/**
 * Local database (IndexedDB via Dexie). Everything stays on this device —
 * nothing is sent anywhere.
 */
import Dexie, { type Table } from 'dexie';
import type { Category, Deposit, Goal, IncomeSource, MonthKey, MonthPlan, Settings, Transaction } from './types';
import { BASELINE_CATEGORIES, BASELINE_GOALS, BASELINE_SETTINGS, BASELINE_SOURCES } from './baseline';
import { BACKUP_APP, BACKUP_VERSION, parseBackup, type BackupFile } from './backup';

export class BudgetDB extends Dexie {
  settings!: Table<Settings, string>;
  categories!: Table<Category, string>;
  sources!: Table<IncomeSource, string>;
  goals!: Table<Goal, string>;
  months!: Table<MonthPlan, string>;
  transactions!: Table<Transaction, number>;
  deposits!: Table<Deposit, number>;

  constructor(name = 'my-budget') {
    super(name);
    this.version(1).stores({
      settings: 'id',
      categories: 'id, order',
      sources: 'id, order',
      goals: 'id, order',
      months: 'month',
      transactions: '++id, date, type',
      deposits: '++id, date, goalId',
    });
  }
}

export const db = new BudgetDB();

/** First launch: load the baseline budget. Never creates transactions or deposits. */
export async function seedIfEmpty(d: BudgetDB = db): Promise<void> {
  await d.transaction('rw', [d.settings, d.categories, d.sources, d.goals], async () => {
    if (await d.settings.get('app')) return;
    await d.settings.put(structuredClone(BASELINE_SETTINGS));
    await d.categories.bulkPut(structuredClone(BASELINE_CATEGORIES));
    await d.sources.bulkPut(structuredClone(BASELINE_SOURCES));
    await d.goals.bulkPut(structuredClone(BASELINE_GOALS));
  });
}

/** Build a month plan from the current defaults (not saved). */
export function planFromDefaults(settings: Settings, month: MonthKey): MonthPlan {
  return {
    month,
    expectedIncome: { ...settings.defaults.expectedIncome },
    budgets: { ...settings.defaults.budgets },
    allocations: { ...settings.defaults.allocations },
  };
}

/** Returns the saved plan for a month, creating it from the defaults the first time. */
export async function ensureMonthPlan(month: MonthKey, d: BudgetDB = db): Promise<MonthPlan> {
  return d.transaction('rw', [d.months, d.settings], async () => {
    const existing = await d.months.get(month);
    if (existing) return existing;
    const settings = await d.settings.get('app');
    if (!settings) throw new Error('App is not set up yet.');
    const plan = planFromDefaults(settings, month);
    await d.months.put(plan);
    return plan;
  });
}

/**
 * Save new defaults. When `applyFrom` is given, months from that month onward
 * that already exist are updated too; earlier months keep their history.
 */
export async function saveDefaults(
  defaults: Settings['defaults'],
  applyFrom: MonthKey | null,
  d: BudgetDB = db,
): Promise<void> {
  await d.transaction('rw', [d.settings, d.months], async () => {
    const s = await d.settings.get('app');
    if (!s) throw new Error('App is not set up yet.');
    await d.settings.put({ ...s, defaults: structuredClone(defaults) });
    if (applyFrom) {
      const later = await d.months.where('month').aboveOrEqual(applyFrom).toArray();
      await d.months.bulkPut(later.map((m) => ({ ...planFromDefaults({ ...s, defaults }, m.month) })));
    }
  });
}

export async function exportBackup(d: BudgetDB = db): Promise<BackupFile> {
  const [settings, categories, sources, goals, months, transactions, deposits] = await Promise.all([
    d.settings.toArray(),
    d.categories.toArray(),
    d.sources.toArray(),
    d.goals.toArray(),
    d.months.toArray(),
    d.transactions.toArray(),
    d.deposits.toArray(),
  ]);
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { settings, categories, sources, goals, months, transactions, deposits },
  };
}

/** Replaces ALL data with the backup. Validates first; nothing changes if the file is invalid. */
export async function importBackup(raw: unknown, d: BudgetDB = db): Promise<void> {
  const parsed = parseBackup(raw);
  if (!parsed.ok) throw new Error(parsed.error);
  const x = parsed.data;
  const tables = [d.settings, d.categories, d.sources, d.goals, d.months, d.transactions, d.deposits];
  await d.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
    await d.settings.bulkPut(x.settings);
    await d.categories.bulkPut(x.categories);
    await d.sources.bulkPut(x.sources);
    await d.goals.bulkPut(x.goals);
    await d.months.bulkPut(x.months);
    await d.transactions.bulkPut(x.transactions);
    await d.deposits.bulkPut(x.deposits);
  });
}

/** Wipes everything and restores the baseline budget. */
export async function resetAll(d: BudgetDB = db): Promise<void> {
  const tables = [d.settings, d.categories, d.sources, d.goals, d.months, d.transactions, d.deposits];
  await d.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
  });
  await seedIfEmpty(d);
}
