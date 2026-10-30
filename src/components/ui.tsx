import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { formatMoney } from '../lib/finance';

// ---------- currency context ----------

export const CurrencyContext = createContext('₱');
export function useMoney() {
  const symbol = useContext(CurrencyContext);
  return (n: number, decimals?: boolean) => formatMoney(n, symbol, { decimals });
}

// ---------- layout ----------

export function Page({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="px-5 pb-32 pt-2">
      <div className="mb-5 flex items-end justify-between gap-3">
        <h1 className="text-[34px] font-semibold leading-none tracking-[-0.03em]">{title}</h1>
        {action}
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

export function Section({ title, aside, children }: { title?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section>
      {title && (
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="label">{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Card({ children, className = '', dark = false }: { children: ReactNode; className?: string; dark?: boolean }) {
  return (
    <div className={`${dark ? 'bg-ink text-paper' : 'bg-paper border border-line'} rounded-[22px] p-5 ${className}`}>
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, big = false }: { label: string; value: string; sub?: string; big?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="label !text-current opacity-60">{label}</div>
      <div className={`num truncate ${big ? 'mt-1 text-[40px] font-semibold tracking-[-0.04em]' : 'mt-0.5 text-xl font-semibold tracking-[-0.02em]'}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs opacity-60">{sub}</div>}
    </div>
  );
}

export function Row({ left, sub, right, rightSub, onClick }: { left: ReactNode; sub?: ReactNode; right?: ReactNode; rightSub?: ReactNode; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`flex w-full items-center justify-between gap-3 py-3.5 text-left ${onClick ? 'active:opacity-60' : ''}`}>
      <div className="min-w-0">
        <div className="truncate text-[15px] font-medium">{left}</div>
        {sub && <div className="mt-0.5 truncate text-xs text-mute">{sub}</div>}
      </div>
      <div className="shrink-0 text-right">
        <div className="num text-[15px] font-medium">{right}</div>
        {rightSub && <div className="num mt-0.5 text-xs text-mute">{rightSub}</div>}
      </div>
    </Tag>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-line rounded-[22px] border border-line bg-paper px-5">{children}</div>;
}

export function Bar({ value, max, inverted = false }: { value: number; max: number; inverted?: boolean }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : value > 0 ? 100 : 0;
  const over = max > 0 && value > max;
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full ${inverted ? 'bg-white/20' : 'bg-soft'}`}>
      <div
        className={`h-full rounded-full ${inverted ? 'bg-paper' : over ? 'bg-ink bar-over' : 'bg-ink'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-dashed border-line px-6 py-10 text-center">
      <div className="mx-auto mb-3 h-8 w-8 rounded-full border border-ink" />
      <div className="text-[15px] font-semibold">{title}</div>
      <p className="mx-auto mt-1 max-w-[260px] text-sm text-mute">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-ink px-4 py-3 text-sm">{children}</div>;
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  const styles = {
    primary: 'bg-ink text-paper',
    secondary: 'border border-ink text-ink bg-paper',
    ghost: 'text-ink underline underline-offset-4',
    danger: 'border border-ink text-ink bg-paper',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`h-12 rounded-full px-5 text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-30 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-full bg-soft p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`h-9 flex-1 rounded-full text-sm font-semibold transition ${value === o.value ? 'bg-ink text-paper' : 'text-mute'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- form fields ----------

export function Field({ label, error, hint, children }: { label: string; error?: string | null; hint?: string; children: ReactNode }) {
  return (
    <div className="block" role="group" aria-label={label}>
      <span className="label mb-1.5 block">{label}</span>
      {children}
      {error ? <span className="mt-1.5 block text-sm font-medium">⚠ {error}</span> : hint ? <span className="mt-1.5 block text-xs text-mute">{hint}</span> : null}
    </div>
  );
}

export const inputClass =
  'h-12 w-full rounded-2xl border border-line bg-paper px-4 text-base outline-none focus:border-ink';

export function MoneyInput({ value, onChange, symbol, autoFocus }: { value: string; onChange: (v: string) => void; symbol: string; autoFocus?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mute">{symbol}</span>
      <input
        className={`${inputClass} num pl-9`}
        inputMode="decimal"
        autoFocus={autoFocus}
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
      />
    </div>
  );
}

// ---------- bottom sheet & confirm ----------

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/40 animate-fade" onClick={onClose} />
      <div
        ref={ref}
        className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-paper px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3 animate-up sm:rounded-[28px]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
          <button onClick={onClose} className="h-9 w-9 rounded-full bg-soft text-lg leading-none" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function useConfirm() {
  const [state, setState] = useState<{ title: string; body: string; confirm: string; resolve: (ok: boolean) => void } | null>(null);
  const ask = (title: string, body: string, confirm = 'Delete') =>
    new Promise<boolean>((resolve) => setState({ title, body, confirm, resolve }));
  const close = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };
  const dialog = state ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6" role="alertdialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/50 animate-fade" onClick={() => close(false)} />
      <div className="relative w-full max-w-sm rounded-[24px] bg-paper p-6 text-center animate-up">
        <div className="text-lg font-semibold">{state.title}</div>
        <p className="mt-2 text-sm text-mute">{state.body}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => close(false)}>Cancel</Button>
          <Button onClick={() => close(true)}>{state.confirm}</Button>
        </div>
      </div>
    </div>
  ) : null;
  return { ask, dialog };
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2400);
    return () => clearTimeout(t);
  }, [msg]);
  const toast = msg ? (
    <div className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-[70] flex justify-center px-6">
      <div className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper shadow-lg animate-fade">{msg}</div>
    </div>
  ) : null;
  return { show: setMsg, toast };
}

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const currentMonth = () => todayISO().slice(0, 7);

/** A sensible default date for a new record in the given month. */
export const defaultDateFor = (month: string) => (currentMonth() === month ? todayISO() : `${month}-01`);

export function shortDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
