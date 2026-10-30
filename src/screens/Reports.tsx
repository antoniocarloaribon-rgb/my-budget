import type { AppCtx } from '../context';
import { historyMonths, shortLabel, summariesFor } from '../lib/history';
import { monthLabel } from '../lib/finance';
import { useMonth } from '../lib/useBudget';
import { Donut, GroupedBars, Legendary, TrendLine, groupSlices } from '../components/charts';
import { Card, Empty, Page, Section, currentMonth, useMoney } from '../components/ui';

export default function Reports({ ctx }: { ctx: AppCtx }) {
  const { core, month } = ctx;
  const money = useMoney();
  const { summary: s } = useMonth(core, month);
  const catName = new Map(core.categories.map((c) => [c.id, c.name]));
  const all = summariesFor(core, historyMonths(core, currentMonth(), month));
  const hasAny = core.transactions.length > 0 || core.deposits.length > 0;

  const breakdown = Object.entries(s.byCategory)
    .map(([id, value]) => ({ name: catName.get(id) ?? id, value }))
    .sort((a, b) => b.value - a.value);

  const flow = all.map((m) => ({ label: shortLabel(m.month), income: m.actualIncome, expenses: m.actualExpenses }));
  const trend = all.map((m) => ({ label: shortLabel(m.month), balance: m.closingTotal, planned: m.plannedTotal }));
  const deposits = all.map((m) => ({ label: shortLabel(m.month), deposited: m.deposited }));

  if (!hasAny)
    return (
      <Page title="Reports">
        <Empty title="No data to report yet" body="Reports fill in as you record transactions and savings deposits." />
      </Page>
    );

  return (
    <Page title="Reports">
      <Section title={`Expense breakdown · ${monthLabel(month)}`}>
        <Card>
          {breakdown.length ? (
            <>
              <Donut data={groupSlices(breakdown)} center={money(s.actualExpenses)} />
              <Legendary data={groupSlices(breakdown)} total={s.actualExpenses} />
              <div className="mt-5 border-t border-line pt-4">
                <div className="label mb-2">All categories</div>
                {breakdown.map((b) => (
                  <div key={b.name} className="num flex justify-between py-1 text-sm">
                    <span className="truncate">{b.name}</span>
                    <span>
                      <span className="mr-3 text-mute">{Math.round((b.value / s.actualExpenses) * 100)}%</span>
                      {money(b.value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-mute">No expenses recorded in {monthLabel(month)}.</p>
          )}
        </Card>
      </Section>

      <Section title="Savings balance trend">
        <Card>
          <TrendLine
            data={trend}
            series={[
              { key: 'balance', name: 'Closing balance' },
              { key: 'planned', name: 'Planned this month' },
            ]}
          />
        </Card>
      </Section>

      <Section title="Deposits per month">
        <Card>
          <GroupedBars data={deposits} series={[{ key: 'deposited', name: 'Deposited' }]} height={200} />
        </Card>
      </Section>

      <Section title="Income vs expenses">
        <Card>
          <GroupedBars
            data={flow}
            series={[
              { key: 'expenses', name: 'Expenses' },
              { key: 'income', name: 'Income' },
            ]}
          />
        </Card>
      </Section>

      <Section title={`Goal balances · end of ${monthLabel(month)}`}>
        <div className="divide-y divide-line rounded-[22px] border border-line px-5">
          {s.balances.map((b) => (
            <div key={b.goalId} className="num flex justify-between py-3.5 text-[15px]">
              <span className="font-medium">{core.goals.find((g) => g.id === b.goalId)?.name}</span>
              <span className="font-semibold">{money(b.closing)}</span>
            </div>
          ))}
        </div>
      </Section>
    </Page>
  );
}
