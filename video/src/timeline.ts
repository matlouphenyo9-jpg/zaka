// The story, beat by beat. Every image is a frame recorded from the real app by capture.mjs (see rec.json).
import rec from './rec.json';

export const FPS = 30;

export type Shot = { scene: string; img: number; hold: number };
export type Zoom = { x: number; y: number; scale: number }; // focal point in app CSS px
export type Beat = { step: string; label: string; caption: string; sub?: string; shots: Shot[]; zoom?: Zoom };

const hold = (scene: string, img: number, frames: number): Shot[] => [{ scene, img, hold: frames }];
const run = (scene: string, from: number, to: number, each = 1): Shot[] =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ scene, img: from + i, hold: each }));

const typedLen = rec.type.marks.fill - 1; // frames 1..typedLen are one character each
const saveAt = rec.type.marks.save;
const txAt = rec.slip.marks.tx; // first Transactions frame
const slipLast = rec.slip.frames - 1;
const homeLast = rec.home.frames - 1;

// Every number below was read off the screen during the same recording (see rec.json: demo.home, slip.saved,
// slip.lines, home.now, type.impact). One freshly reset demo account, recorded in this order.
export const BEATS: Beat[] = [
  {
    step: '01', label: 'Snap a slip',
    caption: 'Snap or upload a slip.',
    sub: 'One tap on “Try the demo”, then the biggest button on Home: a photo, screenshot or PDF of a slip.',
    shots: [...hold('demo', 0, 25), ...hold('demo', 1, 50), ...hold('slip', 0, 50)],
  },
  {
    step: '02', label: 'Read by AI',
    caption: 'A sample slip, read in seconds.',
    sub: 'R187.45 at the spaza, food, 25 Oct – filled in for Lerato to check. Nothing is saved until she taps Save.',
    shots: [...hold('slip', 1, 25), ...hold('slip', 2, 90), ...run('slip', 3, txAt - 2), ...hold('slip', txAt - 2, 10)],
  },
  {
    step: '03', label: 'Saved',
    caption: 'Saved – and the plan reacts.',
    sub: 'Safe to spend drops from R128 to R0, and the tight day moves from Mon 2 Nov to Sat 31 Oct.',
    shots: [...hold('slip', txAt - 1, 105)],
    zoom: { x: 195, y: 220, scale: 1.12 },
  },
  {
    step: '04', label: 'Transactions',
    caption: 'Every rand, by category.',
    sub: '“Food: 4 times this month, R862.45 total.” This month so far: R2 080 in, R2 150.45 out.',
    shots: [...hold('slip', txAt, 35), ...run('slip', txAt + 1, slipLast - 1), ...hold('slip', slipLast, 110)],
  },
  {
    step: '05', label: 'Safe to spend',
    caption: 'R0 is safe to spend right now.',
    sub: 'Money you have now is R373.55 – but bills and everyday costs come first until Thu 29 Oct.',
    shots: [...hold('home', 0, 100)],
    zoom: { x: 195, y: 200, scale: 1.1 },
  },
  {
    step: '06', label: 'Tight-day warning',
    caption: 'A warning before it happens.',
    sub: 'Money may run short on Saturday 31 Oct.',
    shots: [...run('home', 1, homeLast - 1), ...hold('home', homeLast, 110)],
    zoom: { x: 195, y: 560, scale: 1.1 },
  },
  {
    step: '07', label: 'Type it',
    caption: 'She types it in her own words.',
    sub: '“got R350 from a piece job” – AI fills the form, she checks it.',
    shots: [
      ...hold('type', 0, 25),
      ...run('type', 1, typedLen, 2),
      ...hold('type', typedLen + 1, 18),
      ...hold('type', typedLen + 2, 60),
      ...run('type', typedLen + 3, saveAt - 1, 1),
      ...hold('type', saveAt - 1, 10),
    ],
  },
  {
    step: '08', label: 'The plan updates',
    caption: 'The tight day moves out three days.',
    sub: 'From Saturday 31 Oct to Tuesday 3 Nov. Safe to spend rises from R0 to R17.',
    shots: [...hold('type', saveAt, 150)],
    zoom: { x: 195, y: 250, scale: 1.12 },
  },
  {
    step: '09', label: 'Why this estimate?',
    caption: 'Every rand, explained.',
    sub: 'R724 now, minus bills, everyday costs and money set aside, leaves R17. Plain code does the maths – AI never sets the numbers.',
    shots: [...hold('why', 0, 30), ...hold('why', 1, 150)],
  },
  {
    step: '10', label: 'Scam Shield',
    caption: 'A fake SASSA message, caught.',
    sub: 'High risk: warning signs found on the phone, then explained with a safe next step.',
    shots: [
      ...hold('scam', 0, 30),
      ...hold('scam', 1, 35),
      ...hold('scam', 2, 14),
      ...run('scam', 3, 32),
      ...hold('scam', 33, 65),
      ...run('scam', 34, 63),
      ...hold('scam', 64, 110),
    ],
  },
  {
    step: '11', label: 'Loan Check',
    caption: 'Above the legal maximum.',
    sub: 'R5 000 over 12 months would cost R8 278. Interest, initiation fee and service fee checked against the National Credit Regulations.',
    shots: [
      ...hold('loan', 0, 22),
      ...hold('loan', 1, 45),
      ...run('loan', 2, 25),
      ...hold('loan', 26, 24),
      ...run('loan', 27, 56),
      ...hold('loan', 57, 140),
    ],
    zoom: { x: 195, y: 520, scale: 1.1 },
  },
  {
    step: '12', label: 'Five languages',
    caption: 'Also in isiZulu, isiXhosa, Sepedi and Afrikaans (beta).',
    shots: [...hold('lang', 0, 20), ...hold('lang', 1, 20), ...hold('lang', 2, 50), ...hold('lang', 3, 12), ...hold('lang', 4, 18)],
  },
];

export const INTRO = 96;
export const OUTRO = 210;

export type Placed = Shot & { start: number; beat: number };
export const PLACED: Placed[] = [];
export const BEAT_START: number[] = [];
let cursor = INTRO;
BEATS.forEach((b, bi) => {
  BEAT_START.push(cursor);
  for (const s of b.shots) {
    PLACED.push({ ...s, start: cursor, beat: bi });
    cursor += s.hold;
  }
});
BEAT_START.push(cursor);
export const STORY_END = cursor;
export const DURATION = STORY_END + OUTRO;

// Tap ripples: a tap recorded before image `at` of a scene starts a few frames before that image appears.
type Taps = Record<string, { taps: { at: number; x: number; y: number }[] }>;
export const RIPPLES = Object.entries(rec as unknown as Taps).flatMap(([scene, v]) =>
  v.taps.flatMap((tp) => {
    const shot = PLACED.find((p) => p.scene === scene && p.img === tp.at);
    return shot ? [{ frame: Math.max(INTRO, shot.start - 9), x: tp.x, y: tp.y }] : [];
  }),
);
