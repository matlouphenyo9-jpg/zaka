// On-device rule parser for "got R350 from a piece job". Used offline and as the fallback when the AI is unavailable.
// The Edge Function returns the same shape; either way the person confirms a pre-filled form before anything is saved.
import { addDays, weekday, type ISODate } from '../lib/dates';
import type { Category, Direction } from './types';

export interface ParsedEntry {
  direction: Direction;
  amount_cents: number;
  category: Category;
  occurred_on: ISODate;
}

const CATS: [RegExp, Category][] = [
  [/\b(piece ?jobs?|gig|cleaning|ironing|garden(ing)?|domestic|washing|laundry|char|tog|toho)\b/i, 'piece_job'],
  [/\b(grant|sassa|srd|child support|pension)\b/i, 'grant'],
  [/\b(salary|wage|wages|pay ?day|paid me|payslip)\b/i, 'salary'],
  [/\b(sold|selling|sales|stall|spaza|customers?)\b/i, 'trade'],
  [/\b(taxi|bus|train|uber|bolt|transport|fare|petrol|diesel|fuel|myciti|rea vaya|gautrain|metrorail)\b/i, 'transport'],
  [/\b(food|groceries|grocery|bread|milk|maize|mealie|meat|chicken|eggs|rice|sugar|shop(rite)?|spar|boxer|pick ?n ?pay|checkers|usave)\b/i, 'food'],
  [/\b(electricity|lights|prepaid|units|eskom|power)\b/i, 'electricity'],
  [/\b(data|airtime|bundle|mtn|vodacom|cell ?c|telkom)\b/i, 'data_airtime'],
  [/\b(rent|room|landlord)\b/i, 'rent'],
  [/\b(school|uniform|fees|creche|cr[eè]che|books)\b/i, 'school'],
  [/\b(stokvel|umgalelo|society)\b/i, 'stokvel'],
  [/\b(saved|savings|put away|set aside)\b/i, 'savings_goal'],
  [/\b(funeral|burial|policy)\b/i, 'funeral'],
  [/\b(loan|mashonisa|repay|repayment|debt|owe)\b/i, 'debt'],
  [/\b(clinic|doctor|medicine|pharmacy|chemist)\b/i, 'health'],
  [/\b(gift|helped me|sent me|gave me)\b/i, 'gift'],
];
const INCOME_CATS: Category[] = ['piece_job', 'grant', 'salary', 'trade', 'gift', 'income'];
const IN_WORDS = /\b(got|get|received|receive|earned|earn|made|paid me|came in|in from|from a|from my|income|gave me|sent me)\b/i;
const OUT_WORDS = /\b(paid|pay|spent|spend|bought|buy|for the|on the|topped up|top up|sent to|gave)\b/i;
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function parseAmount(text: string): number | null {
  const t = text.replace(/\u00a0/g, ' ');
  const num = String.raw`(\d{1,3}(?:[ ,]\d{3})+|\d+)(?:[.,](\d{1,2}))?(?!\d)(?!\s?%)`;
  // An amount written with "R" wins over any other number in the sentence.
  const m = t.match(new RegExp(String.raw`\bR\s?` + num, 'i')) ?? t.match(new RegExp(String.raw`(?<![\d-])` + num));
  if (!m) return null;
  const rands = Number(m[1].replace(/[ ,]/g, ''));
  const cents = m[2] ? Number(m[2].padEnd(2, '0')) : 0;
  const total = rands * 100 + cents;
  return total > 0 && total <= 100_000_000 ? total : null;
}

export function parseEntryLocally(text: string, today: ISODate): ParsedEntry | null {
  const t = text.trim().slice(0, 200);
  const amount = parseAmount(t);
  if (amount == null) return null;
  let category: Category | null = null;
  for (const [re, c] of CATS) if (re.test(t)) { category = c; break; }
  // Both an amount and a clear direction are needed; otherwise nothing is proposed (B4: never guess).
  let direction: Direction;
  if (category && INCOME_CATS.includes(category)) direction = 'in';
  else if (IN_WORDS.test(t) && !OUT_WORDS.test(t)) direction = 'in';
  else if (category || OUT_WORDS.test(t)) direction = 'out';
  else return null;
  if (!category) category = direction === 'in' ? 'income' : 'other';

  let occurred_on = today;
  if (/\byesterday\b|\bizolo\b|\bgister\b/i.test(t)) occurred_on = addDays(today, -1);
  else {
    const d = DAYS.findIndex((n) => new RegExp(`\\b(on |last )?${n}\\b`, 'i').test(t));
    if (d >= 0) {
      let back = (weekday(today) - d + 7) % 7;
      if (back === 0) back = 7;
      occurred_on = addDays(today, -back);
    }
  }
  return { direction, amount_cents: amount, category, occurred_on };
}
