import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useForecast } from '../lib/useForecast';
import { useStore } from '../lib/store';
import { Button, Card } from '../components/ui';
import { Icon } from '../components/Icon';
import { formatEstimate, formatRand } from '../lib/money';
import { shortDate } from '../lib/format';
import { insightIcon, useInsightText } from '../components/InsightText';
import { stokvelPlan } from '../engine/forecast';
import { todaySA } from '../lib/dates';
import { BalanceCard } from '../components/Balance';
import type { ConfidenceLevel } from '../engine/forecast';

const CONF_TONE: Record<ConfidenceLevel, string> = { low: 'bg-amber-soft text-amber-ink', medium: 'bg-ink/5 text-ink', high: 'bg-teal-soft text-teal-dark' };
const CONF_BARS: Record<ConfidenceLevel, number> = { low: 1, medium: 2, high: 3 };

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const { t } = useTranslation();
  const { t: tu } = useTranslation('ui');
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${CONF_TONE[level]}`}>
      <span className="flex items-end gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((b) => (
          <span key={b} className={`w-1 rounded-sm ${b <= CONF_BARS[level] ? 'bg-current' : 'bg-current opacity-25'}`} style={{ height: 4 + b * 3 }} />
        ))}
      </span>
      {t('confidence', { level: tu(`conf_${level}`) })}
    </span>
  );
}

export function HomeScreen() {
  const { t } = useTranslation();
  const { t: tu } = useTranslation('ui');
  const { data, online } = useStore();
  const { forecast: f, insights } = useForecast();
  const insightText = useInsightText();
  const navigate = useNavigate();
  const empty = data.txns.length === 0;
  const stokvel = stokvelPlan(data.obligations, todaySA());
  const name = data.profile?.display_name;
  const firstInsight = insights.find((i) => i.code !== 'shortfall_gap') ?? insights[0];

  if (empty) {
    return (
      <div className="pt-6">
        <Card className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-soft text-teal">
            <Icon name="opening_balance" size={28} />
          </span>
          <p className="mt-4 text-lg font-semibold">{t('empty')}</p>
          <p className="mt-2 text-ink-soft">{t('rough')}</p>
          <Button className="mt-5" block icon="plus" onClick={() => navigate('/add')}>
            {t('add_money')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!online && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-soft px-4 py-3 text-[15px] text-amber-ink">
          <Icon name="offline" size={20} /> {t('last_saved')}
        </p>
      )}
      {name && <p className="text-lg font-semibold text-ink-soft">{name}</p>}

      {/* The one big number */}
      <section className="relative overflow-hidden rounded-[1.75rem] bg-ink px-5 pb-5 pt-6 text-white shadow-card">
        <svg className="pointer-events-none absolute -right-10 -top-10 opacity-[0.08]" width="200" height="200" viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="18.5" fill="#C9A227" />
        </svg>
        <p className="text-base font-semibold text-white/80">{t('safe', { date: shortDate(f.horizon_date) })}</p>
        <p className="tabular mt-1 text-[3.25rem] font-bold leading-none tracking-tight" data-testid="safe-amount">
          {formatEstimate(f.safe_cents)}
        </p>
        <p className="mt-2 text-lg font-semibold text-[#9FE3D9]">{f.safe_cents > 0 ? t('daily', { amount: formatEstimate(f.daily_cents) }) : tu('safe_none', { date: shortDate(f.horizon_date) })}</p>
        <p className="mt-3 text-[15px] text-white/70">{t('after_costs')}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ConfidenceBadge level={f.confidence.level} />
          <Link to="/plan" className="inline-flex min-h-tap items-center gap-1 rounded-full px-2 text-sm font-semibold text-white underline decoration-white/40 underline-offset-4">
            <Icon name="info" size={18} /> {t('why')}
          </Link>
        </div>
      </section>

      <BalanceCard f={f} />

      {/* Tight-week warning */}
      {f.shortfall ? (
        <Card tone="amber">
          <div className="flex gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber text-white">
              <Icon name="warning" size={22} />
            </span>
            <div>
              <p className="text-lg font-bold text-amber-ink" data-testid="shortfall">{t('shortfall', { date: shortDate(f.shortfall.date) })}</p>
              <p className="mt-1 text-[15px] text-amber-ink/90">{tu('tight_body')}</p>
              <Link to="/plan" className="mt-2 inline-flex min-h-tap items-center font-semibold text-amber-ink underline underline-offset-4">
                {tu('see_plan')} →
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <Card tone="teal">
          <p className="flex items-center gap-2 font-semibold text-teal-dark">
            <Icon name="check" /> {t('no_shortfall')}
          </p>
        </Card>
      )}

      {/* Insight from patterns */}
      {firstInsight && (
        <Card>
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F6EDCF] text-[#6B5208]">
              <Icon name={insightIcon(firstInsight)} />
            </span>
            <p className="text-base text-ink">{insightText(firstInsight)}</p>
          </div>
        </Card>
      )}

      {/* Stokvel */}
      {stokvel && (
        <Card>
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-soft text-teal">
              <Icon name="stokvel" />
            </span>
            <div>
              <p className="font-semibold">{t('stokvel_due', { amount: formatRand(stokvel.amount_cents), date: shortDate(stokvel.due) })}</p>
              <p className="text-ink-soft">{t('stokvel_daily', { amount: formatRand(stokvel.daily_cents) })}</p>
            </div>
          </div>
        </Card>
      )}

      {f.confidence.level === 'low' && <p className="rounded-xl bg-ink/5 px-4 py-3 text-[15px] text-ink-soft">{t('rough')}</p>}

      <Button block icon="plus" onClick={() => navigate('/add')} className="!min-h-[56px] text-lg">
        {tu('money_in')} / {tu('money_out')}
      </Button>
    </div>
  );
}
