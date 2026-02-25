#!/usr/bin/env node
/**
 * Import LzO credit card CSV into Supabase credit_card_transactions table.
 *
 * Usage:
 *   node scripts/import-csv.mjs <path-to-csv> <your-supabase-user-id>
 *
 * Example:
 *   node scripts/import-csv.mjs ~/Downloads/kreditkarte.csv 12345678-abcd-1234-abcd-1234567890ab
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://eelmaevvsjnelmxqlcwy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_i7a0P6IBwS-jq10w2yEhEA_2coIgh-H';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Parse args ──
const csvPath = process.argv[2];
const userId = process.argv[3];

if (!csvPath || !userId) {
  console.error('Usage: node scripts/import-csv.mjs <csv-path> <user-id>');
  console.error('  user-id: your Supabase auth user ID (find it in Supabase Dashboard → Auth → Users)');
  process.exit(1);
}

// ── Parse date DD.MM.YY → YYYY-MM-DD ──
function parseDate(raw) {
  const parts = raw.trim().split('.');
  if (parts.length !== 3) return null;
  const [dd, mm, yy] = parts;
  const year = parseInt(yy) < 50 ? `20${yy}` : `19${yy}`;
  return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

// ── Parse CSV ──
// LzO Kreditkarten-CSV: semicolon-separated, quoted fields
// Columns: Umsatz getätigt von; Belegdatum; Buchungsdatum; Originalbetrag;
//          Originalwährung; Umrechnungskurs; Buchungsbetrag; Buchungswährung;
//          Transaktionsbeschreibung; Transaktionsbeschreibung Zusatz; Buchungsreferenz; ...
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) {
    console.error('CSV has no data rows.');
    process.exit(1);
  }

  const header = lines[0].split(';').map(h => h.trim().replace(/^"/g, '').replace(/"/g, ''));
  console.log('CSV columns:', header);

  // Find column indices
  const colMap = {};
  for (let i = 0; i < header.length; i++) {
    const h = header[i].toLowerCase();
    if (h.includes('belegdatum')) colMap.transactionDate = i;
    else if (h.includes('buchungsdatum')) colMap.bookingDate = i;
    else if (h.includes('buchungsbetrag')) colMap.amount = i;
    else if (h.includes('buchungsw')) colMap.currency = i;
    else if (h === 'transaktionsbeschreibung' || (h.includes('transaktionsbeschreibung') && !h.includes('zusatz'))) colMap.merchant = i;
    else if (h.includes('buchungsreferenz')) colMap.reference = i;
  }

  // Fallback: if Buchungsbetrag not found, try Originalbetrag
  if (colMap.amount === undefined) {
    for (let i = 0; i < header.length; i++) {
      if (header[i].toLowerCase().includes('originalbetrag')) { colMap.amount = i; break; }
    }
  }
  // Fallback: first "beschreibung" column for merchant
  if (colMap.merchant === undefined) {
    for (let i = 0; i < header.length; i++) {
      if (header[i].toLowerCase().includes('beschreibung')) { colMap.merchant = i; break; }
    }
  }

  console.log('Column mapping:', colMap);

  if (colMap.transactionDate === undefined || colMap.amount === undefined || colMap.merchant === undefined) {
    console.error('Could not find required columns.');
    console.error('Available columns:', header);
    process.exit(1);
  }

  const rows = [];
  let skippedPositive = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';').map(c => c.trim().replace(/^"/g, '').replace(/"/g, ''));
    if (cols.length < 3) continue;

    const transactionDate = parseDate(cols[colMap.transactionDate]);
    const bookingDate = colMap.bookingDate !== undefined ? parseDate(cols[colMap.bookingDate]) : transactionDate;

    // Buchungsbetrag: negative = expense, positive = payment/Einzug
    const rawAmount = cols[colMap.amount]?.replace(',', '.') || '0';
    const parsedAmount = parseFloat(rawAmount);

    const currency = colMap.currency !== undefined ? cols[colMap.currency] || 'EUR' : 'EUR';
    const merchant = cols[colMap.merchant] || '';
    const reference = colMap.reference !== undefined ? cols[colMap.reference] || null : null;

    if (!transactionDate || isNaN(parsedAmount)) continue;

    // Skip positive amounts (payment entries like "Einzug des Rechnungsbetrages")
    if (parsedAmount >= 0) {
      skippedPositive++;
      continue;
    }

    // Store as positive (expenses)
    const amount = Math.abs(parsedAmount);

    rows.push({
      user_id: userId,
      transaction_date: transactionDate,
      booking_date: bookingDate,
      amount,
      currency,
      merchant,
      description: merchant,
      booking_reference: reference,
      category: null,
    });
  }

  if (skippedPositive > 0) {
    console.log(`Skipped ${skippedPositive} non-expense entries (payments/credits).`);
  }

  return rows;
}

// ── Main ──
const csvText = readFileSync(csvPath, 'utf-8');
const rows = parseCSV(csvText);

console.log(`\nParsed ${rows.length} transactions.`);
if (rows.length > 0) {
  console.log('First row:', rows[0]);
  console.log('Last row:', rows[rows.length - 1]);
}

if (rows.length === 0) {
  console.log('No rows to import.');
  process.exit(0);
}

// Insert in batches of 100
const BATCH_SIZE = 100;
let inserted = 0;
let skipped = 0;

for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  const { data, error } = await supabase
    .from('credit_card_transactions')
    .upsert(batch, { onConflict: 'user_id,booking_reference', ignoreDuplicates: true });

  if (error) {
    console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
    skipped += batch.length;
  } else {
    inserted += batch.length;
  }
}

console.log(`\nDone! Inserted: ${inserted}, Skipped/Errors: ${skipped}`);
