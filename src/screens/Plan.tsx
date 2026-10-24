import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useForecast } from '../lib/useForecast';
import { useStore } from '../lib/store';
import { Badge, Button, Card, Field, Row, ScreenTitle, Sheet, Toast } from '../components/ui';
import { Icon } from '../components/Icon';
import { ConfidenceBadge } from './Home';
import { insightIcon, useInsightText } from '../components/InsightText';
import { formatEstimate, formatRand, parseRandInput } from '../lib/money';
import { shortDate, longDate, weekdayFromIndex } from '../lib/format';
import { addDays, diffDays, todaySA } from '../lib/dates';
import { savedForGoal, stokvelPlan, type Forecast } from '../engine/forecast';
import { buildInsights } from '../engine/insights';
import type { IncomePlanItem } from '../engine/types';
import type { PieceJobPattern, RecurringPattern } from '../engine/patterns';

function Bars({ f }: { f: Forecast }) {
  const { t } = useTranslation('ui');
  const vals = [f.balance_cents, ...f.days.map((d) => d.balance_cents)];
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const range = max - min || 1;
  const zeroY = (max / range) * 100;
  return (
    <figure aria-label={t('plan_low_path_note')} className="mt-1">
      <div className="relative h-36">
        <div className="absolute inset-x-0 border-t border-dashed border-ink/30" style={{ top: `${zeroY}%` }} />
        <div className="absolute inset-0 flex items-stretch gap-[3px]">
          {f.days.map((d) => {
            const v = d.balance_cents;
            const h = (Math.abs(v) / range) * 100;
            const neg = v < 0;
            const isHorizon = d.date === f.horizon_date;
            return (
              <div key={d.date} className="relative flex-1" title={`${shortDate(d.date)}: ${formatRand(v)}`}>
                <div
                  className={`absolute inset-x-0 rounded-[3px] ${neg ? 'bg-risk/70' : d.date === f.shortfall?.date ? 'bg-amber' : isHorizon ? 'bg-teal' : 'bg-teal/45'}`}
                  style={neg ? { top: `${zeroY}%`, height: `${h}%` } : { bottom: `${100 - zeroY}%`, height: `${Math.max(h, 1)}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <figcaption className="mt-2 flex justify-between text-xs text-ink-soft">
        <span>{shortDate(f.days[0].date)}</span>
        <span>{shortDate(f.days[f.days.length - 1].date)}</span>
      </figcaption>
    </figure>
  );
}

function WhySheet({ f, open, onClose }: { f: Forecast; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { t: tu } = useTranslation('ui');
  const horizonIncome = f.income.filter((e) => e.date <= f.horizon_date);
  const horizonCosts = f.costs.filter((c) => c.date <= f.horizon_date);
  const essTotal = f.days.slice(0, f.horizon_days).reduce((s, d) => s + d.essentials_cents, 0);
  return (
    <Sheet open={open} onClose={onClose} title={t('why')}>
      <div className="space-y-4 text-base">
        <p className="text-ink-soft">{f.horizon_reason === 'income' && f.horizon_income ? tu('plan_horizon_income', { source: tu(`src_${f.horizon_income.source}`), date: shortDate(f.horizon_income.date) }) : tu('plan_horizon_cap')}</p>
        <div className="divide-y divide-line rounded-xl2 border border-line bg-white px-4">
          <Row icon="opening_balance" title={tu('plan_balance_now')} right={<span className="tabular font-semibold">{formatRand(f.balance_cents)}</span>} />
          {horizonIncome.map((e, i) => (
            <Row key={`i${i}`} icon={e.source === 'grant' ? 'grant' : 'piece_job'} tone="in" title={`${t('expected_money')}: ${tu(`src_${e.source}`)}`} sub={`${shortDate(e.date)} · ${formatRand(e.amount_cents)} · ${tu(`weight_${e.reliability}`)}`} right={<span className="tabular font-semibold text-teal-dark">+{formatEstimate(e.amount_cents * e.weight)}</span>} />
          ))}
          {horizonCosts.map((c, i) => (
            <Row key={`c${i}`} icon={c.category} title={c.name} sub={shortDate(c.date)} right={<span className="tabular font-semibold">−{formatRand(c.amount_cents)}</span>} />
          ))}
          <Row icon="food" title={tu('plan_essentials')} sub={`${f.horizon_days} × ~${formatRand(Math.round(essTotal / Math.max(1, f.horizon_days)))}`} right={<span className="tabular font-semibold">−{formatEstimate(essTotal)}</span>} />
          <Row icon="plan" title={tu('plan_low_path_note').split('.')[0]} sub={shortDate(f.horizon_date)} right={<span className="tabular font-semibold">{formatEstimate(f.min_balance_cents)}</span>} />
          {f.reserve_cents > 0 && <Row icon="savings_goal" title={tu('plan_reserve')} right={<span className="tabular font-semibold">−{formatRand(f.reserve_cents)}</span>} />}
          {f.set_asides.map((a, i) => (
            <Row key={`s${i}`} icon={a.kind === 'goal' ? 'savings_goal' : 'stokvel'} title={tu('plan_set_aside', { name: a.name })} sub={tu('per_day', { amount: formatEstimate(a.daily_cents) })} right={<span className="tabular font-semibold">−{formatEstimate(a.total_cents)}</span>} />
          ))}
          <Row icon="check" title={<strong>{tu('plan_result')}</strong>} sub={t('daily', { amount: formatEstimate(f.daily_cents) })} right={<strong className="tabular text-lg text-teal-dark">{formatEstimate(f.safe_cents)}</strong>} />
        </div>

        <div>
          <p className="mb-2 font-semibold">{tu('plan_essentials')}</p>
          <div className="divide-y divide-line rounded-xl2 border border-line bg-white px-4">
            {f.essentials.map((e) => (
              <Row key={e.key} icon={e.key} title={tu(`cat_${e.key}`)} sub={tu(`origin_${e.origin}`)} right={<span className="tabular font-semibold">{tu('onb_weekly', { amount: formatRand(e.weekly_cents) })}</span>} />
            ))}
          </div>
        </div>
        <ConfidenceBadge level={f.confidence.level} />
        <p className="text-sm text-ink-soft">{tu(`conf_why_${f.confidence.level}`, { days: f.confidence.history_days, count: f.confidence.confirmed_entries })}</p>
        <p className="rounded-xl bg-ink/5 px-4 py-3 text-sm text-ink-soft">{tu('plan_low_path_note')}</p>
      </div>
    </Sheet>
  );
}

function PatternCard({ p, kind }: { p: RecurringPattern | PieceJobPattern; kind: 'recurring' | 'piece' }) {
  const { t } = useTranslation();
  const { t: tu } = useTranslation('ui');
  const { data, saveProfile } = useStore();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(Math.round((kind === 'piece' ? (p as PieceJobPattern).median_cents : (p as RecurringPattern).amount_cents) / 100)));
  const [msg, setMsg] = useState<string | null>(null);
  const ignored = data.profile?.ignored_patterns?.includes(p.key);
  const plan = data.profile?.income_plan ?? [];
  const r = p as RecurringPattern;
  const pj = p as PieceJobPattern;
  const source = kind === 'piece' ? 'piece_job' : r.source;
  const inPlan = plan.some((x) => x.source === source);
  const text =
    kind === 'piece'
      ? tu('ins_piece_jobs', { perWeek: pj.per_week, amount: formatRand(pj.median_cents) })
      : r.kind === 'monthly'
        ? tu('ins_monthly_income', { source: tu(`src_${r.source}`).toLowerCase(), amount: formatRand(r.amount_cents), day: r.day, count: r.occurrences })
        : tu('ins_recurring_weekly', { source: tu(`src_${r.source}`), amount: formatRand(r.amount_cents), weekday: weekdayFromIndex(r.weekday!), count: r.occurrences });

  async function use(edited: boolean) {
    const amt = edited ? parseRandInput(amount) : null;
    const amount_cents = amt ?? (kind === 'piece' ? pj.median_cents : r.amount_cents);
    const item: IncomePlanItem =
      kind === 'piece'
        ? { key: `plan:piece_job`, source: 'piece_job', amount_cents, rule: { kind: 'frequency', per_week: pj.per_week }, reliability: 'likely' }
        : { key: `plan:${r.source}`, source: r.source, amount_cents, rule: r.kind === 'monthly' ? { kind: 'monthly', day: r.day! } : { kind: 'weekly', weekday: r.weekday! }, reliability: 'likely' };
    await saveProfile({ income_plan: [...plan.filter((x) => x.source !== item.source), item], ignored_patterns: (data.profile?.ignored_patterns ?? []).filter((k) => k !== p.key) });
    setEditing(false);
    setMsg(tu('pattern_used'));
  }
  async function toggleIgnore() {
    const cur = data.profile?.ignored_patterns ?? [];
    await saveProfile({ ignored_patterns: ignored ? cur.filter((k) => k !== p.key) : [...cur, p.key] });
  }

  return (
    <Card className={ignored ? 'opacity-60' : ''}>
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F6EDCF] text-[#6B5208]">
          <Icon name={kind === 'piece' ? 'piece_job' : r.source === 'grant' ? 'grant' : 'calendar'} />
        </span>
        <div className="min-w-0 flex-1">
          <Badge tone={p.strength === 'strong' ? 'teal' : 'amber'}>{tu(p.strength === 'strong' ? 'plan_pattern_strong' : 'plan_pattern_emerging')}</Badge>
          <p className="mt-1.5 text-base text-ink">{t('pattern', { pattern: text.replace(/\.$/, '') })}</p>
          {kind === 'recurring' && <p className="mt-1 text-sm text-ink-soft">{r.dates.map((d) => shortDate(d)).join(' · ')}</p>}
          {ignored ? (
            <button className="mt-2 min-h-tap font-semibold text-teal" onClick={toggleIgnore}>{tu('pattern_restore')}</button>
          ) : editing ? (
            <div className="mt-3 flex items-end gap-2">
              <Field className="flex-1" label={t('amount')} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Button onClick={() => use(true)}>{t('save')}</Button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1">
              {!inPlan && <Button variant="ghost" className="!px-3" icon="check" onClick={() => use(false)}>{t('use_pattern')}</Button>}
              <Button variant="ghost" className="!px-3" icon="edit" onClick={() => setEditing(true)}>{t('change')}</Button>
              <Button variant="ghost" className="!px-3 !text-ink-soft" onClick={toggleIgnore}>{tu('pattern_not_right')}</Button>
            </div>
          )}
          {msg && <p className="mt-1 text-sm font-semibold text-teal-dark">{msg}</p>}
        </div>
      </div>
    </Card>
  );
}

function GoalCard() {
  const { t } = useTranslation();
  const { t: tu } = useTranslation('ui');
  const { data, saveGoal, addTxn } = useStore();
  const today = todaySA();
  const goal = data.goals.find((g) => g.kind === 'savings');
  const [adding, setAdding] = useState(false);
  const [amt, setAmt] = useState('');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', target: '', due: addDays(today, 56) });
  const [toast, setToast] = useState<string | null>(null);

  if (!goal) {
    return (
      <Card>
        <p className="flex items-center gap-2 font-semibold"><Icon name="savings_goal" className="text-teal" /> {t('goal')}</p>
        {creating ? (
          <div className="mt-3 space-y-3">
            <Field label={tu('goal_name')} value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('goal_amount')} inputMode="decimal" value={draft.target} onChange={(e) => setDraft({ ...draft, target: e.target.value })} />
              <Field label={t('goal_due')} type="date" min={addDays(today, 1)} value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} />
            </div>
            <Button block onClick={async () => { const c = parseRandInput(draft.target); if (!draft.name.trim() || !c) return; await saveGoal({ name: draft.name.trim(), target_cents: c, due_on: draft.due, kind: 'savings' }); setCreating(false); }}>{t('save')}</Button>
          </div>
        ) : (
          <Button variant="secondary" className="mt-3" icon="plus" onClick={() => setCreating(true)}>{tu('goal_new')}</Button>
        )}
      </Card>
    );
  }
  const saved = savedForGoal(data.txns, goal);
  const pct = Math.min(100, Math.round((saved / goal.target_cents) * 100));
  const days = goal.due_on ? Math.max(1, diffDays(goal.due_on, today)) : null;
  const daily = days ? Math.ceil(Math.max(0, goal.target_cents - saved) / days) : null;
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-semibold"><Icon name="savings_goal" className="text-teal" /> {t('goal')}: {goal.name}</p>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-base">{t('goal_progress', { saved: formatRand(saved), goal: formatRand(goal.target_cents) })}</p>
      {saved >= goal.target_cents ? (
        <p className="mt-1 font-semibold text-teal-dark">{tu('goal_reached')}</p>
      ) : daily && goal.due_on ? (
        <p className="mt-1 text-ink-soft">{tu('goal_daily', { amount: formatRand(daily), date: longDate(goal.due_on) })}</p>
      ) : null}
      {adding ? (
        <div className="mt-3 flex items-end gap-2">
          <Field className="flex-1" label={t('amount')} inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} autoFocus />
          <Button onClick={async () => { const c = parseRandInput(amt); if (!c) return; await addTxn({ direction: 'out', amount_cents: c, category: 'savings_goal', source: 'cash', note: goal.name, occurred_on: today, created_via: 'manual', confirmed: true }); setAmt(''); setAdding(false); setToast(tu('goal_added')); }}>{t('save')}</Button>
        </div>
      ) : (
        <Button variant="secondary" className="mt-3" icon="plus" onClick={() => setAdding(true)}>{t('add_goal')}</Button>
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </Card>
  );
}

export function PlanScreen() {
  const { t } = useTranslation();
  const { t: tu } = useTranslation('ui');
  const { data } = useStore();
  const { forecast: f } = useForecast();
  const insights = buildInsights(f, 10);
  const insightText = useInsightText();
  const [why, setWhy] = useState(false);
  const stokvel = stokvelPlan(data.obligations, todaySA());
  const { recurring, pieceJobs } = f.patterns;

  return (
    <div className="space-y-4">
      <ScreenTitle sub={f.shortfall ? t('shortfall', { date: shortDate(f.shortfall.date) }) : t('no_shortfall')}>{t('forecast')}</ScreenTitle>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink-soft">{t('safe', { date: shortDate(f.horizon_date) })}</p>
            <p className="tabular text-[2.5rem] font-bold leading-tight">{formatEstimate(f.safe_cents)}</p>
            <p className="text-ink-soft">{t('daily', { amount: formatEstimate(f.daily_cents) })}</p>
          </div>
          <ConfidenceBadge level={f.confidence.level} />
        </div>
        <Bars f={f} />
        <Button variant="secondary" block icon="info" className="mt-3" onClick={() => setWhy(true)}>
          {t('why')}
        </Button>
      </Card>

      {stokvel && (
        <Card tone="teal">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-teal"><Icon name="stokvel" /></span>
            <div>
              <p className="font-semibold">{t('stokvel_due', { amount: formatRand(stokvel.amount_cents), date: shortDate(stokvel.due) })}</p>
              <p className="text-ink-soft">{t('stokvel_daily', { amount: formatRand(stokvel.daily_cents) })}</p>
            </div>
          </div>
        </Card>
      )}

      <GoalCard />

      {/* Day by day */}
      <section>
        <h2 className="mb-2 text-lg font-bold">{t('forecast')}</h2>
        <ol className="divide-y divide-line overflow-hidden rounded-xl2 border border-line bg-white">
          {f.days.map((d) => {
            const neg = d.balance_cents < 0;
            const first = d.date === f.shortfall?.date;
            return (
              <li key={d.date} className={`flex min-h-[56px] items-center gap-3 px-4 py-2 ${first ? 'bg-amber-soft' : neg ? 'bg-risk-soft/50' : ''}`}>
                <div className="w-20 shrink-0">
                  <p className="font-semibold">{shortDate(d.date).split(' ').slice(0, 1).join(' ')}</p>
                  <p className="text-sm text-ink-soft">{shortDate(d.date).split(' ').slice(1).join(' ')}</p>
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  {d.events.income.map((e, i) => (
                    <p key={i} className="truncate font-semibold text-teal-dark">+{formatEstimate(e.amount_cents * e.weight)} {tu(`src_${e.source}`)} <span className="font-normal text-ink-soft">({e.reliability === 'likely' ? '½' : e.reliability === 'confirmed' ? '✓' : '0'})</span></p>
                  ))}
                  {d.events.costs.map((c, i) => (
                    <p key={i} className="truncate font-semibold">−{formatRand(c.amount_cents)} {c.name}</p>
                  ))}
                  <p className="text-ink-soft">−{formatEstimate(d.essentials_cents)} {tu('plan_essentials').toLowerCase()}</p>
                </div>
                <p className={`tabular shrink-0 text-right font-bold ${neg ? 'text-risk' : 'text-ink'}`}>{formatEstimate(d.balance_cents)}</p>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-sm text-ink-soft">{tu('plan_low_path_note')}</p>
      </section>

      {/* Patterns */}
      {(recurring.length > 0 || pieceJobs) && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">{tu('plan_patterns')}</h2>
          {recurring.map((p) => <PatternCard key={p.key} p={p} kind="recurring" />)}
          {pieceJobs && <PatternCard p={pieceJobs} kind="piece" />}
          {insights.filter((i) => i.code === 'tight_day' || i.code === 'busy_weekday').map((i) => (
            <Card key={i.code}>
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink/5"><Icon name={insightIcon(i)} /></span>
                <p>{insightText(i)}</p>
              </div>
            </Card>
          ))}
        </section>
      )}

      <WhySheet f={f} open={why} onClose={() => setWhy(false)} />
    </div>
  );
}
