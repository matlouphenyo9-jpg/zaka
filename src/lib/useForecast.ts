import { useMemo } from 'react';
import { buildForecast, type Forecast } from '../engine/forecast';
import { buildInsights, type Insight } from '../engine/insights';
import type { PlanProfile } from '../engine/types';
import { todaySA } from './dates';
import { useStore, type AppData } from './store';

export function planProfile(p: AppData['profile']): PlanProfile {
  return {
    reserve_amount: p?.reserve_amount ?? 0,
    income_plan: p?.income_plan ?? [],
    essentials: p?.essentials ?? {},
    ignored_patterns: p?.ignored_patterns ?? [],
  };
}

export function forecastFor(data: AppData, today = todaySA()): Forecast {
  return buildForecast({ today, txns: data.txns, obligations: data.obligations, goals: data.goals, profile: planProfile(data.profile) });
}

/** Recomputed client-side on every change, so it works offline. */
export function useForecast(): { forecast: Forecast; insights: Insight[] } {
  const { data } = useStore();
  const today = todaySA();
  return useMemo(() => {
    const forecast = forecastFor(data, today);
    return { forecast, insights: buildInsights(forecast) };
  }, [data, today]);
}
