import React, { useEffect, useMemo, useState } from 'react';
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { Caption } from '@remotion/captions';

// "Rubber Room" palette from docs/CREATIVE.md
const C = {
  paper: '#F6EBD9',
  ink: '#1F1A17',
  pink: '#EF5B7B',
  green: '#9CCB3B',
  mustard: '#F5B700',
  blue: '#4FB3E8',
};
const FONT =
  '"Arial Rounded MT Bold", "SF Pro Rounded", "Nunito", "Varela Round", ui-rounded, system-ui, sans-serif';

export type Sfx = { src: string; atSec: number; volume: number };
export type DemoProps = {
  introSrc: string | null;
  introStartSec: number;
  introSec: number;
  screenSrc: string | null;
  screenStartSec: number;
  screenSec: number;
  outroSrc: string | null;
  outroStartSec: number;
  outroSec: number;
  endSec: number;
  screenFocusX: number; // 0 left .. 1 right, used by the vertical crop
  captionsFile: string | null;
  name: string;
  tagline: string;
  project: string;
  line: string;
  event: string;
  handle: string;
  credits: string;
  sfx: Sfx[];
  vertical: boolean;
};

/* ---------- whoopee cushion with a face (boiling ink line) ---------- */
const BODY = [
  'M60 120 C40 60 120 22 200 26 C290 30 352 64 344 124 C338 178 270 206 196 204 C118 202 72 176 60 120 Z',
  'M58 118 C44 58 124 20 202 28 C288 28 356 66 342 126 C336 176 268 208 194 202 C116 204 70 174 58 118 Z',
  'M62 122 C38 62 118 24 198 24 C292 32 350 62 346 122 C340 180 272 204 198 206 C120 200 74 178 62 122 Z',
];
export const Cushion: React.FC<{ size: number; squash?: number; blink?: boolean }> = ({
  size,
  squash = 0,
  blink = false,
}) => {
  const frame = useCurrentFrame();
  const v = Math.floor(frame / 4) % 3; // swap outline every 4 frames = hand-drawn "boil"
  const sx = 1 + squash * 0.18;
  const sy = 1 - squash * 0.18;
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 420 260" style={{ overflow: 'visible' }}>
      <g transform={`translate(200 210) scale(${sx} ${sy}) translate(-200 -210)`}>
        <path d="M336 118 C368 112 384 108 398 98 L408 128 C392 136 372 140 340 140 Z" fill={C.pink} stroke={C.ink} strokeWidth={8} strokeLinejoin="round" />
        <path d={BODY[v]} fill={C.pink} stroke={C.ink} strokeWidth={8} strokeLinejoin="round" />
        <path d="M110 92 C150 70 230 66 280 84" fill="none" stroke={C.paper} strokeWidth={8} strokeLinecap="round" opacity={0.7} />
        {blink ? (
          <>
            <path d="M150 128 l28 0" stroke={C.ink} strokeWidth={8} strokeLinecap="round" />
            <path d="M222 128 l28 0" stroke={C.ink} strokeWidth={8} strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx={164} cy={124} r={20} fill={C.paper} stroke={C.ink} strokeWidth={7} />
            <circle cx={236} cy={124} r={20} fill={C.paper} stroke={C.ink} strokeWidth={7} />
            <circle cx={170} cy={128} r={8} fill={C.ink} />
            <circle cx={242} cy={128} r={8} fill={C.ink} />
          </>
        )}
      </g>
    </svg>
  );
};

/* ---------- three-circle puff (never a smooth blob) ---------- */
const Puff: React.FC<{ x: number; y: number; r: number; color: string; t: number }> = ({ x, y, r, color, t }) => {
  const s = interpolate(t, [0, 0.25, 1], [0.2, 1, 1.15], { extrapolateRight: 'clamp' });
  const o = interpolate(t, [0, 0.7, 1], [1, 1, 0], { extrapolateRight: 'clamp' });
  return (
    <g transform={`translate(${x} ${y - t * r * 0.8}) scale(${s})`} opacity={o}>
      {[[-0.55, 0.1, 0.62], [0.5, 0.15, 0.58], [0, -0.35, 0.72]].map(([dx, dy, rr], i) => (
        <circle key={i} cx={dx * r} cy={dy * r} r={rr * r} fill={color} stroke={C.ink} strokeWidth={6} />
      ))}
    </g>
  );
};

/* ---------- placeholder when a clip is missing ---------- */
const Placeholder: React.FC<{ label: string }> = ({ label }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: C.paper, alignItems: 'center', justifyContent: 'center', fontFamily: FONT, color: C.ink }}>
      <Cushion size={width * 0.32} blink={frame % 50 < 4} />
      <div style={{ fontSize: width * 0.03, marginTop: 30, fontWeight: 800 }}>{label}</div>
    </AbsoluteFill>
  );
};

const Clip: React.FC<{ src: string | null; startSec: number; fit: 'cover' | 'contain'; label: string; style?: React.CSSProperties }> = ({
  src,
  startSec,
  fit,
  label,
  style,
}) => {
  const { fps } = useVideoConfig();
  if (!src) return <Placeholder label={label} />;
  return (
    <OffthreadVideo
      src={staticFile(src)}
      trimBefore={Math.round(startSec * fps)}
      style={{ width: '100%', height: '100%', objectFit: fit, ...style }}
    />
  );
};

/* ---------- title stinger at the selfie-to-screen cut ---------- */
const Stinger: React.FC<{ project: string }> = ({ project }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const inS = spring({ frame, fps, config: { damping: 9, stiffness: 180 } });
  const out = interpolate(frame, [16, 22], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const squash = interpolate(frame, [0, 3, 8], [1, -0.4, 0], { extrapolateRight: 'clamp' });
  const big = Math.min(width, height);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: out }}>
      <AbsoluteFill style={{ background: C.green, opacity: 0.92 * inS }} />
      <div style={{ transform: `scale(${inS})`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Cushion size={big * 0.55} squash={squash} blink={frame < 6} />
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: big * 0.12, color: C.ink, marginTop: -10, textTransform: 'lowercase' }}>
          {project}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- lower-third ---------- */
const LowerThird: React.FC<{ name: string; tagline: string; vertical: boolean }> = ({ name, tagline, vertical }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const inS = spring({ frame, fps, config: { damping: 11, stiffness: 160 } });
  const outS = spring({ frame: frame - (durationInFrames - 12), fps, config: { damping: 200 } });
  const x = interpolate(inS - outS, [0, 1], [-width * 0.6, 0]);
  const u = width / 1920;
  const s = vertical ? 1.6 : 1;
  return (
    <AbsoluteFill style={{ justifyContent: vertical ? 'flex-start' : 'flex-end', padding: vertical ? `${260 * u}px ${60 * u}px` : `0 0 ${210 * u}px ${80 * u}px` }}>
      <div
        style={{
          transform: `translateX(${x}px) rotate(-1.5deg)`,
          alignSelf: 'flex-start',
          background: C.paper,
          border: `${6 * u * s}px solid ${C.ink}`,
          borderRadius: 22 * u * s,
          padding: `${16 * u * s}px ${30 * u * s}px`,
          boxShadow: `${10 * u * s}px ${10 * u * s}px 0 ${C.ink}`,
          fontFamily: FONT,
          color: C.ink,
        }}
      >
        <div style={{ fontSize: 52 * u * s, fontWeight: 800, lineHeight: 1.05 }}>{name}</div>
        <div style={{ fontSize: 28 * u * s, marginTop: 6 * u * s }}>{tagline}</div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- captions (word-level from Whisper, or phrase-level hand written) ---------- */
const useCaptions = (file: string | null): Caption[] | null => {
  const [caps, setCaps] = useState<Caption[] | null>(null);
  const [handle] = useState(() => (file ? delayRender('captions') : null));
  useEffect(() => {
    if (!file || handle === null) return;
    fetch(staticFile(file))
      .then((r) => r.json())
      .then((j: Caption[]) => {
        setCaps(j);
        continueRender(handle);
      })
      .catch(() => {
        setCaps([]);
        continueRender(handle);
      });
  }, [file, handle]);
  return caps;
};

// One page = one short phrase. New page after a sentence end, a comma, a pause over 400 ms, or 7 words,
// so captions never split "a fart instrument. Out / of my MacBook."
type Page = { startMs: number; durationMs: number; tokens: { text: string; fromMs: number; toMs: number }[] };
const toPages = (caps: Caption[]): Page[] => {
  const pages: Page[] = [];
  let cur: Caption[] = [];
  const flush = () => {
    if (!cur.length) return;
    const startMs = cur[0].startMs;
    pages.push({
      startMs,
      durationMs: cur[cur.length - 1].endMs - startMs,
      tokens: cur.map((c, i) => ({ text: i === 0 ? c.text.trimStart() : c.text, fromMs: c.startMs, toMs: c.endMs })),
    });
    cur = [];
  };
  caps.forEach((c, i) => {
    const prev = caps[i - 1];
    const p = prev ? prev.text.trim() : '';
    if (prev && cur.length && (/[.?!]$/.test(p) || (p.endsWith(',') && cur.length >= 3) || c.startMs - prev.endMs > 400 || cur.length >= 7)) flush();
    cur.push(c);
  });
  flush();
  // hold each page until the next one starts (max 600 ms extra) so captions don't flicker
  pages.forEach((p, i) => {
    const next = pages[i + 1];
    const end = p.startMs + p.durationMs;
    p.durationMs += Math.max(0, Math.min(600, (next ? next.startMs : end + 600) - end));
  });
  return pages;
};

const Captions: React.FC<{ captions: Caption[]; vertical: boolean }> = ({ captions, vertical }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const pages = useMemo(() => toPages(captions), [captions]);
  const page = pages.find((p) => ms >= p.startMs && ms < p.startMs + p.durationMs);
  if (!page) return null;
  const pop = spring({ frame: frame - Math.round((page.startMs / 1000) * fps), fps, config: { damping: 12, stiffness: 220 } });
  const u = width / (vertical ? 1080 : 1920);
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: vertical ? 330 * u : 70 * u }}>
      <div
        style={{
          transform: `scale(${0.9 + 0.1 * pop})`,
          maxWidth: '86%',
          textAlign: 'center',
          background: C.paper,
          border: `${5 * u}px solid ${C.ink}`,
          borderRadius: 18 * u,
          padding: `${10 * u}px ${26 * u}px`,
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: (vertical ? 64 : 54) * u,
          lineHeight: 1.2,
          color: C.ink,
          whiteSpace: 'pre-wrap',
        }}
      >
        {page.tokens.map((t) => {
          const on = ms >= t.fromMs && ms < t.toMs;
          return (
            <span key={t.fromMs} style={{ color: on ? C.pink : C.ink }}>
              {t.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ---------- end card ---------- */
const EndCard: React.FC<DemoProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const inS = spring({ frame, fps, config: { damping: 10, stiffness: 140 } });
  const big = Math.min(width, height);
  const squash = interpolate(frame, [0, 4, 12], [0.9, -0.3, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: C.paper, alignItems: 'center', justifyContent: 'center', fontFamily: FONT, color: C.ink }}>
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        <Puff x={width * 0.5 + big * 0.33} y={height * 0.33} r={big * 0.07} color={C.green} t={Math.min(1, frame / 22)} />
      </svg>
      <div style={{ transform: `translateY(${(1 - inS) * 60}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <Cushion size={big * 0.5} squash={squash} blink={frame > 40 && frame < 44} />
        <div style={{ fontSize: big * 0.11, fontWeight: 800, textTransform: 'lowercase', marginTop: -6 }}>{p.project}</div>
        <div style={{ fontSize: big * 0.038, marginTop: big * 0.012, maxWidth: width * 0.8 }}>{p.line}</div>
        <div style={{ fontSize: big * 0.03, marginTop: big * 0.04, fontWeight: 800 }}>
          by {p.name.toLowerCase()} · {p.handle}
        </div>
        <div style={{ fontSize: big * 0.024, marginTop: big * 0.008 }}>{p.event}</div>
        <div style={{ fontSize: big * 0.018, marginTop: big * 0.03, opacity: 0.7 }}>{p.credits}</div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- the whole video ---------- */
export const Demo: React.FC<DemoProps> = (p) => {
  const { fps } = useVideoConfig();
  const f = (s: number) => Math.round(s * fps);
  const intro = f(p.introSec);
  const screen = f(p.screenSec);
  const outro = f(p.outroSec);
  const end = f(p.endSec);
  const captions = useCaptions(p.captionsFile);

  return (
    <AbsoluteFill style={{ background: C.paper }}>
      {intro > 0 && (
        <Sequence durationInFrames={intro} name="selfie hook">
          <Clip src={p.introSrc} startSec={p.introStartSec} fit="cover" label="selfie.mp4 goes here" />
        </Sequence>
      )}
      <Sequence from={intro} durationInFrames={screen} name="screen recording">
        <ScreenPart {...p} />
      </Sequence>
      {outro > 0 && (
        <Sequence from={intro + screen} durationInFrames={outro} name="selfie closer">
          <Clip src={p.outroSrc} startSec={p.outroStartSec} fit="cover" label="selfie closer goes here" />
        </Sequence>
      )}
      <Sequence from={intro + screen + outro} durationInFrames={end} name="end card">
        <EndCard {...p} />
      </Sequence>

      <Sequence from={intro + f(1)} durationInFrames={f(4)} name="lower-third">
        <LowerThird name={p.name} tagline={p.tagline} vertical={p.vertical} />
      </Sequence>
      {captions && captions.length > 0 && (
        <Sequence durationInFrames={intro + screen + outro} name="captions">
          <Captions captions={captions} vertical={p.vertical} />
        </Sequence>
      )}
      {intro > 0 && (
        <Sequence from={Math.max(0, intro - 4)} durationInFrames={24} name="title stinger">
          <Stinger project={p.project} />
        </Sequence>
      )}
      {p.sfx.map((s, i) => (
        <Sequence key={i} from={f(s.atSec)} name={`sfx ${s.src}`}>
          <Audio src={staticFile(s.src)} volume={s.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/* Screen part: punch-in zoom at the cut ("zoom into the Mac"), then the recording.
   16:9: the 16:10 Mac screen is letterboxed on paper. 9:16: cropped around screenFocusX. */
const ScreenPart: React.FC<DemoProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const z = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const scale = interpolate(z, [0, 1], [1.35, 1]);
  if (!p.vertical) {
    return (
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <Clip src={p.screenSrc} startSec={p.screenStartSec} fit="contain" label="screen.mp4 goes here" />
      </AbsoluteFill>
    );
  }
  // vertical: screen band in the middle, 1.5x so the pads read on a phone
  const bandW = width * 1.5;
  const bandH = (bandW * 10) / 16;
  const left = -(bandW - width) * p.screenFocusX;
  return (
    <AbsoluteFill style={{ background: C.paper, transform: `scale(${scale})` }}>
      <div style={{ position: 'absolute', left, top: (height - bandH) / 2 - height * 0.04, width: bandW, height: bandH, borderTop: `8px solid ${C.ink}`, borderBottom: `8px solid ${C.ink}` }}>
        <Clip src={p.screenSrc} startSec={p.screenStartSec} fit="cover" label="screen.mp4 goes here" />
      </div>
    </AbsoluteFill>
  );
};
