// B4-G2/G4: "How is Zaka for you?" (real traction evidence) and "Share Zaka" on WhatsApp.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { cleanText } from '../lib/validate';
import { Button, Card } from './ui';
import { Icon } from './Icon';

export const SITE_URL = 'https://zaka.pages.dev';

export function FeedbackCard() {
  const { t: tu } = useTranslation('ui');
  const { i18n } = useTranslation();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [quote, setQuote] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (rating < 1) return setError(tu('feedback_pick_stars'));
    const c = cleanText(comment, { max: 280, required: false });
    if (!c.ok) return setError(tu(`err_${c.error}`));
    setError(null);
    setState('busy');
    // Insert only: nobody (not even the sender) can read feedback rows back through the API.
    const { error: e } = await supabase.from('feedback').insert({ rating, comment: c.value || null, may_quote: quote, locale: i18n.language });
    if (e) {
      setState('idle');
      return setError(tu(e.code === '53400' ? 'feedback_limit' : 'feedback_failed'));
    }
    setState('sent');
  }

  if (state === 'sent') {
    return (
      <Card tone="teal">
        <p className="flex items-center gap-2 font-semibold text-teal-dark"><Icon name="check" /> {tu('feedback_thanks')}</p>
      </Card>
    );
  }
  return (
    <Card>
      <p className="font-semibold">{tu('feedback_title')}</p>
      <div className="mt-2 flex gap-1" role="radiogroup" aria-label={tu('feedback_title')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={rating === n}
            aria-label={tu('feedback_stars', { n })}
            onClick={() => { setRating(n); setError(null); }}
            className={`min-h-tap min-w-tap text-3xl leading-none ${n <= rating ? 'text-gold' : 'text-line'}`}
          >
            ★
          </button>
        ))}
      </div>
      <label className="mt-3 block text-[15px] font-semibold" htmlFor="fb-comment">{tu('feedback_comment')}</label>
      <textarea
        id="fb-comment"
        rows={3}
        maxLength={280}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="mt-1 w-full rounded-xl border border-line bg-white px-4 py-3 text-base focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/25"
      />
      <label className="mt-2 flex min-h-tap items-center gap-3 text-[15px]">
        <input type="checkbox" checked={quote} onChange={(e) => setQuote(e.target.checked)} className="h-5 w-5 accent-teal" />
        {tu('feedback_quote')}
      </label>
      {error && <p role="alert" className="mt-2 font-semibold text-risk">{error}</p>}
      <Button className="mt-3" icon="check" disabled={state === 'busy'} onClick={send}>{tu('feedback_send')}</Button>
    </Card>
  );
}

export function ShareButton() {
  const { t: tu } = useTranslation('ui');
  const text = `${tu('share_message')} ${SITE_URL}`;
  return (
    <a
      className="inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 font-semibold text-ink shadow-card"
      href={`https://wa.me/?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="share-zaka"
    >
      <Icon name="forward" size={20} /> {tu('share_zaka')}
    </a>
  );
}
