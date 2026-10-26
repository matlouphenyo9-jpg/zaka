// B5: "📸 Snap or upload a slip". Photo, screenshot or PDF → Claude reads it once → the person checks and corrects
// every field → only then is anything saved. The file itself is never stored.
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { forecastFor } from '../lib/useForecast';
import { Button, Card, Chip, Field, ScreenTitle, Segmented, Spinner } from '../components/ui';
import { Icon } from '../components/Icon';
import { CATEGORY_ICON, IN_CATEGORIES, OUT_CATEGORIES, sourceFor } from '../engine/categories';
import type { Category } from '../engine/types';
import { formatEstimate, formatRand } from '../lib/money';
import { addDays, todaySA } from '../lib/dates';
import { shortDate } from '../lib/format';
import { scanSlip, type ScanError } from '../lib/ai';
import { prepareSlip } from '../lib/slipImage';
import { slipNote, type SlipItem, type SlipKind, type SlipRow } from '../lib/slipRules';
import { BIG_AMOUNT_CENTS, MAX_AMOUNT_CENTS, MAX_FUTURE_DAYS, MIN_ENTRY_DATE, cleanNote, entryDateError, parseRands } from '../lib/validate';
import { FLAGS } from '../lib/flags';

/** Bundled, clearly marked SAMPLE slips for judges without a slip in hand. */
const SAMPLES = [
  { key: 'spaza', src: '/samples/slip-spaza.png', label: 'sample_spaza' },
  { key: 'electricity', src: '/samples/slip-electricity.png', label: 'sample_electricity' },
  { key: 'airtime', src: '/samples/slip-airtime.png', label: 'sample_airtime' },
] as const;
/** What each sample says, used only if scanning is busy or offline, and labelled as such. */
const SAMPLE_FALLBACK: Record<string, { kind: SlipKind; row: SlipRow; items: SlipItem[] }> = {
  spaza: { kind: 'till_slip', row: { direction: 'out', amount_cents: 18745, occurred_on: '2026-10-25', merchant: 'KASI CORNER SPAZA', category: 'food', units_kwh: null }, items: [{ name: 'Maize meal 10kg', amount_cents: 8999 }, { name: 'Bread white 700g', amount_cents: 1850 }, { name: 'Milk 2L', amount_cents: 3299 }, { name: 'Eggs 6', amount_cents: 2499 }, { name: 'Sugar 1kg', amount_cents: 2098 }] },
  electricity: { kind: 'electricity', row: { direction: 'out', amount_cents: 10000, occurred_on: '2026-10-24', merchant: 'Ubuntu Power Vendors (SAMPLE)', category: 'electricity', units_kwh: 52.3 }, items: [] },
  airtime: { kind: 'airtime_data', row: { direction: 'out', amount_cents: 2900, occurred_on: '2026-10-26', merchant: 'QuickTop Airtime', category: 'data_airtime', units_kwh: null }, items: [] },
};

interface Draft {
  pick: boolean;
  direction: 'in' | 'out';
  amount: string;
  category: Category;
  date: string;
  note: string;
  errors: { amount?: string; date?: string; note?: string };
}

type Phase =
  | { at: 'pick' }
  | { at: 'reading'; preview: string | null; pdf: boolean }
  | { at: 'error'; error: ScanError; preview: string | null }
  | { at: 'check'; preview: string | null; kind: SlipKind; confidence: 'low' | 'medium' | 'high'; items: SlipItem[]; fallback: boolean }
  | { at: 'saved'; count: number; safeFrom: number; safeTo: number; from: string | null; to: string | null };

const rands = (c: number) => (c % 100 ? (c / 100).toFixed(2) : String(c / 100));

export function ScanScreen() {
  const { t } = useTranslation();
  const { t: tu, i18n } = useTranslation('ui');
  const { addTxn, data } = useStore();
  const navigate = useNavigate();
  const today = todaySA();
  const [phase, setPhase] = useState<Phase>({ at: 'pick' });
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [confirmBig, setConfirmBig] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = useRef(0); // a newer scan or Cancel makes an older answer stale
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { run.current++; }, []);
  if (!FLAGS.slipScan) return null;

  function toDrafts(rows: SlipRow[], kind: SlipKind) {
    setConfirmBig(false);
    setDrafts(rows.map((r) => ({
      pick: true,
      direction: r.direction,
      amount: rands(r.amount_cents),
      category: r.category as Category,
      date: r.occurred_on ?? today,
      note: slipNote(r, 'kWh'),
      errors: {},
    })));
    void kind;
  }

  async function scan(file: Blob, sample?: string) {
    const id = ++run.current;
    const prep = await prepareSlip(file, FLAGS.slipPdf);
    if ('error' in prep) return setPhase({ at: 'error', error: prep.error, preview: null });
    setPhase({ at: 'reading', preview: prep.preview, pdf: prep.kind === 'pdf' });
    const res = await scanSlip(prep.blob, i18n.language);
    if (id !== run.current) return; // cancelled or replaced
    if (res.ok) {
      toDrafts(res.result.rows, res.result.kind);
      return setPhase({ at: 'check', preview: prep.preview, kind: res.result.kind, confidence: res.result.confidence, items: res.result.items, fallback: false });
    }
    // A sample still works for judges when scanning is busy or offline: its printed details, clearly labelled.
    const fb = sample ? SAMPLE_FALLBACK[sample] : null;
    if (fb && ['rate_limited', 'unavailable', 'offline'].includes(res.error)) {
      toDrafts([fb.row], fb.kind);
      return setPhase({ at: 'check', preview: prep.preview, kind: fb.kind, confidence: 'high', items: fb.items, fallback: true });
    }
    setPhase({ at: 'error', error: res.error, preview: prep.preview });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) await scan(f);
  }

  async function trySample(key: string, src: string) {
    try {
      const blob = await (await fetch(src)).blob();
      await scan(blob, key);
    } catch {
      setPhase({ at: 'error', error: 'unavailable', preview: null });
    }
  }

  function update(i: number, patch: Partial<Draft>) {
    setConfirmBig(false);
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch, errors: { ...d.errors, ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) } } : d)));
  }

  async function save() {
    if (phase.at !== 'check') return;
    let bad = false;
    const checked = drafts.map((d) => {
      if (!d.pick) return { d, cents: 0 };
      const errors: Draft['errors'] = {};
      const a = parseRands(d.amount);
      if (!a.ok) errors.amount = tu(a.error === 'amount_too_big' ? 'err_amount_too_big' : a.error === 'amount_empty' ? 'err_amount_empty' : 'err_amount_invalid');
      const dErr = entryDateError(d.date, today);
      if (dErr) errors.date = tu(`err_${dErr}`);
      const n = cleanNote(d.note);
      if (!n.ok) errors.note = tu(`err_${n.error}`);
      if (Object.keys(errors).length) bad = true;
      return { d: { ...d, errors }, cents: a.ok ? a.value : 0, note: n.ok ? n.value : '' };
    });
    setDrafts(checked.map((c) => c.d));
    const chosen = checked.filter((c) => c.d.pick);
    if (bad || chosen.length === 0) return;
    if (chosen.some((c) => c.cents > BIG_AMOUNT_CENTS || c.cents > MAX_AMOUNT_CENTS) && !confirmBig) return setConfirmBig(true);
    setBusy(true);
    try {
      const before = forecastFor(data, today);
      const paidWith = ['payment', 'payslip', 'money_received'].includes(phase.kind) ? 'bank' : 'cash';
      const added = [];
      for (const c of chosen) {
        const { txn } = await addTxn({
          direction: c.d.direction,
          amount_cents: c.cents,
          category: c.d.category,
          source: sourceFor(c.d.category, paidWith),
          note: ('note' in c && c.note) || null,
          occurred_on: c.d.date,
          created_via: 'slip',
          confirmed: true,
        });
        added.push(txn);
      }
      const after = forecastFor({ ...data, txns: [...data.txns, ...added] }, today);
      setPhase({ at: 'saved', count: added.length, safeFrom: before.safe_cents, safeTo: after.safe_cents, from: before.shortfall?.date ?? null, to: after.shortfall?.date ?? null });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  }

  const accept = FLAGS.slipPdf ? 'image/*,application/pdf' : 'image/*';
  const picked = drafts.filter((d) => d.pick).length;

  return (
    <div>
      <ScreenTitle sub={tu('scan_privacy')}>{tu('scan_title')}</ScreenTitle>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} data-testid="scan-camera" />
      <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={onFile} data-testid="scan-file" />

      {phase.at === 'pick' && (
        <div className="space-y-4">
          {!navigator.onLine && <p className="rounded-xl bg-amber-soft px-4 py-3 text-[15px] text-amber-ink">{tu('scan_offline')}</p>}
          <Button block icon="camera" className="!min-h-[64px] text-lg" onClick={() => camRef.current?.click()}>{tu('scan_take_photo')}</Button>
          <Button block variant="secondary" icon="plus" className="!min-h-[56px]" onClick={() => fileRef.current?.click()}>
            {tu(FLAGS.slipPdf ? 'scan_choose_file' : 'scan_choose_photo')}
          </Button>
          <Card>
            <p className="font-semibold">{tu('scan_try_sample')}</p>
            <p className="mt-1 text-[15px] text-ink-soft">{tu('scan_try_sample_body')}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {SAMPLES.map((s) => (
                <button key={s.key} onClick={() => trySample(s.key, s.src)} className="flex min-h-tap flex-col items-center gap-1 rounded-xl border border-line bg-white p-2 text-sm font-semibold text-ink hover:border-teal" data-testid={`sample-${s.key}`}>
                  <img src={s.src} alt="" className="h-20 w-full rounded object-cover object-top" loading="lazy" />
                  <span className="text-center leading-tight">{tu(s.label)}</span>
                </button>
              ))}
            </div>
          </Card>
          <p className="text-center text-[15px] text-ink-soft">
            {tu('scan_or')} <Link to="/add" className="font-semibold text-teal underline underline-offset-4">{tu('scan_by_hand')}</Link>
          </p>
        </div>
      )}

      {phase.at === 'reading' && (
        <Card className="text-center">
          {phase.preview ? <img src={phase.preview} alt="" className="mx-auto max-h-64 rounded-lg" /> : <Icon name="list" size={48} className="mx-auto text-teal" />}
          <div className="mt-4 flex justify-center"><Spinner label={tu('scan_reading')} /></div>
          <Button variant="ghost" className="mt-3" onClick={() => { run.current++; setPhase({ at: 'pick' }); }}>{t('cancel')}</Button>
        </Card>
      )}

      {phase.at === 'error' && (
        <Card tone="amber">
          <p className="font-semibold text-amber-ink" role="alert" data-testid="scan-error">{tu(`scan_err_${phase.error}`)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button icon="camera" onClick={() => setPhase({ at: 'pick' })}>{tu('scan_try_again')}</Button>
            <Button variant="secondary" icon="edit" onClick={() => navigate('/add')}>{tu('scan_by_hand')}</Button>
          </div>
        </Card>
      )}

      {phase.at === 'check' && (
        <div className="space-y-4">
          <p className={`rounded-xl px-4 py-3 text-[15px] ${phase.confidence === 'low' || phase.fallback ? 'bg-amber-soft text-amber-ink' : 'bg-teal-soft text-teal-dark'}`} data-testid="scan-check">
            {phase.fallback ? tu('scan_sample_fallback') : tu(phase.confidence === 'low' ? 'scan_check_low' : 'scan_check')}
          </p>
          {phase.preview && (
            <details className="rounded-xl2 border border-line bg-white px-4 py-2">
              <summary className="min-h-tap cursor-pointer py-2 font-semibold">{tu('scan_see_photo')}</summary>
              <img src={phase.preview} alt="" className="mx-auto mb-2 max-h-80 rounded-lg" />
            </details>
          )}
          {drafts.map((d, i) => {
            const cats = d.direction === 'in' ? IN_CATEGORIES : OUT_CATEGORIES;
            return (
              <Card key={i}>
                {drafts.length > 1 && (
                  <label className="mb-3 flex min-h-tap items-center gap-3 font-semibold">
                    <input type="checkbox" className="h-5 w-5 accent-teal" checked={d.pick} onChange={(e) => update(i, { pick: e.target.checked })} />
                    {tu('scan_save_this')}
                  </label>
                )}
                <div className={d.pick ? '' : 'opacity-50'}>
                  <Segmented label={t('direction')} value={d.direction} onChange={(v) => update(i, { direction: v, category: v === 'in' ? 'income' : 'other' })} options={[{ value: 'in', label: tu('money_in'), icon: 'income' }, { value: 'out', label: tu('money_out'), icon: 'debt' }]} />
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field label={t('amount')} inputMode="decimal" autoComplete="off" maxLength={16} value={d.amount} onChange={(e) => update(i, { amount: e.target.value })} error={d.errors.amount} data-testid={`scan-amount-${i}`} />
                    <Field label={t('entry_date')} type="date" value={d.date} min={MIN_ENTRY_DATE} max={addDays(today, MAX_FUTURE_DAYS)} onChange={(e) => update(i, { date: e.target.value })} error={d.errors.date} />
                  </div>
                  <p className="mb-2 mt-3 text-[15px] font-semibold">{t('choose_category')}</p>
                  <div className="flex flex-wrap gap-2">
                    {cats.map((c) => (
                      <Chip key={c} icon={CATEGORY_ICON[c]} selected={d.category === c} onClick={() => update(i, { category: c })}>{tu(`cat_${c}`)}</Chip>
                    ))}
                  </div>
                  <Field className="mt-3" label={t('note')} maxLength={140} value={d.note} onChange={(e) => update(i, { note: e.target.value })} error={d.errors.note} />
                </div>
              </Card>
            );
          })}
          {phase.items.length > 0 && (
            <details className="rounded-xl2 border border-line bg-white px-4 py-2" data-testid="scan-items">
              <summary className="min-h-tap cursor-pointer py-2 font-semibold">{tu('scan_see_items', { count: phase.items.length })}</summary>
              <ul className="divide-y divide-line pb-2">
                {phase.items.map((it, j) => (
                  <li key={j} className="flex justify-between gap-3 py-1.5 text-[15px]"><span className="min-w-0">{it.name}</span><span className="tabular shrink-0">{it.amount_cents != null ? formatRand(it.amount_cents) : ''}</span></li>
                ))}
              </ul>
            </details>
          )}
          {confirmBig && <p role="alert" className="rounded-xl bg-amber-soft px-4 py-3 font-semibold text-amber-ink">{tu('scan_big_confirm')}</p>}
          <Button block icon="check" className="!min-h-[56px] text-lg" disabled={busy || picked === 0} onClick={save} data-testid="scan-save">
            {confirmBig ? tu('big_amount_yes') : tu(picked === 1 ? 'scan_save1' : 'scan_save', { count: picked })}
          </Button>
          <div className="flex justify-between">
            <Button variant="ghost" icon="camera" onClick={() => { setPhase({ at: 'pick' }); setDrafts([]); }}>{tu('scan_try_again')}</Button>
            <Button variant="ghost" icon="edit" onClick={() => navigate('/add')}>{tu('scan_by_hand')}</Button>
          </div>
        </div>
      )}

      {phase.at === 'saved' && (
        <Card tone="teal">
          <p className="flex items-center gap-2 text-lg font-bold text-teal-dark" data-testid="scan-saved"><Icon name="check" /> {tu(phase.count === 1 ? 'scan_saved1' : 'scan_saved', { count: phase.count })}</p>
          {phase.from && phase.to && phase.from !== phase.to && <p className="mt-2 font-semibold">{tu('shortfall_moved', { from: shortDate(phase.from), to: shortDate(phase.to) })}</p>}
          {phase.from && !phase.to && <p className="mt-2 font-semibold">{tu('shortfall_cleared')}</p>}
          {!phase.from && phase.to && <p className="mt-2 font-semibold text-amber-ink">{t('shortfall', { date: shortDate(phase.to) })}</p>}
          <p className="mt-1 text-ink-soft">
            {tu('plan_result')}: <span className="tabular line-through decoration-ink-faint">{formatEstimate(phase.safeFrom)}</span> → <strong className="tabular text-teal-dark">{formatEstimate(phase.safeTo)}</strong>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button icon="home" onClick={() => navigate('/')}>{tu('nav_home')}</Button>
            <Button variant="secondary" icon="list" onClick={() => navigate('/transactions')}>{tu('tx_title')}</Button>
            <Button variant="ghost" icon="camera" onClick={() => { setPhase({ at: 'pick' }); setDrafts([]); }}>{tu('scan_another')}</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
