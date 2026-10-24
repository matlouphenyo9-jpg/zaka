import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Badge, Button, Card, Chip, Field, ScreenTitle, Segmented } from '../components/ui';
import { Icon } from '../components/Icon';
import { checkMessage, type ScamFlag, type ScamResult } from '../engine/scam';
import { loanCost, type CreditType, type LoanResult } from '../engine/loan';
import { explainScam } from '../lib/ai';
import { supabase } from '../lib/supabase';
import { formatRand, parseRandInput } from '../lib/money';

const FLAG_ICON: Record<ScamFlag, string> = {
  otp_pin: 'shield', upfront_fee: 'debt', urgency: 'warning', link: 'link', too_good: 'gift',
  impersonation: 'grant', new_number: 'data_airtime', personal_info: 'user', prompt_injection: 'info',
};

// Synthetic examples so the check can be tried in one tap. Not real messages.
const EXAMPLES = [
  'Congratulations! Your R5000 loan is approved, no credit check. Pay an admin fee of R350 today to release your loan. WhatsApp 071 000 0000.',
  'SASSA: Your SRD grant is on hold. Update your details within 24 hours at sassa-srd-update.xyz or lose your payment.',
];

function ScamShield() {
  const { t, i18n } = useTranslation();
  const { t: tu } = useTranslation('ui');
  const [text, setText] = useState('');
  const [result, setResult] = useState<ScamResult | null>(null);
  const [ai, setAi] = useState<{ state: 'idle' | 'loading' | 'done' | 'failed'; summary?: string; next_step?: string }>({ state: 'idle' });

  async function check(msg = text) {
    const r = checkMessage(msg);
    setResult(r);
    // Only the outcome is stored, never the message.
    void supabase.from('scam_checks').insert({ risk_level: r.level, flags: r.flags }).then(() => undefined, () => undefined);
    setAi({ state: 'loading' });
    const ex = await explainScam(msg, r.flags, r.level, i18n.language);
    setAi(ex ? { state: 'done', ...ex } : { state: 'failed' });
  }

  const tone = result?.level === 'high' ? 'risk' : result?.level === 'medium' ? 'amber' : 'plain';

  return (
    <div className="space-y-4">
      <p className="text-ink-soft">{tu('scam_intro')}</p>
      {!result ? (
        <>
          <div>
            <label htmlFor="scam-text" className="mb-1.5 block text-base font-semibold">{t('paste')}</label>
            <textarea
              id="scam-text"
              rows={6}
              maxLength={2000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-xl border border-line bg-white px-4 py-3 text-base focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/25"
            />
            <p className="mt-1.5 flex items-start gap-2 text-sm text-ink-soft"><Icon name="info" size={18} className="shrink-0" />{t('privacy')}</p>
          </div>
          <Button block icon="shield" disabled={!text.trim()} onClick={() => check()}>{t('check')}</Button>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex, i) => (
              <Chip key={i} icon="sparkle" onClick={() => { setText(ex); void check(ex); }}>
                {tu('scam_example', { n: i + 1 })}
              </Chip>
            ))}
          </div>
        </>
      ) : (
        <>
          <Card tone={tone}>
            <div className="flex items-start gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${result.level === 'high' ? 'bg-risk text-white' : result.level === 'medium' ? 'bg-amber text-white' : 'bg-ink/10 text-ink'}`}>
                <Icon name={result.level === 'low' ? 'info' : 'warning'} />
              </span>
              <div>
                <p className={`text-xl font-bold ${result.level === 'high' ? 'text-risk' : result.level === 'medium' ? 'text-amber-ink' : 'text-ink'}`} data-testid="scam-level">
                  {tu(`scam_level_${result.level}`)}
                </p>
                <p className="mt-1 text-ink">{result.level === 'low' ? tu('scam_low_body') : t('warning')}</p>
              </div>
            </div>
            {result.flags.length > 0 && (
              <ul className="mt-4 space-y-2" aria-label={t('reasons', { reasons: '' })}>
                {result.flags.map((f) => (
                  <li key={f} className="flex items-center gap-3 rounded-xl bg-white/70 px-3 py-2.5 font-semibold text-ink">
                    <Icon name={FLAG_ICON[f]} size={20} className={result.level === 'high' ? 'text-risk' : 'text-amber'} />
                    {tu(`flag_${f}`)}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <p className="mb-2 flex items-center gap-2 font-semibold"><Icon name="sparkle" size={20} className="text-teal" /> {tu('scam_next_step')}</p>
            {ai.state === 'loading' && <p className="animate-pulse text-ink-soft">{tu('scam_explaining')}</p>}
            {ai.state === 'done' && (
              <>
                <p className="text-ink">{ai.summary}</p>
                {ai.next_step && <p className="mt-2 font-semibold text-teal-dark">{ai.next_step}</p>}
              </>
            )}
            {(ai.state === 'failed' || ai.state === 'idle') && <p className="text-ink">{t('safe_step')}</p>}
            {ai.state === 'failed' && result.level !== 'low' && <p className="mt-2 text-sm text-ink-soft">{tu('scam_explain_failed')}</p>}
            <p className="mt-3 text-sm text-ink-soft">{t(result.level === 'low' ? 'uncertain' : 'no_guarantee')}</p>
          </Card>

          <Card>
            <p className="mb-2 font-semibold">{tu('scam_report')}</p>
            <ul className="space-y-2 text-[15px] text-ink">
              <li className="flex gap-2"><Icon name="grant" size={20} className="shrink-0 text-ink-soft" />{tu('scam_report_bank')}</li>
              <li className="flex gap-2"><Icon name="shield" size={20} className="shrink-0 text-ink-soft" />{tu('scam_report_saps')}</li>
              <li className="flex gap-2"><Icon name="debt" size={20} className="shrink-0 text-ink-soft" /><a className="underline underline-offset-2" href="tel:0860627627">{tu('scam_report_ncr')}</a></li>
              <li className="flex gap-2"><Icon name="info" size={20} className="shrink-0 text-ink-soft" />{tu('scam_report_sassa')}</li>
            </ul>
          </Card>
          <p className="text-sm text-ink-soft">{tu('scam_not_stored')}</p>
          <Button variant="secondary" block onClick={() => { setResult(null); setText(''); setAi({ state: 'idle' }); }}>{tu('scam_clear')}</Button>
        </>
      )}
    </div>
  );
}

function LoanCheck() {
  const { t } = useTranslation();
  const { t: tu } = useTranslation('ui');
  const [type, setType] = useState<CreditType>('short_first');
  const [mode, setMode] = useState<'pct_month' | 'rand'>('pct_month');
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [interest, setInterest] = useState('');
  const [fees, setFees] = useState('');
  const [term, setTerm] = useState('1');
  const [res, setRes] = useState<LoanResult | null>(null);
  const [missing, setMissing] = useState(false);

  function calc() {
    const p = parseRandInput(principal);
    const f = fees.trim() ? parseRandInput(fees) : 0;
    const n = Number(term);
    const r = Number(rate.replace(',', '.'));
    const i = parseRandInput(interest);
    const ok = p && f != null && n > 0 && n <= 120 && (mode === 'pct_month' ? rate.trim() !== '' && r >= 0 && r <= 100 : i != null);
    if (!ok) {
      setMissing(true);
      setRes(null);
      return;
    }
    setMissing(false);
    setRes(loanCost({ principal_cents: p!, interest: mode === 'pct_month' ? { mode, rate: r } : { mode, cents: i! }, fees_cents: f!, term_months: n, type }));
  }

  return (
    <div className="space-y-4">
      <p className="text-ink-soft">{tu('loan_intro')}</p>
      <div>
        <label htmlFor="loan-type" className="mb-1.5 block text-base font-semibold">{tu('loan_type')}</label>
        <select id="loan-type" value={type} onChange={(e) => setType(e.target.value as CreditType)} className="min-h-tap w-full rounded-xl border border-line bg-white px-4 py-3 text-base">
          <option value="short_first">{tu('loan_type_short_first')}</option>
          <option value="short_repeat">{tu('loan_type_short_repeat')}</option>
          <option value="other">{tu('loan_type_other')}</option>
        </select>
      </div>
      <Field label={t('borrowed')} inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
      <Segmented label={tu('loan_interest_mode')} value={mode} onChange={setMode} options={[{ value: 'pct_month', label: tu('loan_interest_pct_month') }, { value: 'rand', label: tu('loan_interest_rand') }]} />
      <div className="grid grid-cols-2 gap-3">
        {mode === 'pct_month' ? (
          <Field label={tu('loan_rate')} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} suffix={<span className="text-ink-soft">%</span>} />
        ) : (
          <Field label={t('interest')} inputMode="decimal" value={interest} onChange={(e) => setInterest(e.target.value)} />
        )}
        <Field label={tu('loan_term')} inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value.replace(/\D/g, '').slice(0, 3))} />
      </div>
      <Field label={t('fees')} inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} />
      {missing && <p role="alert" className="rounded-xl bg-amber-soft px-4 py-3 text-amber-ink">{t('missing_terms')}</p>}
      <Button block icon="calc" onClick={calc}>{t('show_total')}</Button>

      {res && (
        <Card tone={res.above_limit ? 'risk' : 'plain'}>
          <p className="text-sm font-semibold text-ink-soft">{tu('loan_result_total')}</p>
          <p className="tabular text-[2.5rem] font-bold leading-tight" data-testid="loan-total">{formatRand(res.total_cents)}</p>
          <p className="text-lg">
            {tu('loan_result_cost')} <strong className="tabular">{formatRand(res.cost_cents)}</strong> · {tu('loan_result_extra', { pct: res.cost_pct })}
          </p>
          {Number(term) > 1 && <p className="text-ink-soft">{tu('loan_per_month', { amount: formatRand(res.monthly_cents) })}</p>}
          <div className="mt-4">
            {res.above_limit === true && <p className="flex items-start gap-2 rounded-xl bg-risk px-3 py-2.5 font-bold text-white" data-testid="above-limit"><Icon name="warning" size={20} className="mt-0.5 shrink-0" />{t('above_limit')}</p>}
            {res.above_limit === false && <Badge tone="teal" icon="check">{tu('loan_within_limit')}</Badge>}
            {res.above_limit === null && <p className="text-[15px] text-ink">{tu('loan_no_limit')}</p>}
          </div>
          {res.max_rate != null && <p className="mt-2 text-sm text-ink-soft">{tu('loan_limit_value', { rate: res.max_rate })} {tu('loan_fees_note')}</p>}
        </Card>
      )}

      <Card>
        <ul className="space-y-3 text-[15px]">
          <li className="flex gap-2"><Icon name="shield" size={20} className="shrink-0 text-teal" />{tu('loan_rights')}</li>
          <li className="flex gap-2">
            <Icon name="link" size={20} className="shrink-0 text-teal" />
            <a href="https://ncr.org.za/register/registered_cp.php" target="_blank" rel="noopener noreferrer" className="font-semibold text-teal underline underline-offset-2">{tu('loan_ncr_check')}</a>
          </li>
          <li className="flex gap-2"><Icon name="debt" size={20} className="shrink-0 text-teal" /><a className="underline underline-offset-2" href="tel:0860627627">{tu('scam_report_ncr')}</a></li>
        </ul>
      </Card>
      <p className="text-sm text-ink-soft">{t('loan_disclaimer')}</p>
    </div>
  );
}

export function SafetyScreen() {
  const { t } = useTranslation();
  const { t: tu } = useTranslation('ui');
  const [tab, setTab] = useState<'scam' | 'loan'>('scam');
  return (
    <div className="space-y-4">
      <ScreenTitle>{tu('safety')}</ScreenTitle>
      <Segmented label={tu('safety')} value={tab} onChange={setTab} options={[{ value: 'scam', label: t('scam'), icon: 'shield' }, { value: 'loan', label: t('loan'), icon: 'calc' }]} />
      {tab === 'scam' ? <ScamShield /> : <LoanCheck />}
    </div>
  );
}
