import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { BudgetDB, ensureMonthPlan, exportBackup, importBackup, resetAll, saveDefaults, seedIfEmpty } from '../src/lib/db';
import { parseBackup, transactionsToCSV } from '../src/lib/backup';
import { summarizeMonth } from '../src/lib/finance';
import { BASELINE_CATEGORIES, BASELINE_SOURCES } from '../src/lib/baseline';

let d: BudgetDB;
let n = 0;
beforeEach(async () => {
  d = new BudgetDB(`test-${n++}`);
  await seedIfEmpty(d);
});

describe('seeding', () => {
  it('pre-fills budgets but never invents transactions or deposits', async () => {
    expect(await d.categories.count()).toBe(12);
    expect(await d.sources.count()).toBe(3);
    expect(await d.goals.count()).toBe(4);
    expect(await d.transactions.count()).toBe(0);
    expect(await d.deposits.count()).toBe(0);
    for (const g of await d.goals.toArray()) expect(g.openingBalance).toBe(0);
  });
  it('is safe to run twice', async () => {
    await seedIfEmpty(d);
    expect(await d.categories.count()).toBe(12);
  });
});

describe('month plans and carry-forward with the database', () => {
  it('creates each month from defaults once and keeps edits', async () => {
    const nov = await ensureMonthPlan('2026-11', d);
    expect(nov.budgets.rent).toBe(8000);
    await d.months.put({ ...nov, budgets: { ...nov.budgets, rent: 9000 } });
    expect((await ensureMonthPlan('2026-11', d)).budgets.rent).toBe(9000);
  });

  it('saving defaults updates chosen month onward, not earlier months', async () => {
    await ensureMonthPlan('2026-11', d);
    await ensureMonthPlan('2026-12', d);
    const s = (await d.settings.get('app'))!;
    await saveDefaults({ ...s.defaults, budgets: { ...s.defaults.budgets, rent: 8500 } }, '2026-12', d);
    expect((await d.months.get('2026-11'))!.budgets.rent).toBe(8000);
    expect((await d.months.get('2026-12'))!.budgets.rent).toBe(8500);
    expect((await ensureMonthPlan('2027-01', d)).budgets.rent).toBe(8500);
  });

  it('November → December carry-forward using stored deposits', async () => {
    await d.transactions.bulkAdd([
      { type: 'income', date: '2026-11-15', amount: 22000, sourceId: 'paycheck-1' },
      { type: 'income', date: '2026-11-30', amount: 22000, sourceId: 'paycheck-2' },
      { type: 'expense', date: '2026-11-05', amount: 26150, categoryId: 'other' },
    ]);
    await d.deposits.add({ goalId: 'emergency', date: '2026-11-30', amount: 10710 });
    const goals = await d.goals.orderBy('order').toArray();
    const txs = await d.transactions.toArray();
    const deps = await d.deposits.toArray();
    const nov = summarizeMonth(await ensureMonthPlan('2026-11', d), txs, deps, goals);
    const dec = summarizeMonth(await ensureMonthPlan('2026-12', d), txs, deps, goals);
    expect(nov.available).toBe(17850);
    expect(nov.closingTotal).toBe(10710);
    expect(nov.unallocated).toBe(7140);
    expect(dec.openingTotal).toBe(nov.closingTotal);
    expect(dec.balances[0]).toMatchObject({ opening: 10710, deposited: 0, closing: 10710 });
  });
});

describe('backup & restore', () => {
  it('round-trips all data', async () => {
    await d.transactions.add({ type: 'expense', date: '2026-11-02', amount: 850, categoryId: 'internet', note: 'PLDT' });
    await d.deposits.add({ goalId: 'travel', date: '2026-11-30', amount: 500 });
    await ensureMonthPlan('2026-11', d);
    const file = JSON.parse(JSON.stringify(await exportBackup(d)));

    const other = new BudgetDB(`restore-${n++}`);
    await importBackup(file, other);
    expect(await other.transactions.toArray()).toEqual(await d.transactions.toArray());
    expect(await other.deposits.toArray()).toEqual(await d.deposits.toArray());
    expect(await other.months.count()).toBe(1);
  });

  it('rejects invalid files without touching existing data', async () => {
    await d.transactions.add({ type: 'income', date: '2026-11-15', amount: 22000, sourceId: 'paycheck-1' });
    await expect(importBackup({ hello: 'world' }, d)).rejects.toThrow(/not a My Budget backup/);
    const bad = await exportBackup(d);
    bad.data.deposits.push({ goalId: 'travel', date: '2026-11-01', amount: -5 });
    await expect(importBackup(JSON.parse(JSON.stringify(bad)), d)).rejects.toThrow(/invalid savings deposit/);
    expect(await d.transactions.count()).toBe(1);
  });

  it('parseBackup rejects a missing table', () => {
    expect(parseBackup({ app: 'my-budget', version: 1, data: {} })).toMatchObject({ ok: false });
  });

  it('reset restores baseline and clears records', async () => {
    await d.transactions.add({ type: 'income', date: '2026-11-15', amount: 1, sourceId: 'additional' });
    await resetAll(d);
    expect(await d.transactions.count()).toBe(0);
    expect(await d.categories.count()).toBe(12);
  });
});

describe('CSV export', () => {
  it('writes readable rows and escapes commas and quotes', () => {
    const csv = transactionsToCSV(
      [
        { id: 2, type: 'expense', date: '2026-11-03', amount: 3500, categoryId: 'groceries', note: 'SM, "weekly"' },
        { id: 1, type: 'income', date: '2026-11-01', amount: 22000, sourceId: 'paycheck-1' },
      ],
      BASELINE_CATEGORIES,
      BASELINE_SOURCES,
    );
    expect(csv.split('\r\n')).toEqual([
      'Date,Type,Category / Source,Amount (PHP),Note',
      '2026-11-01,Income,Paycheck 1,22000.00,',
      '2026-11-03,Expense,Groceries / Food,3500.00,"SM, ""weekly"""',
    ]);
  });
});
