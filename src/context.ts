import type { ReadyCore } from './lib/useBudget';
import type { Deposit, MonthKey, Transaction, TransactionType } from './lib/types';

export type Tab = 'home' | 'transactions' | 'budget' | 'savings' | 'history' | 'reports' | 'settings';

/** Everything a screen needs, passed down from App. */
export interface AppCtx {
  core: ReadyCore;
  month: MonthKey;
  setMonth: (m: MonthKey) => void;
  go: (t: Tab) => void;
  openTx: (editing: Transaction | null, type?: TransactionType) => void;
  openDeposit: (editing: Deposit | null, goalId?: string) => void;
  toast: (msg: string) => void;
}
