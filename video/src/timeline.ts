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

export const BEATS: Beat[] = [
  {
    step: '01', label: 'Language',
    caption: 'Lerato picks isiXhosa.',
    sub: 'English plus four South African languages, all beta until native review.',
    shots: [...hold('pick', 0, 55), ...hold('pick', 1, 50), ...hold('pick', 2, 30)],
  },
  {
    step: '02', label: 'Demo',
    caption: 'One tap: Try the demo.',
    sub: 'Ten weeks of synthetic history: a grant, piece jobs, a stokvel.',
    shots: [...hold('demo', 0, 40)],
  },
  {
    step: '03', label: 'Safe to spend',
    caption: 'R128 is safe until Wednesday.',
    sub: 'And a warning before it happens: Saturday looks tight.',
    shots: [...hold('demo', 1, 200)],
    zoom: { x: 195, y: 330, scale: 1.12 },
  },
  {
    step: '04', label: 'Type it',
    caption: 'She types it in her own words.',
    sub: '“ndifumene i-R350 ngomsebenzi wethutyana” – AI fills the form, she checks it.',
    shots: [
      ...hold('type', 0, 30),
      ...run('type', 1, typedLen, 3),
      ...hold('type', typedLen + 1, 22),
      ...hold('type', typedLen + 2, 70),
      ...run('type', typedLen + 3, saveAt - 1, 1),
      ...hold('type', saveAt - 1, 12),
    ],
  },
  {
    step: '05', label: 'The plan updates',
    caption: 'The tight day moves out six days.',
    sub: 'From Saturday 31 Oct to Friday 6 Nov. Safe to spend rises from R128 to R190.',
    shots: [...hold('type', saveAt, 170)],
    zoom: { x: 195, y: 250, scale: 1.12 },
  },
  {
    step: '06', label: 'Why this estimate?',
    caption: 'Every rand, explained.',
    sub: 'Plain code on the phone does the maths – AI never sets the numbers.',
    shots: [...hold('why', 0, 40), ...hold('why', 1, 170)],
  },
  {
    step: '07', label: 'Scam Shield',
    caption: 'A fake SASSA message, caught.',
    sub: 'Warning signs found on the phone, explained in isiXhosa.',
    shots: [
      ...hold('scam', 0, 34),
      ...hold('scam', 1, 40),
      ...hold('scam', 2, 16),
      ...run('scam', 3, 32),
      ...hold('scam', 33, 75),
      ...run('scam', 34, 63),
      ...hold('scam', 64, 130),
    ],
  },
  {
    step: '08', label: 'Loan Check',
    caption: 'Above the legal maximum.',
    sub: 'Interest, initiation fee and service fee checked against the National Credit Regulations.',
    shots: [
      ...hold('loan', 0, 26),
      ...hold('loan', 1, 50),
      ...run('loan', 2, 25),
      ...hold('loan', 26, 28),
      ...run('loan', 27, 56),
      ...hold('loan', 57, 165),
    ],
    zoom: { x: 195, y: 520, scale: 1.1 },
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
