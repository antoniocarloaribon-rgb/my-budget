/**
 * Finance engine — every formula the app uses lives here as a plain function,
 * so it can be tested without any screens or database.
 *
 * Mirrors the reference workbook:
 *   Available            = Actual income − Actual expenses
 *   Planned allocation   = Available × goal %
 *   Closing balance      = Opening balance + Actual deposits
 *   Next month opening   = This month closing
 *   Unallocated cash     = Available − Actual deposits
 *
 * Money is added up in whole centavos to avoid floating-point drift.
 */
import type { AmountMap, Deposit, Goal, MonthKey, MonthPlan, Transaction } from './types';

// ---------- money helpers ----------

export const toCents = (n: number) => Math.round(n * 100);
export const fromCents = (c: number) => c / 100;
export const round2 = (n: number) => fromCents(toCents(n));

export function sum(values: number[]): number {
  return fromCents(values.reduce((acc, v) => acc + toCents(v), 0));
}

export const sumMap = (m: AmountMap) => sum(Object.values(m));

// ---------- month helpers ----------

export const monthOf = (date: string): MonthKey => date.slice(0, 7);

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Inclusive list of months from `start` to `end`. */
export function monthRange(start: MonthKey, end: MonthKey): MonthKey[] {
  const out: MonthKey[] = [];
  for (let m = start; m <= end; m = addMonths(m, 1)) out.push(m);
  return out;
}

export function monthLabel(month: MonthKey, style: 'long' | 'short' = 'long'): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: style,
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// ---------- validation ----------

/** Returns an error message, or null when the amount is a valid positive number. */
export function validateAmount(value: unknown, opts: { allowZero?: boolean } = {}): string | null {
  if (value === '' || value === null || value === undefined) return 'Enter an amount.';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 'Amount must be a number.';
  if (n < 0) return 'Amount cannot be negative.';
  if (n === 0 && !opts.allowZero) return 'Amount must be greater than zero.';
  if (Math.abs(n * 100 - toCents(n)) > 1e-6) return 'Use at most 2 decimal places.';
  if (n > 1e12) return 'Amount is too large.';
  return null;
}

/** Allocation fractions must each be 0–1 and together total exactly 100%. */
export function validateAllocations(allocations: AmountMap): {
  ok: boolean;
  totalPercent: number;
  error: string | null;
} {
  const values = Object.values(allocations);
  const totalPercent = Math.round(values.reduce((a, v) => a + v * 10000, 0)) / 100;
  for (const v of values) {
    if (!Number.isFinite(v)) return { ok: false, totalPercent, error: 'Percentages must be numbers.' };
    if (v < 0) return { ok: false, totalPercent, error: 'Percentages cannot be negative.' };
    if (v > 1) return { ok: false, totalPercent, error: 'A percentage cannot exceed 100%.' };
  }
  if (totalPercent !== 100)
    return { ok: false, totalPercent, error: `Percentages total ${totalPercent}% — they must total 100%.` };
  return { ok: true, totalPercent, error: null };
}

// ---------- monthly formulas ----------

const inMonth = (month: MonthKey) => (r: { date: string }) => monthOf(r.date) === month;

/** 1. Actual income = sum of recorded income transactions for the month. */
export function actualIncome(txs: Transaction[], month: MonthKey): number {
  return sum(txs.filter((t) => t.type === 'income' && monthOf(t.date) === month).map((t) => t.amount));
}

/** 2. Actual expenses = sum of recorded expense transactions for the month. */
export function actualExpenses(txs: Transaction[], month: MonthKey): number {
  return sum(txs.filter((t) => t.type === 'expense' && monthOf(t.date) === month).map((t) => t.amount));
}

/** 3. Available after expenses. */
export const availableAfterExpenses = (income: number, expenses: number) => round2(income - expenses);

/**
 * 4. Planned allocation per goal = available × percentage.
 * When nothing is available (zero or negative) there is nothing to plan, so each goal is ₱0.
 * This is a PLAN only — it is never written as a deposit.
 */
export function plannedAllocations(available: number, allocations: AmountMap): AmountMap {
  const base = Math.max(0, available);
  const out: AmountMap = {};
  for (const [goalId, pct] of Object.entries(allocations)) out[goalId] = round2(base * pct);
  return out;
}

/** 5. Actual deposits per goal in a month (manually recorded only). */
export function depositsByGoal(deposits: Deposit[], month: MonthKey): AmountMap {
  const out: AmountMap = {};
  for (const d of deposits.filter(inMonth(month))) out[d.goalId] = sum([out[d.goalId] ?? 0, d.amount]);
  return out;
}

export interface GoalBalance {
  goalId: string;
  opening: number;
  deposited: number;
  closing: number;
}

/**
 * 6 & 7. Opening = goal's starting balance + all deposits before this month
 * (which equals the previous month's closing). Closing = opening + this month's deposits.
 * Computed on the fly, so editing an old deposit automatically flows forward.
 */
export function goalBalances(goals: Goal[], deposits: Deposit[], month: MonthKey): GoalBalance[] {
  return goals.map((g) => {
    const mine = deposits.filter((d) => d.goalId === g.id);
    const before = mine.filter((d) => monthOf(d.date) < month).map((d) => d.amount);
    const during = mine.filter((d) => monthOf(d.date) === month).map((d) => d.amount);
    const opening = sum([g.openingBalance, ...before]);
    const deposited = sum(during);
    return { goalId: g.id, opening, deposited, closing: sum([opening, deposited]) };
  });
}

/** 8. Unallocated cash = available − actual savings deposits. */
export const unallocatedCash = (available: number, deposited: number) => round2(available - deposited);

/** Expense totals per category for a month. */
export function expensesByCategory(txs: Transaction[], month: MonthKey): AmountMap {
  const out: AmountMap = {};
  for (const t of txs)
    if (t.type === 'expense' && monthOf(t.date) === month && t.categoryId)
      out[t.categoryId] = sum([out[t.categoryId] ?? 0, t.amount]);
  return out;
}

/** Income totals per source for a month. */
export function incomeBySource(txs: Transaction[], month: MonthKey): AmountMap {
  const out: AmountMap = {};
  for (const t of txs)
    if (t.type === 'income' && monthOf(t.date) === month && t.sourceId)
      out[t.sourceId] = sum([out[t.sourceId] ?? 0, t.amount]);
  return out;
}

export interface MonthSummary {
  month: MonthKey;
  expectedIncome: number;
  budgetedExpenses: number;
  expectedAvailable: number;
  actualIncome: number;
  actualExpenses: number;
  available: number;
  planned: AmountMap;
  plannedTotal: number;
  deposited: number;
  unallocated: number;
  balances: GoalBalance[];
  openingTotal: number;
  closingTotal: number;
  byCategory: AmountMap;
  bySource: AmountMap;
}

/** Everything the "Monthly summary" block of a sheet shows, for one month. */
export function summarizeMonth(
  plan: MonthPlan,
  txs: Transaction[],
  deposits: Deposit[],
  goals: Goal[],
): MonthSummary {
  const month = plan.month;
  const inc = actualIncome(txs, month);
  const exp = actualExpenses(txs, month);
  const available = availableAfterExpenses(inc, exp);
  const planned = plannedAllocations(available, plan.allocations);
  const balances = goalBalances(goals, deposits, month);
  const deposited = sum(balances.map((b) => b.deposited));
  const expectedIncome = sumMap(plan.expectedIncome);
  const budgetedExpenses = sumMap(plan.budgets);
  return {
    month,
    expectedIncome,
    budgetedExpenses,
    expectedAvailable: round2(expectedIncome - budgetedExpenses),
    actualIncome: inc,
    actualExpenses: exp,
    available,
    planned,
    plannedTotal: sumMap(planned),
    deposited,
    unallocated: unallocatedCash(available, deposited),
    balances,
    openingTotal: sum(balances.map((b) => b.opening)),
    closingTotal: sum(balances.map((b) => b.closing)),
    byCategory: expensesByCategory(txs, month),
    bySource: incomeBySource(txs, month),
  };
}

export function formatMoney(n: number, symbol = '₱', opts: { decimals?: boolean } = {}): string {
  const decimals = opts.decimals ?? !Number.isInteger(round2(n));
  const abs = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${n < 0 ? '−' : ''}${symbol}${abs}`;
}
