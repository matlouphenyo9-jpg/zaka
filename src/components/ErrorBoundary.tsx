import { Component, type ReactNode } from 'react';
import i18n from '../i18n';

/** Last line of defence: a friendly screen instead of a blank page. Entries are safe in IndexedDB. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto flex min-h-screen max-w-[480px] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold text-ink">{i18n.t('error_generic', { ns: 'ui' })}</p>
        <button className="min-h-tap rounded-xl bg-teal px-5 py-3 font-semibold text-white" onClick={() => location.assign('/')}>
          {i18n.t('retry')}
        </button>
      </div>
    );
  }
}
