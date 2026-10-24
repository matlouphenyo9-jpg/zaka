import { Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { lazy, Suspense, useEffect, useState } from 'react';
import { LOCALE_OVERRIDE_KEY, useStore } from './lib/store';
import { savedLocale, setLocale, type LocaleCode } from './i18n';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { CoinMark } from './components/Logo';
import { LanguageScreen } from './screens/Language';
import { AuthScreen } from './screens/Auth';
import { ConsentScreen } from './screens/Consent';
const OnboardingScreen = lazy(() => import('./screens/Onboarding').then((m) => ({ default: m.OnboardingScreen })));
import { HomeScreen } from './screens/Home';
const AddScreen = lazy(() => import('./screens/Add').then((m) => ({ default: m.AddScreen })));
const PlanScreen = lazy(() => import('./screens/Plan').then((m) => ({ default: m.PlanScreen })));
const SafetyScreen = lazy(() => import('./screens/Safety').then((m) => ({ default: m.SafetyScreen })));
const MeScreen = lazy(() => import('./screens/Me').then((m) => ({ default: m.MeScreen })));

function Splash() {
  const { t } = useTranslation('ui');
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-paper">
      <CoinMark size={56} />
      <Spinner label={t('loading')} />
    </div>
  );
}

export function App() {
  const { session, authReady, data, dataReady } = useStore();
  const [locale, setLoc] = useState<LocaleCode | null>(savedLocale());

  // The profile's language wins once signed in (e.g. the demo account is isiXhosa).
  useEffect(() => {
    const pl = data.profile?.locale;
    if (pl && pl !== locale && !sessionStorage.getItem(LOCALE_OVERRIDE_KEY)) {
      setLocale(pl);
      setLoc(pl);
    }
  }, [data.profile?.locale, locale]);

  if (!locale) return <LanguageScreen onDone={(c) => setLoc(c)} />;
  if (!authReady) return <Splash />;
  if (!session) return <AuthScreen />;
  if (!dataReady || !data.profile) return <Splash />;
  if (!data.profile.consent_at) return <ConsentScreen />;
  if (!data.profile.onboarded_at) return <Suspense fallback={<Splash />}><OnboardingScreen /></Suspense>;

  return (
    <Suspense fallback={<Splash />}>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomeScreen />} />
        <Route path="add" element={<AddScreen />} />
        <Route path="plan" element={<PlanScreen />} />
        <Route path="safety" element={<SafetyScreen />} />
        <Route path="me" element={<MeScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
