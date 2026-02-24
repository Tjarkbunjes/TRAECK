# TRÆCK

A full-featured fitness tracking Progressive Web App (PWA) with iOS support via Capacitor. Built with Next.js, Supabase, and Tailwind CSS.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TRÆCK – PWA / iOS App                        │
│                                                                     │
│  ┌───────────────────── Next.js (Static Export) ──────────────────┐ │
│  │                                                                 │ │
│  │  app/layout.tsx ── BottomNav (5 tabs) + PWAInstall + Toaster   │ │
│  │                                                                 │ │
│  │  Pages (App Router)                                             │ │
│  │  ┌────────────┐  ┌──────────────────────────────────────────┐  │ │
│  │  │     /      │  │  /food          /food/add   /food/scan   │  │ │
│  │  │  Dashboard │  │  Food Diary     Add Entry   Barcode Scan │  │ │
│  │  └────────────┘  │  /food/meals                             │  │ │
│  │                  │  Meal Templates                          │  │ │
│  │                  └──────────────────────────────────────────┘  │ │
│  │                                                                 │ │
│  │  ┌───────────────────────────────────────────────────────────┐ │ │
│  │  │  /workout       /workout/active    /workout/edit          │ │ │
│  │  │  Workout Hub    Active Session     Edit Finished Session  │ │ │
│  │  │  /workout/templates                                       │ │ │
│  │  └───────────────────────────────────────────────────────────┘ │ │
│  │                                                                 │ │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────────────────┐ │ │
│  │  │ /analytics │  │ /friends   │  │ /profile                 │ │ │
│  │  │ Charts &   │  │ Social     │  │ Goals & Settings         │ │ │
│  │  │ Progression│  │ Dashboard  │  └──────────────────────────┘ │ │
│  │  └────────────┘  └────────────┘                               │ │
│  │                                                                 │ │
│  │  /auth/login   /auth/signup   /auth/callback                   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─────────────── lib/ (shared logic) ───────────────────────────┐ │
│  │  hooks.ts          – 12 React data hooks (Supabase queries)   │ │
│  │  supabase.ts       – Supabase client singleton                │ │
│  │  types.ts          – All TypeScript interfaces & constants    │ │
│  │  exercises.ts      – Static exercise database (~160 entries)  │ │
│  │  food-api.ts       – Open Food Facts search + barcode lookup  │ │
│  │  muscle-mapping.ts – Exercise → SVG muscle highlight map      │ │
│  │  db.ts             – Dexie IndexedDB (recent foods cache)     │ │
│  │  default-templates.ts – Push / Pull / Leg day defaults        │ │
│  │  admin.ts          – Admin email guard                        │ │
│  │  utils.ts          – cn() Tailwind class merge                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─────────────── components/ ───────────────────────────────────┐ │
│  │  Feature:  MacroRings, WeightChart, CalorieChart, MuscleMap   │ │
│  │            MuscleRadarChart, ExerciseProgressionChart         │ │
│  │            BarcodeScanner, WorkoutSetRow, FoodEntryCard       │ │
│  │            PWAInstall, BottomNav, DecimalInput                │ │
│  │  SVG:      muscle-svg/FrontBody, muscle-svg/BackBody          │ │
│  │  UI:       shadcn/ui (Radix UI primitives)                    │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │
                   ┌──────────▼──────────┐
                   │      Supabase        │
                   │  ┌───────────────┐  │
                   │  │  PostgreSQL   │  │
                   │  │  (RLS on all) │  │
                   │  ├───────────────┤  │
                   │  │ profiles      │  │
                   │  │ food_entries  │  │
                   │  │ food_favorites│  │
                   │  │ meal_templates│  │
                   │  │ workouts      │  │
                   │  │ workout_sets  │  │
                   │  │ workout_exs   │  │
                   │  │ wkt_templates │  │
                   │  │ weight_entries│  │
                   │  │ friendships   │  │
                   │  ├───────────────┤  │
                   │  │ Auth (JWT)    │  │
                   │  ├───────────────┤  │
                   │  │ SQL RPCs      │  │
                   │  │ (DEFINER)     │  │
                   │  └───────────────┘  │
                   └─────────────────────┘
                              │
             ┌────────────────▼────────────────┐
             │        External APIs             │
             │  Open Food Facts (REST)          │
             │  world.openfoodfacts.org         │
             └─────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (React 19) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui (Radix UI primitives) |
| Icons | Lucide React |
| Backend / Auth / DB | Supabase (PostgreSQL + Auth + RLS) |
| Charts | Recharts 3 |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Local DB | Dexie (IndexedDB) |
| Date utilities | date-fns 4 |
| Barcode scanning | BarcodeDetector WASM polyfill |
| Food data API | Open Food Facts |
| PWA / Native | Service Worker + Capacitor iOS |
| Build output | Static export |

---

## Project Structure

```
fittrack/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout, nav, fonts
│   ├── page.tsx                  # Dashboard (home)
│   ├── auth/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── callback/page.tsx
│   ├── food/
│   │   ├── page.tsx              # Food diary
│   │   ├── add/page.tsx          # Add / edit food entry
│   │   ├── scan/page.tsx         # Barcode scanner
│   │   └── meals/page.tsx        # Meal templates
│   ├── workout/
│   │   ├── page.tsx              # Workout hub & history
│   │   ├── active/page.tsx       # Active workout session
│   │   ├── edit/page.tsx         # Edit finished workout
│   │   └── templates/page.tsx    # Template editor
│   ├── analytics/page.tsx        # Charts & progression
│   ├── friends/page.tsx          # Social / friends
│   └── profile/page.tsx          # Settings & goals
├── components/
│   ├── ui/                       # shadcn/ui primitives
│   ├── muscle-svg/               # Front & back body SVGs
│   ├── MacroRings.tsx            # Calorie ring + macro bars
│   ├── WeightChart.tsx           # Weight trend chart
│   ├── CalorieChart.tsx          # Calorie bar chart
│   ├── MuscleRadarChart.tsx      # Muscle volume radar
│   ├── ExerciseProgressionChart.tsx
│   ├── BarcodeScanner.tsx        # Camera + WASM detection
│   ├── BottomNav.tsx             # 5-tab navigation bar
│   ├── WorkoutSetRow.tsx         # Set input row
│   └── FoodEntryCard.tsx         # Food log entry card
├── lib/
│   ├── hooks.ts                  # All Supabase data hooks
│   ├── types.ts                  # TypeScript interfaces
│   ├── supabase.ts               # Supabase client
│   ├── food-api.ts               # Open Food Facts API
│   ├── exercises.ts              # ~160 exercises static DB
│   ├── muscle-mapping.ts         # Exercise → SVG mapping
│   ├── db.ts                     # Dexie IndexedDB
│   ├── default-templates.ts      # Push/Pull/Leg templates
│   ├── admin.ts                  # Admin guard
│   └── utils.ts                  # cn() helper
├── supabase/                     # SQL migrations
│   ├── migration_friends_all.sql
│   ├── migration_workout_exercises.sql
│   ├── migration_admin_templates.sql
│   └── seed_default_templates.sql
├── public/                       # Static assets, icons, manifest
├── next.config.ts
├── capacitor.config.ts
└── package.json
```

---

## Database Schema

```
┌──────────────────┐     ┌──────────────────────┐
│    profiles      │     │    food_entries       │
│──────────────────│     │──────────────────────│
│ id (UUID) PK     │────<│ user_id (FK)         │
│ display_name     │     │ date                 │
│ email            │     │ meal_type            │
│ calorie_goal     │     │ food_name            │
│ protein_goal     │     │ barcode              │
│ carbs_goal       │     │ serving_grams        │
│ fat_goal         │     │ calories             │
│ target_weight    │     │ protein / carbs / fat│
└──────────┬───────┘     │ sugar / saturated_fat│
           │             └──────────────────────┘
           │
           │             ┌──────────────────────┐
           ├────────────<│      workouts        │
           │             │──────────────────────│
           │             │ id (UUID) PK         │
           │             │ user_id (FK)         │
           │             │ date, name           │
           │             │ started_at           │
           │             │ finished_at          │
           │             └──────────┬───────────┘
           │                        │
           │             ┌──────────▼───────────┐
           │             │    workout_sets       │
           │             │──────────────────────│
           │             │ workout_id (FK)      │
           │             │ exercise_name        │
           │             │ muscle_group         │
           │             │ set_number           │
           │             │ weight_kg / reps     │
           │             └──────────────────────┘
           │
           │             ┌──────────────────────┐
           ├────────────<│   weight_entries     │
           │             │──────────────────────│
           │             │ user_id (FK)         │
           │             │ date, weight_kg      │
           │             │ body_fat_pct         │
           │             └──────────────────────┘
           │
           │             ┌──────────────────────┐
           └────────────<│    friendships       │
                         │──────────────────────│
                         │ requester_id (FK)    │
                         │ addressee_id (FK)    │
                         │ status               │
                         │ requester_nickname   │
                         │ addressee_nickname   │
                         └──────────────────────┘
```

---

## Features

### Dashboard
- Daily macro ring showing calories remaining / over goal
- Quick-add buttons (food, workout, weight)
- Weekly consistency grid — nutrition, training, weight for Mon–Sun with week pagination

### Food Diary
- Per-day log grouped by meal type (breakfast / lunch / dinner / snack)
- Full CRUD, macro summary with sugar and saturated fat subtotals
- Saved meal templates for one-tap logging

### Food Search & Barcode Scanner
- Open Food Facts full-text search with fallback mirrors
- Camera barcode scanning (WASM BarcodeDetector, EAN-13/8, UPC-A/E)
- Manual macro entry per 100 g with live serving calculation
- Favourites and recent foods history

### Workout Logging
- Exercise blocks with set rows (weight + reps + RPE)
- Drag-to-reorder exercises (dnd-kit)
- Last-session reference visible per exercise

### Workout Templates
- User-defined templates
- TRAECK system defaults (Push / Pull / Leg day, admin-managed)

### Analytics
- Time range: 7 d / 30 d / 90 d / 1 y
- Weight trend chart + avg and change stats
- Calorie bar chart + macro average bars
- Muscle volume radar chart (sets or reps per group)
- Per-exercise progression charts (max weight / estimated 1RM)

### Social / Friends
- Add friends by email, accept / decline requests
- Friend dashboard: workout heatmap, weight chart, weekly stats
- Per-user custom nicknames
- Friend data served via Supabase SECURITY DEFINER RPCs

### PWA & iOS
- Service worker, install prompt banner, Apple Web App meta tags
- Capacitor iOS build (`npm run build:ios`)

---

## Data Flow

```
User action
     │
     ▼
Next.js page / component
     │
     ├── lib/hooks.ts ──────────────────► Supabase PostgreSQL
     │   (useProfile, useFoodEntries,       (RLS enforced)
     │    useWorkouts, useAnalytics…)
     │
     ├── lib/food-api.ts ────────────────► Open Food Facts REST
     │   (searchFood, lookupBarcode)
     │
     └── lib/db.ts ──────────────────────► Dexie IndexedDB
         (recent foods cache)
```

---

## Hooks Reference

| Hook | Returns | Source |
|---|---|---|
| `useProfile` | profile, loading, update | Supabase profiles |
| `useAuth` | user, loading | Supabase Auth |
| `useFoodEntries(date)` | entries, add, remove, update | Supabase food_entries |
| `useWeightEntries` | entries, add, remove | Supabase weight_entries |
| `useWorkouts` | workouts, create, finish | Supabase workouts |
| `useAnalyticsWorkouts(range)` | workouts with sets | Supabase join |
| `useAnalyticsFood(range)` | daily aggregates | Supabase food_entries |
| `useLastSets(exercise)` | last session sets | Supabase workout_sets |
| `useFriends` | friends, remove | Supabase friendships RPC |
| `useFriendRequests` | pending, accept, decline | Supabase friendships |
| `useFriendWorkouts(id)` | heatmap data | Supabase RPC |
| `useFriendWeight(id)` | weight entries | Supabase RPC |

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project

### Setup

```bash
# Install dependencies
npm install

# Set environment variables
# Create .env.local with:
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Run database migrations in Supabase SQL editor:
# supabase/migration_friends_all.sql
# supabase/migration_workout_exercises.sql
# supabase/migration_admin_templates.sql
# supabase/seed_default_templates.sql

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### iOS Build (Capacitor)

```bash
npm run build        # Static export → /out
npx cap sync ios     # Sync to Capacitor iOS project
npx cap open ios     # Open in Xcode
```

### Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon public key |
