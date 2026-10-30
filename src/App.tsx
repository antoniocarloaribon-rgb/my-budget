import { useCallback, useEffect, useState } from 'react';
import type { AppCtx, Tab } from './context';
import { useCore, type ReadyCore } from './lib/useBudget';
import { addMonths, monthLabel, summarizeMonth } from './lib/finance';
import { planFromDefaults } from './lib/db';
import type { Deposit, Transaction, TransactionType } from './lib/types';
import { CurrencyContext, Sheet, currentMonth, defaultDateFor, useMoney, useToast } from './components/ui';
import { DepositSheet, TransactionSheet } from './components/forms';
import Dashboard from './screens/Dashboard';
import Transactions from './screens/Transactions';
import Budget from './screens/Budget';
import Savings from './screens/Savings';
import History from './screens/History';
import Reports from './screens/Reports';
import Settings from './screens/Settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Overview', icon: 'M3 12l9-8 9 8M5 10v10h14V10' },
  { id: 'transactions', label: 'Activity', icon: 'M4 6h16M4 12h16M4 18h10' },
  { id: 'budget', label: 'Budget', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { id: 'savings', label: 'Savings', icon: 'M12 3v18M17 7.5C17 5.6 14.8 4.5 12 4.5S7 5.6 7 7.6s2.2 2.9 5 3.4 5 1.5 5 3.5-2.2 3-5 3-5-1.1-5-3' },
];
const MORE: { id: Tab; label: string; desc: string }[] = [
  { id: 'history', label: 'Monthly history', desc: 'Every month since November 2026' },
  { id: 'reports', label: 'Reports', desc: 'Expense breakdown and savings trends' },
  { id: 'settings', label: 'Settings', desc: 'Budget, income, %, currency, backup' },
];

const readHash = (): Tab => {
  const h = window.location.hash.slice(1) as Tab;
  return ['home', 'transactions', 'budget', 'savings', 'history', 'reports', 'settings'].includes(h) ? h : 'home';
};

export default function App() {
  const core = useCore();
  if (!core.ready)
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="text-sm text-mute">Loading…</div>
      </div>
    );
  return (
    <CurrencyContext.Provider value={core.settings!.currencySymbol}>
      <Shell core={core as ReadyCore} />
    </CurrencyContext.Provider>
  );
}

function Shell({ core }: { core: ReadyCore }) {
  const start = core.settings.startMonth;
  const [tab, setTab] = useState<Tab>(readHash);
  const [month, setMonthRaw] = useState(() => (currentMonth() < start ? start : currentMonth()));
  const [more, setMore] = useState(false);
  const [tx, setTx] = useState<{ open: boolean; editing: Transaction | null; type: TransactionType }>({ open: false, editing: null, type: 'expense' });
  const [dep, setDep] = useState<{ open: boolean; editing: Deposit | null; goalId: string }>({ open: false, editing: null, goalId: '' });
  const { show, toast } = useToast();
  const money = useMoney();

  const setMonth = (m: string) => setMonthRaw(m < start ? start : m);
  const go = useCallback((t: Tab) => {
    setTab(t);
    setMore(false);
    window.location.hash = t;
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onHash = () => setTab(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const ctx: AppCtx = {
    core,
    month,
    setMonth,
    go,
    openTx: (editing, type = 'expense') => setTx({ open: true, editing, type: editing?.type ?? type }),
    openDeposit: (editing, goalId) => setDep({ open: true, editing, goalId: editing?.goalId ?? goalId ?? core.goals[0]?.id ?? '' }),
    toast: show,
  };

  const plannedHint = (goalId: string) => {
    const plan = core.months.find((m) => m.month === month) ?? planFromDefaults(core.settings, month);
    const s = summarizeMonth(plan, core.transactions, core.deposits, core.goals);
    const p = s.planned[goalId];
    return p ? `Planned for ${monthLabel(month)}: ${money(p)}` : undefined;
  };

  const Screen = { home: Dashboard, transactions: Transactions, budget: Budget, savings: Savings, history: History, reports: Reports, settings: Settings }[tab];
  const showMonth = tab !== 'settings' && tab !== 'history';
  const fabTabs: Tab[] = ['home', 'transactions', 'budget'];

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-paper">
      <header className="sticky top-0 z-30 bg-paper/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-5">
          <div className="text-[13px] font-semibold uppercase tracking-[0.18em]">My Budget</div>
          {showMonth && (
            <div className="flex items-center gap-1">
              <button aria-label="Previous month" disabled={month <= start} onClick={() => setMonth(addMonths(month, -1))} className="h-9 w-9 rounded-full text-lg active:bg-soft disabled:opacity-20">
                ‹
              </button>
              <button onClick={() => setMonth(currentMonth())} className="num min-w-[92px] text-center text-sm font-semibold">
                {monthLabel(month, 'short')}
              </button>
              <button aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))} className="h-9 w-9 rounded-full text-lg active:bg-soft">
                ›
              </button>
            </div>
          )}
        </div>
      </header>

      <main key={tab}>
        <Screen ctx={ctx} />
      </main>

      {fabTabs.includes(tab) && (
        <button
          onClick={() => ctx.openTx(null, 'expense')}
          aria-label="Add transaction"
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+84px)] right-[max(20px,calc(50vw-14rem))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-3xl font-light text-paper shadow-[0_8px_24px_rgba(0,0,0,0.25)] active:scale-95"
        >
          +
        </button>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="mx-auto grid h-[64px] max-w-lg grid-cols-5">
          {TABS.map((t) => (
            <NavBtn key={t.id} active={tab === t.id} label={t.label} onClick={() => go(t.id)}>
              <path d={t.icon} />
            </NavBtn>
          ))}
          <NavBtn active={['history', 'reports', 'settings'].includes(tab)} label="More" onClick={() => setMore(true)}>
            <circle cx="5" cy="12" r="1.2" />
            <circle cx="12" cy="12" r="1.2" />
            <circle cx="19" cy="12" r="1.2" />
          </NavBtn>
        </div>
      </nav>

      <Sheet open={more} onClose={() => setMore(false)} title="More">
        <div className="divide-y divide-line">
          {MORE.map((m) => (
            <button key={m.id} onClick={() => go(m.id)} className="flex w-full items-center justify-between py-4 text-left active:opacity-60">
              <div>
                <div className="text-[17px] font-semibold">{m.label}</div>
                <div className="text-sm text-mute">{m.desc}</div>
              </div>
              <span className="text-xl text-mute">›</span>
            </button>
          ))}
        </div>
      </Sheet>

      <TransactionSheet
        open={tx.open}
        onClose={() => setTx((s) => ({ ...s, open: false }))}
        editing={tx.editing}
        defaultType={tx.type}
        defaultDate={defaultDateFor(month)}
        categories={core.categories}
        sources={core.sources}
        symbol={core.settings.currencySymbol}
        startMonth={start}
        onSaved={show}
      />
      <DepositSheet
        open={dep.open}
        onClose={() => setDep((s) => ({ ...s, open: false }))}
        editing={dep.editing}
        defaultGoalId={dep.goalId}
        defaultDate={defaultDateFor(month)}
        goals={core.goals}
        symbol={core.settings.currencySymbol}
        startMonth={start}
        plannedHint={plannedHint}
        onSaved={show}
      />
      {toast}
    </div>
  );
}

function NavBtn({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 ${active ? 'text-ink' : 'text-[#a3a3a3]'}`} aria-current={active ? 'page' : undefined}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
      <span className="text-[10px] font-semibold tracking-wide">{label}</span>
    </button>
  );
}
