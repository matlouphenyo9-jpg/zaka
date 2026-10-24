import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { useStore } from '../lib/store';
import { isBeta } from '../i18n';

const TABS = [
  { to: '/', icon: 'home', key: 'nav_home' },
  { to: '/add', icon: 'plus', key: 'nav_add' },
  { to: '/plan', icon: 'plan', key: 'nav_plan' },
  { to: '/safety', icon: 'shield', key: 'nav_safety' },
  { to: '/me', icon: 'user', key: 'nav_me' },
];

export function SyncPill() {
  const { online, pending } = useStore();
  const { t } = useTranslation('ui');
  if (!online)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-2.5 py-1 text-sm font-semibold text-amber-ink">
        <Icon name="offline" size={16} /> {pending ? t('pending_sync', { count: pending }) : 'Offline'}
      </span>
    );
  if (pending)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 text-sm font-semibold text-ink-soft">
        <Icon name="sync" size={16} className="animate-spin [animation-duration:2s]" /> {t('pending_sync', { count: pending })}
      </span>
    );
  return null;
}

function BetaNotice() {
  const { t, i18n } = useTranslation();
  const { t: tu } = useTranslation('ui');
  const { changeLocale } = useStore();
  const [hidden, setHidden] = useState(() => sessionStorage.getItem('zaka.beta.hidden') === i18n.language);
  if (!isBeta(i18n.language) || hidden) return null;
  return (
    <div className="mb-4 rounded-xl border border-amber/30 bg-amber-soft px-4 py-3 text-[15px] text-amber-ink">
      <p>
        <strong className="mr-1 rounded bg-white/70 px-1.5 py-0.5 text-xs uppercase tracking-wide">{tu('beta_badge')}</strong>
        {t('beta')}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          className="min-h-tap rounded-lg px-3 font-semibold underline underline-offset-2"
          onClick={() => void changeLocale('en')}
        >
          English
        </button>
        <button
          className="min-h-tap rounded-lg px-3 font-semibold"
          onClick={() => {
            sessionStorage.setItem('zaka.beta.hidden', i18n.language);
            setHidden(true);
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}

export function Layout() {
  const { t } = useTranslation('ui');
  const { data } = useStore();
  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-paper">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-paper/90 px-5 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <Logo height={26} />
        <div className="flex items-center gap-2">
          {data.profile?.is_demo && <span className="rounded-full bg-[#F6EDCF] px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-[#6B5208]">{t('synthetic_badge')}</span>}
          <SyncPill />
        </div>
      </header>
      <main className="pb-nav px-5 pt-2">
        <BetaNotice />
        <Outlet />
      </main>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto grid max-w-[480px] grid-cols-5">
          {TABS.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  `flex min-h-[64px] flex-col items-center justify-center gap-0.5 text-[13px] font-semibold transition-colors ${isActive ? 'text-teal' : 'text-ink-soft hover:text-ink'}`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`flex h-8 w-12 items-center justify-center rounded-full ${isActive ? 'bg-teal-soft' : ''}`}>
                      <Icon name={tab.icon} size={22} strokeWidth={isActive ? 2.1 : 1.8} />
                    </span>
                    {t(tab.key)}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
