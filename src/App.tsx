import { Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useStore } from './lib/store';
import { savedLocale, setLocale, type LocaleCode } from './i18n';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { CoinMark } from './components/Logo';
import { LanguageScreen } from './screens/Language';
import { AuthScreen } from './screens/Auth';
import { ConsentScreen } from './screens/Consent';
import { NotFoundScreen, PrivacyScreen } from './screens/Privacy';
import { LockScreen, usePinLock } from './components/PinLock';
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
  const { pathname } = useLocation();
  const uid = session?.user.id ?? null;
  const [locked, unlock] = usePinLock(uid);
  const [locale, setLoc] = useState<LocaleCode | null>(savedLocale());

  // A real account's saved language wins once signed in (it follows the user across devices). The shared demo
  // account keeps whatever language was picked on this device.
  useEffect(() => {
    const pl = data.profile?.locale;
    if (pl && pl !== locale && !data.profile?.is_demo) {
      setLocale(pl);
      setLoc(pl);
    }
  }, [data.profile?.locale, data.profile?.is_demo, locale]);

  // The privacy page is public: it opens before sign-in (linked from sign-up) and needs no account.
  if (pathname === '/privacy') return <PrivacyScreen />;
  if (!locale) return <LanguageScreen onDone={(c) => setLoc(c)} />;
  if (!authReady) return <Splash />;
  if (!session) return <AuthScreen />;
  if (locked && uid) return <LockScreen uid={uid} onUnlock={unlock} />;
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
        <Route path="*" element={<NotFoundScreen />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
