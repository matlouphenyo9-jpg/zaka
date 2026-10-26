// B4-H: "Money you have now", the "How we got this" breakdown, and "Count my cash" (a visible balance correction).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { safeBreakdown, type Forecast } from '../engine/forecast';
import { useStore } from '../lib/store';
import { todaySA } from '../lib/dates';
import { formatRand, parseRandInput } from '../lib/money';
import { shortDate } from '../lib/format';
import { BIG_BALANCE_CENTS, MAX_AMOUNT_CENTS } from '../lib/validate';
import { Button, Card, Field, Sheet } from './ui';
import { Icon } from './Icon';

function Line({ label, value, strong, sub }: { label: string; value: string; strong?: boolean; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className={strong ? 'font-bold text-ink' : 'text-ink'}>{label}</p>
        {sub && <p className="text-sm text-ink-soft">{sub}</p>}
      </div>
      <span className={`tabular shrink-0 ${strong ? 'text-lg font-bold text-teal-dark' : 'font-semibold'}`}>{value}</span>
    </div>
  );
}

/** Whole-rand lines that visibly add up: rounding differences are absorbed by the "lowest day" line. */
export function displayBreakdown(f: Forecast) {
  const b = safeBreakdown(f);
  const r = (c: number) => Math.round(c / 100);
  const now = r(b.balance_cents);
  const bills = r(b.bills_cents);
  const ess = r(b.essentials_cents);
  const exp = r(b.expected_cents);
  const left = now - bills - ess + exp;
  const reserve = r(b.reserve_cents);
  const setAside = r(b.set_aside_cents);
  const safe = Math.floor(b.safe_cents / 100); // same as the big number on Home
  const low = b.safe_cents > 0 ? Math.max(0, left - reserve - setAside - safe) : Math.max(0, r(b.low_day_cents));
  return { now, bills, ess, exp, left, low, reserve, setAside, safe };
}

export function SafeBreakdownList({ f }: { f: Forecast }) {
  const { t: tu } = useTranslation('ui');
  const d = displayBreakdown(f);
  const R = (rands: number) => formatRand(rands * 100);
  const minus = (rands: number) => (rands > 0 ? `−${R(rands)}` : R(0));
  return (
    <div className="divide-y divide-line" data-testid="breakdown">
      <Line label={tu('bd_now')} value={R(d.now)} />
      <Line label={tu('bd_bills')} value={minus(d.bills)} />
      <Line label={tu('bd_essentials', { days: f.horizon_days })} value={minus(d.ess)} />
      <Line label={tu('bd_expected')} sub={tu('bd_expected_sub')} value={`+${R(d.exp)}`} />
      <Line label={tu('bd_left', { date: shortDate(f.horizon_date) })} value={R(d.left)} />
      {d.low > 0 && <Line label={tu('bd_low_day')} value={minus(d.low)} />}
      {d.reserve > 0 && <Line label={tu('bd_reserve')} value={minus(d.reserve)} />}
      {d.setAside > 0 && <Line label={tu('bd_set_aside')} value={minus(d.setAside)} />}
      <Line label={tu('bd_safe')} value={R(d.safe)} strong />
    </div>
  );
}

export function CountCashSheet({ open, onClose, f }: { open: boolean; onClose: () => void; f: Forecast }) {
  const { t } = useTranslation();
  const { t: tu } = useTranslation('ui');
  const { addTxn } = useStore();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmBig, setConfirmBig] = useState(false);
  const [busy, setBusy] = useState(false);
  const entered = value.trim() ? parseRandInput(value) : null;
  const diff = entered == null ? null : entered - f.balance_cents;

  const close = () => {
    setValue('');
    setError(null);
    setConfirmBig(false);
    onClose();
  };

  async function save() {
    if (entered == null) return setError(tu(value.trim() ? 'err_amount_invalid' : 'err_amount_empty'));
    if (entered > MAX_AMOUNT_CENTS) return setError(tu('err_amount_too_big'));
    if (entered > BIG_BALANCE_CENTS && !confirmBig) return setConfirmBig(true);
    if (diff === 0 || diff == null) return close();
    if (Math.abs(diff) > MAX_AMOUNT_CENTS) return setError(tu('err_amount_too_big'));
    setBusy(true);
    try {
      await addTxn({
        direction: diff > 0 ? 'in' : 'out',
        amount_cents: Math.abs(diff),
        category: 'balance_correction',
        source: 'cash',
        note: null,
        occurred_on: todaySA(),
        created_via: 'manual',
        confirmed: true,
      });
      close();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={close} title={tu('count_cash_title')}>
      <div className="space-y-4">
        <p className="text-ink-soft">{tu('count_cash_body')}</p>
        <p className="font-semibold">{tu('count_cash_now', { amount: formatRand(f.balance_cents) })}</p>
        <Field
          label={tu('count_cash_field')}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          maxLength={16}
          error={error}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
            setConfirmBig(false);
          }}
        />
        {diff != null && (
          <p className="rounded-xl bg-ink/5 px-4 py-3 text-[15px] text-ink" data-testid="count-cash-diff">
            {diff === 0 ? tu('count_cash_same') : tu(diff > 0 ? 'count_cash_diff_in' : 'count_cash_diff_out', { amount: formatRand(Math.abs(diff)) })}
          </p>
        )}
        {confirmBig && entered != null && (
          <p className="rounded-xl bg-amber-soft px-4 py-3 font-semibold text-amber-ink" role="alert">{tu('big_amount_confirm', { amount: formatRand(entered) })}</p>
        )}
        <Button block icon="check" disabled={busy} onClick={save}>
          {confirmBig ? tu('big_amount_yes') : diff === 0 ? t('ok') : tu('count_cash_save')}
        </Button>
      </div>
    </Sheet>
  );
}

/** Home: money you have now, a tap-to-open breakdown, and Count my cash. */
export function BalanceCard({ f }: { f: Forecast }) {
  const { t: tu } = useTranslation('ui');
  const [open, setOpen] = useState(false);
  const [counting, setCounting] = useState(false);
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[15px] text-ink-soft">{tu('balance_now')}</p>
          <p className="tabular text-2xl font-bold text-ink" data-testid="balance-now">{formatRand(f.balance_cents)}</p>
        </div>
        <Button variant="secondary" className="shrink-0 px-3" icon="opening_balance" onClick={() => setCounting(true)}>
          {tu('count_cash')}
        </Button>
      </div>
      <button
        className="mt-2 inline-flex min-h-tap items-center gap-1 font-semibold text-teal"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="info" size={18} /> {tu('how_we_got')} <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && <div className="mt-1"><SafeBreakdownList f={f} /></div>}
      <CountCashSheet open={counting} onClose={() => setCounting(false)} f={f} />
    </Card>
  );
}
