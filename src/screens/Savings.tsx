import { useEffect, useState } from 'react';
import type { AppCtx } from '../context';
import { db } from '../lib/db';
import { monthLabel, validateAllocations } from '../lib/finance';
import { useMonth } from '../lib/useBudget';
import { Bar, Button, Card, Field, List, Notice, Page, Row, Section, Sheet, Stat, inputClass, shortDate, useMoney } from '../components/ui';

export default function Savings({ ctx }: { ctx: AppCtx }) {
  const { core, month } = ctx;
  const { plan, summary: s } = useMonth(core, month);
  const money = useMoney();
  const [editPct, setEditPct] = useState(false);
  const goals = core.goals.filter((g) => !g.archived || s.balances.some((b) => b.goalId === g.id && (b.opening || b.deposited)));
  const goalName = new Map(core.goals.map((g) => [g.id, g.name]));
  const monthDeposits = core.deposits.filter((d) => d.date.startsWith(month));
  const pctCheck = validateAllocations(plan.allocations);

  return (
    <Page title="Savings">
      <Card dark>
        <Stat big label="Total saved" value={money(s.closingTotal)} sub={`Opened ${monthLabel(month)} at ${money(s.openingTotal)}`} />
        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Available" value={money(s.available)} />
          <Stat label="Deposited" value={money(s.deposited)} />
          <Stat label="Unallocated" value={money(s.unallocated)} />
        </div>
      </Card>

      {!pctCheck.ok && <Notice>{pctCheck.error}</Notice>}
      {s.unallocated < 0 && (
        <Notice>
          Deposits this month are {money(-s.unallocated)} more than what's available after expenses. That's fine if the money came from
          earlier savings — just double-check the amounts.
        </Notice>
      )}
      {s.available <= 0 && s.actualIncome === 0 && (
        <Notice>Planned amounts appear once income is recorded. Planned amounts are a guide only — they never count as savings.</Notice>
      )}

      <Section
        title="Goals"
        aside={
          <button className="text-sm font-medium underline underline-offset-4" onClick={() => setEditPct(true)}>
            Edit %
          </button>
        }
      >
        <div className="space-y-3">
          {goals.map((g) => {
            const b = s.balances.find((x) => x.goalId === g.id)!;
            const planned = s.planned[g.id] ?? 0;
            const pct = plan.allocations[g.id] ?? 0;
            return (
              <Card key={g.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[17px] font-semibold tracking-tight">{g.name}</div>
                    <div className="num text-xs text-mute">{Math.round(pct * 1000) / 10}% of available</div>
                  </div>
                  <div className="text-right">
                    <div className="label">Balance</div>
                    <div className="num text-xl font-semibold tracking-tight">{money(b.closing)}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <Bar value={b.deposited} max={planned} />
                  <div className="num mt-1.5 flex justify-between text-xs text-mute">
                    <span>
                      Deposited {money(b.deposited)} of {money(planned)} planned
                    </span>
                    <span>{planned > 0 ? Math.round((b.deposited / planned) * 100) : 0}%</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                  <span className="num text-xs text-mute">
                    Opening {money(b.opening)} → Closing {money(b.closing)}
                  </span>
                  <Button className="!h-9 !px-4 text-sm" onClick={() => ctx.openDeposit(null, g.id)}>
                    + Deposit
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section title={`Deposits in ${monthLabel(month)}`}>
        {monthDeposits.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-line px-5 py-6 text-center text-sm text-mute">
            No deposits recorded yet. When you transfer money to savings, record it here.
          </div>
        ) : (
          <List>
            {monthDeposits.map((d) => (
              <Row key={d.id} onClick={() => ctx.openDeposit(d)} left={goalName.get(d.goalId) ?? d.goalId} sub={`${shortDate(d.date)}${d.note ? ` · ${d.note}` : ''}`} right={money(d.amount)} />
            ))}
          </List>
        )}
      </Section>

      <AllocationSheet open={editPct} onClose={() => setEditPct(false)} ctx={ctx} />
    </Page>
  );
}

function AllocationSheet({ open, onClose, ctx }: { open: boolean; onClose: () => void; ctx: AppCtx }) {
  const { core, month } = ctx;
  const { plan } = useMonth(core, month);
  const goals = core.goals.filter((g) => !g.archived);
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) setDraft(Object.fromEntries(goals.map((g) => [g.id, String(Math.round((plan.allocations[g.id] ?? 0) * 10000) / 100)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fractions = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v === '' ? NaN : Number(v) / 100]));
  const check = validateAllocations(fractions);

  const save = async () => {
    if (!check.ok) return;
    await db.months.put({ ...plan, allocations: fractions });
    ctx.toast(`Allocation saved for ${monthLabel(month)}`);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Allocation %">
      <div className="space-y-4">
        <p className="text-sm text-mute">How available cash should be split this month. Must total 100%. Defaults for new months are in Settings.</p>
        {goals.map((g) => (
          <Field key={g.id} label={g.name}>
            <div className="relative">
              <input
                className={`${inputClass} num pr-10`}
                inputMode="decimal"
                value={draft[g.id] ?? ''}
                onChange={(e) => setDraft({ ...draft, [g.id]: e.target.value.replace(/[^0-9.]/g, '') })}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-mute">%</span>
            </div>
          </Field>
        ))}
        <div className={`num flex justify-between rounded-2xl px-4 py-3 text-sm font-semibold ${check.ok ? 'bg-soft' : 'border border-ink'}`}>
          <span>Total</span>
          <span>{Number.isFinite(check.totalPercent) ? check.totalPercent : '—'}%</span>
        </div>
        {check.error && <p className="text-sm font-medium">⚠ {check.error}</p>}
        <Button className="w-full" disabled={!check.ok} onClick={save}>
          Save
        </Button>
      </div>
    </Sheet>
  );
}
