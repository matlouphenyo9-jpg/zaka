import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({ variant = 'primary', icon, className = '', children, block, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: string; block?: boolean }) {
  const styles: Record<Variant, string> = {
    primary: 'bg-teal text-white hover:bg-teal-dark active:bg-teal-dark shadow-sm disabled:bg-ink-faint',
    secondary: 'bg-white text-ink border border-line hover:border-ink-faint active:bg-paper',
    ghost: 'bg-transparent text-teal hover:bg-teal-soft',
    danger: 'bg-white text-risk border border-risk/40 hover:bg-risk-soft',
  };
  return (
    <button
      {...rest}
      className={`inline-flex min-h-tap items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed ${block ? 'w-full' : ''} ${styles[variant]} ${className}`}
    >
      {icon && <Icon name={icon} size={20} />}
      {children}
    </button>
  );
}

export function Card({ children, className = '', tone = 'plain' }: { children: ReactNode; className?: string; tone?: 'plain' | 'amber' | 'risk' | 'teal' }) {
  const tones = {
    plain: 'bg-card border-line',
    amber: 'bg-amber-soft border-amber/30 text-amber-ink',
    risk: 'bg-risk-soft border-risk/30',
    teal: 'bg-teal-soft border-teal/20',
  };
  return <section className={`rounded-xl2 border p-4 shadow-card ${tones[tone]} ${className}`}>{children}</section>;
}

export function Badge({ children, tone = 'ink', icon }: { children: ReactNode; tone?: 'ink' | 'teal' | 'amber' | 'risk' | 'gold'; icon?: string }) {
  const tones = {
    ink: 'bg-ink/5 text-ink',
    teal: 'bg-teal-soft text-teal-dark',
    amber: 'bg-amber-soft text-amber-ink',
    risk: 'bg-risk-soft text-risk',
    gold: 'bg-[#F6EDCF] text-[#6B5208]',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${tones[tone]}`}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </span>
  );
}

export function Field({ label, hint, error, className = '', suffix, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null; suffix?: ReactNode }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-base font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={!!error}
          aria-describedby={hint || error ? `${id}-d` : undefined}
          {...rest}
          className={`min-h-tap w-full rounded-xl border bg-white px-4 py-3 text-base text-ink placeholder:text-ink-faint focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/25 ${error ? 'border-risk' : 'border-line'}`}
        />
        {suffix && <div className="absolute inset-y-0 right-3 flex items-center">{suffix}</div>}
      </div>
      {(hint || error) && (
        <p id={`${id}-d`} className={`mt-1.5 text-sm ${error ? 'font-semibold text-risk' : 'text-ink-soft'}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export function Chip({ selected, onClick, icon, children, className = '' }: { selected?: boolean; onClick?: () => void; icon?: string; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex min-h-tap items-center gap-2 rounded-xl border px-3.5 py-2 text-[15px] font-semibold transition-colors ${
        selected ? 'border-teal bg-teal text-white' : 'border-line bg-white text-ink hover:border-ink-faint'
      } ${className}`}
    >
      {icon && <Icon name={icon} size={20} />}
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: string; tone?: 'teal' | 'ink' }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-xl bg-ink/5 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`inline-flex min-h-tap min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-center text-[15px] font-semibold leading-tight transition [overflow-wrap:anywhere] ${value === o.value ? 'bg-white text-ink shadow-sm' : 'text-ink-soft'}`}
        >
          {o.icon && <Icon name={o.icon} size={20} className="shrink-0 max-[359px]:hidden" />}
          <span className="min-w-0">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" className="absolute inset-0 bg-ink/40" onClick={onClose} tabIndex={-1} />
      <div ref={ref} tabIndex={-1} className="relative max-h-[88vh] w-full max-w-[480px] overflow-y-auto rounded-t-[1.75rem] bg-paper px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl outline-none">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold text-ink">{title}</h2>
          <button onClick={onClose} className="-mr-2 -mt-1 inline-flex min-h-tap min-w-tap items-center justify-center rounded-full text-ink-soft hover:bg-ink/5" aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({ message, onDone, tone = 'teal' }: { message: string | null; onDone: () => void; tone?: 'teal' | 'amber' }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3600);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
      <div className={`pointer-events-auto flex max-w-[440px] items-center gap-2 rounded-xl px-4 py-3 text-base font-semibold shadow-lg ${tone === 'teal' ? 'bg-ink text-white' : 'bg-amber-soft text-amber-ink'}`}>
        <Icon name={tone === 'teal' ? 'check' : 'offline'} size={20} />
        {message}
      </div>
    </div>
  );
}

export function ScreenTitle({ children, sub, right }: { children: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-[1.6rem] font-bold leading-tight tracking-tight text-ink">{children}</h1>
        {sub && <p className="mt-1 text-base text-ink-soft">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Row({ icon, title, sub, right, tone }: { icon?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; tone?: 'in' | 'out' }) {
  return (
    <div className="flex min-h-[56px] items-center gap-3 py-2">
      {icon && (
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone === 'in' ? 'bg-teal-soft text-teal' : 'bg-ink/5 text-ink'}`}>
          <Icon name={icon} size={20} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-semibold text-ink">{title}</div>
        {sub && <div className="truncate text-sm text-ink-soft">{sub}</div>}
      </div>
      {right && <div className="shrink-0 text-right">{right}</div>}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-ink-soft" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-teal/30 border-t-teal" />
      {label}
    </div>
  );
}
