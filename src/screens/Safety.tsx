import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Button, Card, Chip, Field, ScreenTitle, Segmented } from '../components/ui';
import { Icon } from '../components/Icon';
import { checkMessage, notAMessage, type ScamFlag, type ScamResult } from '../engine/scam';
import { loanCost, type CreditType, type LoanResult, type Verdict } from '../engine/loan';
import { CREDIT_TYPES, LEGAL_CHECKED, REPO, rateCap } from '../engine/legal';
import { BANK_LINES, HELP_CHECKED, HELP_LINES, telHref } from '../data/help';
import { longDate } from '../lib/format';
import { explainScam } from '../lib/ai';
import { supabase } from '../lib/supabase';
import { formatRand, parseRandInput } from '../lib/money';
import { scamTextError, stripInvisible } from '../lib/validate';

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
  const [inputErr, setInputErr] = useState<string | null>(null);

  async function check(raw = text) {
    // Empty, emoji-only or symbol-only text is refused here and again on the server (no AI call, nothing stored).
    const msg = stripInvisible(raw).trim();
    const bad = scamTextError(msg);
    if (bad) return setInputErr(tu(`err_${bad}`));
    // A question for an assistant, chat, code or keyboard-mash isn't a message someone received: no check, no AI call.
    if (notAMessage(msg)) return setInputErr(tu('scam_not_message'));
    setInputErr(null);
    const r = checkMessage(msg);
    setResult(r);
    // Only the outcome is stored, never the message.
    void supabase.from('scam_checks').insert({ risk_level: r.level, flags: r.flags }).then(() => undefined, () => undefined);
    setAi({ state: 'loading' });
    const ex = await explainScam(msg, r.flags, r.level, i18n.language);
    if (ex === 'not_a_message') {
      setResult(null);
      setAi({ state: 'idle' });
      return setInputErr(tu('scam_not_message'));
    }
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
          {inputErr && <p role="alert" className="rounded-xl bg-amber-soft px-4 py-3 font-semibold text-amber-ink" data-testid="scam-input-error">{inputErr}</p>}
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

          <ReportCard flags={result.flags} />
          <p className="text-sm text-ink-soft">{tu('scam_not_stored')}</p>
          <Button variant="secondary" block onClick={() => { setResult(null); setText(''); setAi({ state: 'idle' }); }}>{tu('scam_clear')}</Button>
        </>
      )}
    </div>
  );
}

/** Verified help numbers (R8 Part C). Shows the lines that fit the warning signs first. */
function ReportCard({ flags }: { flags: ScamFlag[] }) {
  const { t: tu } = useTranslation('ui');
  const [banksOpen, setBanksOpen] = useState(false);
  const lines = [HELP_LINES.saps, ...(flags.includes('impersonation') ? [HELP_LINES.sassa] : []), ...(flags.includes('upfront_fee') || flags.includes('too_good') ? [HELP_LINES.ncr] : []), HELP_LINES.obs];
  if (!lines.includes(HELP_LINES.sassa)) lines.splice(lines.length - 1, 0, HELP_LINES.sassa);
  if (!lines.includes(HELP_LINES.ncr)) lines.splice(lines.length - 1, 0, HELP_LINES.ncr);
  return (
    <Card>
      <p className="mb-1 font-semibold">{tu('scam_report')}</p>
      <p className="mb-3 text-sm text-ink-soft">{tu('help_own_number')}</p>
      <ul className="divide-y divide-line">
        {lines.map((l) => (
          <li key={l.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">{l.name}</p>
              <p className="text-sm text-ink-soft">{tu(l.use)}</p>
            </div>
            <a href={telHref(l.number)} className="tabular inline-flex min-h-tap shrink-0 items-center rounded-xl bg-teal-soft px-3 font-semibold text-teal-dark">{l.number}</a>
          </li>
        ))}
      </ul>
      <button type="button" aria-expanded={banksOpen} onClick={() => setBanksOpen(!banksOpen)} className="mt-2 flex min-h-tap w-full items-center justify-between rounded-xl px-1 text-left font-semibold text-teal">
        {tu('help_bank_lines')} <Icon name={banksOpen ? 'close' : 'forward'} size={18} />
      </button>
      {banksOpen && (
        <ul className="divide-y divide-line">
          {BANK_LINES.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-2">
              <span className="font-semibold">{b.name}</span>
              <a href={telHref(b.number)} className="tabular inline-flex min-h-tap items-center px-2 font-semibold text-teal-dark underline underline-offset-2">{b.number}</a>
            </li>
          ))}
          <li className="py-2 text-sm text-ink-soft">{tu('help_other_banks')}</li>
        </ul>
      )}
      <p className="mt-2 text-xs text-ink-faint">{tu('help_checked', { date: longDate(HELP_CHECKED) })}</p>
    </Card>
  );
}

type Mode = 'pct_month' | 'pct_year' | 'rand';

function VerdictLine({ verdict, above, within, unknown }: { verdict: Verdict; above: string; within: string; unknown?: string }) {
  if (verdict === 'above') return <p className="flex items-start gap-2 rounded-xl bg-risk px-3 py-2.5 font-bold text-white" data-testid="above-limit"><Icon name="warning" size={20} className="mt-0.5 shrink-0" />{above}</p>;
  if (verdict === 'within') return <p className="flex items-start gap-2 rounded-xl bg-teal-soft px-3 py-2.5 font-semibold text-teal-dark"><Icon name="check" size={20} className="mt-0.5 shrink-0" />{within}</p>;
  return unknown ? <p className="flex items-start gap-2 rounded-xl bg-ink/5 px-3 py-2.5 text-ink"><Icon name="info" size={20} className="mt-0.5 shrink-0" />{unknown}</p> : null;
}

function LoanCheck() {
  const { t } = useTranslation();
  const { t: tu } = useTranslation('ui');
  const [type, setType] = useState<CreditType>('short_first');
  const [mode, setMode] = useState<Mode>('pct_month');
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [interest, setInterest] = useState('');
  const [initFee, setInitFee] = useState('');
  const [serviceFee, setServiceFee] = useState('');
  const [fees, setFees] = useState('');
  const [term, setTerm] = useState('1');
  const [res, setRes] = useState<LoanResult | null>(null);
  const [missing, setMissing] = useState(false);
  const cap = rateCap(type);
  const opt = (s: string) => (s.trim() ? parseRandInput(s) : 0);

  function calc() {
    const p = parseRandInput(principal);
    const [fi, fs, fo] = [opt(initFee), opt(serviceFee), opt(fees)];
    const n = Number(term);
    // Strict number format: "1e3", "Infinity" or "--5" can never reach the maths (no NaN or Infinity on screen).
    const rateText = rate.trim().replace(',', '.');
    const r = /^\d{1,4}(\.\d{1,2})?$/.test(rateText) ? Number(rateText) : NaN;
    const i = parseRandInput(interest);
    const rateOk = mode === 'rand' ? i != null : Number.isFinite(r) && r >= 0 && r <= (mode === 'pct_month' ? 100 : 1000);
    const principalOk = p != null && p >= 10_000 && p <= 100_000_000; // R100 – R1,000,000
    if (!principalOk || fi == null || fs == null || fo == null || !(Number.isInteger(n) && n >= 1 && n <= 360) || !rateOk) {
      setMissing(true);
      setRes(null);
      return;
    }
    setMissing(false);
    setRes(loanCost({
      principal_cents: p!,
      interest: mode === 'rand' ? { mode, cents: i! } : { mode, rate: r },
      initiation_cents: fi, service_monthly_cents: fs, other_fees_cents: fo,
      term_months: n, type,
    }));
  }

  const capText = cap.per === 'month' ? tu('loan_cap_month', { rate: cap.max }) : tu('loan_cap_year', { rate: cap.max, repo: REPO.rate });
  const anyAbove = res && [res.rate.verdict, res.initiation.verdict, res.service.verdict].includes('above');

  return (
    <div className="space-y-4">
      <p className="text-ink-soft">{tu('loan_intro')}</p>
      <div>
        <label htmlFor="loan-type" className="mb-1.5 block text-base font-semibold">{tu('loan_type')}</label>
        <select id="loan-type" value={type} onChange={(e) => { setType(e.target.value as CreditType); setRes(null); }} className="min-h-tap w-full rounded-xl border border-line bg-white px-4 py-3 text-base">
          {CREDIT_TYPES.map((c) => <option key={c} value={c}>{tu(`loan_type_${c}`)}</option>)}
        </select>
        <p className="mt-1.5 text-sm text-ink-soft">{capText}</p>
      </div>
      <Field label={t('borrowed')} inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
      <Segmented label={tu('loan_interest_mode')} value={mode} onChange={setMode} options={[{ value: 'pct_month', label: tu('loan_interest_pct_month') }, { value: 'pct_year', label: tu('loan_interest_pct_year') }, { value: 'rand', label: tu('loan_interest_rand') }]} />
      <div className="grid grid-cols-2 gap-3">
        {mode === 'rand' ? (
          <Field label={t('interest')} inputMode="decimal" value={interest} onChange={(e) => setInterest(e.target.value)} />
        ) : (
          <Field label={mode === 'pct_month' ? tu('loan_rate') : tu('loan_rate_year')} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} suffix={<span className="text-ink-soft">%</span>} />
        )}
        <Field label={tu('loan_term')} inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value.replace(/\D/g, '').slice(0, 3))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={tu('loan_init_fee')} inputMode="decimal" value={initFee} onChange={(e) => setInitFee(e.target.value)} />
        <Field label={tu('loan_service_fee')} inputMode="decimal" value={serviceFee} onChange={(e) => setServiceFee(e.target.value)} />
      </div>
      <Field label={t('fees')} inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} />
      {missing && <p role="alert" className="rounded-xl bg-amber-soft px-4 py-3 text-amber-ink">{t('missing_terms')} {tu('loan_ranges')}</p>}
      <Button block icon="calc" onClick={calc}>{t('show_total')}</Button>

      {res && (
        <Card tone={anyAbove ? 'risk' : 'plain'}>
          <p className="text-sm font-semibold text-ink-soft">{tu('loan_result_total')}</p>
          <p className="tabular text-[2.5rem] font-bold leading-tight" data-testid="loan-total">{formatRand(res.total_cents)}</p>
          <p className="text-lg">
            {tu('loan_result_cost')} <strong className="tabular">{formatRand(res.cost_cents)}</strong> · {tu('loan_result_extra', { pct: res.cost_pct })}
          </p>
          {Number(term) > 1 && <p className="text-ink-soft">{tu('loan_per_month', { amount: formatRand(res.monthly_cents) })}</p>}
          {res.interest_estimated && Number(term) > 1 && <p className="mt-1 text-sm text-ink-soft">{tu('loan_simple_interest_note')}</p>}
          <div className="mt-4 space-y-2">
            <VerdictLine verdict={res.rate.verdict} above={t('above_limit')} within={tu('loan_within_limit')} unknown={tu('loan_rate_needed')} />
            {(opt(initFee) ?? 0) > 0 && <VerdictLine verdict={res.initiation.verdict} above={tu('loan_init_above', { max: formatRand(res.initiation.cap_cents) })} within={tu('loan_init_within', { max: formatRand(res.initiation.cap_cents) })} />}
            {(opt(serviceFee) ?? 0) > 0 && <VerdictLine verdict={res.service.verdict} above={tu('loan_service_above', { max: formatRand(res.service.cap_cents) })} within={tu('loan_service_within', { max: formatRand(res.service.cap_cents) })} />}
          </div>
          <p className="mt-3 text-xs text-ink-faint">{tu('loan_legal_source', { date: longDate(LEGAL_CHECKED) })}</p>
        </Card>
      )}

      <Card>
        <ul className="space-y-3 text-[15px]">
          <li className="flex gap-2"><Icon name="shield" size={20} className="shrink-0 text-teal" />{tu('loan_rights')}</li>
          <li className="flex gap-2">
            <Icon name="link" size={20} className="shrink-0 text-teal" />
            <a href="https://ncr.org.za/register/registered_cp.php" target="_blank" rel="noopener noreferrer" className="font-semibold text-teal underline underline-offset-2">{tu('loan_ncr_check')}</a>
          </li>
          <li className="flex gap-2"><Icon name="debt" size={20} className="shrink-0 text-teal" /><a className="underline underline-offset-2" href={telHref(HELP_LINES.ncr.number)}>{tu('scam_report_ncr')}</a></li>
        </ul>
      </Card>
      <p className="text-sm text-ink-soft">{t('loan_disclaimer')} {tu('loan_not_legal_advice')}</p>
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
