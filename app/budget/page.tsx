'use client';

import { useState, useMemo } from 'react';
import { format, subMonths, addMonths, parseISO, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { useAuth, useTransactions, useMonthlyBudget } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { SPENDING_CATEGORIES } from '@/lib/types';
import type { CreditCardTransaction } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Pencil, Check, X, Loader2, Sparkles, Search, Upload } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { toast } from 'sonner';
import { useRef } from 'react';

type SpendingView = 'D' | 'W' | 'M';

// ── CSV Parser for LzO credit card exports ──
function parseLzODate(raw: string): string | null {
  const parts = raw.trim().split('.');
  if (parts.length !== 3) return null;
  const [dd, mm, yy] = parts;
  const year = parseInt(yy) < 50 ? `20${yy}` : `19${yy}`;
  return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function parseLzOCSV(text: string, userId: string) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0].split(';').map(h => h.trim().replace(/^"/g, '').replace(/"$/g, ''));

  // Map columns by name
  // CSV: "Umsatz getätigt von";"Belegdatum";"Buchungsdatum";"Originalbetrag";"Originalwährung";
  //      "Umrechnungskurs";"Buchungsbetrag";"Buchungswährung";"Transaktionsbeschreibung";
  //      "Transaktionsbeschreibung Zusatz";"Buchungsreferenz";...
  const colMap: Record<string, number> = {};
  for (let i = 0; i < header.length; i++) {
    const h = header[i].toLowerCase().replace(/[äöü]/g, m =>
      ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[m] || m)
    );
    if (h.includes('belegdatum')) colMap.transactionDate = i;
    else if (h.includes('buchungsdatum')) colMap.bookingDate = i;
    else if (h.includes('buchungsbetrag')) colMap.amount = i;
    else if (h.includes('buchungswaehrung') || h.includes('buchungsw')) colMap.currency = i;
    else if (h === 'transaktionsbeschreibung' || h.includes('transaktionsbeschreibung') && !h.includes('zusatz')) colMap.merchant = i;
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

  if (colMap.transactionDate === undefined || colMap.amount === undefined || colMap.merchant === undefined) {
    return [];
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';').map(c => c.trim().replace(/^"/g, '').replace(/"/g, ''));
    if (cols.length < 3) continue;

    const transactionDate = parseLzODate(cols[colMap.transactionDate]);
    const bookingDate = colMap.bookingDate !== undefined ? parseLzODate(cols[colMap.bookingDate]) : transactionDate;
    const rawAmount = cols[colMap.amount]?.replace(',', '.') || '0';
    const parsedAmount = parseFloat(rawAmount);
    const currency = colMap.currency !== undefined ? cols[colMap.currency] || 'EUR' : 'EUR';
    const merchant = cols[colMap.merchant] || '';
    const reference = colMap.reference !== undefined ? cols[colMap.reference] || null : null;

    if (!transactionDate || isNaN(parsedAmount)) continue;

    // Skip zero amounts and payment entries (positive = "Einzug des Rechnungsbetrages")
    if (parsedAmount >= 0) continue;

    // Store as positive value (expenses)
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

  return rows;
}

export default function BudgetPage() {
  const { user } = useAuth();
  const [monthDate, setMonthDate] = useState(new Date());
  const month = format(monthDate, 'yyyy-MM');

  const { transactions, loading: txLoading, refresh } = useTransactions(month);
  const { budget, loading: budgetLoading, saveBudget } = useMonthlyBudget(month);

  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [spendingView, setSpendingView] = useState<SpendingView>('D');
  const [categorizing, setCategorizing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedBar, setSelectedBar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Only expenses (positive amounts = expenses stored as absolute values)
  const expenses = useMemo(() => transactions.filter(t => t.amount > 0), [transactions]);

  const totalSpent = useMemo(
    () => expenses.reduce((s, t) => s + t.amount, 0),
    [expenses]
  );

  const budgetAmount = budget?.budget_amount ?? 0;
  const remaining = budgetAmount - totalSpent;
  const spentPct = budgetAmount > 0 ? Math.min((totalSpent / budgetAmount) * 100, 100) : 0;

  // ── Daily spending data ──
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const budgetPerDay = budgetAmount > 0 ? Math.round((budgetAmount / daysInMonth) * 100) / 100 : 0;

  const dailySpending = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of expenses) {
      const day = t.transaction_date;
      map.set(day, (map.get(day) || 0) + t.amount);
    }
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = format(new Date(monthDate.getFullYear(), monthDate.getMonth(), i + 1), 'yyyy-MM-dd');
      return {
        label: String(i + 1),
        date: day,
        amount: Math.round((map.get(day) || 0) * 100) / 100,
      };
    });
  }, [expenses, monthDate, daysInMonth]);

  // ── Weekly spending data ──
  const weeklySpending = useMemo(() => {
    const weeks: { weekStart: Date; weekEnd: Date; amount: number }[] = [];
    const map = new Map<number, { start: Date; end: Date; amount: number }>();
    for (const t of expenses) {
      const d = parseISO(t.transaction_date);
      const ws = startOfWeek(d, { weekStartsOn: 1 });
      const we = endOfWeek(d, { weekStartsOn: 1 });
      const key = ws.getTime();
      const existing = map.get(key);
      if (existing) {
        existing.amount += t.amount;
      } else {
        map.set(key, { start: ws, end: we, amount: t.amount });
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, { start, end, amount }], i) => ({
        label: `W${i + 1}`,
        dateFrom: format(start, 'yyyy-MM-dd'),
        dateTo: format(end, 'yyyy-MM-dd'),
        amount: Math.round(amount * 100) / 100,
      }));
  }, [expenses]);

  // ── Monthly view (same as daily) ──
  const chartData = spendingView === 'D' ? dailySpending : spendingView === 'W' ? weeklySpending : dailySpending;
  const chartKPI = spendingView === 'D'
    ? (dailySpending.filter(d => d.amount > 0).length > 0
      ? Math.round(totalSpent / dailySpending.filter(d => d.amount > 0).length * 100) / 100
      : 0)
    : spendingView === 'W'
    ? (weeklySpending.length > 0 ? Math.round(totalSpent / weeklySpending.length * 100) / 100 : 0)
    : totalSpent;
  const chartKPILabel = spendingView === 'D' ? 'avg/day' : spendingView === 'W' ? 'avg/week' : 'total';

  // ── Category breakdown ──
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of expenses) {
      const cat = t.category || 'uncategorized';
      map.set(cat, (map.get(cat) || 0) + t.amount);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({
        category,
        amount: Math.round(amount * 100) / 100,
        pct: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
      }));
  }, [expenses, totalSpent]);

  const maxCatAmount = categoryBreakdown.length > 0 ? categoryBreakdown[0].amount : 1;

  // ── Uncategorized count ──
  const uncategorizedCount = expenses.filter(t => !t.category).length;

  // ── Bar click handler ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleBarClick(data: any, index: number) {
    if (spendingView === 'D') {
      const day = dailySpending[index]?.date;
      if (!day) return;
      setSelectedBar(prev => prev === day ? null : day);
    } else if (spendingView === 'W') {
      const week = weeklySpending[index];
      if (!week) return;
      const key = `${week.dateFrom}|${week.dateTo}`;
      setSelectedBar(prev => prev === key ? null : key);
    } else {
      // M view uses same data as D
      const day = dailySpending[index]?.date;
      if (!day) return;
      setSelectedBar(prev => prev === day ? null : day);
    }
  }

  // Clear bar selection when switching views
  const handleViewChange = (v: SpendingView) => {
    setSpendingView(v);
    setSelectedBar(null);
  };

  // ── Filtered transactions ──
  const filteredTransactions = useMemo(() => {
    let result = transactions;

    // Filter by selected bar
    if (selectedBar) {
      if (selectedBar.includes('|')) {
        // Week range: "dateFrom|dateTo"
        const [from, to] = selectedBar.split('|');
        result = result.filter(t => t.transaction_date >= from && t.transaction_date <= to);
      } else {
        // Single day
        result = result.filter(t => t.transaction_date === selectedBar);
      }
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.merchant.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q))
      );
    }

    return result;
  }, [transactions, search, selectedBar]);

  // ── Save budget ──
  function handleSaveBudget() {
    const val = parseFloat(budgetInput);
    if (isNaN(val) || val <= 0) {
      toast.error('please enter a valid amount.');
      return;
    }
    saveBudget(val);
    setEditingBudget(false);
  }

  // ── AI Categorize ──
  async function handleCategorize() {
    const uncategorized = expenses.filter(t => !t.category);
    if (uncategorized.length === 0) {
      toast.info('all transactions are already categorized.');
      return;
    }

    setCategorizing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('not authenticated.');
        setCategorizing(false);
        return;
      }

      const res = await supabase.functions.invoke('categorize-transactions', {
        body: {
          transactions: uncategorized.map(t => ({
            id: t.id,
            merchant: t.merchant,
            description: t.description,
          })),
        },
      });

      if (res.error) {
        toast.error('categorization failed.');
      } else {
        toast.success(`categorized ${uncategorized.length} transactions.`);
        refresh();
      }
    } catch {
      toast.error('categorization failed.');
    }
    setCategorizing(false);
  }

  // ── CSV Import ──
  async function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseLzOCSV(text, user.id);

      if (rows.length === 0) {
        toast.error('no valid transactions found in CSV.');
        setImporting(false);
        return;
      }

      // Insert in batches of 100, upsert to skip duplicates
      const BATCH_SIZE = 100;
      let inserted = 0;
      let errors = 0;

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('credit_card_transactions')
          .upsert(batch, { onConflict: 'user_id,booking_reference', ignoreDuplicates: true });

        if (error) {
          console.error('Batch error:', error.message);
          errors += batch.length;
        } else {
          inserted += batch.length;
        }
      }

      if (errors > 0) {
        toast.success(`imported ${inserted} transactions (${errors} skipped/errors).`);
      } else {
        toast.success(`imported ${inserted} transactions.`);
      }
      refresh();
    } catch (err) {
      console.error('CSV import error:', err);
      toast.error('failed to parse CSV.');
    }
    setImporting(false);
    // Reset file input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md p-4 flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">please sign in to view budget.</p>
      </div>
    );
  }

  const chartTooltipStyle = { backgroundColor: '#0F0F0F', border: '1px solid #292929', borderRadius: 6, fontSize: 12 };

  return (
    <div className="mx-auto max-w-md p-4 pb-24 space-y-4">
      {/* Header + Month Navigator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">budget</h1>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleCSVImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md border border-[#292929] hover:border-[#444]"
          >
            {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            csv
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonthDate(subMonths(monthDate, 1))}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium min-w-[90px] text-center">
            {format(monthDate, 'MMM yyyy')}
          </span>
          <button
            onClick={() => setMonthDate(addMonths(monthDate, 1))}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {(txLoading || budgetLoading) && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!txLoading && !budgetLoading && (
        <>
          {/* Budget Overview */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">monthly budget</p>
                {!editingBudget ? (
                  <button
                    onClick={() => { setEditingBudget(true); setBudgetInput(String(budgetAmount || '')); }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    {budgetAmount > 0 ? 'edit' : 'set budget'}
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                      className="h-7 w-24 text-sm"
                      placeholder="EUR"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveBudget()}
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveBudget}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingBudget(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {budgetAmount > 0 ? (
                <>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold font-mono">
                        {remaining >= 0 ? remaining.toFixed(0) : remaining.toFixed(0)}
                        <span className="text-sm font-normal text-muted-foreground ml-1">EUR</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">remaining</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold font-mono">
                        {Math.round(100 - spentPct)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {totalSpent.toFixed(0)} / {budgetAmount.toFixed(0)}
                      </p>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#1E1E1E] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${spentPct}%`,
                        backgroundColor: spentPct > 90 ? '#EF4444' : spentPct > 70 ? '#F59E0B' : '#22C55E',
                      }}
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {totalSpent > 0
                    ? `${totalSpent.toFixed(2)} EUR spent this month. set a budget to track progress.`
                    : 'no data yet. set a budget to get started.'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Spending Chart (D/W/M) */}
          {expenses.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold font-mono">{chartKPI.toFixed(0)}<span className="text-sm font-normal text-muted-foreground ml-1">EUR</span></p>
                    <p className="text-[10px] text-muted-foreground">{chartKPILabel}</p>
                  </div>
                  <div className="flex rounded-md border border-[#292929] overflow-hidden">
                    {(['D', 'W', 'M'] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => handleViewChange(v)}
                        className={`px-2.5 py-1 text-xs transition-colors ${spendingView === v ? 'bg-[#2626FF] text-white' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#d4d4d4', fontSize: 9 }}
                      tickLine={false}
                      axisLine={false}
                      interval={spendingView === 'D' ? 4 : 'preserveStartEnd'}
                    />
                    <YAxis tick={{ fill: '#d4d4d4', fontSize: 9 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={false}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.[0]) return null;
                        const val = payload[0].value as number;
                        return (
                          <div style={{ backgroundColor: '#0F0F0F', border: '1px solid #292929', borderRadius: 6, padding: '6px 10px' }}>
                            <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>{val.toFixed(2)} EUR</p>
                            <p style={{ color: '#888', fontSize: 10 }}>{spendingView === 'D' ? `day ${label}` : label}</p>
                          </div>
                        );
                      }}
                    />
                    {budgetPerDay > 0 && (
                      <ReferenceLine
                        y={spendingView === 'W' ? budgetPerDay * 7 : budgetPerDay}
                        stroke="#888"
                        strokeDasharray="4 4"
                        strokeWidth={1}
                        label={undefined}
                      />
                    )}
                    <Bar
                      dataKey="amount"
                      fill="#2626FF"
                      radius={[2, 2, 0, 0]}
                      activeBar={{ fill: '#4a4aFF' }}
                      onClick={handleBarClick}
                      cursor="pointer"
                      shape={(props: any) => {
                        const { x, y, width, height, index } = props;
                        let isSelected = false;
                        if (selectedBar) {
                          if (spendingView === 'W') {
                            const week = weeklySpending[index];
                            isSelected = week ? selectedBar === `${week.dateFrom}|${week.dateTo}` : false;
                          } else {
                            const day = dailySpending[index];
                            isSelected = day ? selectedBar === day.date : false;
                          }
                        }
                        return (
                          <rect
                            x={x}
                            y={y}
                            width={width}
                            height={height}
                            fill={isSelected ? '#6a6aFF' : '#2626FF'}
                            rx={2}
                            ry={2}
                          />
                        );
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 pt-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-2 rounded-sm bg-[#2626FF]" />
                    <span className="text-[10px] text-muted-foreground">spending</span>
                  </div>
                  {budgetPerDay > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 border-t border-dashed border-[#888]" />
                      <span className="text-[10px] text-muted-foreground">
                        budget ({Math.round(spendingView === 'W' ? budgetPerDay * 7 : budgetPerDay)} €/{spendingView === 'W' ? 'week' : 'day'})
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Category Breakdown */}
          {categoryBreakdown.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground">categories</p>
                {categoryBreakdown.map(({ category, amount, pct }) => {
                  const catInfo = SPENDING_CATEGORIES[category];
                  const label = catInfo?.label || category;
                  const color = catInfo?.color || '#6B7280';
                  const barPct = maxCatAmount > 0 ? (amount / maxCatAmount) * 100 : 0;

                  return (
                    <div key={category} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span style={{ color }}>{label}</span>
                        <span className="font-mono">{amount.toFixed(0)} EUR · {pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#1E1E1E] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${barPct}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* AI Categorize Button */}
          {uncategorizedCount > 0 && (
            <Button
              onClick={handleCategorize}
              disabled={categorizing}
              className="w-full bg-[#2626FF] hover:bg-[#1e1ecc]"
            >
              {categorizing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              categorize {uncategorizedCount} transactions
            </Button>
          )}

          {/* Transaction List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                transactions ({filteredTransactions.length}{selectedBar ? ` of ${transactions.length}` : ''})
              </p>
              {selectedBar && (
                <button
                  onClick={() => setSelectedBar(null)}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                  clear filter
                </button>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <div className="space-y-1">
              {filteredTransactions.map((t) => {
                const catInfo = t.category ? SPENDING_CATEGORIES[t.category] : null;
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#1E1E1E] border border-[#292929]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.merchant}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {format(parseISO(t.transaction_date), 'dd.MM')}
                        </span>
                        {catInfo ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0"
                            style={{ backgroundColor: catInfo.color + '20', color: catInfo.color }}
                          >
                            {catInfo.label}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 opacity-40">
                            uncategorized
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className={`text-sm font-mono font-medium shrink-0 ml-2 ${t.amount > 0 ? 'text-white' : 'text-green-500'}`}>
                      {t.amount > 0 ? '-' : '+'}{Math.abs(t.amount).toFixed(2)}
                    </p>
                  </div>
                );
              })}

              {filteredTransactions.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-8">
                  {search ? 'no matching transactions.' : 'no transactions this month.'}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
