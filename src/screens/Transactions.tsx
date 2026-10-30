import { useState } from 'react';
import type { AppCtx } from '../context';
import { monthLabel, sum } from '../lib/finance';
import { Button, Empty, List, Page, Row, Segmented, shortDate, useMoney } from '../components/ui';

type Filter = 'all' | 'income' | 'expense';

export default function Transactions({ ctx }: { ctx: AppCtx }) {
  const { core, month } = ctx;
  const money = useMoney();
  const [filter, setFilter] = useState<Filter>('all');
  const catName = new Map(core.categories.map((c) => [c.id, c.name]));
  const srcName = new Map(core.sources.map((x) => [x.id, x.name]));

  const inMonth = core.transactions.filter((t) => t.date.startsWith(month));
  const shown = inMonth.filter((t) => filter === 'all' || t.type === filter);
  const income = sum(inMonth.filter((t) => t.type === 'income').map((t) => t.amount));
  const expenses = sum(inMonth.filter((t) => t.type === 'expense').map((t) => t.amount));

  const byDate = new Map<string, typeof shown>();
  for (const t of shown) byDate.set(t.date, [...(byDate.get(t.date) ?? []), t]);

  return (
    <Page
      title="Activity"
      action={
        <Button className="!h-10 !px-4 text-sm" onClick={() => ctx.openTx(null, filter === 'income' ? 'income' : 'expense')}>
          + Add
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[18px] bg-soft p-4">
          <div className="label">Income</div>
          <div className="num mt-1 text-lg font-semibold">{money(income)}</div>
        </div>
        <div className="rounded-[18px] bg-soft p-4">
          <div className="label">Expenses</div>
          <div className="num mt-1 text-lg font-semibold">{money(expenses)}</div>
        </div>
      </div>

      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'income', label: 'Income' },
          { value: 'expense', label: 'Expenses' },
        ]}
      />

      {shown.length === 0 ? (
        <Empty
          title="No transactions"
          body={`Nothing ${filter === 'all' ? '' : filter + ' '}recorded in ${monthLabel(month)} yet.`}
          action={<Button onClick={() => ctx.openTx(null, filter === 'income' ? 'income' : 'expense')}>Add transaction</Button>}
        />
      ) : (
        [...byDate.entries()].map(([date, txs]) => (
          <section key={date}>
            <h2 className="label mb-2">{shortDate(date)}</h2>
            <List>
              {txs.map((t) => (
                <Row
                  key={t.id}
                  onClick={() => ctx.openTx(t)}
                  left={t.type === 'income' ? srcName.get(t.sourceId ?? '') ?? 'Income' : catName.get(t.categoryId ?? '') ?? 'Expense'}
                  sub={t.note || (t.type === 'income' ? 'Income' : 'Expense')}
                  right={<span>{t.type === 'income' ? '+' : '−'}{money(t.amount).replace('−', '')}</span>}
                />
              ))}
            </List>
          </section>
        ))
      )}
      <p className="text-center text-xs text-mute">Tap a transaction to edit or delete it.</p>
    </Page>
  );
}
