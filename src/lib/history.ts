import { planFromDefaults } from './db';
import { monthLabel, monthOf, monthRange, summarizeMonth, type MonthSummary } from './finance';
import type { ReadyCore } from './useBudget';
import type { MonthKey } from './types';

/** Months from the start month up to the latest of: today, the last record, or the selected month. */
export function historyMonths(core: ReadyCore, today: MonthKey, selected: MonthKey): MonthKey[] {
  const start = core.settings.startMonth;
  const last = [today, selected, ...core.transactions.map((t) => monthOf(t.date)), ...core.deposits.map((d) => monthOf(d.date))]
    .filter((m) => m >= start)
    .sort()
    .pop() ?? start;
  return monthRange(start, last);
}

export function summariesFor(core: ReadyCore, months: MonthKey[]): MonthSummary[] {
  return months.map((m) => {
    const plan = core.months.find((p) => p.month === m) ?? planFromDefaults(core.settings, m);
    return summarizeMonth(plan, core.transactions, core.deposits, core.goals);
  });
}

export const shortLabel = (m: MonthKey) => {
  const l = monthLabel(m, 'short');
  return `${l.slice(0, 3)} ${l.slice(-2)}`;
};
