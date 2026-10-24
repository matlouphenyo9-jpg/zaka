import { useTranslation } from 'react-i18next';
import type { Insight } from '../engine/insights';
import { formatRand } from '../lib/money';
import { shortDate, weekdayFromIndex } from '../lib/format';

/** Turns an insight code into a sentence using translatable templates. */
export function useInsightText() {
  const { t } = useTranslation('ui');
  return (i: Insight): string => {
    switch (i.code) {
      case 'monthly_income':
        return t('ins_monthly_income', { source: t(`src_${i.source}`).toLowerCase(), amount: formatRand(i.amount_cents), day: i.day, count: i.count });
      case 'recurring_weekly':
        return t('ins_recurring_weekly', { source: t(`src_${i.source}`), amount: formatRand(i.amount_cents), weekday: weekdayFromIndex(i.weekday), count: i.count });
      case 'piece_jobs':
        return t('ins_piece_jobs', { perWeek: i.per_week.toLocaleString('en-ZA', { maximumFractionDigits: 1 }), amount: formatRand(i.amount_cents) });
      case 'tight_day':
        return t('ins_tight_day', { day: i.day });
      case 'busy_weekday':
        return t('ins_busy_weekday', { weekday: weekdayFromIndex(i.weekday), amount: formatRand(i.amount_cents) });
      case 'shortfall_gap':
        return t('ins_shortfall_gap', { amount: formatRand(Math.ceil(i.amount_cents / 1000) * 1000), date: shortDate(i.date) });
    }
  };
}

export function insightIcon(i: Insight): string {
  return { monthly_income: 'grant', recurring_weekly: 'calendar', piece_jobs: 'piece_job', tight_day: 'calendar', busy_weekday: 'plan', shortfall_gap: 'warning' }[i.code];
}
