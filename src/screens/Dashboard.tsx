import type { AppCtx } from '../context';
import { useMonth } from '../lib/useBudget';
import { monthLabel } from '../lib/finance';
import { Donut, GroupedBars, Legendary, groupSlices } from '../components/charts';
import { Bar, Button, Card, Empty, List, Notice, Page, Row, Section, Stat, shortDate, useMoney } from '../components/ui';

export default function Dashboard({ ctx }: { ctx: AppCtx }) {
  const { core, month } = ctx;
  const { summary: s } = useMonth(core, month);
  const money = useMoney();
  const catName = new Map(core.categories.map((c) => [c.id, c.name]));
  const srcName = new Map(core.sources.map((x) => [x.id, x.name]));
  const monthTx = core.transactions.filter((t) => t.date.startsWith(month));

  const slices = groupSlices(Object.entries(s.byCategory).map(([id, value]) => ({ name: catName.get(id) ?? id, value })));
  const goalBars = core.goals
    .filter((g) => !g.archived)
    .map((g) => ({
      label: g.name.split(' ')[0],
      planned: s.planned[g.id] ?? 0,
      actual: s.balances.find((b) => b.goalId === g.id)?.deposited ?? 0,
    }));

  return (
    <Page title="Overview">
      <Card dark>
        <Stat big label="Available after expenses" value={money(s.available)} sub={`Expected ${money(s.expectedAvailable)} · ${monthLabel(month)}`} />
        <div className="mt-6 grid grid-cols-2 gap-5">
          <div>
            <Stat label="Income" value={money(s.actualIncome)} sub={`of ${money(s.expectedIncome)} expected`} />
            <div className="mt-2">
              <Bar inverted value={s.actualIncome} max={s.expectedIncome} />
            </div>
          </div>
          <div>
            <Stat label="Expenses" value={money(s.actualExpenses)} sub={`of ${money(s.budgetedExpenses)} budget`} />
            <div className="mt-2">
              <Bar inverted value={s.actualExpenses} max={s.budgetedExpenses} />
            </div>
          </div>
        </div>
      </Card>

      {s.available < 0 && <Notice>Expenses are higher than income this month by {money(-s.available)}.</Notice>}

      <Section title="Savings">
        <Card>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Planned" value={money(s.plannedTotal)} />
            <Stat label="Deposited" value={money(s.deposited)} />
            <Stat label="Unallocated" value={money(s.unallocated)} />
          </div>
          <div className="mt-5 flex items-end justify-between border-t border-line pt-4">
            <Stat label="Total saved (closing)" value={money(s.closingTotal)} sub={`Opening ${money(s.openingTotal)}`} />
            <Button variant="secondary" className="!h-10 !px-4 text-sm" onClick={() => ctx.go('savings')}>
              Goals →
            </Button>
          </div>
        </Card>
      </Section>

      {monthTx.length === 0 ? (
        <Empty
          title={`Nothing recorded for ${monthLabel(month, 'long')}`}
          body="Add your paychecks and expenses as they happen. Your budget is ready and waiting."
          action={<Button onClick={() => ctx.openTx(null, 'income')}>Add first transaction</Button>}
        />
      ) : (
        <>
          <Section title="Expense breakdown">
            <Card>
              {slices.length ? (
                <>
                  <Donut data={slices} center={money(s.actualExpenses)} />
                  <Legendary data={slices} total={s.actualExpenses} />
                </>
              ) : (
                <p className="py-6 text-center text-sm text-mute">No expenses recorded yet.</p>
              )}
            </Card>
          </Section>

          <Section title="Savings · planned vs actual">
            <Card>
              <GroupedBars
                data={goalBars}
                series={[
                  { key: 'planned', name: 'Planned' },
                  { key: 'actual', name: 'Deposited' },
                ]}
              />
            </Card>
          </Section>

          <Section
            title="Recent"
            aside={
              <button className="text-sm font-medium underline underline-offset-4" onClick={() => ctx.go('transactions')}>
                See all
              </button>
            }
          >
            <List>
              {monthTx.slice(0, 5).map((t) => (
                <Row
                  key={t.id}
                  onClick={() => ctx.openTx(t)}
                  left={t.type === 'income' ? srcName.get(t.sourceId ?? '') : catName.get(t.categoryId ?? '')}
                  sub={`${shortDate(t.date)}${t.note ? ` · ${t.note}` : ''}`}
                  right={`${t.type === 'income' ? '+' : '−'}${money(t.amount).replace('−', '')}`}
                />
              ))}
            </List>
          </Section>
        </>
      )}
    </Page>
  );
}
