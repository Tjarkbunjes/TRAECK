#!/usr/bin/env python3
"""
Garmin → Supabase sync script.
Pulls health data from Garmin Connect and upserts into the garmin_health_data table.

Required environment variables:
  GARMIN_EMAIL          - Garmin Connect email
  GARMIN_PASSWORD       - Garmin Connect password
  SUPABASE_URL          - e.g. https://xxxx.supabase.co
  SUPABASE_SERVICE_KEY  - service role key (bypasses RLS for INSERT/UPDATE)
  SUPABASE_USER_ID      - your auth.users UUID in Supabase
"""

import os
import json
import time
import requests
from datetime import date, timedelta

try:
    from garminconnect import Garmin, GarminConnectAuthenticationError
except ImportError:
    print("garminconnect not installed. Run: pip install garminconnect")
    raise


# ── Config ───────────────────────────────────────────────────────────────────

GARMIN_EMAIL = os.environ["GARMIN_EMAIL"]
GARMIN_PASSWORD = os.environ["GARMIN_PASSWORD"]
SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
SUPABASE_USER_ID = os.environ["SUPABASE_USER_ID"]

# Days to backfill on each run (today + previous days)
DAYS_TO_SYNC = 7


# ── Garmin login ─────────────────────────────────────────────────────────────

def garmin_login() -> Garmin:
    client = Garmin(GARMIN_EMAIL, GARMIN_PASSWORD)
    client.login()
    print("Logged in to Garmin Connect.")
    return client


# ── Data helpers ─────────────────────────────────────────────────────────────

def safe_get(fn, *args, retries=3, delay=5):
    """Call a Garmin API function with retries on failure."""
    for attempt in range(retries):
        try:
            return fn(*args)
        except GarminConnectAuthenticationError:
            raise
        except Exception as e:
            if attempt < retries - 1:
                print(f"  Retrying ({attempt + 1}/{retries}): {e}")
                time.sleep(delay * (attempt + 1))
            else:
                print(f"  Failed after {retries} attempts: {e}")
                return None


def extract_steps(data) -> dict:
    if not data:
        return {}
    if isinstance(data, list):
        total = sum(d.get("steps", 0) or 0 for d in data)
        goal = data[0].get("stepGoal") if data else None
        return {"steps": total, "step_goal": goal}
    return {
        "steps": data.get("totalSteps"),
        "step_goal": data.get("dailyStepGoal"),
    }


def extract_heart_rate(data) -> dict:
    if not data:
        return {}
    raw_values = data.get("heartRateValues") or []
    cleaned = [
        {"t": int(v[0]), "hr": int(v[1])}
        for v in raw_values
        if isinstance(v, list) and len(v) == 2 and v[1] is not None and v[1] > 0
    ]
    return {
        "resting_hr": data.get("restingHeartRate"),
        "avg_hr": data.get("averageHeartRate"),
        "max_hr": data.get("maxHeartRate"),
        "hr_values": cleaned if cleaned else None,
    }


def extract_sleep(data) -> dict:
    if not data:
        return {}
    # garminconnect returns daily sleep summary under dailySleepDTO
    dto = data.get("dailySleepDTO") or data
    score = None
    if "sleepScores" in dto:
        score = (dto["sleepScores"] or {}).get("overall", {}).get("value")
    elif "averageSpO2Value" in dto:
        pass  # older API, no score
    sleep_seconds = dto.get("sleepTimeSeconds")
    return {
        "sleep_score": int(score) if score is not None else None,
        "sleep_seconds": sleep_seconds,
    }


def extract_body_battery(data) -> dict:
    if not data:
        return {}
    if isinstance(data, list):
        values = [d.get("charged") or d.get("bodyBatteryLevel", 0) for d in data if d]
        high = max(values) if values else None
        return {"body_battery_high": high}
    return {"body_battery_high": data.get("charged")}


def extract_stress(data) -> dict:
    if not data:
        return {}
    if isinstance(data, list):
        values = [d[1] for d in data if isinstance(d, list) and len(d) > 1 and d[1] is not None and d[1] >= 0]
        avg = int(sum(values) / len(values)) if values else None
        return {"stress_avg": avg}
    return {"stress_avg": data.get("avgStressLevel")}


def extract_stats(data) -> dict:
    if not data:
        return {}
    return {
        "calories_active": data.get("activeKilocalories"),
        "distance_meters": int(data.get("totalDistanceMeters") or 0) or None,
    }


# ── Supabase upsert ───────────────────────────────────────────────────────────

def upsert_to_supabase(row: dict):
    url = f"{SUPABASE_URL}/rest/v1/garmin_health_data"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    resp = requests.post(url, headers=headers, json=row)
    if resp.status_code not in (200, 201):
        print(f"  Supabase error {resp.status_code}: {resp.text}")
    else:
        print(f"  Upserted {row['date']} ✓")


# ── Main sync ─────────────────────────────────────────────────────────────────

def sync_date(client: Garmin, d: date):
    date_str = d.isoformat()
    print(f"\nSyncing {date_str}...")

    row: dict = {
        "user_id": SUPABASE_USER_ID,
        "date": date_str,
    }

    # Steps
    steps_data = safe_get(client.get_steps_data, date_str)
    row.update(extract_steps(steps_data))

    # Heart rate
    hr_data = safe_get(client.get_heart_rates, date_str)
    if hr_data:
        hrv = hr_data.get("heartRateValues") or []
        valid = [v for v in hrv if isinstance(v, list) and len(v) == 2 and v[1] is not None and v[1] > 0]
        print(f"  HR keys: {list(hr_data.keys())}")
        print(f"  heartRateValues total: {len(hrv)}, valid (>0): {len(valid)}, sample: {hrv[:3]}")
    row.update(extract_heart_rate(hr_data))

    # Sleep (yesterday's sleep shows on today's date in Garmin)
    sleep_data = safe_get(client.get_sleep_data, date_str)
    row.update(extract_sleep(sleep_data))

    # Body battery
    bb_data = safe_get(client.get_body_battery, date_str, date_str)
    row.update(extract_body_battery(bb_data))

    # Stress
    stress_data = safe_get(client.get_stress_data, date_str)
    row.update(extract_stress(stress_data))

    # Daily stats summary
    stats_data = safe_get(client.get_stats, date_str)
    row.update(extract_stats(stats_data))

    # Remove None values to avoid overwriting existing data with nulls
    row = {k: v for k, v in row.items() if v is not None or k in ("user_id", "date")}

    # Cast floats to int for integer columns (exclude jsonb fields)
    int_cols = {"steps", "step_goal", "resting_hr", "avg_hr", "max_hr",
                "sleep_score", "sleep_seconds", "body_battery_high",
                "stress_avg", "calories_active", "distance_meters"}
    row = {k: int(v) if k in int_cols and isinstance(v, float) else v for k, v in row.items()}
    # hr_values is a list → send as-is (Supabase jsonb accepts Python list)
    # already excluded from int_cols above

    upsert_to_supabase(row)


def main():
    print("Starting Garmin sync...")
    client = garmin_login()

    today = date.today()
    for i in range(DAYS_TO_SYNC):
        sync_date(client, today - timedelta(days=i))
        time.sleep(1)  # be gentle with the API

    print("\nSync complete.")


if __name__ == "__main__":
    main()
