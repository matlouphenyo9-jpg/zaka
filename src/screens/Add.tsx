import { useTranslation } from 'react-i18next';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { forecastFor } from '../lib/useForecast';
import { Button, Card, Chip, Field, Row, ScreenTitle, Segmented, Toast } from '../components/ui';
import { Icon } from '../components/Icon';
import { CATEGORY_ICON, IN_CATEGORIES, OUT_CATEGORIES, sourceFor } from '../engine/categories';
import type { Category, Direction } from '../engine/types';
import { formatEstimate, formatRand } from '../lib/money';
import { addDays, isValidISODate, todaySA } from '../lib/dates';
import { shortDate } from '../lib/format';
import { parseEntry } from '../lib/ai';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

export function AddScreen() {
  const { t, i18n } = useTranslation();
  const { t: tu } = useTranslation('ui');
  const { addTxn, deleteTxn, data } = useStore();
  const today = todaySA();
  const [direction, setDirection] = useState<Direction>('in');
  const [amount, setAmount] = useState(''); // rand string typed on the keypad
  const [category, setCategory] = useState<Category | null>(null);
  const [paidWith, setPaidWith] = useState<'cash' | 'bank'>('cash');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ amount?: string; date?: string; category?: string }>({});
  const [via, setVia] = useState<'manual' | 'ai_parsed'>('manual');
  const [typed, setTyped] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseMsg, setParseMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'teal' | 'amber' } | null>(null);
  const [impact, setImpact] = useState<{ from: string | null; to: string | null; safeFrom: number; safeTo: number } | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);

  const cents = useMemo(() => {
    if (!amount) return 0;
    const n = Math.round(parseFloat(amount) * 100);
    return Number.isFinite(n) ? n : 0;
  }, [amount]);

  function press(k: string) {
    setErrors((e) => ({ ...e, amount: undefined }));
    if (k === 'del') return setAmount((a) => a.slice(0, -1));
    setAmount((a) => {
      if (k === '.' && (a.includes('.') || a === '')) return a === '' ? '0.' : a;
      const next = a === '0' && k !== '.' ? k : a + k;
      const [w, f] = next.split('.');
      if (w.length > 7 || (f && f.length > 2)) return a;
      return next;
    });
  }

  async function fillFromText() {
    if (!typed.trim()) return;
    setParsing(true);
    setParseMsg(null);
    try {
      const r = await parseEntry(typed, i18n.language);
      if (!r) return setParseMsg({ tone: 'error', text: tu('type_it_failed') });
      const e = r.entry;
      setDirection(e.direction);
      setAmount(e.amount_cents % 100 ? (e.amount_cents / 100).toFixed(2) : String(e.amount_cents / 100));
      setCategory(e.category);
      setDate(e.occurred_on > today ? today : e.occurred_on);
      setNote(typed.trim().slice(0, 140));
      setVia('ai_parsed');
      setParseMsg({ tone: 'info', text: r.via === 'ai' ? t('confirm_parse') : `${tu('type_it_fallback')} ${t('confirm_parse')}` });
    } finally {
      setParsing(false);
    }
  }

  async function save() {
    const errs: typeof errors = {};
    if (!(cents > 0)) errs.amount = t('amount_error');
    if (!isValidISODate(date) || date > addDays(today, 60) || date < '2020-01-01') errs.date = t('date_error');
    if (!category) errs.category = t('choose_category');
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const before = forecastFor(data, today);
    const { queued, txn } = await addTxn({
      direction,
      amount_cents: cents,
      category: category!,
      source: sourceFor(category!, paidWith),
      note: note.trim() ? note.trim().slice(0, 140) : null,
      occurred_on: date,
      created_via: via,
      confirmed: true,
    });
    const after = forecastFor({ ...data, txns: [...data.txns, txn] }, today);
    setImpact({ from: before.shortfall?.date ?? null, to: after.shortfall?.date ?? null, safeFrom: before.safe_cents, safeTo: after.safe_cents });
    setLastId(txn.id);
    setToast({ text: queued ? tu('queued') : t('saved'), tone: queued ? 'amber' : 'teal' });
    setAmount('');
    setCategory(null);
    setNote('');
    setTyped('');
    setVia('manual');
    setParseMsg(null);
    setDate(today);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const cats = direction === 'in' ? IN_CATEGORIES : OUT_CATEGORIES;
  const recent = [...data.txns].sort((a, b) => (b.occurred_on + b.id).localeCompare(a.occurred_on + a.id)).slice(0, 6);
  const needsPaidWith = category && !['grant', 'piece_job', 'trade'].includes(category);

  return (
    <div>
      <ScreenTitle>{t('entry_title')}</ScreenTitle>

      {impact && (impact.from !== impact.to || impact.safeFrom !== impact.safeTo) && (
        <Card tone="teal" className="mb-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal text-white">
              <Icon name="sparkle" size={20} />
            </span>
            <div className="flex-1">
              {impact.from && impact.to && impact.from !== impact.to && <p className="font-semibold text-ink">{tu('shortfall_moved', { from: shortDate(impact.from), to: shortDate(impact.to) })}</p>}
              {impact.from && !impact.to && <p className="font-semibold text-ink">{tu('shortfall_cleared')}</p>}
              <p className="mt-0.5 text-ink-soft">
                {tu('plan_result')}: <span className="tabular line-through decoration-ink-faint">{formatEstimate(impact.safeFrom)}</span> → <strong className="tabular text-teal-dark">{formatEstimate(impact.safeTo)}</strong>
              </p>
              <div className="mt-2 flex gap-2">
                <Link to="/" className="inline-flex min-h-tap items-center font-semibold text-teal">{tu('nav_home')} →</Link>
                {lastId && (
                  <button className="ml-auto min-h-tap px-2 text-sm font-semibold text-ink-soft" onClick={() => { void deleteTxn(lastId); setImpact(null); setLastId(null); }}>
                    {tu('undo')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Type it */}
      <Card className="mb-4">
        <label htmlFor="typeit" className="flex items-center gap-2 text-base font-semibold">
          <Icon name="sparkle" size={20} className="text-teal" /> {tu('type_it')}
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="typeit"
            value={typed}
            maxLength={200}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fillFromText()}
            placeholder={tu('type_it_hint')}
            className="min-h-tap min-w-0 flex-1 rounded-xl border border-line bg-white px-4 text-base placeholder:text-ink-faint focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/25"
          />
          <Button onClick={fillFromText} disabled={parsing || !typed.trim()} className="shrink-0 px-4">
            {parsing ? tu('type_it_busy') : tu('type_it_go')}
          </Button>
        </div>
        {parseMsg && <p className={`mt-2 rounded-lg px-3 py-2 text-[15px] ${parseMsg.tone === 'info' ? 'bg-amber-soft text-amber-ink' : 'bg-risk-soft text-risk'}`}>{parseMsg.text}</p>}
      </Card>

      <Segmented
        label={t('direction')}
        value={direction}
        onChange={(d) => { setDirection(d); setCategory(null); }}
        options={[
          { value: 'in', label: tu('money_in'), icon: 'income' },
          { value: 'out', label: tu('money_out'), icon: 'debt' },
        ]}
      />

      {/* Amount */}
      <div className={`mt-4 rounded-xl2 border bg-white px-5 py-4 text-center ${errors.amount ? 'border-risk' : 'border-line'}`} aria-live="polite">
        <span className="sr-only">{t('amount')}</span>
        <span className={`tabular text-[3rem] font-bold leading-none ${cents ? (direction === 'in' ? 'text-teal-dark' : 'text-ink') : 'text-ink-faint'}`}>
          {direction === 'out' && cents ? '−' : ''}R{amount || '0'}
        </span>
        {errors.amount && <p className="mt-2 text-sm font-semibold text-risk">{errors.amount}</p>}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            aria-label={k === 'del' ? tu('keypad_delete') : k}
            className="tabular flex min-h-[56px] items-center justify-center rounded-xl bg-white text-2xl font-semibold text-ink shadow-sm ring-1 ring-line active:bg-teal-soft"
          >
            {k === 'del' ? <Icon name="back" /> : k}
          </button>
        ))}
      </div>

      {/* Category */}
      <p className="mb-2 mt-5 text-base font-semibold">{t('choose_category')}</p>
      <div className="flex flex-wrap gap-2">
        {cats.map((c) => (
          <Chip key={c} icon={CATEGORY_ICON[c]} selected={category === c} onClick={() => { setCategory(c); setErrors((e) => ({ ...e, category: undefined })); }}>
            {tu(`cat_${c}`)}
          </Chip>
        ))}
      </div>
      {errors.category && <p className="mt-2 text-sm font-semibold text-risk">{errors.category}</p>}

      {needsPaidWith && (
        <div className="mt-4">
          <Segmented label={t('source')} value={paidWith} onChange={setPaidWith} options={[{ value: 'cash', label: tu('src_cash') }, { value: 'bank', label: tu('src_bank') }]} />
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label={t('entry_date')} type="date" value={date} max={addDays(today, 60)} onChange={(e) => setDate(e.target.value)} error={errors.date} />
        <Field label={t('note')} value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} />
      </div>

      <Button block className="mt-5" onClick={save} icon="check">
        {t('save_entry')}
      </Button>
      {!navigator.onLine && <p className="mt-3 rounded-xl bg-amber-soft px-4 py-3 text-[15px] text-amber-ink">{t('offline')}</p>}

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 text-lg font-bold">{tu('recent')}</h2>
          <div className="divide-y divide-line rounded-xl2 border border-line bg-white px-4">
            {recent.map((x) => (
              <Row
                key={x.id}
                icon={CATEGORY_ICON[x.category]}
                tone={x.direction}
                title={tu(`cat_${x.category}`)}
                sub={`${shortDate(x.occurred_on)}${x.note ? ` · ${x.note}` : ''}`}
                right={
                  <div className="flex items-center gap-1">
                    <span className={`tabular font-semibold ${x.direction === 'in' ? 'text-teal-dark' : 'text-ink'}`}>
                      {x.direction === 'in' ? '+' : '−'}
                      {formatRand(x.amount_cents)}
                    </span>
                    <button aria-label={tu('delete_entry')} onClick={() => deleteTxn(x.id)} className="inline-flex min-h-tap min-w-tap items-center justify-center rounded-full text-ink-faint hover:bg-ink/5 hover:text-risk">
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        </section>
      )}
      <Toast message={toast?.text ?? null} tone={toast?.tone} onDone={() => setToast(null)} />
    </div>
  );
}
