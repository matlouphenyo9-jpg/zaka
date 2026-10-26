import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib/store';
import { Button } from '../components/ui';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';

export function ConsentScreen() {
  const { t } = useTranslation('ui');
  const { saveProfile, signOut } = useStore();
  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col px-5 pb-8 pt-10">
      <Logo height={30} />
      <h1 className="mt-8 text-[1.6rem] font-bold text-ink">{t('consent_title')}</h1>
      <p className="mt-4 text-[17px] leading-relaxed text-ink">{t('consent_body')}</p>
      <Link to="/privacy" className="mt-2 inline-flex min-h-tap items-center font-semibold text-teal underline underline-offset-2">{t('privacy_link')}</Link>
      <ul className="mt-6 space-y-3">
        {['consent_points_1', 'consent_points_2', 'consent_points_3'].map((k) => (
          <li key={k} className="flex items-start gap-3 text-base text-ink">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-soft text-teal">
              <Icon name="check" size={18} />
            </span>
            {t(k)}
          </li>
        ))}
      </ul>
      <div className="mt-auto space-y-3 pt-8">
        <Button block onClick={() => saveProfile({ consent_at: new Date().toISOString() })}>
          {t('consent_agree')}
        </Button>
        <Button block variant="ghost" onClick={() => signOut()}>
          {t('consent_decline')}
        </Button>
      </div>
    </div>
  );
}
