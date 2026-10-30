import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { validateAmount } from '../lib/finance';
import type { Category, Deposit, Goal, IncomeSource, Transaction, TransactionType } from '../lib/types';
import { Button, Field, MoneyInput, Segmented, Sheet, inputClass, useConfirm } from './ui';

function validateDate(date: string, startMonth: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Choose a date.';
  if (date.slice(0, 7) < startMonth) return `Records start from ${startMonth}.`;
  return null;
}

// ---------- income / expense ----------

export function TransactionSheet({
  open,
  onClose,
  editing,
  defaultType,
  defaultDate,
  categories,
  sources,
  symbol,
  startMonth,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: Transaction | null;
  defaultType: TransactionType;
  defaultDate: string;
  categories: Category[];
  sources: IncomeSource[];
  symbol: string;
  startMonth: string;
  onSaved: (msg: string) => void;
}) {
  const [type, setType] = useState<TransactionType>(defaultType);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const { ask, dialog } = useConfirm();

  const activeCats = categories.filter((c) => !c.archived || c.id === editing?.categoryId);
  const activeSrc = sources.filter((s) => !s.archived || s.id === editing?.sourceId);

  useEffect(() => {
    if (!open) return;
    const t = editing?.type ?? defaultType;
    setType(t);
    setAmount(editing ? String(editing.amount) : '');
    setDate(editing?.date ?? defaultDate);
    setRef(editing ? (t === 'income' ? editing.sourceId : editing.categoryId) ?? '' : '');
    setNote(editing?.note ?? '');
    setErrors({});
  }, [open, editing, defaultType, defaultDate]);

  const switchType = (t: TransactionType) => {
    setType(t);
    setRef('');
  };

  const save = async () => {
    const e = {
      amount: validateAmount(amount),
      date: validateDate(date, startMonth),
      ref: ref ? null : type === 'income' ? 'Choose an income source.' : 'Choose a category.',
    };
    setErrors(e);
    if (e.amount || e.date || e.ref) return;
    const record: Transaction = {
      type,
      amount: Number(amount),
      date,
      note: note.trim() || undefined,
      ...(type === 'income' ? { sourceId: ref } : { categoryId: ref }),
      createdAt: editing?.createdAt ?? Date.now(),
    };
    if (editing?.id) await db.transactions.put({ ...record, id: editing.id });
    else await db.transactions.add(record);
    onSaved(editing ? 'Transaction updated' : 'Transaction added');
    onClose();
  };

  const remove = async () => {
    if (!editing?.id) return;
    if (await ask('Delete transaction?', 'This permanently removes it and updates your totals.')) {
      await db.transactions.delete(editing.id);
      onSaved('Transaction deleted');
      onClose();
    }
  };

  const options = type === 'income' ? activeSrc : activeCats;

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit transaction' : 'New transaction'}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Segmented
          value={type}
          onChange={switchType}
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
          ]}
        />
        <Field label="Amount" error={errors.amount}>
          <MoneyInput value={amount} onChange={setAmount} symbol={symbol} autoFocus={!editing} />
        </Field>
        <Field label={type === 'income' ? 'Income source' : 'Category'} error={errors.ref}>
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <button
                type="button"
                key={o.id}
                onClick={() => setRef(o.id)}
                className={`rounded-full border px-3.5 py-2 text-sm font-medium ${ref === o.id ? 'border-ink bg-ink text-paper' : 'border-line'}`}
              >
                {o.name}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Date" error={errors.date}>
          <input type="date" className={inputClass} value={date} min={`${startMonth}-01`} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <input className={inputClass} value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Meralco bill" />
        </Field>
        <div className="flex gap-3 pt-1">
          {editing && (
            <Button variant="danger" onClick={remove} className="flex-1">
              Delete
            </Button>
          )}
          <Button type="submit" className="flex-[2]">
            {editing ? 'Save changes' : 'Add'}
          </Button>
        </div>
      </form>
      {dialog}
    </Sheet>
  );
}

// ---------- savings deposit ----------

export function DepositSheet({
  open,
  onClose,
  editing,
  defaultGoalId,
  defaultDate,
  goals,
  symbol,
  startMonth,
  plannedHint,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: Deposit | null;
  defaultGoalId: string;
  defaultDate: string;
  goals: Goal[];
  symbol: string;
  startMonth: string;
  plannedHint?: (goalId: string) => string | undefined;
  onSaved: (msg: string) => void;
}) {
  const [goalId, setGoalId] = useState(defaultGoalId);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const { ask, dialog } = useConfirm();

  useEffect(() => {
    if (!open) return;
    setGoalId(editing?.goalId ?? defaultGoalId);
    setAmount(editing ? String(editing.amount) : '');
    setDate(editing?.date ?? defaultDate);
    setNote(editing?.note ?? '');
    setErrors({});
  }, [open, editing, defaultGoalId, defaultDate]);

  const save = async () => {
    const e = {
      amount: validateAmount(amount),
      date: validateDate(date, startMonth),
      goal: goalId ? null : 'Choose a goal.',
    };
    setErrors(e);
    if (e.amount || e.date || e.goal) return;
    const record: Deposit = { goalId, amount: Number(amount), date, note: note.trim() || undefined, createdAt: editing?.createdAt ?? Date.now() };
    if (editing?.id) await db.deposits.put({ ...record, id: editing.id });
    else await db.deposits.add(record);
    onSaved(editing ? 'Deposit updated' : 'Deposit recorded');
    onClose();
  };

  const remove = async () => {
    if (!editing?.id) return;
    if (await ask('Delete deposit?', 'Balances for this and later months will update.')) {
      await db.deposits.delete(editing.id);
      onSaved('Deposit deleted');
      onClose();
    }
  };

  const hint = plannedHint?.(goalId);

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit deposit' : 'Record a deposit'}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p className="text-sm text-mute">Record money you actually moved into savings. Planned amounts are never counted automatically.</p>
        <Field label="Goal" error={errors.goal}>
          <div className="flex flex-wrap gap-2">
            {goals
              .filter((g) => !g.archived || g.id === editing?.goalId)
              .map((g) => (
                <button
                  type="button"
                  key={g.id}
                  onClick={() => setGoalId(g.id)}
                  className={`rounded-full border px-3.5 py-2 text-sm font-medium ${goalId === g.id ? 'border-ink bg-ink text-paper' : 'border-line'}`}
                >
                  {g.name}
                </button>
              ))}
          </div>
        </Field>
        <Field label="Amount deposited" error={errors.amount} hint={hint}>
          <MoneyInput value={amount} onChange={setAmount} symbol={symbol} autoFocus={!editing} />
        </Field>
        <Field label="Date" error={errors.date}>
          <input type="date" className={inputClass} value={date} min={`${startMonth}-01`} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <input className={inputClass} value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Transfer to GoSave" />
        </Field>
        <div className="flex gap-3 pt-1">
          {editing && (
            <Button variant="danger" onClick={remove} className="flex-1">
              Delete
            </Button>
          )}
          <Button type="submit" className="flex-[2]">
            {editing ? 'Save changes' : 'Record deposit'}
          </Button>
        </div>
      </form>
      {dialog}
    </Sheet>
  );
}
