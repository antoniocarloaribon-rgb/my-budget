/** Pure helpers for JSON backup files and CSV export (no database access here). */
import type { Category, Deposit, Goal, IncomeSource, MonthPlan, Settings, Transaction } from './types';

export const BACKUP_APP = 'my-budget';
export const BACKUP_VERSION = 1;

export interface BackupData {
  settings: Settings[];
  categories: Category[];
  sources: IncomeSource[];
  goals: Goal[];
  months: MonthPlan[];
  transactions: Transaction[];
  deposits: Deposit[];
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  data: BackupData;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isPositive = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0;

/** Checks an uploaded backup before anything is overwritten. Returns the data or an error message. */
export function parseBackup(raw: unknown): { ok: true; data: BackupData } | { ok: false; error: string } {
  if (!isObj(raw) || raw.app !== BACKUP_APP) return { ok: false, error: 'This is not a My Budget backup file.' };
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION)
    return { ok: false, error: 'This backup was made by a newer version of the app.' };
  const d = raw.data;
  if (!isObj(d)) return { ok: false, error: 'The backup has no data.' };
  const keys: (keyof BackupData)[] = ['settings', 'categories', 'sources', 'goals', 'months', 'transactions', 'deposits'];
  for (const k of keys) if (!Array.isArray(d[k])) return { ok: false, error: `The backup is missing "${k}".` };
  const data = d as unknown as BackupData;
  if (data.settings.length !== 1 || data.settings[0].id !== 'app')
    return { ok: false, error: 'The backup settings are invalid.' };
  for (const t of data.transactions) {
    if ((t.type !== 'income' && t.type !== 'expense') || !isDate(t.date) || !isPositive(t.amount))
      return { ok: false, error: 'The backup contains an invalid transaction.' };
  }
  for (const dep of data.deposits) {
    if (typeof dep.goalId !== 'string' || !isDate(dep.date) || !isPositive(dep.amount))
      return { ok: false, error: 'The backup contains an invalid savings deposit.' };
  }
  return { ok: true, data };
}

const csvCell = (v: string | number | undefined) => {
  const s = v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Transactions as CSV, oldest first, with readable category / source names. */
export function transactionsToCSV(
  txs: Transaction[],
  categories: Category[],
  sources: IncomeSource[],
  currency = 'PHP',
): string {
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const src = new Map(sources.map((s) => [s.id, s.name]));
  const header = ['Date', 'Type', 'Category / Source', `Amount (${currency})`, 'Note'];
  const rows = [...txs]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))
    .map((t) => [
      t.date,
      t.type === 'income' ? 'Income' : 'Expense',
      t.type === 'income' ? src.get(t.sourceId ?? '') ?? t.sourceId : cat.get(t.categoryId ?? '') ?? t.categoryId,
      t.amount.toFixed(2),
      t.note ?? '',
    ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}
