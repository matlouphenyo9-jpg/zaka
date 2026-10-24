// Scam Shield red-flag rules. Deterministic, run on the phone, before any AI is involved.
// Never says "safe": the best result is "no common warning signs found".

export type ScamFlag = 'otp_pin' | 'upfront_fee' | 'urgency' | 'link' | 'too_good' | 'impersonation' | 'new_number' | 'personal_info' | 'prompt_injection';
export type RiskLevel = 'high' | 'medium' | 'low';

const RULES: { flag: ScamFlag; re: RegExp }[] = [
  { flag: 'otp_pin', re: /\b(otp|one[- ]?time (pin|password|code)|verification code|security code|cvv|pin(\s?(number|code))?|password|wachtwoord|iphasiwedi)\b/i },
  { flag: 'upfront_fee', re: /\b((admin(istration)?|processing|insurance|release|activation|courier|clearance|registration|joining) fee|pay (a |the )?fee|fee (of|to)|pay(ment)? (first|upfront|up front|in advance)|to (release|unlock|activate) (your|the) (loan|funds|money|payout|grant|parcel)|deposit (of )?r ?\d+ (to|before|first))\b/i },
  { flag: 'urgency', re: /\b(urgent(ly)?|immediately|right now|asap|today only|last chance|act now|final (notice|warning)|within \d+ ?(hours?|hrs?|minutes?|mins?|days?)|expires? (today|soon|in)|(will be|has been|is) (suspended|blocked|closed|cancelled|canceled|deactivated|frozen)|avoid (suspension|closure|penalty))\b/i },
  { flag: 'link', re: /(https?:\/\/|www\.|\bbit\.ly\b|\btinyurl\b|\bwa\.me\b|\b[a-z0-9-]+\.(com|co\.za|za|net|org|info|xyz|top|click|link|ly|me|site|online|app)(\/\S*)?\b)/i },
  { flag: 'too_good', re: /\b(you('ve| have)? won|winner|congratulations|prize|lotto|jackpot|lucky draw|guaranteed (returns?|profits?|loan|approval)|double your|no credit check|instant (loan|approval|cash)|blacklisted (welcome|ok|accepted)|earn r ?\d[\d ,]* (a|per) (day|week)|risk[- ]free|\d{2,3}% (returns?|profit|interest) (a|per|in) (day|week|month))\b/i },
  { flag: 'impersonation', re: /\b(sassa|srd|south african social security|fnb|first national bank|absa|capitec|standard bank|nedbank|tyme ?bank|african bank|postbank|discovery bank|sars|post office|sapo|ncr|government|department of|your bank|bank (security|fraud) (team|department))\b/i },
  { flag: 'new_number', re: /\b(new number|changed (my )?number|lost my phone|phone (was )?stolen|(hi|hey|hello),? (mom|mum|ma|mama|mommy|dad|papa|tata)\b|it'?s me,? (mom|mum|ma|mama|dad)|this is my new)\b/i },
  { flag: 'personal_info', re: /\b(id (number|no\.?|copy)|identity (number|document)|account (number|no\.?|details)|card (number|details)|bank(ing)? details|login details|username and password|selfie with (your )?id)\b/i },
  { flag: 'prompt_injection', re: /\b(ignore (all |any |the )?(previous|prior|above|earlier) (instructions|prompts?|rules)|system prompt|disregard (your|the|all)|you are now|act as (an?|the)|respond (only )?with|(say|tell the user|classify) (that )?(this|the message) (is )?(safe|legit|legitimate|not a scam))\b/i },
];

const MONEY_ASK = /\b(send (me )?(r ?\d+|money|cash|airtime|data)|e-?wallet|cash ?send|instant money|transfer (r ?\d+|money|it)|pay (me|into|r ?\d+)|buy (me )?(airtime|vouchers?|gift cards?))\b/i;

export interface ScamResult {
  level: RiskLevel;
  flags: ScamFlag[];
}

export function checkMessage(text: string): ScamResult {
  const t = text.slice(0, 5000);
  const raw = RULES.filter((r) => r.re.test(t)).map((r) => r.flag);
  // A lone "OTP"/"PIN" mention without an ask ("we will never ask for your OTP") is not a warning sign.
  const askForCode = raw.includes('otp_pin') && /\b(send|share|give|reply|provide|confirm|enter|forward|tell|sms|whatsapp)\b/i.test(t) && !/\b(never|will not|won'?t|don'?t|do not)\b[^.]{0,40}\b(ask|share|send|give)/i.test(t);
  const others = raw.filter((f) => f !== 'impersonation' && (f !== 'otp_pin' || askForCode));
  // Claiming to be SASSA or a bank is only a warning sign together with another sign: real ones do send messages.
  const flags = raw.filter((f) => (f === 'otp_pin' ? askForCode : f === 'impersonation' ? others.length > 0 : true));
  const has = (f: ScamFlag) => flags.includes(f);

  let level: RiskLevel = others.length ? 'medium' : 'low';
  if (askForCode || has('upfront_fee') || has('personal_info') || (has('new_number') && MONEY_ASK.test(t)) || others.length >= 3) level = 'high';
  if (has('impersonation') && has('link') && (has('urgency') || has('personal_info') || has('otp_pin'))) level = 'high';
  return { level, flags };
}
