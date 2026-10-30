import { useContext, useEffect, useState } from 'react';
import type { AppCtx } from '../context';
import { db } from '../lib/db';
import { monthLabel, round2, sumMap, validateAmount } from '../lib/finance';
import { useMonth } from '../lib/useBudget';
import { Bar, Button, Card, CurrencyContext, Field, MoneyInput, Page, Section, Sheet, Stat, useMoney } from '../components/ui';

type Edit = { kind: 'budgets' | 'expectedIncome'; id: string; name: string; value: number } | null;

export default function Budget({ ctx }: { ctx: AppCtx }) {
  const { core, month } = ctx;
  const { plan, summary: s } = useMonth(core, month);
  const money = useMoney();
  const symbol = useContext(CurrencyContext);
  const [edit, setEdit] = useState<Edit>(null);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (edit) {
      setDraft(String(edit.value));
      setErr(null);
    }
  }, [edit]);

  const save = async () => {
    if (!edit) return;
    const e = validateAmount(draft, { allowZero: true });
    setErr(e);
    if (e) return;
    await db.months.put({ ...plan, [edit.kind]: { ...plan[edit.kind], [edit.id]: Number(draft) } });
    ctx.toast('Budget updated for ' + monthLabel(month));
    setEdit(null);
  };

  const cats = core.categories.filter((c) => !c.archived || (s.byCategory[c.id] ?? 0) > 0 || (plan.budgets[c.id] ?? 0) > 0);
  const srcs = core.sources.filter((x) => !x.archived || (s.bySource[x.id] ?? 0) > 0);
  const budgetTotal = sumMap(plan.budgets);
  const remaining = round2(budgetTotal - s.actualExpenses);

  return (
    <Page title="Budget">
      <Card dark>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Budgeted" value={money(budgetTotal)} />
          <Stat label="Spent" value={money(s.actualExpenses)} />
          <Stat label="Remaining" value={money(remaining)} />
        </div>
        <div className="mt-4">
          <Bar inverted value={s.actualExpenses} max={budgetTotal} />
        </div>
      </Card>

      <Section title="Income · expected vs actual">
        <div className="divide-y divide-line rounded-[22px] border border-line px-5">
          {srcs.map((x) => {
            const expected = plan.expectedIncome[x.id] ?? 0;
            const actual = s.bySource[x.id] ?? 0;
            return (
              <button key={x.id} className="block w-full py-3.5 text-left active:opacity-60" onClick={() => setEdit({ kind: 'expectedIncome', id: x.id, name: x.name, value: expected })}>
                <div className="flex justify-between text-[15px] font-medium">
                  <span>{x.name}</span>
                  <span className="num">{money(actual)}</span>
                </div>
                <div className="num mt-0.5 flex justify-between text-xs text-mute">
                  <span>Expected {money(expected)}</span>
                  <span>{expected === 0 && actual === 0 ? '—' : actual >= expected ? 'Received' : `${money(expected - actual)} to go`}</span>
                </div>
              </button>
            );
          })}
          <div className="num flex justify-between py-3.5 text-[15px] font-semibold">
            <span>Total</span>
            <span>
              {money(s.actualIncome)} <span className="font-normal text-mute">/ {money(s.expectedIncome)}</span>
            </span>
          </div>
        </div>
      </Section>

      <Section title="Expenses · budget vs actual">
        <div className="divide-y divide-line rounded-[22px] border border-line px-5">
          {cats.map((c) => {
            const budget = plan.budgets[c.id] ?? 0;
            const actual = s.byCategory[c.id] ?? 0;
            const left = round2(budget - actual);
            return (
              <button key={c.id} className="block w-full py-3.5 text-left active:opacity-60" onClick={() => setEdit({ kind: 'budgets', id: c.id, name: c.name, value: budget })}>
                <div className="flex justify-between text-[15px] font-medium">
                  <span className="truncate">{c.name}</span>
                  <span className="num">
                    {money(actual)} <span className="font-normal text-mute">/ {money(budget)}</span>
                  </span>
                </div>
                <div className="mt-2">
                  <Bar value={actual} max={budget} />
                </div>
                <div className={`num mt-1.5 text-right text-xs ${left < 0 ? 'font-semibold text-ink' : 'text-mute'}`}>
                  {left < 0 ? `Over by ${money(-left)}` : `${money(left)} left`}
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <p className="text-center text-xs text-mute">Tap a line to change its amount for {monthLabel(month)} only. Change defaults for future months in Settings.</p>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.name ?? ''}>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Field label={`${edit?.kind === 'budgets' ? 'Budget' : 'Expected income'} for ${monthLabel(month)}`} error={err}>
            <MoneyInput value={draft} onChange={setDraft} symbol={symbol} autoFocus />
          </Field>
          <Button type="submit" className="w-full">
            Save
          </Button>
        </form>
      </Sheet>
    </Page>
  );
}
