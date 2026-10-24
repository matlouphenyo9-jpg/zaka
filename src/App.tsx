import { Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { LOCALE_OVERRIDE_KEY, useStore } from './lib/store';
import { savedLocale, setLocale, type LocaleCode } from './i18n';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { CoinMark } from './components/Logo';
import { LanguageScreen } from './screens/Language';
import { AuthScreen } from './screens/Auth';
import { ConsentScreen } from './screens/Consent';
import { OnboardingScreen } from './screens/Onboarding';
import { HomeScreen } from './screens/Home';
import { AddScreen } from './screens/Add';
import { PlanScreen } from './screens/Plan';
import { SafetyScreen } from './screens/Safety';
import { MeScreen } from './screens/Me';

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
  if (!data.profile.onboarded_at) return <OnboardingScreen />;

  return (
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
  );
}
