/** A calendar month in the form "YYYY-MM", e.g. "2026-11". */
export type MonthKey = string;

/** Amounts per item id, e.g. { rent: 8000 }. */
export type AmountMap = Record<string, number>;

export interface Category {
  id: string;
  name: string;
  order: number;
  archived?: boolean;
}

export interface IncomeSource {
  id: string;
  name: string;
  order: number;
  archived?: boolean;
}

export interface Goal {
  id: string;
  name: string;
  order: number;
  /** Balance before the start month (₱0 for every goal by default). */
  openingBalance: number;
  archived?: boolean;
}

/** The plan for a single month — copied from the defaults the first time a month is opened. */
export interface MonthPlan {
  month: MonthKey;
  expectedIncome: AmountMap; // per income source
  budgets: AmountMap; // per expense category
  allocations: AmountMap; // per goal, as a fraction (0.6 = 60%)
}

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id?: number;
  type: TransactionType;
  date: string; // YYYY-MM-DD
  amount: number; // always positive
  categoryId?: string; // for expenses
  sourceId?: string; // for income
  note?: string;
  createdAt?: number;
}

/** Money actually moved into a savings goal. Never created automatically. */
export interface Deposit {
  id?: number;
  goalId: string;
  date: string; // YYYY-MM-DD
  amount: number; // always positive
  note?: string;
  createdAt?: number;
}

export interface Settings {
  id: 'app';
  currency: string; // ISO code, e.g. PHP
  currencySymbol: string; // e.g. ₱
  startMonth: MonthKey;
  defaults: {
    expectedIncome: AmountMap;
    budgets: AmountMap;
    allocations: AmountMap;
  };
}
