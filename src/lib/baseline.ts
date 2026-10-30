/**
 * Baseline values taken from the reference workbook and your project brief.
 * These pre-fill BUDGETS and EXPECTED income only — no actual transactions
 * or savings deposits are ever created from them.
 */
import type { Category, Goal, IncomeSource, Settings } from './types';

export const START_MONTH = '2026-11';

export const BASELINE_SOURCES: IncomeSource[] = [
  { id: 'paycheck-1', name: 'Paycheck 1', order: 0 },
  { id: 'paycheck-2', name: 'Paycheck 2', order: 1 },
  { id: 'additional', name: 'Additional income', order: 2 },
];

export const BASELINE_CATEGORIES: Category[] = [
  { id: 'rent', name: 'Rent', order: 0 },
  { id: 'electricity', name: 'Electricity', order: 1 },
  { id: 'water', name: 'Water', order: 2 },
  { id: 'internet', name: 'Internet', order: 3 },
  { id: 'groceries', name: 'Groceries / Food', order: 4 },
  { id: 'transportation', name: 'Transportation', order: 5 },
  { id: 'phone', name: 'Phone / Subscriptions', order: 6 },
  { id: 'loans', name: 'Loans / Installments', order: 7 },
  { id: 'netflix', name: 'Netflix', order: 8 },
  { id: 'psplus', name: 'PlayStation Plus', order: 9 },
  { id: 'vape', name: 'Vape', order: 10 },
  { id: 'other', name: 'Other', order: 11 },
];

export const BASELINE_GOALS: Goal[] = [
  { id: 'emergency', name: 'Emergency fund', order: 0, openingBalance: 0 },
  { id: 'investments', name: 'Investments', order: 1, openingBalance: 0 },
  { id: 'travel', name: 'Travel', order: 2, openingBalance: 0 },
  { id: 'personal', name: 'Personal goals', order: 3, openingBalance: 0 },
];

export const BASELINE_SETTINGS: Settings = {
  id: 'app',
  currency: 'PHP',
  currencySymbol: '₱',
  startMonth: START_MONTH,
  defaults: {
    expectedIncome: { 'paycheck-1': 22000, 'paycheck-2': 22000, additional: 0 },
    budgets: {
      rent: 8000,
      electricity: 2000,
      water: 1000,
      internet: 850,
      groceries: 3500,
      transportation: 4000,
      phone: 400,
      loans: 3650,
      netflix: 1000,
      psplus: 750,
      vape: 1000,
      other: 0,
    },
    allocations: { emergency: 0.6, investments: 0.2, travel: 0.1, personal: 0.1 },
  },
};
