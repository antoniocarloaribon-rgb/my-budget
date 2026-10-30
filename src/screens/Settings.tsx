import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppCtx } from '../context';
import { db, exportBackup, importBackup, resetAll, saveDefaults } from '../lib/db';
import { transactionsToCSV } from '../lib/backup';
import { monthLabel, round2, sum, validateAllocations, validateAmount } from '../lib/finance';
import { saveFile, stamp } from '../lib/files';
import type { Category } from '../lib/types';
import { Button, Card, Page, Section, inputClass, useConfirm, useMoney } from '../components/ui';

type Draft = {
  income: Record<string, string>;
  budgets: Record<string, string>;
  pct: Record<string, string>;
  catNames: Record<string, string>;
  goalNames: Record<string, string>;
  srcNames: Record<string, string>;
  code: string;
  symbol: string;
};

const pctStr = (f: number) => String(Math.round(f * 10000) / 100);
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'category';

export default function Settings({ ctx }: { ctx: AppCtx }) {
  const { core, month } = ctx;
  const money = useMoney();
  const { ask, dialog } = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [applyFrom, setApplyFrom] = useState(true);
  const [newCat, setNewCat] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const reload = () => {
    const d = core.settings.defaults;
    setDraft({
      income: Object.fromEntries(core.sources.map((x) => [x.id, String(d.expectedIncome[x.id] ?? 0)])),
      budgets: Object.fromEntries(core.categories.map((c) => [c.id, String(d.budgets[c.id] ?? 0)])),
      pct: Object.fromEntries(core.goals.map((g) => [g.id, pctStr(d.allocations[g.id] ?? 0)])),
      catNames: Object.fromEntries(core.categories.map((c) => [c.id, c.name])),
      goalNames: Object.fromEntries(core.goals.map((g) => [g.id, g.name])),
      srcNames: Object.fromEntries(core.sources.map((x) => [x.id, x.name])),
      code: core.settings.currency,
      symbol: core.settings.currencySymbol,
    });
    setErrors([]);
  };
  // Reload the form when stored data changes (e.g. after restore)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, [core.settings, core.categories, core.goals, core.sources]);

  if (!draft) return null;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });

  const activeCats = core.categories.filter((c) => !c.archived);
  const archivedCats = core.categories.filter((c) => c.archived);
  const activeGoals = core.goals.filter((g) => !g.archived);
  const fractions = Object.fromEntries(activeGoals.map((g) => [g.id, draft.pct[g.id] === '' ? NaN : Number(draft.pct[g.id]) / 100]));
  const pctCheck = validateAllocations(fractions);
  const num = (v: string) => (v === '' || !Number.isFinite(Number(v)) ? 0 : Number(v));
  const incomeTotal = sum(core.sources.filter((x) => !x.archived).map((x) => num(draft.income[x.id])));
  const budgetTotal = sum(activeCats.map((c) => num(draft.budgets[c.id])));

  const save = async () => {
    const errs: string[] = [];
    for (const x of core.sources) if (validateAmount(draft.income[x.id], { allowZero: true })) errs.push(`${x.name}: enter a valid amount.`);
    for (const c of activeCats) if (validateAmount(draft.budgets[c.id], { allowZero: true })) errs.push(`${c.name}: enter a valid amount.`);
    if (!pctCheck.ok) errs.push(pctCheck.error!);
    if (!draft.symbol.trim() || !draft.code.trim()) errs.push('Currency code and symbol are required.');
    for (const [id, n] of Object.entries({ ...draft.catNames, ...draft.goalNames, ...draft.srcNames }))
      if (!n.trim()) errs.push(`A name is empty (${id}).`);
    setErrors(errs);
    if (errs.length) return;

    await db.transaction('rw', [db.categories, db.goals, db.sources, db.settings, db.months], async () => {
      await db.categories.bulkPut(core.categories.map((c) => ({ ...c, name: draft.catNames[c.id].trim() })));
      await db.goals.bulkPut(core.goals.map((g) => ({ ...g, name: draft.goalNames[g.id].trim() })));
      await db.sources.bulkPut(core.sources.map((x) => ({ ...x, name: draft.srcNames[x.id].trim() })));
      await db.settings.put({ ...core.settings, currency: draft.code.trim().toUpperCase(), currencySymbol: draft.symbol.trim() });
      await saveDefaults(
        {
          expectedIncome: Object.fromEntries(core.sources.map((x) => [x.id, Number(draft.income[x.id])])),
          budgets: Object.fromEntries(activeCats.map((c) => [c.id, Number(draft.budgets[c.id])])),
          allocations: fractions,
        },
        applyFrom ? month : null,
      );
    });
    ctx.toast('Settings saved');
  };

  const addCategory = async () => {
    const name = newCat.trim();
    if (!name) return;
    let id = slug(name);
    while (core.categories.some((c) => c.id === id)) id += '-x';
    const cat: Category = { id, name, order: Math.max(0, ...core.categories.map((c) => c.order)) + 1 };
    await db.categories.add(cat);
    await db.settings.put({ ...core.settings, defaults: { ...core.settings.defaults, budgets: { ...core.settings.defaults.budgets, [id]: 0 } } });
    setNewCat('');
    ctx.toast(`Added ${name}`);
  };

  const archiveCategory = async (c: Category) => {
    const ok = await ask(
      `Remove ${c.name}?`,
      'It will be hidden from new entries and future budgets. Past transactions keep this category. You can restore it later.',
      'Remove',
    );
    if (!ok) return;
    const budgets = { ...core.settings.defaults.budgets };
    delete budgets[c.id];
    await db.categories.put({ ...c, archived: true });
    await db.settings.put({ ...core.settings, defaults: { ...core.settings.defaults, budgets } });
    ctx.toast(`${c.name} removed`);
  };

  const restoreCategory = async (c: Category) => {
    await db.categories.put({ ...c, archived: false });
    await db.settings.put({ ...core.settings, defaults: { ...core.settings.defaults, budgets: { ...core.settings.defaults.budgets, [c.id]: 0 } } });
  };

  const doExport = async () => {
    await saveFile(`my-budget-backup-${stamp()}.json`, JSON.stringify(await exportBackup(), null, 2), 'application/json');
  };
  const doCSV = async () => {
    if (!core.transactions.length) return ctx.toast('No transactions to export');
    await saveFile(`my-budget-transactions-${stamp()}.csv`, transactionsToCSV(core.transactions, core.categories, core.sources, core.settings.currency), 'text/csv');
  };
  const doImport = async (file: File) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      return ctx.toast('That file is not valid JSON');
    }
    const ok = await ask('Restore this backup?', 'All current data on this device will be replaced by the backup.', 'Restore');
    if (!ok) return;
    try {
      await importBackup(parsed);
      ctx.toast('Backup restored');
    } catch (e) {
      ctx.toast((e as Error).message);
    }
  };
  const doReset = async () => {
    const ok = await ask('Erase everything?', 'All transactions, deposits and budget changes will be deleted and the original budget restored. Export a backup first if unsure.', 'Erase');
    if (ok) {
      await resetAll();
      ctx.toast('All data erased');
    }
  };

  return (
    <Page title="Settings">
      <Group title="Expected monthly income" aside={money(incomeTotal)}>
        {core.sources
          .filter((x) => !x.archived)
          .map((x) => (
            <AmountLine key={x.id} name={draft.srcNames[x.id]} onName={(v) => set('srcNames', { ...draft.srcNames, [x.id]: v })} value={draft.income[x.id]} onValue={(v) => set('income', { ...draft.income, [x.id]: v })} symbol={draft.symbol} />
          ))}
      </Group>

      <Group title="Monthly budget" aside={money(budgetTotal)}>
        {activeCats.map((c) => (
          <AmountLine
            key={c.id}
            name={draft.catNames[c.id]}
            onName={(v) => set('catNames', { ...draft.catNames, [c.id]: v })}
            value={draft.budgets[c.id] ?? '0'}
            onValue={(v) => set('budgets', { ...draft.budgets, [c.id]: v })}
            symbol={draft.symbol}
            onRemove={() => archiveCategory(c)}
          />
        ))}
        <div className="flex gap-2 py-3">
          <input className={`${inputClass} !h-11`} placeholder="New category name" value={newCat} maxLength={40} onChange={(e) => setNewCat(e.target.value)} />
          <Button className="!h-11 shrink-0 text-sm" variant="secondary" onClick={addCategory} disabled={!newCat.trim()}>
            Add
          </Button>
        </div>
        {archivedCats.length > 0 && (
          <div className="py-3 text-sm">
            <div className="label mb-2">Removed</div>
            {archivedCats.map((c) => (
              <div key={c.id} className="flex justify-between py-1">
                <span className="text-mute">{c.name}</span>
                <button className="font-medium underline underline-offset-4" onClick={() => restoreCategory(c)}>
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </Group>

      <div className="-mt-2 flex justify-between rounded-2xl bg-soft px-4 py-3 text-sm">
        <span>Expected available</span>
        <span className="num font-semibold">{money(round2(incomeTotal - budgetTotal))}</span>
      </div>

      <Group title="Savings allocation" aside={<span className={pctCheck.ok ? '' : 'font-semibold text-ink'}>{pctCheck.totalPercent}%</span>}>
        {activeGoals.map((g) => (
          <div key={g.id} className="flex items-center gap-3 py-2.5">
            <input className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none" value={draft.goalNames[g.id]} maxLength={40} onChange={(e) => set('goalNames', { ...draft.goalNames, [g.id]: e.target.value })} />
            <div className="relative w-24">
              <input className={`${inputClass} num !h-10 pr-8 text-right`} inputMode="decimal" value={draft.pct[g.id]} onChange={(e) => set('pct', { ...draft.pct, [g.id]: e.target.value.replace(/[^0-9.]/g, '') })} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-mute">%</span>
            </div>
          </div>
        ))}
        {!pctCheck.ok && <p className="pb-3 text-sm font-medium">⚠ {pctCheck.error}</p>}
      </Group>

      <Group title="Currency">
        <div className="grid grid-cols-2 gap-3 py-3">
          <label>
            <span className="label mb-1 block">Code</span>
            <input className={`${inputClass} !h-11`} value={draft.code} maxLength={3} onChange={(e) => set('code', e.target.value)} />
          </label>
          <label>
            <span className="label mb-1 block">Symbol</span>
            <input className={`${inputClass} !h-11`} value={draft.symbol} maxLength={4} onChange={(e) => set('symbol', e.target.value)} />
          </label>
        </div>
      </Group>

      <Card className="space-y-4">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-black" checked={applyFrom} onChange={(e) => setApplyFrom(e.target.checked)} />
          <span>
            Also apply budget, income and % changes to <b>{monthLabel(month)}</b> and later months already opened. Earlier months keep their history.
          </span>
        </label>
        {errors.length > 0 && (
          <ul className="space-y-1 text-sm font-medium">
            {errors.map((e) => (
              <li key={e}>⚠ {e}</li>
            ))}
          </ul>
        )}
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={reload}>
            Undo
          </Button>
          <Button className="flex-[2]" onClick={save}>
            Save settings
          </Button>
        </div>
      </Card>

      <Section title="Backup">
        <Card className="space-y-3">
          <p className="text-sm text-mute">Your data lives only on this device. Export a backup regularly and keep it in Files or iCloud Drive.</p>
          <Button className="w-full" onClick={doExport}>
            Export backup (JSON)
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => fileRef.current?.click()}>
            Restore from backup
          </Button>
          <Button variant="secondary" className="w-full" onClick={doCSV}>
            Export transactions (CSV)
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void doImport(f);
            }}
          />
        </Card>
      </Section>

      <Section title="Danger zone">
        <Button variant="danger" className="w-full" onClick={doReset}>
          Erase all data
        </Button>
      </Section>

      <p className="pb-4 text-center text-xs text-mute">My Budget · v1.0 · Starts {monthLabel(core.settings.startMonth)} · Offline, on-device only</p>
      {dialog}
    </Page>
  );
}

function Group({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <Section title={title} aside={<span className="num text-sm">{aside}</span>}>
      <div className="divide-y divide-line rounded-[22px] border border-line px-5">{children}</div>
    </Section>
  );
}

function AmountLine({ name, onName, value, onValue, symbol, onRemove }: { name: string; onName: (v: string) => void; value: string; onValue: (v: string) => void; symbol: string; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-2 py-2.5">
      <input className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none" value={name} maxLength={40} onChange={(e) => onName(e.target.value)} aria-label="Name" />
      <div className="relative w-28 shrink-0">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mute">{symbol}</span>
        <input className={`${inputClass} num !h-10 pl-7 text-right`} inputMode="decimal" value={value} onChange={(e) => onValue(e.target.value.replace(/[^0-9.]/g, ''))} aria-label={`${name} amount`} />
      </div>
      {onRemove && (
        <button className="h-8 w-8 shrink-0 rounded-full text-lg text-mute active:bg-soft" onClick={onRemove} aria-label={`Remove ${name}`}>
          ×
        </button>
      )}
    </div>
  );
}
