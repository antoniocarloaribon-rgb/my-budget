/** React hooks that read live data from the local database. Screens re-render when data changes. */
import { useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureMonthPlan, planFromDefaults } from './db';
import { summarizeMonth } from './finance';
import type { MonthKey } from './types';

export function useCore() {
  const settings = useLiveQuery(() => db.settings.get('app'), []);
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), []);
  const sources = useLiveQuery(() => db.sources.orderBy('order').toArray(), []);
  const goals = useLiveQuery(() => db.goals.orderBy('order').toArray(), []);
  const transactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), []);
  const deposits = useLiveQuery(() => db.deposits.orderBy('date').reverse().toArray(), []);
  const months = useLiveQuery(() => db.months.toArray(), []);
  const ready = !!(settings && categories && sources && goals && transactions && deposits && months);
  return { ready, settings, categories, sources, goals, transactions, deposits, months };
}

export type Core = ReturnType<typeof useCore>;
export type ReadyCore = { [K in keyof Core]-?: NonNullable<Core[K]> };

/** The plan + summary for one month (creates the month plan from defaults the first time). */
export function useMonth(core: ReadyCore, month: MonthKey) {
  useEffect(() => {
    if (!core.months.some((m) => m.month === month)) void ensureMonthPlan(month);
  }, [core.months, month]);

  return useMemo(() => {
    const plan = core.months.find((m) => m.month === month) ?? planFromDefaults(core.settings, month);
    const summary = summarizeMonth(plan, core.transactions, core.deposits, core.goals);
    return { plan, summary };
  }, [core, month]);
}
