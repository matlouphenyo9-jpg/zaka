import { useTranslation } from 'react-i18next';
import { useMemo, useState } from 'react';
import { useStore, type PriceItem } from '../lib/store';
import { Button, Chip, Field } from '../components/ui';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';
import { formatRand, parseRandInput } from '../lib/money';
import { essentialsError } from '../lib/validate';
import { todaySA } from '../lib/dates';
import { longDate } from '../lib/format';
import type { IncomePlanItem, IncomeSource, Obligation } from '../engine/types';

export const CITIES = ['Cape Town', 'Johannesburg', 'Tshwane', 'Durban', 'Ekurhuleni', 'Gqeberha', 'Polokwane', 'Bloemfontein', 'Other'];
const COASTAL = ['Cape Town', 'Durban', 'Gqeberha'];
export const MODES = ['taxi', 'bus', 'metrorail', 'gautrain', 'car', 'walk', 'other'] as const;
export type Mode = (typeof MODES)[number];
const MODE_ICON: Record<Mode, string> = { taxi: 'transport', bus: 'transport', metrorail: 'transport', gautrain: 'transport', car: 'transport', walk: 'user', other: 'other' };

export function busFares(book: PriceItem[], city: string): PriceItem[] {
  return book.filter((p) => p.mode === 'bus' && p.unit === 'single trip' && p.city === city && p.price_cents != null);
}
export function fuelPrice(book: PriceItem[], city: string): PriceItem | undefined {
  return book.find((p) => p.id === (COASTAL.includes(city) ? 'fuel-95-coastal' : 'fuel-95-inland'));
}

type IncomeDraft = { on: boolean; day: string; perWeek: string; amount: string };
const SOURCES: { key: IncomeSource; label: string; icon: string; rule: 'monthly' | 'frequency' }[] = [
  { key: 'grant', label: 'onb_grant', icon: 'grant', rule: 'monthly' },
  { key: 'piece_job', label: 'onb_piece_jobs', icon: 'piece_job', rule: 'frequency' },
  { key: 'trade', label: 'onb_trading', icon: 'trade', rule: 'frequency' },
  { key: 'salary', label: 'onb_salary', icon: 'salary', rule: 'monthly' },
];

/** The everyday-costs editor, shared by onboarding and the Me screen. */
export interface CostsDraft {
  mode: Mode | null;
  city: string;
  fare: string; // single trip, rand
  fareRef: string | null;
  trips: string;
  workdays: string;
  km: string;
  lper100: string;
  food: string;
  electricity: string;
  data: string;
}

export function dailyTransportCents(d: CostsDraft, book: PriceItem[]): number | null {
  if (!d.mode) return null;
  if (d.mode === 'walk') return 0;
  if (d.mode === 'car') {
    const km = Number(d.km), l = Number(d.lper100), fuel = fuelPrice(book, d.city)?.price_cents;
    if (!(km > 0 && l > 0 && fuel)) return null;
    return Math.round(2 * km * (l / 100) * fuel);
  }
  const fare = parseRandInput(d.fare);
  const trips = Number(d.trips) || 2;
  return fare == null ? null : fare * trips;
}

export function CostsEditor({ draft, set }: { draft: CostsDraft; set: (p: Partial<CostsDraft>) => void }) {
  const { t } = useTranslation();
  const { t: tu } = useTranslation('ui');
  const { priceBook } = useStore();
  const fares = draft.mode === 'bus' ? busFares(priceBook, draft.city) : [];
  const ref = priceBook.find((p) => p.id === draft.fareRef);
  const daily = dailyTransportCents(draft, priceBook);
  const workdays = Number(draft.workdays) || 5;
  const fuel = fuelPrice(priceBook, draft.city);
  const dataRefs = priceBook.filter((p) => p.mode === 'data' && p.price_cents);

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-1.5 block text-base font-semibold">{t('city')}</label>
        <select value={draft.city} onChange={(e) => set({ city: e.target.value, fareRef: null })} className="min-h-tap w-full rounded-xl border border-line bg-white px-4 py-3 text-base">
          {CITIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      <div>
        <p className="mb-2 text-base font-semibold">{t('travel_mode')}</p>
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <Chip key={m} icon={MODE_ICON[m]} selected={draft.mode === m} onClick={() => set({ mode: m, fareRef: null, fare: m === draft.mode ? draft.fare : '' })}>
              {tu(`mode_${m}`)}
            </Chip>
          ))}
        </div>
      </div>

      {draft.mode && draft.mode !== 'walk' && (
        <div className="space-y-4 rounded-xl2 border border-line bg-white p-4">
          {draft.mode === 'bus' && fares.length > 0 && (
            <div className="space-y-2">
              {fares.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => set({ fare: String(f.price_cents! / 100), fareRef: f.id })}
                  className={`w-full rounded-xl border p-3 text-left ${draft.fareRef === f.id ? 'border-teal bg-teal-soft' : 'border-line'}`}
                >
                  <span className="block font-semibold">
                    {f.item}: {formatRand(f.price_cents!)}
                    {f.high_cents ? ` – ${formatRand(f.high_cents)}` : ''}
                  </span>
                  <span className="block text-sm text-ink-soft">
                    {t('as_of', { date: longDate(f.as_of) })} · {f.confidence}
                    {f.note ? ` · ${f.note}` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
          {(draft.mode === 'taxi' || draft.mode === 'metrorail' || draft.mode === 'gautrain' || draft.mode === 'other' || (draft.mode === 'bus' && fares.length === 0)) && (
            <p className="rounded-xl bg-amber-soft px-3 py-2 text-[15px] text-amber-ink">{t('unknown_fare')}</p>
          )}
          {draft.mode === 'car' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label={tu('km_each_way')} inputMode="decimal" value={draft.km} onChange={(e) => set({ km: e.target.value })} />
                <Field label={tu('litres_per_100')} inputMode="decimal" value={draft.lper100} onChange={(e) => set({ lper100: e.target.value })} />
              </div>
              {fuel && (
                <p className="text-sm text-ink-soft">
                  {fuel.item} ({fuel.city}): {formatRand(fuel.price_cents!, { cents: true })}/L · {t('as_of', { date: longDate(fuel.as_of) })}
                </p>
              )}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label={tu('onb_fare')} inputMode="decimal" placeholder="R" value={draft.fare} onChange={(e) => set({ fare: e.target.value, fareRef: null })} hint={draft.fareRef && ref ? t('as_of', { date: longDate(ref.as_of) }) : undefined} />
              <Field label={t('trips')} inputMode="numeric" value={draft.trips} onChange={(e) => set({ trips: e.target.value.replace(/\D/g, '').slice(0, 1) })} />
            </div>
          )}
          <Field label={tu('onb_workdays')} inputMode="numeric" value={draft.workdays} onChange={(e) => set({ workdays: e.target.value.replace(/\D/g, '').slice(0, 1) })} />
          {daily != null && daily > 0 && (
            <p className="rounded-xl bg-teal-soft px-3 py-2.5 text-base font-semibold text-teal-dark">
              {draft.mode === 'taxi' ? t('taxi_example', { days: workdays, amount: formatRand(daily * workdays) }) : `${tu('onb_daily_transport')}: ${formatRand(daily)} · ${tu('onb_weekly', { amount: formatRand(daily * workdays) })}`}
            </p>
          )}
        </div>
      )}

      <div>
        <p className="mb-1 text-base font-semibold">{t('costs')}</p>
        <p className="mb-3 text-sm text-ink-soft">{tu('onb_costs_hint')}</p>
        <div className="space-y-3">
          <Field label={`${t('food')} — ${tu('onb_per_week_label')}`} inputMode="decimal" placeholder="R" value={draft.food} onChange={(e) => set({ food: e.target.value })} />
          <Field label={`${t('electricity')} — ${tu('onb_per_week_label')}`} inputMode="decimal" placeholder="R" value={draft.electricity} onChange={(e) => set({ electricity: e.target.value })} />
          <Field label={`${t('data')} — ${tu('onb_per_week_label')}`} inputMode="decimal" placeholder="R" value={draft.data} onChange={(e) => set({ data: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            {dataRefs.slice(0, 4).map((d) => {
              const weekly = d.unit === '7 days' ? d.price_cents! : Math.round((d.price_cents! * 7) / 30);
              return (
                <button key={d.id} type="button" onClick={() => set({ data: String(Math.round(weekly / 100)) })} className="min-h-tap rounded-xl border border-line bg-white px-3 py-1.5 text-left text-sm">
                  <span className="font-semibold">{d.item}</span> {formatRand(d.price_cents!)}/{d.unit === '7 days' ? '7d' : d.unit}
                  <span className="block text-xs text-ink-faint">{t('as_of', { date: longDate(d.as_of) })}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function costsToEssentials(d: CostsDraft, book: PriceItem[]) {
  const daily = dailyTransportCents(d, book);
  const wd = Math.min(7, Math.max(1, Number(d.workdays) || 5));
  const cents = (s: string) => (s.trim() === '' ? null : parseRandInput(s));
  return {
    transport_daily_cents: daily,
    workdays: [1, 2, 3, 4, 5, 6, 0].slice(0, wd),
    fare_single_cents: parseRandInput(d.fare),
    trips_per_day: Math.min(10, Math.max(1, Math.round(Number(d.trips) || 2))),
    price_ref: d.fareRef,
    food_weekly_cents: cents(d.food),
    electricity_weekly_cents: cents(d.electricity),
    data_weekly_cents: cents(d.data),
    // km_each_way / l_per_100km are not stored until the database accepts them (B4: supabase/manual SQL).
  };
}

export function OnboardingScreen() {
  const { t } = useTranslation();
  const { t: tu } = useTranslation('ui');
  const { saveProfile, addTxn, saveObligation, priceBook, data, flushNow } = useStore();
  const [step, setStep] = useState(0);
  const [balance, setBalance] = useState('');
  const [balanceErr, setBalanceErr] = useState<string | null>(null);
  const [costsErr, setCostsErr] = useState<string | null>(null);
  const csg = priceBook.find((p) => p.id === 'grant-csg')?.price_cents;
  const [income, setIncome] = useState<Record<IncomeSource, IncomeDraft>>({
    grant: { on: false, day: '3', perWeek: '', amount: '' },
    piece_job: { on: false, day: '', perWeek: '2', amount: '' },
    trade: { on: false, day: '', perWeek: '3', amount: '' },
    salary: { on: false, day: '25', perWeek: '', amount: '' },
    other: { on: false, day: '', perWeek: '', amount: '' },
  });
  const [costs, setCosts] = useState<CostsDraft>({ mode: null, city: 'Cape Town', fare: '', fareRef: null, trips: '2', workdays: '5', km: '', lper100: '', food: '', electricity: '', data: '' });
  const [obs, setObs] = useState<{ name: string; amount: string; day: string; category: Obligation['category'] }[]>([]);
  const [saving, setSaving] = useState(false);
  const total = 3;

  const incomePlan: IncomePlanItem[] = useMemo(
    () =>
      SOURCES.flatMap((s) => {
        const d = income[s.key];
        const amt = parseRandInput(d.amount);
        if (!d.on || !amt) return [];
        if (s.rule === 'monthly') {
          const day = Math.min(31, Math.max(1, Number(d.day) || 1));
          return [{ key: `plan:${s.key}`, source: s.key, amount_cents: amt, rule: { kind: 'monthly', day }, reliability: 'likely' } as IncomePlanItem];
        }
        const pw = Math.min(14, Math.max(0.5, Number(d.perWeek) || 1));
        return [{ key: `plan:${s.key}`, source: s.key, amount_cents: amt, rule: { kind: 'frequency', per_week: pw }, reliability: 'likely' } as IncomePlanItem];
      }),
    [income],
  );

  async function finish(skip = false) {
    setSaving(true);
    try {
      const bal = parseRandInput(balance);
      if (!skip && bal && bal > 0 && !data.txns.some((x) => x.category === 'opening_balance')) {
        await addTxn({ direction: 'in', amount_cents: bal, category: 'opening_balance', source: 'cash', note: null, occurred_on: todaySA(), created_via: 'manual', confirmed: true });
      }
      if (!skip) {
        for (const o of obs) {
          const amt = parseRandInput(o.amount);
          if (!o.name.trim() || !amt) continue;
          await saveObligation({ name: o.name.trim().slice(0, 60), amount_cents: amt, due_kind: 'monthly', due_day: Math.min(31, Math.max(1, Number(o.day) || 1)), category: o.category, active: true });
        }
      }
      await saveProfile({
        ...(skip ? {} : { income_plan: incomePlan, essentials: costsToEssentials(costs, priceBook), transport_mode: costs.mode, city: costs.city }),
        onboarded_at: new Date().toISOString(),
      });
      // Make sure the new plan reaches the server before the person can close the app (offline: it stays queued).
      await flushNow();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col px-5 pb-8 pt-6">
      <div className="flex items-center justify-between">
        <Logo height={24} />
        <button className="min-h-tap px-2 text-base font-semibold text-ink-soft" onClick={() => finish(true)} disabled={saving}>
          {t('skip')}
        </button>
      </div>
      <div className="mt-6 flex gap-1.5" aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-teal' : 'bg-line'}`} />
        ))}
      </div>
      <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">{tu('onb_step', { n: step + 1, total })}</p>

      {step === 0 && (
        <section className="mt-2">
          <h1 className="text-[1.6rem] font-bold leading-tight">{t('setup_title')}</h1>
          <p className="mt-6 text-lg font-semibold">{t('balance')}</p>
          <p className="mt-1 text-base text-ink-soft">{tu('onb_money_hint')}</p>
          <div className="mt-4 flex items-center rounded-xl2 border-2 border-line bg-white px-4 focus-within:border-teal">
            <span className="text-[2.5rem] font-bold text-ink-faint">R</span>
            <input
              aria-label={t('amount')}
              inputMode="decimal"
              autoFocus
              value={balance}
              onChange={(e) => { setBalance(e.target.value); setBalanceErr(null); }}
              placeholder="0"
              className="tabular w-full bg-transparent px-2 py-3 text-[2.5rem] font-bold text-ink outline-none"
            />
          </div>
          {balanceErr && <p className="mt-2 font-semibold text-risk">{balanceErr}</p>}
          <p className="mt-6 rounded-xl bg-ink/5 px-4 py-3 text-[15px] text-ink-soft">{t('setup_uncertain')}</p>
        </section>
      )}

      {step === 1 && (
        <section className="mt-2">
          <h1 className="text-[1.6rem] font-bold leading-tight">{tu('onb_income_title')}</h1>
          <p className="mt-1 text-base text-ink-soft">{tu('onb_income_hint')}</p>
          <div className="mt-5 space-y-3">
            {SOURCES.map((s) => {
              const d = income[s.key];
              const setD = (p: Partial<IncomeDraft>) => setIncome({ ...income, [s.key]: { ...d, ...p } });
              return (
                <div key={s.key} className={`rounded-xl2 border bg-white p-4 ${d.on ? 'border-teal' : 'border-line'}`}>
                  <button type="button" className="flex min-h-tap w-full items-center gap-3 text-left" aria-pressed={d.on} onClick={() => setD({ on: !d.on, amount: !d.amount && s.key === 'grant' && csg ? String(csg / 100) : d.amount })}>
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${d.on ? 'bg-teal text-white' : 'bg-ink/5'}`}>
                      <Icon name={s.icon} />
                    </span>
                    <span className="flex-1 text-lg font-semibold">{tu(s.label)}</span>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-md border-2 ${d.on ? 'border-teal bg-teal text-white' : 'border-line'}`}>{d.on && <Icon name="check" size={16} />}</span>
                  </button>
                  {d.on && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {s.rule === 'monthly' ? (
                        <Field label={tu('onb_day_of_month')} inputMode="numeric" value={d.day} onChange={(e) => setD({ day: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
                      ) : (
                        <Field label={tu('onb_per_week')} inputMode="decimal" value={d.perWeek} onChange={(e) => setD({ perWeek: e.target.value })} />
                      )}
                      <Field label={tu('onb_usual_amount')} inputMode="decimal" value={d.amount} onChange={(e) => setD({ amount: e.target.value })} />
                      {s.key === 'grant' && csg && <p className="col-span-2 text-sm text-ink-soft">{tu('onb_csg_note', { amount: formatRand(csg) })}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="mt-2">
          <h1 className="mb-1 text-[1.6rem] font-bold leading-tight">{tu('onb_costs_title')}</h1>
          <p className="mb-5 text-base text-ink-soft">{t('essential_costs')}</p>
          <CostsEditor draft={costs} set={(p) => { setCosts({ ...costs, ...p }); setCostsErr(null); }} />
          {costsErr && <p role="alert" className="mt-3 rounded-xl bg-amber-soft px-4 py-3 font-semibold text-amber-ink" data-testid="costs-error">{costsErr}</p>}

          <div className="mt-6">
            <p className="mb-2 text-base font-semibold">{tu('onb_obligations')}</p>
            <div className="space-y-3">
              {obs.map((o, i) => {
                const setO = (p: Partial<(typeof obs)[number]>) => setObs(obs.map((x, j) => (j === i ? { ...x, ...p } : x)));
                return (
                  <div key={i} className="space-y-3 rounded-xl2 border border-line bg-white p-4">
                    <div className="flex flex-wrap gap-2">
                      {(['stokvel', 'rent', 'school', 'funeral', 'electricity', 'other'] as const).map((c) => (
                        <Chip key={c} icon={c} selected={o.category === c} onClick={() => setO({ category: c, name: o.name || tu(`cat_${c}`) })}>
                          {tu(`cat_${c}`)}
                        </Chip>
                      ))}
                    </div>
                    <Field label={tu('onb_ob_name')} value={o.name} maxLength={60} onChange={(e) => setO({ name: e.target.value })} />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label={t('amount')} inputMode="decimal" value={o.amount} onChange={(e) => setO({ amount: e.target.value })} />
                      <Field label={tu('onb_ob_day')} inputMode="numeric" value={o.day} onChange={(e) => setO({ day: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
                    </div>
                    <button className="min-h-tap text-sm font-semibold text-risk" onClick={() => setObs(obs.filter((_, j) => j !== i))}>
                      {tu('remove')}
                    </button>
                  </div>
                );
              })}
              <Button variant="secondary" icon="plus" block onClick={() => setObs([...obs, { name: tu('cat_stokvel'), amount: '', day: '15', category: 'stokvel' }])}>
                {tu('onb_add_obligation')}
              </Button>
            </div>
          </div>
        </section>
      )}

      <div className="mt-auto flex gap-3 pt-8">
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep(step - 1)} icon="back">
            {t('back')}
          </Button>
        )}
        {step < total - 1 ? (
          <Button
            className="flex-1"
            onClick={() => {
              if (step === 0 && balance.trim() && parseRandInput(balance) == null) return setBalanceErr(t('amount_error'));
              if (step === 2 && essentialsError(costsToEssentials(costs, priceBook))) return setCostsErr(tu('err_out_of_range'));
              setCostsErr(null);
              setStep(step + 1);
            }}
          >
            {t('continue')}
          </Button>
        ) : (
          <Button className="flex-1" onClick={() => finish(false)} disabled={saving}>
            {t('save_plan')}
          </Button>
        )}
      </div>
    </div>
  );
}


