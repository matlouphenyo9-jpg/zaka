import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { LOCALES, setLocale, type LocaleCode } from '../i18n';
import { Button } from '../components/ui';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';

export function LanguageScreen({ onDone }: { onDone: (c: LocaleCode) => void }) {
  const { t, i18n } = useTranslation();
  const { t: tu } = useTranslation('ui');
  const [sel, setSel] = useState<LocaleCode>((i18n.language as LocaleCode) || 'en');
  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col px-5 pb-8 pt-10">
      <Logo height={34} />
      <p className="mt-2 text-lg text-ink-soft">{tu('tagline')}</p>
      <h1 className="mt-10 text-[1.6rem] font-bold text-ink">{t('language_title')}</h1>
      <p className="mt-1 text-base text-ink-soft">{t('language_note')}</p>
      <div className="mt-6 space-y-2" role="radiogroup" aria-label={t('language_title')}>
        {LOCALES.map((l) => (
          <div key={l.code}>
            <button
              role="radio"
              aria-checked={sel === l.code}
              lang={l.bcp47}
              onClick={() => {
                setSel(l.code);
                setLocale(l.code);
              }}
              className={`flex min-h-[60px] w-full items-center justify-between rounded-xl border px-4 text-left text-lg font-semibold transition ${
                sel === l.code ? 'border-teal bg-teal-soft text-ink ring-2 ring-teal/30' : 'border-line bg-white text-ink'
              }`}
            >
              <span>{l.name}</span>
              <span className="flex items-center gap-2">
                {l.beta && <span className="rounded-full bg-amber-soft px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-ink">beta</span>}
                {sel === l.code && <Icon name="check" className="text-teal" />}
              </span>
            </button>
          </div>
        ))}
      </div>
      {LOCALES.find((l) => l.code === sel)?.beta && <p className="mt-4 rounded-xl bg-amber-soft px-4 py-3 text-[15px] text-amber-ink">{t('beta')}</p>}
      <div className="mt-auto pt-8">
        <Button block onClick={() => onDone(sel)}>
          {t('continue')}
        </Button>
      </div>
    </div>
  );
}
