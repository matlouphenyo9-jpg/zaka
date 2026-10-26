// B4-G1: Privacy & Terms in plain language. Open to everyone (linked from sign-up, consent and Me).
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui';

const SECTIONS = ['who', 'collect', 'never', 'ai', 'slips', 'where', 'keep', 'rights', 'advice'] as const;

export function PrivacyScreen() {
  const { t: tu } = useTranslation('ui');
  const navigate = useNavigate();
  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-paper px-5 pb-10 pt-8">
      <Logo height={30} />
      <h1 className="mt-6 text-2xl font-bold text-ink">{tu('privacy_title')}</h1>
      <p className="mt-1 text-sm text-ink-soft">{tu('privacy_updated')}</p>
      <div className="mt-6 space-y-5">
        {SECTIONS.map((s) => (
          <section key={s}>
            <h2 className="text-lg font-bold text-ink">{tu(`privacy_${s}_h`)}</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-ink">{tu(`privacy_${s}_b`)}</p>
          </section>
        ))}
      </div>
      <Button className="mt-8" variant="secondary" icon="back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
        {tu('privacy_back')}
      </Button>
    </div>
  );
}

export function NotFoundScreen() {
  const { t: tu } = useTranslation('ui');
  const navigate = useNavigate();
  return (
    <div className="pt-10 text-center" data-testid="not-found">
      <p className="text-5xl font-bold text-ink-faint">404</p>
      <h1 className="mt-4 text-xl font-bold text-ink">{tu('notfound_title')}</h1>
      <p className="mt-2 text-ink-soft">{tu('notfound_body')}</p>
      <Button className="mt-6" icon="home" onClick={() => navigate('/', { replace: true })}>
        {tu('notfound_home')}
      </Button>
    </div>
  );
}
