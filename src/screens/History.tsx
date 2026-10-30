import type { AppCtx } from '../context';
import { historyMonths, summariesFor } from '../lib/history';
import { monthLabel } from '../lib/finance';
import { Page, currentMonth, useMoney } from '../components/ui';

export default function History({ ctx }: { ctx: AppCtx }) {
  const { core, month } = ctx;
  const money = useMoney();
  const months = historyMonths(core, currentMonth(), month);
  const rows = summariesFor(core, months).reverse();

  return (
    <Page title="History">
      <p className="text-sm text-mute">
        Each month opens with the previous month's closing savings balance. Edit any past record and every later month updates automatically.
      </p>
      <div className="space-y-3">
        {rows.map((s) => {
          const empty = s.actualIncome === 0 && s.actualExpenses === 0 && s.deposited === 0;
          const selected = s.month === month;
          return (
            <button
              key={s.month}
              onClick={() => {
                ctx.setMonth(s.month);
                ctx.go('home');
              }}
              className={`block w-full rounded-[22px] p-5 text-left active:opacity-70 ${selected ? 'bg-ink text-paper' : 'border border-line bg-paper'}`}
            >
              <div className="flex items-baseline justify-between">
                <div className="text-[17px] font-semibold tracking-tight">{monthLabel(s.month)}</div>
                <div className="label !text-current opacity-60">{empty ? 'No records' : selected ? 'Viewing' : 'Open →'}</div>
              </div>
              <div className="num mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="opacity-60 text-xs">Income</div>
                  <div className="font-semibold">{money(s.actualIncome)}</div>
                </div>
                <div>
                  <div className="opacity-60 text-xs">Expenses</div>
                  <div className="font-semibold">{money(s.actualExpenses)}</div>
                </div>
                <div>
                  <div className="opacity-60 text-xs">Available</div>
                  <div className="font-semibold">{money(s.available)}</div>
                </div>
              </div>
              <div className={`num mt-3 flex justify-between border-t pt-3 text-xs ${selected ? 'border-white/20' : 'border-line'}`}>
                <span className="opacity-60">Savings {money(s.openingTotal)} → {money(s.closingTotal)}</span>
                <span className="font-semibold">+{money(s.deposited)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </Page>
  );
}
