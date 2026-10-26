import { useTranslation } from 'react-i18next';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { SUPPORT_EMAIL, authErrorKey, checkPassword, clearFailures, cooldownLeft, normaliseEmail, recordFailure, signupMessageKey } from '../lib/authRules';
import { createClient } from '@supabase/supabase-js';
import { DEMO_EMAIL, DEMO_PASSWORD, SUPABASE_KEY, SUPABASE_URL, supabase } from '../lib/supabase';
import { DEMO_RESEED_KEY } from '../lib/store';
import { Button, Field } from '../components/ui';
import { Logo } from '../components/Logo';
import { Icon } from '../components/Icon';

export function AuthScreen() {
  const { t } = useTranslation('ui');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const [wait, setWait] = useState(() => Math.ceil(cooldownLeft() / 1000));
  const pw = checkPassword(password);

  // Count down a cool-down (it survives a refresh because it is stored on the phone).
  useEffect(() => {
    if (wait <= 0) return;
    const id = setInterval(() => setWait(Math.ceil(cooldownLeft() / 1000)), 1000);
    return () => clearInterval(id);
  }, [wait]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!navigator.onLine) return setMsg({ tone: 'error', text: t('auth_offline') });
    if (cooldownLeft() > 0) return setWait(Math.ceil(cooldownLeft() / 1000));
    const cleanEmail = normaliseEmail(email);
    if (!cleanEmail) return setMsg({ tone: 'error', text: t('auth_email_invalid') });
    if (mode === 'signup' && !pw.ok) return setMsg({ tone: 'error', text: t('auth_password_rule') });
    setEmail(cleanEmail);
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'signin') {
        // The shared demo starts fresh however it is opened, so nobody sees what the last visitor left behind.
        if (cleanEmail === DEMO_EMAIL) sessionStorage.setItem(DEMO_RESEED_KEY, '1');
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) {
          sessionStorage.removeItem(DEMO_RESEED_KEY);
          const left = recordFailure();
          setWait(Math.ceil(left / 1000));
          setMsg({ tone: 'error', text: t(authErrorKey(error, 'signin')) });
        } else clearFailures();
      } else {
        // Sign up on a separate client that keeps no session, so a new and an existing email look exactly the same:
        // one message, then the person signs in (where any failure is "Email or password is incorrect").
        const signupClient = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
        const { error } = await signupClient.auth.signUp({ email: cleanEmail, password });
        const key = signupMessageKey(error);
        if (key === 'auth_signup_done') {
          setMode('signin');
          setMsg({ tone: 'info', text: t(key) });
        } else setMsg({ tone: 'error', text: t(key) });
      }
    } finally {
      setBusy(false);
    }
  }

  async function demo() {
    if (!navigator.onLine) return setMsg({ tone: 'error', text: t('auth_offline') });
    setBusy(true);
    setMsg(null);
    sessionStorage.setItem(DEMO_RESEED_KEY, '1');
    const { error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    if (error) setMsg({ tone: 'error', text: t('auth_error') });
    setBusy(false);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col px-5 pb-8 pt-10">
      <Logo height={34} />
      <p className="mt-2 text-lg text-ink-soft">{t('tagline')}</p>

      <button onClick={demo} disabled={busy} className="mt-8 flex w-full items-center gap-4 rounded-xl2 border border-gold/50 bg-[#FBF5E1] p-4 text-left shadow-card transition hover:border-gold">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold text-ink">
          <Icon name="sparkle" />
        </span>
        <span className="flex-1">
          <span className="block text-lg font-bold text-ink">{t('auth_demo')}</span>
          <span className="block text-sm text-ink-soft">{t('auth_demo_note')}</span>
        </span>
        <Icon name="forward" className="text-ink-soft" />
      </button>

      <div className="my-6 flex items-center gap-3 text-sm text-ink-faint">
        <span className="h-px flex-1 bg-line" /> {t('auth_or')} <span className="h-px flex-1 bg-line" />
      </div>

      <h1 className="text-xl font-bold text-ink">{mode === 'signin' ? t('auth_title') : t('auth_signup_title')}</h1>
      <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
        <Field label={t('auth_email')} type="email" autoComplete="email" inputMode="email" maxLength={254} autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field
          label={t('auth_password')}
          type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          value={password}
          minLength={8}
          maxLength={72}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {mode === 'signup' && (
          <ul className="space-y-1 text-sm" aria-live="polite" data-testid="pw-rules">
            {(['length', 'letter', 'number'] as const).map((k) => (
              <li key={k} className={`flex items-center gap-2 ${pw[k] ? 'text-teal-dark' : 'text-ink-soft'}`}>
                <Icon name={pw[k] ? 'check' : 'info'} size={16} /> {t(`auth_pw_${k}`)}
              </li>
            ))}
          </ul>
        )}
        {wait > 0 && (
          <p role="alert" className="rounded-xl bg-amber-soft px-4 py-3 text-[15px] font-semibold text-amber-ink" data-testid="cooldown">
            {t('auth_cooldown', { n: wait })}
          </p>
        )}
        {msg && (
          <p role="alert" className={`rounded-xl px-4 py-3 text-[15px] ${msg.tone === 'error' ? 'bg-risk-soft text-risk' : 'bg-teal-soft text-teal-dark'}`}>
            {msg.text}
          </p>
        )}
        <Button block type="submit" disabled={busy || wait > 0 || !email || (mode === 'signup' ? !pw.ok : password.length < 1)}>
          {busy ? t('signing_in') : mode === 'signin' ? t('auth_signin') : t('auth_signup')}
        </Button>
      </form>
      <button className="mt-4 min-h-tap text-base font-semibold text-teal" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg(null); }}>
        {mode === 'signin' ? t('auth_switch_to_signup') : t('auth_switch_to_signin')}
      </button>
      {mode === 'signin' && (
        <p className="mt-2 text-[15px] text-ink-soft">
          {t('auth_forgot')} <a className="font-semibold text-teal underline underline-offset-2" href={`mailto:${SUPPORT_EMAIL}?subject=Zaka%20password`}>{SUPPORT_EMAIL}</a>
        </p>
      )}
      {mode === 'signup' && (
        <p className="mt-2 text-sm text-ink-soft">
          {t('auth_terms_pre')} <Link to="/privacy" className="font-semibold text-teal underline underline-offset-2">{t('privacy_link')}</Link>
        </p>
      )}
    </div>
  );
}
