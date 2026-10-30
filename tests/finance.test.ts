import { describe, expect, it } from 'vitest';
import {
  actualExpenses,
  actualIncome,
  addMonths,
  availableAfterExpenses,
  depositsByGoal,
  formatMoney,
  goalBalances,
  monthRange,
  plannedAllocations,
  summarizeMonth,
  sumMap,
  unallocatedCash,
  validateAllocations,
  validateAmount,
} from '../src/lib/finance';
import { BASELINE_GOALS, BASELINE_SETTINGS } from '../src/lib/baseline';
import type { Deposit, MonthPlan, Transaction } from '../src/lib/types';

const D = BASELINE_SETTINGS.defaults;
const NOV = '2026-11';
const DEC = '2026-12';
const JAN = '2027-01';

const plan = (month: string): MonthPlan => ({
  month,
  expectedIncome: { ...D.expectedIncome },
  budgets: { ...D.budgets },
  allocations: { ...D.allocations },
});

/** Transactions that exactly match the baseline budget for a month. */
function baselineTransactions(month: string): Transaction[] {
  const txs: Transaction[] = [
    { type: 'income', date: `${month}-15`, amount: 22000, sourceId: 'paycheck-1' },
    { type: 'income', date: `${month}-30`, amount: 22000, sourceId: 'paycheck-2' },
  ];
  for (const [categoryId, amount] of Object.entries(D.budgets))
    if (amount > 0) txs.push({ type: 'expense', date: `${month}-05`, amount, categoryId });
  return txs;
}

describe('baseline figures from the brief', () => {
  it('total expected income is ₱44,000', () => {
    expect(sumMap(D.expectedIncome)).toBe(44000);
  });
  // NOTE: the brief states ₱27,150, but its 12 line items (and the workbook's SUM) total ₱26,150.
  it('total budgeted expenses is ₱26,150 (sum of the line items)', () => {
    expect(sumMap(D.budgets)).toBe(26150);
  });
  it('expected available amount is ₱17,850', () => {
    const s = summarizeMonth(plan(NOV), [], [], BASELINE_GOALS);
    expect(s.expectedAvailable).toBe(17850);
  });
  it('default allocation is 60/20/10/10 and valid', () => {
    expect(validateAllocations(D.allocations)).toEqual({ ok: true, totalPercent: 100, error: null });
  });
});

describe('1–3. income, expenses, available', () => {
  const txs = baselineTransactions(NOV);
  it('actual income sums only income transactions in the month', () => {
    expect(actualIncome(txs, NOV)).toBe(44000);
    expect(actualIncome(txs, DEC)).toBe(0);
  });
  it('actual expenses sums only expense transactions in the month', () => {
    expect(actualExpenses(txs, NOV)).toBe(26150);
    expect(actualExpenses(txs, DEC)).toBe(0);
  });
  it('available = income − expenses', () => {
    expect(availableAfterExpenses(44000, 26150)).toBe(17850);
    expect(availableAfterExpenses(1000, 1500)).toBe(-500);
  });
  it('handles centavos without floating point drift', () => {
    const t: Transaction[] = [
      { type: 'expense', date: '2026-11-01', amount: 0.1, categoryId: 'other' },
      { type: 'expense', date: '2026-11-01', amount: 0.2, categoryId: 'other' },
    ];
    expect(actualExpenses(t, NOV)).toBe(0.3);
  });
});

describe('4. planned allocation', () => {
  it('splits ₱17,850 into 10,710 / 3,570 / 1,785 / 1,785', () => {
    expect(plannedAllocations(17850, D.allocations)).toEqual({
      emergency: 10710,
      investments: 3570,
      travel: 1785,
      personal: 1785,
    });
  });
  it("also matches the brief's ₱16,850 split (10,110 / 3,370 / 1,685 / 1,685)", () => {
    expect(plannedAllocations(16850, D.allocations)).toEqual({
      emergency: 10110,
      investments: 3370,
      travel: 1685,
      personal: 1685,
    });
  });
  it('plans ₱0 when nothing is available', () => {
    expect(plannedAllocations(-500, D.allocations)).toEqual({
      emergency: 0,
      investments: 0,
      travel: 0,
      personal: 0,
    });
  });
});

describe('5, 6, 8, 10. deposits, balances, unallocated cash', () => {
  it('planned allocation is NEVER counted as a deposit', () => {
    const s = summarizeMonth(plan(NOV), baselineTransactions(NOV), [], BASELINE_GOALS);
    expect(s.plannedTotal).toBe(17850);
    expect(s.deposited).toBe(0);
    expect(s.closingTotal).toBe(0);
    expect(s.unallocated).toBe(17850);
  });

  it('November opens at ₱0 and closes at opening + actual deposits', () => {
    const deposits: Deposit[] = [
      { goalId: 'emergency', date: '2026-11-30', amount: 10110 },
      { goalId: 'travel', date: '2026-11-30', amount: 500 },
    ];
    const s = summarizeMonth(plan(NOV), baselineTransactions(NOV), deposits, BASELINE_GOALS);
    const em = s.balances.find((b) => b.goalId === 'emergency')!;
    expect(em).toEqual({ goalId: 'emergency', opening: 0, deposited: 10110, closing: 10110 });
    expect(s.openingTotal).toBe(0);
    expect(s.deposited).toBe(10610);
    expect(s.unallocated).toBe(7240); // 17,850 − 10,610
    expect(unallocatedCash(16850, 10610)).toBe(6240);
  });

  it('groups deposits per goal for the month', () => {
    const deposits: Deposit[] = [
      { goalId: 'emergency', date: '2026-11-01', amount: 100 },
      { goalId: 'emergency', date: '2026-11-20', amount: 50.5 },
      { goalId: 'emergency', date: '2026-12-01', amount: 999 },
    ];
    expect(depositsByGoal(deposits, NOV)).toEqual({ emergency: 150.5 });
  });
});

describe('7. monthly carry-forward', () => {
  const deposits: Deposit[] = [
    { goalId: 'emergency', date: '2026-11-30', amount: 10110 },
    { goalId: 'investments', date: '2026-11-30', amount: 3370 },
    { goalId: 'emergency', date: '2026-12-31', amount: 5000 },
  ];

  it("next month's opening equals previous month's closing", () => {
    const nov = goalBalances(BASELINE_GOALS, deposits, NOV);
    const dec = goalBalances(BASELINE_GOALS, deposits, DEC);
    nov.forEach((b, i) => expect(dec[i].opening).toBe(b.closing));
    expect(dec.find((b) => b.goalId === 'emergency')!.closing).toBe(15110);
  });

  it('carries through a month with no deposits', () => {
    const jan = goalBalances(BASELINE_GOALS, deposits, JAN);
    const feb = goalBalances(BASELINE_GOALS, deposits, '2027-02');
    expect(jan.find((b) => b.goalId === 'emergency')).toMatchObject({ opening: 15110, deposited: 0, closing: 15110 });
    expect(feb.find((b) => b.goalId === 'investments')).toMatchObject({ opening: 3370, closing: 3370 });
  });

  it('chains across 12 months', () => {
    const many: Deposit[] = monthRange(NOV, '2027-10').map((m) => ({
      goalId: 'travel',
      date: `${m}-10`,
      amount: 1685,
    }));
    let prevClosing = 0;
    for (const m of monthRange(NOV, '2027-10')) {
      const b = goalBalances(BASELINE_GOALS, many, m).find((x) => x.goalId === 'travel')!;
      expect(b.opening).toBe(prevClosing);
      expect(b.closing).toBe(prevClosing + 1685);
      prevClosing = b.closing;
    }
    expect(prevClosing).toBe(20220);
  });

  it('editing an earlier deposit flows forward automatically', () => {
    const edited = deposits.map((d) => (d.date === '2026-11-30' && d.goalId === 'emergency' ? { ...d, amount: 9000 } : d));
    expect(goalBalances(BASELINE_GOALS, edited, JAN).find((b) => b.goalId === 'emergency')!.opening).toBe(14000);
  });

  it('respects a non-zero opening balance on a goal', () => {
    const goals = BASELINE_GOALS.map((g) => (g.id === 'travel' ? { ...g, openingBalance: 1000 } : g));
    expect(goalBalances(goals, [], NOV).find((b) => b.goalId === 'travel')!.opening).toBe(1000);
  });
});

describe('9. validation', () => {
  it('rejects allocations that do not total 100%', () => {
    const r = validateAllocations({ a: 0.6, b: 0.2, c: 0.1 });
    expect(r.ok).toBe(false);
    expect(r.totalPercent).toBe(90);
  });
  it('rejects negative or >100% allocations', () => {
    expect(validateAllocations({ a: 1.2, b: -0.2 }).ok).toBe(false);
  });
  it('accepts fractional percentages that total 100%', () => {
    expect(validateAllocations({ a: 0.333, b: 0.333, c: 0.334 }).ok).toBe(true);
  });
  it('rejects negative, zero, empty and non-numeric amounts', () => {
    expect(validateAmount(-1)).toMatch(/negative/);
    expect(validateAmount(0)).toMatch(/greater than zero/);
    expect(validateAmount('')).toMatch(/Enter/);
    expect(validateAmount('abc')).toMatch(/number/);
    expect(validateAmount(NaN)).toMatch(/number/);
    expect(validateAmount(1.234)).toMatch(/decimal/);
  });
  it('accepts valid amounts, and zero where allowed (budgets)', () => {
    expect(validateAmount(22000)).toBeNull();
    expect(validateAmount('850.50')).toBeNull();
    expect(validateAmount(0, { allowZero: true })).toBeNull();
  });
});

describe('helpers', () => {
  it('adds months across years', () => {
    expect(addMonths(NOV, 2)).toBe(JAN);
    expect(addMonths(JAN, -2)).toBe(NOV);
  });
  it('formats PHP', () => {
    expect(formatMoney(16850)).toBe('₱16,850');
    expect(formatMoney(-500.5)).toBe('−₱500.50');
  });
});
