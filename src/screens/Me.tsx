import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useStore } from '../lib/store';
import { LOCALES, hasFullUi } from '../i18n';
import { Button, Card, Chip, Field, Row, ScreenTitle, Sheet, Toast } from '../components/ui';
import { Icon } from '../components/Icon';
import { CostsEditor, costsToEssentials, type CostsDraft, type Mode } from './Onboarding';
import { centsToInput, formatRand, parseRandInput } from '../lib/money';
import { weekdayFromIndex } from '../lib/format';
import { BalanceCard } from '../components/Balance';
import { FeedbackCard, ShareButton } from '../components/Feedback';
import { PinSettings } from '../components/PinLock';
import { Link } from 'react-router-dom';
import { useForecast } from '../lib/useForecast';
import { NAME_MAX, cleanName, essentialsError } from '../lib/validate';

/** Editor-only keys the database does not store yet. */
const stripUiKeys = (e: object = {}) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'km_each_way' && k !== 'l_per_100km'));
import type { Obligation } from '../engine/types';

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><Icon name={icon} className="text-teal" /> {title}</h2>
      {children}
    </section>
  );
}

function draftFromProfile(p: ReturnType<typeof useStore>['data']['profile']): CostsDraft {
  const e = p?.essentials ?? {};
  const s = (c?: number | null) => (c == null ? '' : centsToInput(c));
  return {
    mode: (p?.transport_mode as Mode) ?? null,
    city: p?.city ?? 'Cape Town',
    fare: s(e.fare_single_cents),
    fareRef: e.price_ref ?? null,
    trips: String(e.trips_per_day ?? 2),
    workdays: String(e.workdays?.length ?? 5),
    km: e.km_each_way ?? '',
    lper100: e.l_per_100km ?? '',
    food: s(e.food_weekly_cents),
    electricity: s(e.electricity_weekly_cents),
    data: s(e.data_weekly_cents),
  };
}

export function MeScreen() {
  const { t, i18n } = useTranslation();
  const { t: tu } = useTranslation('ui');
  const { data, saveProfile, changeLocale, saveObligation, deleteObligation, priceBook, resetDemo, deleteAccount, signOut, pending, session } = useStore();
  const p = data.profile!;
  const { forecast } = useForecast();
  const [name, setName] = useState(p.display_name ?? '');
  const [reserve, setReserve] = useState(p.reserve_amount ? centsToInput(p.reserve_amount) : '');
  const [costs, setCosts] = useState<CostsDraft>(() => draftFromProfile(p));
  const [costsOpen, setCostsOpen] = useState(false);
  const [ob, setOb] = useState<{ name: string; amount: string; day: string; category: Obligation['category'] } | null>(null);
  const [del, setDel] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [obErr, setObErr] = useState<string | null>(null);


  return (
    <div className="space-y-7">
      <ScreenTitle sub={session?.user.email}>{tu('me')}</ScreenTitle>
      <Link to="/transactions" className="flex min-h-tap items-center justify-between rounded-xl2 border border-line bg-white px-4 font-semibold text-teal">
        <span className="flex items-center gap-2"><Icon name="list" size={20} /> {tu('tx_title')}</span><span aria-hidden="true">→</span>
      </Link>

      <Section title={tu('me_language')} icon="language">
        <div className="flex flex-wrap gap-2">
          {LOCALES.map((l) => (
            <Chip key={l.code} selected={i18n.language === l.code} onClick={() => changeLocale(l.code)}>
              <span lang={l.bcp47}>{l.name}</span>
              {l.beta && <span className={`rounded px-1 text-[11px] font-bold uppercase ${i18n.language === l.code ? 'bg-white/20' : 'bg-amber-soft text-amber-ink'}`}>beta</span>}
            </Chip>
          ))}
        </div>
        {!hasFullUi(i18n.language) && <p className="mt-2 text-sm text-ink-soft">{tu('english_only_note')}</p>}
      </Section>

      <Section title={tu('balance_now')} icon="opening_balance">
        <BalanceCard f={forecast} />
      </Section>

      <Section title={tu('me_profile')} icon="user">
        <Card className="space-y-4">
          <Field label={tu('me_name')} value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} />
          <Field label={tu('me_reserve')} inputMode="decimal" value={reserve} onChange={(e) => setReserve(e.target.value)} hint={tu('plan_reserve')} />
          <Button
            variant="secondary"
            onClick={async () => {
              const r = reserve.trim() ? parseRandInput(reserve) : 0;
              if (r == null) return setError(t('amount_error'));
              const n = cleanName(name, false);
              if (!n.ok) return setError(tu(`err_${n.error}`));
              setError(null);
              setName(n.value);
              await saveProfile({ display_name: n.value || null, reserve_amount: r });
              setToast(tu('me_saved'));
            }}
          >
            {t('save')}
          </Button>
          {error && <p className="font-semibold text-risk">{error}</p>}
        </Card>
      </Section>

      <Section title={tu('me_presets')} icon="transport">
        <Card>
          <div className="divide-y divide-line">
            <Row icon="transport" title={t('transport')} sub={p.transport_mode ? `${tu(`mode_${p.transport_mode}`)} · ${p.city ?? ''}` : tu('origin_none')} right={p.essentials?.transport_daily_cents != null ? <span className="tabular font-semibold">{tu('per_day', { amount: formatRand(p.essentials.transport_daily_cents) })}</span> : null} />
            {(['food', 'electricity', 'data'] as const).map((k) => {
              const v = p.essentials?.[`${k}_weekly_cents` as 'food_weekly_cents'];
              return <Row key={k} icon={k === 'data' ? 'data_airtime' : k} title={t(k)} sub={v == null ? tu('origin_learned') : tu('origin_you')} right={v != null ? <span className="tabular font-semibold">{tu('onb_weekly', { amount: formatRand(v) })}</span> : null} />;
            })}
          </div>
          <Button variant="secondary" icon="edit" className="mt-3" onClick={() => { setCosts(draftFromProfile(p)); setCostsOpen(true); }}>{tu('edit')}</Button>
        </Card>
      </Section>

      <Section title={tu('me_bills')} icon="stokvel">
        <Card>
          {data.obligations.length === 0 && <p className="text-ink-soft">—</p>}
          <div className="divide-y divide-line">
            {data.obligations.map((o) => (
              <Row
                key={o.id}
                icon={o.category}
                title={o.name}
                sub={o.due_kind === 'monthly' ? `${tu('onb_ob_day')}: ${o.due_day}` : o.due_kind === 'once' ? o.due_date : ''}
                right={
                  <div className="flex items-center gap-1">
                    <span className="tabular font-semibold">{formatRand(o.amount_cents)}</span>
                    <button aria-label={tu('remove')} onClick={() => deleteObligation(o.id)} className="inline-flex min-h-tap min-w-tap items-center justify-center rounded-full text-ink-faint hover:text-risk"><Icon name="trash" size={18} /></button>
                  </div>
                }
              />
            ))}
          </div>
          <Button variant="secondary" icon="plus" className="mt-3" onClick={() => setOb({ name: tu('cat_stokvel'), amount: '', day: '15', category: 'stokvel' })}>{tu('costs_add')}</Button>
        </Card>
      </Section>

      {p.income_plan.length > 0 && (
        <Section title={tu('me_income')} icon="income">
          <Card>
            <div className="divide-y divide-line">
              {p.income_plan.map((x) => (
                <Row
                  key={x.key}
                  icon={x.source === 'grant' ? 'grant' : x.source}
                  tone="in"
                  title={tu(`src_${x.source}`)}
                  sub={x.rule.kind === 'monthly' ? `${tu('onb_day_of_month')}: ${x.rule.day}` : x.rule.kind === 'frequency' ? tu('times_a_week', { n: x.rule.per_week }) : x.rule.kind === 'weekly' ? weekdayFromIndex(x.rule.weekday) : x.rule.date}
                  right={
                    <div className="flex items-center gap-1">
                      <span className="tabular font-semibold text-teal-dark">{formatRand(x.amount_cents)}</span>
                      <button aria-label={tu('remove')} onClick={() => saveProfile({ income_plan: p.income_plan.filter((y) => y.key !== x.key) })} className="inline-flex min-h-tap min-w-tap items-center justify-center rounded-full text-ink-faint hover:text-risk"><Icon name="trash" size={18} /></button>
                    </div>
                  }
                />
              ))}
            </div>
          </Card>
        </Section>
      )}

      <Section title={tu('pin_section')} icon="shield">
        <PinSettings uid={session!.user.id} />
      </Section>

      <section className="space-y-3">
        <FeedbackCard />
        <ShareButton />
      </section>

      <section className="space-y-3">
        {p.is_demo && (
          <Card tone="teal">
            <p className="font-semibold">{tu('me_reset_demo')}</p>
            <p className="mt-1 text-sm text-ink-soft">{tu('me_reset_demo_note')}</p>
            <Button className="mt-3" icon="sync" disabled={busy || !navigator.onLine} onClick={async () => {
              setBusy(true);
              try { await resetDemo(); setToast(tu('me_reset_done')); } catch { setError(tu('error_generic')); } finally { setBusy(false); }
            }}>{tu('me_reset_demo')}</Button>
          </Card>
        )}
        {!p.is_demo && <Button variant="danger" block icon="trash" onClick={() => setDel(true)}>{tu('me_delete')}</Button>}
        <Button variant="secondary" block icon="logout" onClick={() => {
          if (pending > 0 && !window.confirm(tu('logout_pending', { count: pending }))) return;
          void signOut();
        }}>{tu('me_logout')}</Button>
      </section>

      <Card>
        <p className="font-semibold">{tu('me_about')}</p>
        <p className="mt-1 text-sm text-ink-soft">{tu('me_about_body')}</p>
        <p className="mt-2 text-sm text-ink-soft">{tu('me_offline_cache')}</p>
        <Link to="/privacy" className="mt-2 inline-flex min-h-tap items-center font-semibold text-teal underline underline-offset-2">{tu('privacy_link')}</Link>
        <p className="mt-2 text-xs text-ink-faint">{tu('me_version', { v: '1.0.0' })} · {tu('tagline')}</p>
      </Card>

      <Sheet open={costsOpen} onClose={() => setCostsOpen(false)} title={tu('me_presets')}>
        <CostsEditor draft={costs} set={(x) => setCosts({ ...costs, ...x })} />
        <Button block className="mt-6" onClick={async () => {
          const next = costsToEssentials(costs, priceBook);
          if (essentialsError(next)) return setError(tu('err_out_of_range'));
          await saveProfile({ essentials: { ...stripUiKeys(p.essentials), ...next }, transport_mode: costs.mode, city: costs.city });
          setCostsOpen(false);
          setToast(tu('me_saved'));
        }}>{t('save')}</Button>
      </Sheet>

      <Sheet open={!!ob} onClose={() => setOb(null)} title={tu('costs_add')}>
        {ob && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(['stokvel', 'rent', 'school', 'funeral', 'electricity', 'other'] as const).map((c) => (
                <Chip key={c} icon={c} selected={ob.category === c} onClick={() => setOb({ ...ob, category: c, name: tu(`cat_${c}`) })}>{tu(`cat_${c}`)}</Chip>
              ))}
            </div>
            <Field label={tu('onb_ob_name')} value={ob.name} maxLength={60} onChange={(e) => setOb({ ...ob, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('amount')} inputMode="decimal" value={ob.amount} onChange={(e) => setOb({ ...ob, amount: e.target.value })} />
              <Field label={tu('onb_ob_day')} inputMode="numeric" value={ob.day} onChange={(e) => setOb({ ...ob, day: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
            </div>
            {obErr && <p role="alert" className="rounded-xl bg-amber-soft px-4 py-3 font-semibold text-amber-ink">{obErr}</p>}
            <Button block onClick={async () => {
              const amt = parseRandInput(ob.amount);
              const day = Number(ob.day);
              const nm = cleanName(ob.name);
              if (!nm.ok) return setObErr(tu(`err_${nm.error}`));
              if (!amt) return setObErr(tu('err_amount_invalid'));
              if (!(Number.isInteger(day) && day >= 1 && day <= 31)) return setObErr(tu('err_bill_day'));
              setObErr(null);
              await saveObligation({ name: nm.value, amount_cents: amt, due_kind: 'monthly', due_day: day, category: ob.category, active: true });
              setOb(null);
              setToast(tu('me_saved'));
            }}>{t('save')}</Button>
          </div>
        )}
      </Sheet>

      <Sheet open={del} onClose={() => { setDel(false); setConfirm(''); }} title={tu('me_delete')}>
        <p className="text-ink">{tu('me_delete_confirm')}</p>
        <Field className="mt-4" label="DELETE" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        <Button variant="danger" block className="mt-4" disabled={confirm !== 'DELETE' || busy || !navigator.onLine} onClick={async () => {
          setBusy(true);
          try { await deleteAccount(); } catch { setError(tu('error_generic')); setBusy(false); }
        }}>{tu('me_delete')}</Button>
        {error && <p className="mt-2 font-semibold text-risk">{error}</p>}
      </Sheet>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
