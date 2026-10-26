import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { inter, serif } from './fonts';
import { BEATS, BEAT_START, DURATION, INTRO, PLACED, RIPPLES, STORY_END, type Placed } from './timeline';


// Zaka's own palette (tailwind.config.js)
const C = { paper: '#FAF8F2', ink: '#102A43', soft: '#486581', faint: '#829AB1', teal: '#006B64', tealSoft: '#E3F1EF', gold: '#C9A227', line: '#E6E1D3' };

// Phone geometry: the app is 390×844 CSS px, drawn at S px per CSS px.
const S = 0.98;
const SCREEN_W = Math.round(390 * S);
const STATUS_H = 34;
const SCREEN_H = Math.round(844 * S) + STATUS_H;
const BEZEL = 13;
const PHONE_W = SCREEN_W + BEZEL * 2;
const PHONE_H = SCREEN_H + BEZEL * 2;
const PHONE_LEFT = 1110;
const PHONE_TOP = (1080 - PHONE_H) / 2;

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const src = (p: Placed) => staticFile(`rec/${p.scene}/${String(p.img).padStart(3, '0')}.png`);

function shotAt(frame: number): Placed {
  let cur = PLACED[0];
  for (const p of PLACED) {
    if (p.start <= frame) cur = p;
    else break;
  }
  return cur;
}

function Logo({ size = 30 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.28 }}>
      <div style={{ width: size, height: size, borderRadius: '50%', background: C.gold, color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: inter, fontWeight: 700, fontSize: size * 0.55 }}>R</div>
      <div style={{ fontFamily: inter, fontWeight: 700, fontSize: size * 1.05, color: C.ink, letterSpacing: '-0.03em' }}>zaka</div>
    </div>
  );
}

function StatusBar() {
  return (
    <div style={{ height: STATUS_H, background: C.paper, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 26px 0 30px', fontFamily: inter, fontWeight: 600, fontSize: 14, color: C.ink }}>
      <span>08:30</span>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        {[5, 8, 11, 14].map((h) => <div key={h} style={{ width: 3, height: h, borderRadius: 1, background: C.ink }} />)}
        <div style={{ marginLeft: 6, width: 24, height: 12, borderRadius: 3, border: `1.5px solid ${C.ink}`, padding: 1.5 }}>
          <div style={{ width: '72%', height: '100%', borderRadius: 1.5, background: C.ink }} />
        </div>
      </div>
    </div>
  );
}

function Screen({ frame }: { frame: number }) {
  const cur = shotAt(frame);
  // Cross-fade only where the recording changes scene (within a scene it is a continuous recording).
  const idx = PLACED.indexOf(cur);
  const sceneStart = PLACED.findIndex((p) => p.scene === cur.scene);
  const firstOfScene = PLACED[sceneStart];
  const prev = sceneStart > 0 ? PLACED[sceneStart - 1] : null;
  const fade = prev ? interpolate(frame, [firstOfScene.start, firstOfScene.start + 10], [0, 1], clamp) : 1;
  void idx;
  return (
    <div style={{ position: 'relative', width: SCREEN_W, height: SCREEN_H - STATUS_H, overflow: 'hidden', background: C.paper }}>
      {prev && fade < 1 && <Img src={src(prev)} style={{ position: 'absolute', inset: 0, width: '100%' }} />}
      <Img src={src(cur)} style={{ position: 'absolute', inset: 0, width: '100%', opacity: fade }} />
      {RIPPLES.map((r, i) => {
        const t = frame - r.frame;
        if (t < 0 || t > 16) return null;
        const scale = interpolate(t, [0, 16], [0.4, 1.6], { easing: Easing.out(Easing.cubic) });
        const opacity = interpolate(t, [0, 3, 16], [0, 0.55, 0], clamp);
        return (
          <div key={i} style={{ position: 'absolute', left: r.x * S - 26, top: r.y * S - 26, width: 52, height: 52, borderRadius: '50%', background: 'rgba(16,42,67,0.22)', border: '2px solid rgba(255,255,255,0.9)', transform: `scale(${scale})`, opacity }} />
        );
      })}
    </div>
  );
}

function Phone({ frame, fps }: { frame: number; fps: number }) {
  // Gentle camera push on beats that have a focal point.
  const beat = BEATS.findIndex((_, i) => frame >= BEAT_START[i] && frame < BEAT_START[i + 1]);
  const z = beat >= 0 ? BEATS[beat].zoom : undefined;
  let scale = 1;
  let ox = PHONE_W / 2;
  let oy = PHONE_H / 2;
  if (z) {
    const inP = spring({ frame: frame - BEAT_START[beat] - 12, fps, config: { damping: 200 }, durationInFrames: 40 });
    const outP = interpolate(frame, [BEAT_START[beat + 1] - 18, BEAT_START[beat + 1]], [0, 1], clamp);
    scale = 1 + (z.scale - 1) * inP * (1 - outP);
    ox = BEZEL + z.x * S;
    oy = BEZEL + STATUS_H + z.y * S;
  }
  const enter = spring({ frame: frame - INTRO + 18, fps, config: { damping: 200 }, durationInFrames: 36 });
  const exit = interpolate(frame, [STORY_END - 4, STORY_END + 22], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const y = (1 - enter) * 60 + exit * 40;
  return (
    <div style={{ position: 'absolute', left: PHONE_LEFT, top: PHONE_TOP, width: PHONE_W, height: PHONE_H, opacity: enter * (1 - exit), transform: `translateY(${y}px) scale(${scale})`, transformOrigin: `${ox}px ${oy}px` }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 62, background: '#0B1622', boxShadow: '0 50px 100px -30px rgba(16,42,67,0.45), 0 30px 60px -40px rgba(16,42,67,0.5), inset 0 0 0 2px #27384A' }} />
      <div style={{ position: 'absolute', left: BEZEL, top: BEZEL, width: SCREEN_W, height: SCREEN_H, borderRadius: 50, overflow: 'hidden', background: C.paper }}>
        <StatusBar />
        <Screen frame={frame} />
      </div>
      <div style={{ position: 'absolute', left: PHONE_W / 2 - 52, top: BEZEL + 9, width: 104, height: 26, borderRadius: 13, background: '#05090E' }} />
    </div>
  );
}

function Caption({ frame, fps }: { frame: number; fps: number }) {
  const bi = BEATS.findIndex((_, i) => frame >= BEAT_START[i] && frame < BEAT_START[i + 1]);
  if (bi < 0) return null;
  const b = BEATS[bi];
  const local = frame - BEAT_START[bi];
  const len = BEAT_START[bi + 1] - BEAT_START[bi];
  const inA = spring({ frame: local - 4, fps, config: { damping: 200 }, durationInFrames: 26 });
  const inB = spring({ frame: local - 12, fps, config: { damping: 200 }, durationInFrames: 26 });
  const out = interpolate(local, [len - 10, len], [0, 1], clamp);
  const o = (p: number) => ({ opacity: p * (1 - out), transform: `translateY(${(1 - p) * 18 - out * 10}px)` });
  const progress = (bi + interpolate(local, [0, len], [0, 1], clamp)) / BEATS.length;
  return (
    <div style={{ position: 'absolute', left: 190, top: 0, bottom: 0, width: 780, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ ...o(inA), fontFamily: inter, fontWeight: 600, fontSize: 17, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold, display: 'flex', alignItems: 'center', gap: 16 }}>
        <span>{b.step}</span>
        <span style={{ width: 40, height: 1.5, background: C.gold, opacity: 0.6 }} />
        <span style={{ color: C.soft }}>{b.label}</span>
      </div>
      <div style={{ ...o(inA), marginTop: 26, fontFamily: serif, fontSize: 84, lineHeight: 1.04, color: C.ink, letterSpacing: '-0.01em', textWrap: 'balance' }}>{b.caption}</div>
      {b.sub && <div style={{ ...o(inB), marginTop: 26, fontFamily: inter, fontSize: 27, lineHeight: 1.45, color: C.soft, maxWidth: 680, textWrap: 'pretty' }}>{b.sub}</div>}
      <div style={{ position: 'absolute', left: 0, bottom: 96, width: 560, height: 2, background: C.line }}>
        <div style={{ width: `${progress * 100}%`, height: '100%', background: C.teal }} />
      </div>
    </div>
  );
}

function Intro({ frame, fps }: { frame: number; fps: number }) {
  if (frame > INTRO + 10) return null;
  const a = spring({ frame: frame - 6, fps, config: { damping: 200 }, durationInFrames: 30 });
  const b = spring({ frame: frame - 18, fps, config: { damping: 200 }, durationInFrames: 30 });
  const out = interpolate(frame, [INTRO - 14, INTRO + 4], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: 1 - out }}>
      <div style={{ opacity: a, transform: `translateY(${(1 - a) * 14}px)` }}><Logo size={58} /></div>
      <div style={{ opacity: b, transform: `translateY(${(1 - b) * 14}px)`, marginTop: 34, fontFamily: serif, fontSize: 58, color: C.ink }}>A money plan for uneven income.</div>
    </AbsoluteFill>
  );
}

function Outro({ frame, fps }: { frame: number; fps: number }) {
  const local = frame - STORY_END - 10;
  if (local < -10) return null;
  const a = spring({ frame: local, fps, config: { damping: 200 }, durationInFrames: 34 });
  const b = spring({ frame: local - 12, fps, config: { damping: 200 }, durationInFrames: 34 });
  const c = spring({ frame: local - 24, fps, config: { damping: 200 }, durationInFrames: 34 });
  const lift = (p: number) => ({ opacity: p, transform: `translateY(${(1 - p) * 16}px)` });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div style={lift(a)}><Logo size={52} /></div>
      <div style={{ ...lift(b), marginTop: 44, fontFamily: serif, fontSize: 84, color: C.ink, letterSpacing: '-0.01em' }}>
        <span style={{ fontFamily: inter, fontWeight: 600, fontSize: 64, color: C.teal }}>zaka.pages.dev</span>
        <span style={{ color: C.faint }}> · </span>
        <span style={{ fontStyle: 'italic' }}>Every rand, with a plan.</span>
      </div>
      <div style={{ ...lift(c), position: 'absolute', bottom: 70, fontFamily: inter, fontSize: 19, color: C.faint, letterSpacing: '0.02em' }}>
        JustIT Solutions · FNB App of the Year Hackathon 2026 · Demo data is synthetic
      </div>
    </AbsoluteFill>
  );
}

export function Demo() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chrome = interpolate(frame, [INTRO - 6, INTRO + 16, STORY_END, STORY_END + 16], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <AbsoluteFill style={{ background: `radial-gradient(900px 700px at ${PHONE_LEFT + PHONE_W / 2}px 540px, ${C.tealSoft} 0%, rgba(250,248,242,0) 70%)` }} />
      <Intro frame={frame} fps={fps} />
      <div style={{ opacity: chrome }}>
        <div style={{ position: 'absolute', left: 190, top: 76 }}><Logo size={30} /></div>
        <Caption frame={frame} fps={fps} />
      </div>
      {frame >= INTRO - 20 && frame < STORY_END + 30 && <Phone frame={frame} fps={fps} />}
      <Outro frame={frame} fps={fps} />
    </AbsoluteFill>
  );
}

export const DEMO_DURATION = DURATION;
