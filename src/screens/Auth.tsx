import { useTranslation } from 'react-i18next';
import { useState, type FormEvent } from 'react';
import { DEMO_EMAIL, DEMO_PASSWORD, supabase } from '../lib/supabase';
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

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!navigator.onLine) return setMsg({ tone: 'error', text: t('auth_offline') });
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setMsg({ tone: 'error', text: t('auth_error') });
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) setMsg({ tone: 'error', text: error.message });
        else if (!data.session) setMsg({ tone: 'info', text: t('auth_check_email') });
      }
    } finally {
      setBusy(false);
    }
  }

  async function demo() {
    if (!navigator.onLine) return setMsg({ tone: 'error', text: t('auth_offline') });
    setBusy(true);
    setMsg(null);
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
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <h1 className="text-xl font-bold text-ink">{mode === 'signin' ? t('auth_title') : t('auth_signup_title')}</h1>
      <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
        <Field label={t('auth_email')} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field
          label={t('auth_password')}
          type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          value={password}
          minLength={8}
          hint={mode === 'signup' ? t('auth_password_hint') : undefined}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {msg && (
          <p role="alert" className={`rounded-xl px-4 py-3 text-[15px] ${msg.tone === 'error' ? 'bg-risk-soft text-risk' : 'bg-teal-soft text-teal-dark'}`}>
            {msg.text}
          </p>
        )}
        <Button block type="submit" disabled={busy || !email || password.length < (mode === 'signup' ? 8 : 1)}>
          {busy ? t('signing_in') : mode === 'signin' ? t('auth_signin') : t('auth_signup')}
        </Button>
      </form>
      <button className="mt-4 min-h-tap text-base font-semibold text-teal" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg(null); }}>
        {mode === 'signin' ? t('auth_switch_to_signup') : t('auth_switch_to_signin')}
      </button>
    </div>
  );
}
