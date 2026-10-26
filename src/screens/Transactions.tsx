// B5: every entry, filtered by date range, category and in/out, with a per-category summary at the top.
import { useTranslation } from 'react-i18next';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Button, Card, Chip, Field, Row, ScreenTitle, Segmented, Sheet } from '../components/ui';
import { Icon } from '../components/Icon';
import { CATEGORY_ICON, IN_CATEGORIES, OUT_CATEGORIES } from '../engine/categories';
import type { Category, Txn } from '../engine/types';
import { formatRand, parseRandInput } from '../lib/money';
import { addDays, todaySA } from '../lib/dates';
import { shortDate } from '../lib/format';
import { CHIP_CATEGORIES, byDay, filterTxns, rangeFor, summarize, type ChipCategory, type RangeKind } from '../lib/txnFilter';
import { MAX_AMOUNT_CENTS, MAX_FUTURE_DAYS, MIN_ENTRY_DATE, cleanNote, entryDateError } from '../lib/validate';
import { FLAGS } from '../lib/flags';

function EditSheet({ txn, onClose }: { txn: Txn | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { t: tu } = useTranslation('ui');
  const { addTxn, deleteTxn } = useStore();
  const today = todaySA();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<{ amount?: string; date?: string; note?: string }>({});
  const [loaded, setLoaded] = useState<string | null>(null);
  if (txn && loaded !== txn.id) {
    setLoaded(txn.id);
    setAmount(txn.amount_cents % 100 ? (txn.amount_cents / 100).toFixed(2) : String(txn.amount_cents / 100));
    setCategory(txn.category);
    setDate(txn.occurred_on);
    setNote(txn.note ?? '');
    setErr({});
  }
  if (!txn) return null;
  const fixed = txn.category === 'opening_balance' || txn.category === 'balance_correction';
  const cats = txn.direction === 'in' ? IN_CATEGORIES : OUT_CATEGORIES;

  async function save() {
    if (!txn) return;
    const e: typeof err = {};
    const cents = parseRandInput(amount);
    if (cents == null || cents <= 0) e.amount = tu('err_amount_invalid');
    else if (cents > MAX_AMOUNT_CENTS) e.amount = tu('err_amount_too_big');
    const d = entryDateError(date, today);
    if (d) e.date = tu(`err_${d}`);
    const n = cleanNote(note);
    if (!n.ok) e.note = tu(`err_${n.error}`);
    setErr(e);
    if (Object.keys(e).length) return;
    await addTxn({ ...txn, amount_cents: cents!, category, occurred_on: date, note: (n.ok && n.value) || null });
    onClose();
  }

  return (
    <Sheet open={!!txn} onClose={onClose} title={tu('tx_edit')}>
      <div className="space-y-4">
        <Field label={t('amount')} inputMode="decimal" maxLength={16} value={amount} onChange={(e) => setAmount(e.target.value)} error={err.amount} />
        {!fixed && (
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => <Chip key={c} icon={CATEGORY_ICON[c]} selected={category === c} onClick={() => setCategory(c)}>{tu(`cat_${c}`)}</Chip>)}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('entry_date')} type="date" value={date} min={MIN_ENTRY_DATE} max={addDays(today, MAX_FUTURE_DAYS)} onChange={(e) => setDate(e.target.value)} error={err.date} />
          <Field label={t('note')} maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} error={err.note} />
        </div>
        <Button block icon="check" onClick={save}>{t('save_entry')}</Button>
        <Button block variant="danger" icon="trash" onClick={() => { void deleteTxn(txn.id); onClose(); }}>{tu('delete_entry')}</Button>
      </div>
    </Sheet>
  );
}

export function TransactionsScreen() {
  const { t: tu } = useTranslation('ui');
  const { data } = useStore();
  const navigate = useNavigate();
  const today = todaySA();
  const [range, setRange] = useState<RangeKind>('month');
  const [custom, setCustom] = useState({ from: addDays(today, -30), to: today });
  const [dir, setDir] = useState<'all' | 'in' | 'out'>('all');
  const [chips, setChips] = useState<ChipCategory[]>([]);
  const [editing, setEditing] = useState<Txn | null>(null);

  const r = rangeFor(range, today, custom);
  const list = useMemo(() => filterTxns(data.txns, { ...r, dir, chips }), [data.txns, r.from, r.to, dir, chips]); // eslint-disable-line react-hooks/exhaustive-deps
  const sum = useMemo(() => summarize(list), [list]);
  const periodWord = tu(`tx_period_${range}`);
  const toggle = (c: ChipCategory) => setChips((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  return (
    <div className="space-y-4">
      <ScreenTitle right={FLAGS.slipScan ? <Button className="px-3" icon="camera" onClick={() => navigate('/scan')}>{tu('scan_short')}</Button> : undefined}>{tu('tx_title')}</ScreenTitle>

      {/* Filters */}
      <div className="flex flex-wrap gap-2" role="group" aria-label={tu('tx_range')}>
        {(['week', 'month', 'last_month', 'custom'] as RangeKind[]).map((k) => (
          <Chip key={k} selected={range === k} onClick={() => setRange(k)}>{tu(`tx_range_${k}`)}</Chip>
        ))}
      </div>
      {range === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={tu('tx_from')} type="date" value={custom.from} min={MIN_ENTRY_DATE} max={today} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
          <Field label={tu('tx_to')} type="date" value={custom.to} min={MIN_ENTRY_DATE} max={addDays(today, MAX_FUTURE_DAYS)} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
        </div>
      )}
      <Segmented label={tu('tx_in_out')} value={dir} onChange={setDir} options={[{ value: 'all', label: tu('tx_all') }, { value: 'in', label: tu('money_in') }, { value: 'out', label: tu('money_out') }]} />
      <div className="flex flex-wrap gap-2" role="group" aria-label={tu('tx_categories')}>
        {CHIP_CATEGORIES.map((c) => (
          <Chip key={c} icon={CATEGORY_ICON[c]} selected={chips.includes(c)} onClick={() => toggle(c)}>{tu(`cat_${c}`)}</Chip>
        ))}
        {chips.length > 0 && <button className="min-h-tap px-2 text-sm font-semibold text-teal" onClick={() => setChips([])}>{tu('tx_clear')}</button>}
      </div>

      {/* Summary */}
      <Card>
        <p className="text-[15px] text-ink-soft">{tu('tx_summary_period', { from: shortDate(r.from), to: shortDate(r.to) })}</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div><p className="text-sm text-ink-soft">{tu('money_in')}</p><p className="tabular text-xl font-bold text-teal-dark" data-testid="tx-in">+{formatRand(sum.in_cents)}</p></div>
          <div><p className="text-sm text-ink-soft">{tu('money_out')}</p><p className="tabular text-xl font-bold text-ink" data-testid="tx-out">−{formatRand(sum.out_cents)}</p></div>
        </div>
        {sum.lines.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-line pt-3" data-testid="tx-lines">
            {sum.lines.map((l) => (
              <li key={`${l.direction}${l.category}`} className="flex items-start gap-2 text-[15px]">
                <Icon name={CATEGORY_ICON[l.category]} size={18} className={`mt-0.5 shrink-0 ${l.direction === 'in' ? 'text-teal' : 'text-ink-soft'}`} />
                <span className="min-w-0">{tu(l.count === 1 ? 'tx_line1' : 'tx_line', { category: tu(`cat_${l.category}`), count: l.count, period: periodWord, amount: formatRand(l.total_cents) })}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* List */}
      {list.length === 0 ? (
        <Card className="text-center"><p className="text-ink-soft">{tu('tx_empty')}</p></Card>
      ) : (
        byDay(list).map((g) => (
          <section key={g.date}>
            <h2 className="mb-1 text-[15px] font-semibold text-ink-soft">{g.date === today ? tu('tx_today') : shortDate(g.date)}</h2>
            <div className="divide-y divide-line rounded-xl2 border border-line bg-white px-4">
              {g.txns.map((x) => (
                <button key={x.id} className="block w-full text-left" onClick={() => setEditing(x)} aria-label={`${tu(`cat_${x.category}`)} ${formatRand(x.amount_cents)}`}>
                  <Row
                    icon={CATEGORY_ICON[x.category]}
                    tone={x.direction}
                    title={<span className="flex items-center gap-1.5">{tu(`cat_${x.category}`)}{x.created_via === 'slip' && <span className="rounded-full bg-teal-soft px-1.5 text-xs" title={tu('tx_from_slip')}>📸</span>}</span>}
                    sub={x.note || undefined}
                    right={<span className={`tabular font-semibold ${x.direction === 'in' ? 'text-teal-dark' : 'text-ink'}`}>{x.direction === 'in' ? '+' : '−'}{formatRand(x.amount_cents)}</span>}
                  />
                </button>
              ))}
            </div>
          </section>
        ))
      )}
      <EditSheet txn={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
