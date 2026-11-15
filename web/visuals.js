// Visual design department, art direction 05 "defined" (docs/design/05_direction/BRIEF.md).
// Listens to FB.bus only (audio-ready, hit, frame, freshener, outofair, endcard, stage). Never edits app.js state.
//
// The stage is one MacBook seen from above, drawn in a fixed 1440 x 900 space and scaled to the window:
//   #deck     (SVG)    metal deck, hinge strip, keyboard, space bar, silver side rails (one segment per pad)
//   #haze     (canvas) outlined green bands, in front of the deck fill and behind every character and frame
//   #board    (canvas) loop beads on the hinge, speaker grilles that light up as the spectrum
//   pads      (SVG per pad) drum pads shaped by their sound, trackpad heads, pills and tubes
//   #fx       (canvas) side-tap impact wedges, sound words, valve squiggles, freshener
//   #dim               paper at 60% over everything but the cushion (punchlines, uncle captions)
//   #burst    (canvas) the punchline cloud and the uncle captions
//   #cushion  (canvas) the hero, always in front
// Line weights: T1 6, T2 4, T3 2.5, texture 2 at 50%. Every outline is ink.
(() => {
  'use strict';
  const FB = window.FB;
  if (!FB || !FB.bus) { console.warn('visuals.js: FB hook API missing'); return; }
  const hasRough = typeof window.rough !== 'undefined';
  const hasGsap = typeof window.gsap !== 'undefined';
  // GSAP 3.13 plugins (vendored in vendor/gsap-3.13, all local): cartoon motion
  const P = {};
  if (hasGsap) {
    ['CustomEase', 'CustomBounce', 'CustomWiggle', 'MorphSVGPlugin', 'Physics2DPlugin'].forEach(n => { if (window[n]) { try { gsap.registerPlugin(window[n]); P[n] = true; } catch (err) { /* plugin optional */ } } });
    try {
      if (P.CustomBounce) CustomBounce.create('fbLand', { strength: .55, squash: 2, squashID: 'fbLand-squash', endAtStart: false });
      if (P.CustomWiggle) { CustomWiggle.create('fbNo', { wiggles: 6, type: 'easeOut' }); CustomWiggle.create('fbJiggle', { wiggles: 4, type: 'uniform' }); CustomWiggle.create('fbFlick', { wiggles: 5, type: 'easeOut' }); }
      if (P.CustomEase) CustomEase.create('fbOvershoot', 'M0,0 C0.18,0 0.2,1.32 0.46,1.12 0.66,0.97 0.8,1 1,1');
    } catch (err) { /* eases optional */ }
  }
  const E_HIT = P.CustomEase ? 'fbOvershoot' : 'elastic.out(1, 0.4)';
  FB.customVisuals = true;

  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  let RM = mq.matches;
  if (mq.addEventListener) mq.addEventListener('change', e => { RM = e.matches; });

  // ------------------------------------------------------------ palette and geometry (stage units)
  // r3 Incredibox pass: every colour comes from the 8 tokens in style.css (docs/design/DESIGN.md) plus derived tones.
  const rootCss = getComputedStyle(document.documentElement);
  const tok = (n, fb) => { const v = rootCss.getPropertyValue(n).trim(); return /^#[0-9a-f]{6}$/i.test(v) ? v : fb; };
  const hex2 = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, k) => { const A = hex2(a), B = hex2(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
  const rgba = (h, a) => { const [r, g, b] = hex2(h); return `rgba(${r},${g},${b},${a})`; };
  const T = {
    night: tok('--night', '#1B1730'), cream: tok('--cream', '#F3EBDD'), pink: tok('--pink', '#FF4470'), yellow: tok('--yellow', '#FFC23D'),
    cyan: tok('--cyan', '#45C8DA'), violet: tok('--violet', '#8E6BF2'), orange: tok('--orange', '#FF8A3D'), lime: tok('--lime', '#B7E640'),
  };
  const deep = c => mix(c, T.night, .42);                             // the one cel-shadow tone of any hue
  const C = {
    ink: T.night, night: T.night, cream: T.cream, paper: T.cream,
    deck: mix(T.night, T.violet, .16), key: mix(T.night, T.cream, .08), hinge: T.night, silver: mix(T.cream, T.night, .16),
    pad: mix(T.night, T.cream, .05),
    pink: T.pink, pinkDeep: deep(T.pink), green: T.lime, limeDeep: deep(T.lime), mustard: T.yellow, blue: T.cyan,
  };
  // performer body colours (shape keeps the sound, colour = the performer)
  const PAD_COL = { LT: T.cyan, LB: T.violet, RT: T.yellow, RB: T.orange, LT2: T.orange, LB2: T.yellow, RT2: T.violet, RB2: T.cyan };
  const T1 = 6, T2 = 4, T3 = 2.5;
  const W = 1440, H = 900;
  const DECK = { x: 24, y: 62, w: 1392, h: 798, r: 40 };
  const RAIL = { lx: 30, rx: 1364, w: 46 };
  const SEGS4 = [[140, 470], [490, 820]];
  const SEGS8 = [[140, 295], [315, 470], [490, 645], [665, 820]];
  const ORDER4 = { L: ['LT', 'LB'], R: ['RT', 'RB'] };
  const ORDER8 = { L: ['LT', 'LT2', 'LB2', 'LB'], R: ['RT', 'RT2', 'RB2', 'RB'] };
  const GRILLE = { lx: 318, rx: 1068, y: 152, dx: 18, dy: 26, cols: 4, rows: 12 };
  const BEAD = { x: 520, dx: 26.7, y: 93 };
  const CUSH = { cx: 700, cy: 262, R: 220 };                         // round disc, 3/4 view (mock_cushion.png)
  const WORDS = { LT: 'pfft!', LB: 'brap!', RT: 'squee!', RB: 'tss!', LT2: 'fwoo', LB2: 'bomp', RT2: 'pap!', RB2: 'KRAAP' };
  const PUNCH_WORD = { fart_01: 'PRRT', fart_02: 'PFFFT', fart_03: 'BRAAAP', synth_crash: 'KRAAP', synth_slow: 'pf' };
  const PUNCH = new Set(Object.keys(PUNCH_WORD));
  const DUR = {
    voice_01: 1.5, voice_02: 1.1, voice_03: 0.9, voice_04: 0.95, voice_05: 1.0, voice_06: 0.55, voice_07: 0.45,
    fart_01: 0.45, fart_02: 0.4, fart_03: 1.56, synth_slow: 3.0, synth_crash: 2.6,
  };
  // Words for the vocal chops. Only V1 and V2 are known; add the rest here and they show as captions.
  const CAPTIONS = { voice_01: 'uncle...', voice_02: 'not now.' };

  // ------------------------------------------------------------ helpers
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = p => 1 - Math.pow(1 - p, 3);
  const easeIn = p => p * p * p;
  const easeOutBack = p => { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
  const TAU = Math.PI * 2;
  const mulberry = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const rand = mulberry(11);
  const nowS = () => performance.now() / 1000;
  const f1 = n => Math.round(n * 10) / 10;
  const SVG = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs, parent) => {
    const n = document.createElementNS(SVG, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const gen = hasRough ? rough.generator() : null;
  // a hand-drawn ink outline (one stroke, no sketchy double line), clean fill drawn separately
  function inkStroke(d, parent, sw, roughness, seed, cls = 'ink') {
    const g = mk('g', { class: cls }, parent);
    if (gen) gen.toPaths(gen.path(d, { seed, roughness, bowing: .8, strokeWidth: sw, stroke: C.ink, fill: 'none', disableMultiStroke: true, preserveVertices: true }))
      .forEach(p => mk('path', { d: p.d, 'stroke-width': sw }, g));
    else mk('path', { d, 'stroke-width': sw }, g);
    return g;
  }
  const rrect = (x, y, w, h, r) => `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y}Z`;

  // ------------------------------------------------------------ fit the stage to the window
  const stageEl = document.getElementById('stage');
  let S = 1, DPR = 1;
  const canvases = {};
  function canvasCtx(id) {
    const cv = document.getElementById(id);
    if (!cv) return null;
    const bw = Math.round(W * S * DPR), bh = Math.round(H * S * DPR);
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(S * DPR, 0, 0, S * DPR, 0, 0);
    canvases[id] = { cv, ctx, rc: hasRough ? rough.canvas(cv) : null };
    return canvases[id];
  }
  function fit() {
    S = Math.min(innerWidth / W, innerHeight / H);
    DPR = Math.min(2, window.devicePixelRatio || 1);
    document.documentElement.style.setProperty('--s', S.toFixed(4));
    ['haze', 'board', 'fx', 'burst', 'cushion'].forEach(canvasCtx);
    boardKey = ''; hazeKey = '';
  }

  // ------------------------------------------------------------ the deck (static SVG, rails rebuilt per mode)
  const deckSvg = document.getElementById('deck');
  const railEls = {};                    // zone -> { g, rect, x, y0, y1, side }
  let eight = false;
  function buildDeck() {
    while (deckSvg.firstChild) deckSvg.firstChild.remove();
    const d = rrect(DECK.x, DECK.y, DECK.w, DECK.h, DECK.r);
    // one light only: a warm spotlight behind the cushion, plus an edge vignette (DESIGN.md "Light")
    const defs = mk('defs', {}, deckSvg);
    const spot = mk('radialGradient', { id: 'spotG', cx: CUSH.cx, cy: CUSH.cy + 30, r: 470, gradientUnits: 'userSpaceOnUse' }, defs);
    mk('stop', { offset: 0, 'stop-color': T.cream, 'stop-opacity': .26 }, spot);
    mk('stop', { offset: .45, 'stop-color': T.cream, 'stop-opacity': .07 }, spot);
    mk('stop', { offset: 1, 'stop-color': T.cream, 'stop-opacity': 0 }, spot);
    const cone = mk('linearGradient', { id: 'coneG', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    mk('stop', { offset: 0, 'stop-color': T.cream, 'stop-opacity': .13 }, cone);
    mk('stop', { offset: 1, 'stop-color': T.cream, 'stop-opacity': 0 }, cone);
    const vig = mk('radialGradient', { id: 'vigG', cx: 720, cy: 430, r: 820, gradientUnits: 'userSpaceOnUse' }, defs);
    mk('stop', { offset: .55, 'stop-color': T.night, 'stop-opacity': 0 }, vig);
    mk('stop', { offset: 1, 'stop-color': T.night, 'stop-opacity': .75 }, vig);
    const clip = mk('clipPath', { id: 'deckClip' }, defs); mk('path', { d }, clip);
    // the Space Black deck: outer night outline, a thin cream bevel inside the edge
    mk('path', { d, fill: C.deck, stroke: T.night, 'stroke-width': T1 }, deckSvg);
    const lit = mk('g', { 'clip-path': 'url(#deckClip)' }, deckSvg);
    mk('rect', { x: DECK.x, y: DECK.y, width: DECK.w, height: DECK.h, fill: 'url(#spotG)' }, lit);
    // keyboard: faint dark keycaps, the cushion sits on it
    const kb = mk('g', {}, lit);
    [14, 14, 13, 12].forEach((n, r) => {
      const kw = (612 - (n - 1) * 8) / n;
      for (let k = 0; k < n; k++) mk('rect', { x: f1(414 + k * (kw + 8)), y: 142 + r * 58, width: f1(kw), height: 50, rx: 8, fill: C.key, stroke: rgba(T.cream, .1), 'stroke-width': T3 }, kb);
    });
    mk('rect', { x: 414, y: 374, width: 612, height: 50, rx: 8, fill: C.key, stroke: rgba(T.cream, .1), 'stroke-width': T3 }, kb);
    // the spotlight cone falls from the hinge onto the cushion
    mk('path', { d: 'M610 110 L790 110 L1010 470 Q700 520 390 470 Z', fill: 'url(#coneG)' }, lit);
    mk('rect', { x: DECK.x, y: DECK.y, width: DECK.w, height: DECK.h, fill: 'url(#vigG)' }, lit);
    mk('path', { d: rrect(DECK.x + 6, DECK.y + 6, DECK.w - 12, DECK.h - 12, DECK.r - 6), fill: 'none', stroke: rgba(T.cream, .12), 'stroke-width': T3 }, deckSvg);
    // hinge strip (the loop beads are drawn on #board)
    mk('rect', { x: 70, y: 76, width: 1300, height: 34, rx: 17, fill: C.hinge }, deckSvg);
    // silver side rails: one segment per pad, aligned with it. They stay the brightest thing on the deck.
    const segs = eight ? SEGS8 : SEGS4, order = eight ? ORDER8 : ORDER4;
    for (const side of ['L', 'R']) {
      segs.forEach(([y0, y1], i) => {
        const x = side === 'L' ? RAIL.lx : RAIL.rx;
        const g = mk('g', { class: 'rail' }, deckSvg);
        const rd = rrect(x, y0, RAIL.w, y1 - y0, 23);
        const fill = mk('path', { d: rd, fill: C.silver }, g);
        // cel tone on the inner half, highlight stripe 14 px in from the outer edge
        const sx = side === 'L' ? x + RAIL.w * .62 : x;
        const shade = mk('path', { d: rrect(sx, y0 + 4, RAIL.w * .38, y1 - y0 - 8, 12), fill: mix(C.silver, T.night, .22) }, g);
        const hx = side === 'L' ? x + 14 : x + RAIL.w - 14;
        mk('line', { x1: hx, y1: y0 + 26, x2: hx, y2: y1 - 26, stroke: T.cream, 'stroke-width': 5, 'stroke-linecap': 'round' }, g);
        mk('path', { d: rd, fill: 'none', stroke: T.night, 'stroke-width': T2 }, g);
        railEls[order[side][i]] = { g, fill, shade, x, y0, y1, side };
      });
    }
  }

  // ------------------------------------------------------------ pads (critters)
  // drum pad silhouettes follow the sound: low = wide and heavy, high = tall and pointed
  const SHAPES = {
    wet: (w, h) => { const b = h * .8; return { d: `M4 ${f1(h * .36)} C4 ${f1(-h * .04)} ${w - 4} ${f1(-h * .04)} ${w - 4} ${f1(h * .36)} L${w - 4} ${f1(b - 30)} C${w - 4} ${f1(b + 6)} ${f1(w * .82)} ${f1(b + 14)} ${f1(w * .7)} ${f1(b + 8)} C${f1(w * .66)} ${h - 4} ${f1(w * .48)} ${h - 4} ${f1(w * .46)} ${f1(b + 10)} C${f1(w * .2)} ${f1(b + 16)} 4 ${f1(b)} 4 ${f1(b - 30)}Z`, fy: h * .3, label: h * .5 }; },
    kick: (w, h) => { const r = Math.min(h * .44, 64); return { d: `M${r} 4 C${f1(w * .4)} 16 ${f1(w * .6)} 16 ${w - r} 4 Q${w - 4} 4 ${w - 4} ${r} L${w - 4} ${h - r} Q${w - 4} ${h - 4} ${w - r} ${h - 4} L${r} ${h - 4} Q4 ${h - 4} 4 ${h - r} L4 ${r} Q4 4 ${r} 4Z`, fy: h * .28, label: h * .57 }; },
    squeak: (w, h) => ({ d: `M${w / 2} 4 C${f1(w * .8)} ${f1(h * .2)} ${w - 4} ${f1(h * .36)} ${w - 4} ${f1(h * .56)} L${w - 4} ${h - 28} Q${w - 4} ${h - 4} ${w - 28} ${h - 4} L28 ${h - 4} Q4 ${h - 4} 4 ${h - 28} L4 ${f1(h * .56)} C4 ${f1(h * .36)} ${f1(w * .2)} ${f1(h * .2)} ${w / 2} 4Z`, fy: h * .46, label: h * .66 }),
    snare: (w, h) => {
      const t = Math.min(26, h * .16), n = 8, step = (w - 8) / n;
      let d = `M4 ${t}`;
      for (let i = 1; i <= n; i++) d += ` L${f1(4 + i * step)} ${i % 2 ? 4 : t}`;
      d += ` L${w - 4} ${h - 28} Q${w - 4} ${h - 4} ${w - 28} ${h - 4} L28 ${h - 4} Q4 ${h - 4} 4 ${h - 28}Z`;
      return { d, fy: h * .36, label: h * .62 };
    },
    puff: (w, h) => {               // cloud: 7 scallops
      const pts = [], n = 56, cx = w / 2, cy = h / 2 + 2, rx = w / 2 - 6, ry = h / 2 - 6;
      for (let i = 0; i < n; i++) { const th = i / n * TAU, sc = Math.abs(Math.sin(3.5 * th + .4)); const k = .86 + .14 * sc; pts.push([cx + Math.cos(th) * rx * k, cy + Math.sin(th) * ry * k]); }
      return { d: smooth(pts), fy: h * .36, label: h * .56 };
    },
    tom: (w, h) => ({ d: `M20 8 Q${w / 2} -4 ${w - 20} 8 Q${w + 2} ${h / 2} ${w - 20} ${h - 8} Q${w / 2} ${h + 4} 20 ${h - 8} Q-2 ${h / 2} 20 8Z`, fy: h * .34, label: h * .56 }),
    clap: (w, h) => ({ d: `M4 ${f1(h * .46)} C4 ${f1(-h * .06)} ${f1(w * .5)} ${f1(-h * .06)} ${f1(w * .5)} ${f1(h * .34)} C${f1(w * .5)} ${f1(-h * .06)} ${w - 4} ${f1(-h * .06)} ${w - 4} ${f1(h * .46)} L${w - 4} ${h - 24} Q${w - 4} ${h - 4} ${w - 24} ${h - 4} L24 ${h - 4} Q4 ${h - 4} 4 ${h - 24}Z`, fy: h * .4, label: h * .6 }),
    crash: (w, h) => {              // star edged
      const n = 16, cx = w / 2, cy = h / 2, rx = w / 2 - 4, ry = h / 2 - 4; let d = '';
      for (let i = 0; i <= n * 2; i++) { const th = i / (n * 2) * TAU - Math.PI / 2, k = i % 2 ? .86 : 1; d += `${i ? 'L' : 'M'}${f1(cx + Math.cos(th) * rx * k)} ${f1(cy + Math.sin(th) * ry * k)} `; }
      return { d: d + 'Z', fy: h * .36, label: h * .56 };
    },
  };
  function smooth(pts) {
    const n = pts.length; let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
    }
    return d + 'Z';
  }
  const ZONE_SHAPE = { LT: 'wet', LB: 'kick', RT: 'squeak', RB: 'snare', LT2: 'puff', LB2: 'tom', RT2: 'clap', RB2: 'crash' };

  const critters = new Map();
  let critterList = [];
  // mouth shapes for MorphSVG: same command structure so the morph is clean
  const mouthD = (cx, my, r, open) => {
    const w = r * (open ? .95 : 1), dy = open ? r * 1.35 : r * .38, up = open ? r * .55 : -r * .05;
    return `M${f1(cx - w)} ${f1(my)} C${f1(cx - w * .7)} ${f1(my - up)} ${f1(cx + w * .7)} ${f1(my - up)} ${f1(cx + w)} ${f1(my)} C${f1(cx + w * .8)} ${f1(my + dy)} ${f1(cx - w * .8)} ${f1(my + dy)} ${f1(cx - w)} ${f1(my)}Z`;
  };
  function buildDrum(el) {
    const z = el.dataset.zone, side = z[0];
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return null;
    const col = PAD_COL[z] || T.pink, dcol = deep(col);
    el.style.setProperty('--deep', dcol);
    const sh = SHAPES[ZONE_SHAPE[z]](w, h);
    const svg = mk('svg', { class: 'critter', viewBox: `0 0 ${w} ${h}`, 'aria-hidden': 'true' });
    el.insertBefore(svg, el.firstChild);
    // flat body + ONE cel tone on the rail side and bottom + a cream rim light on the stage side (light = centre stage)
    const cid = `cp-${z}`, toC = side === 'L' ? 1 : -1;
    const defs = mk('defs', {}, svg);
    mk('path', { d: sh.d }, mk('clipPath', { id: cid }, defs));
    mk('path', { d: sh.d, fill: dcol }, svg);
    const lit = mk('g', { 'clip-path': `url(#${cid})` }, svg);
    mk('path', { class: 'belly', d: sh.d, fill: col, transform: `translate(${9 * toC} -11)` }, lit);
    mk('path', { class: 'rim', d: sh.d, transform: `translate(${-5 * toC} 5)` }, lit);
    mk('path', { class: 'ink', d: sh.d, 'stroke-width': T2 }, svg);
    // face: big eyes, a mouth that becomes the whole action
    const small = h < 150;
    const er = small ? 14 : 19, gap = small ? 19 : 25, fy = small ? h * .27 : (ZONE_SHAPE[z] === 'squeak' ? h * .42 : sh.fy), cx = w / 2 + toC * 4;
    const look = side === 'L' ? -1 : 1;                       // listening to its own rail
    const calm = mk('g', { class: 'calm' }, svg);
    const eyes = mk('g', { class: 'eyes' }, calm);
    for (const dx of [-gap, gap]) {
      mk('circle', { class: 'eye', cx: f1(cx + dx), cy: f1(fy), r: er }, eyes);
      const px = cx + dx + look * er * .38;
      mk('circle', { class: 'pupil', cx: f1(px), cy: f1(fy + 2), r: f1(er * .55) }, eyes);
      mk('circle', { class: 'glint', cx: f1(px - er * .18), cy: f1(fy - er * .16), r: f1(er * .16) }, eyes);
    }
    // 8-square extras: simpler, but each gets one personality mark so no two faces match
    const kindX = ZONE_SHAPE[z];
    if (kindX === 'puff') [-gap, gap].forEach(dx => {                        // drowsy: heavy lids
      mk('path', { d: `M${f1(cx + dx - er - 1)} ${f1(fy - er - 1)} H${f1(cx + dx + er + 1)} V${f1(fy + 1)} H${f1(cx + dx - er - 1)}Z`, fill: col }, eyes);
      line(eyes, `M${f1(cx + dx - er)} ${f1(fy + 1)} H${f1(cx + dx + er)}`, T2);
    });
    if (kindX === 'tom') {                                                  // a sweatband across the forehead
      line(calm, `M10 ${f1(fy - er - 9)} H${w - 10}`, 13);
      mk('path', { d: `M10 ${f1(fy - er - 9)} H${w - 10}`, stroke: T.cream, 'stroke-width': 7, fill: 'none' }, calm);
    }
    if (kindX === 'clap') [-1, 1].forEach(s => mk('circle', { cx: f1(cx + s * (gap + er + 6)), cy: f1(fy + er + 4), r: 7, fill: mix(T.pink, col, .4) }, calm));
    if (kindX === 'crash') [-1, 1].forEach(s => line(calm, `M${f1(cx + s * (gap + er))} ${f1(fy - er - 9)} L${f1(cx + s * 6)} ${f1(fy - er + 1)}`, 4.5));
    const ouch = mk('g', { class: 'ouch' }, svg);
    for (const dx of [-gap, gap]) {                           // singing: eyes squeezed into happy arcs
      mk('path', { class: 'sing', d: `M${f1(cx + dx - er * .8)} ${f1(fy + er * .25)} Q${f1(cx + dx)} ${f1(fy - er * .9)} ${f1(cx + dx + er * .8)} ${f1(fy + er * .25)}` }, ouch);
    }
    const mr = small ? 11 : 15, my = fy + er * 1.75;
    const shutD = mouthD(cx, my, mr * .7, false), openD = mouthD(cx, my, mr, true);
    const mouth = mk('path', { class: 'mouth', d: shutD }, svg);
    mk('ellipse', { class: 'tongue', cx: f1(cx), cy: f1(my + mr * .95), rx: f1(mr * .55), ry: f1(mr * .28) }, ouch);
    svg.appendChild(ouch);
    // labels follow the shape and sit clear of the open mouth
    const lb = el.querySelector('b'), ks = el.querySelector('span');
    const labelTop = Math.max(small ? 0 : sh.label, my + mr * 1.35 + 6);
    if (lb) { lb.style.top = `${f1(labelTop)}px`; lb.style.fontSize = small ? '24px' : ''; }
    if (ks) ks.style.top = `${f1(labelTop + (small ? 24 : 30))}px`;
    return { el, kind: 'drum', zone: z, side, svg, mouth, shutD, openD, col, blinkAt: nowS() + 1 + rand() * 4 };
  }
  // trackpad squares: a flat fill layer (.cell, the only thing that scales), the label above the finger dot
  // each square gets its own drawn glyph (no identical cards): uncle = speech-bubble mouth, fart = puffs, long fart = squiggle,
  // notes = a note head on a little staff at its pitch height
  const NOTE_RANK = { A2: 0, C3: 1, D3: 2, E3: 3, G3: 4, A3: 5, C4: 6, D4: 7 };
  function glyphSvg(el) {
    const sound = el.dataset.sound || '', note = el.dataset.note || '';
    const F = 'style="fill:var(--deep)"', S = `stroke="${T.night}" stroke-width="${T3}" stroke-linecap="round" stroke-linejoin="round"`;
    let g = '';
    if (note) {
      const r = NOTE_RANK[note] ?? 3, y = 40 - r * 4.4;
      for (let i = 0; i < 3; i++) g += `<line x1="22" x2="114" y1="${12 + i * 12}" y2="${12 + i * 12}" ${S} opacity=".45"/>`;
      g += `<ellipse cx="66" cy="${f1(y)}" rx="9" ry="7" transform="rotate(-20 66 ${f1(y)})" fill="${T.night}"/><line x1="74" y1="${f1(y)}" x2="74" y2="${f1(y - 26)}" ${S}/>`;
    } else if (sound.startsWith('voice')) {
      const n = +sound.slice(-1) || 1;
      g += `<path d="M42 6 H94 Q106 6 106 18 V26 Q106 38 94 38 H66 L54 46 L56 38 H42 Q30 38 30 26 V18 Q30 6 42 6Z" ${F} ${S}/>`;
      if (n === 1) g += [56, 68, 80].map(x => `<circle cx="${x}" cy="22" r="3.5" fill="${T.night}"/>`).join('');
      else if (n === 2) g += `<line x1="56" y1="22" x2="80" y2="22" ${S} stroke-width="4"/>`;
      else g += `<ellipse cx="68" cy="22" rx="${6 + (n % 3) * 3}" ry="${5 + (n % 2) * 4}" fill="${T.night}"/>`;
    } else if (sound === 'synth_slow') {
      g += `<path d="M18 30 Q28 14 38 30 T58 30 T78 30 T98 30" fill="none" ${S} stroke-width="4"/><circle cx="112" cy="26" r="11" ${F} ${S}/>`;
    } else {
      const n = sound === 'fart_03' ? 3 : (sound === 'fart_02' ? 2 : 1);
      const xs = n === 1 ? [68] : (n === 2 ? [56, 82] : [44, 68, 92]);
      xs.forEach((x, i) => { const r = 9 + (i % 2) * 3; g += `<circle cx="${x - 5}" cy="${28 - i % 2 * 2}" r="${r}" ${F} ${S}/><circle cx="${x + 6}" cy="${24 - i % 2 * 2}" r="${r + 2}" ${F} ${S}/>`; });
    }
    return `<svg class="glyph" viewBox="0 0 136 46" aria-hidden="true">${g}</svg>`;
  }
  function buildTrackpadCells() {
    document.querySelectorAll('.trackpad .pad[data-slot]').forEach(el => {
      let cell = el.querySelector(':scope > i.cell');
      if (!cell) { cell = Object.assign(document.createElement('i'), { className: 'cell' }); el.insertBefore(cell, el.firstChild); }
      const key = (el.dataset.sound || '') + (el.dataset.note || '');
      if (cell.dataset.g !== key) { cell.innerHTML = glyphSvg(el); cell.dataset.g = key; }
      // fit rule (DESIGN.md): a label that would overflow its square steps down from 44 until its longest word fits 120 px
      const b = el.querySelector('b');
      if (b && !el.classList.contains('note')) {
        b.style.fontSize = '';
        const wmax = b.scrollWidth;
        if (wmax > 120) b.style.fontSize = `${Math.floor(44 * 120 / wmax)}px`;
      }
    });
  }
  // ------------------------------------------------------------ r4: the four main drum performers, one personality each
  // Silhouette and face come from the sound (docs/design/08_characters). Every part: flat colour, ONE cel tone (deep),
  // a 4 px night outline. Light comes from centre stage, so the cel tone sits on the rail side and underneath.
  function celPart(parent, d, col, toC, id, cls) {
    const g = mk('g', cls ? { class: cls } : {}, parent);
    const defs = mk('defs', {}, g);
    mk('path', { d }, mk('clipPath', { id }, defs));
    mk('path', { d, fill: deep(col) }, g);
    const lit = mk('g', { 'clip-path': `url(#${id})` }, g);
    mk('path', { class: 'belly', d, fill: col, transform: `translate(${7 * toC} -8)` }, lit);
    mk('path', { class: 'rim', d, transform: `translate(${-4 * toC} 4)` }, lit);
    mk('path', { class: 'ink', d, 'stroke-width': T2 }, g);
    return g;
  }
  const line = (parent, d, sw, cls = 'ink', extra = {}) => mk('path', { class: cls, d, 'stroke-width': sw, ...extra }, parent);
  function eye(parent, x, y, r, pr, look, cls = 'eye') {
    mk('circle', { class: cls, cx: f1(x), cy: f1(y), r: f1(r) }, parent);
    const px = x + look * (r - pr) * .55;
    mk('circle', { class: 'pupil', cx: f1(px), cy: f1(y + r * .12), r: f1(pr) }, parent);
    if (pr > 3.5) mk('circle', { class: 'glint', cx: f1(px - pr * .35), cy: f1(y - pr * .3), r: f1(Math.max(1.5, pr * .3)) }, parent);
  }
  // each builder returns { parts, label: {top, size}, key }
  const CHAR = {
    // KICK: a squat violet brick on stubby legs, heavy grumpy unibrow, underbite tooth. Bouncer.
    kick(svg, w, h, col, toC, look, z) {
      const cx = w / 2, top = h * .12, bot = h * .85, small = h < 150;
      const legs = mk('g', { class: 'legs' }, svg);
      [cx - w * .26, cx + w * .26].forEach((x, i) => celPart(legs, rrect(x - 16, bot - 10, 32, h - bot + 6, 9), col, toC, `${z}-leg${i}`));
      const body = mk('g', { class: 'body' }, svg);
      celPart(body, `M18 ${f1(top)} H${w - 18} Q${w - 6} ${f1(top)} ${w - 6} ${f1(top + 14)} L${w - 3} ${f1(bot - 12)} Q${w - 3} ${f1(bot)} ${w - 16} ${f1(bot)} H16 Q3 ${f1(bot)} 3 ${f1(bot - 12)} L6 ${f1(top + 14)} Q6 ${f1(top)} 18 ${f1(top)}Z`, col, toC, `${z}-body`);
      const ey = top + (bot - top) * (small ? .23 : .24), er = small ? 10 : 12, gap = 27;
      const calm = mk('g', { class: 'calm' }, body), ouchG = mk('g', { class: 'ouch' }, body);
      const eyes = mk('g', { class: 'eyes' }, calm);
      [-gap, gap].forEach(dx => {                                      // half-lidded: the brow sits on them
        mk('path', { class: 'eye', d: `M${f1(cx + dx - er)} ${f1(ey)} A${er} ${er} 0 0 0 ${f1(cx + dx + er)} ${f1(ey)}Z` }, eyes);
        mk('circle', { class: 'pupil', cx: f1(cx + dx + look * 4), cy: f1(ey + er * .42), r: 4.5 }, eyes);
      });
      line(calm, `M${f1(cx - 48)} ${f1(ey - 13)} L${f1(cx - 6)} ${f1(ey - 2)} L${f1(cx + 6)} ${f1(ey - 2)} L${f1(cx + 48)} ${f1(ey - 13)}`, 9, 'ink brow');
      const my = ey + (small ? 16 : 19);
      line(calm, `M${f1(cx - 17)} ${f1(my + 3)} Q${f1(cx)} ${f1(my - 6)} ${f1(cx + 17)} ${f1(my + 3)}`, 4);
      mk('path', { d: `M${f1(cx + 5)} ${f1(my - 1)} l3 -7 l4 0 l1 6Z`, fill: T.cream, stroke: T.night, 'stroke-width': T3, 'stroke-linejoin': 'round' }, calm);
      // stomp face: brow slams down onto shut eyes, cheeks puffed, lips pressed "mmf"
      line(ouchG, `M${f1(cx - 50)} ${f1(ey - 6)} L${f1(cx - 6)} ${f1(ey + 4)} L${f1(cx + 6)} ${f1(ey + 4)} L${f1(cx + 50)} ${f1(ey - 6)}`, 10, 'ink brow');
      [-gap, gap].forEach(dx => line(ouchG, `M${f1(cx + dx - 9)} ${f1(ey + 8)} L${f1(cx + dx + 9)} ${f1(ey + 8)}`, 4));
      [-1, 1].forEach(s => mk('circle', { cx: f1(cx + s * 52), cy: f1(my - 8), r: small ? 9 : 11, fill: mix(col, T.cream, .3), stroke: T.night, 'stroke-width': T3 }, ouchG));
      line(ouchG, `M${f1(cx - 9)} ${f1(my + 1)} Q${f1(cx)} ${f1(my + 5)} ${f1(cx + 9)} ${f1(my + 1)}`, 4);
      return { parts: { body, legs }, origin: [cx, bot], label: { top: my + (small ? 14 : 19), size: small ? 22 : 24 }, keyGap: small ? 19 : 22 };
    },
    // WET: melting cyan puddle-ghost, droopy uneven eyes, tongue out, a drool drip, drips off the base. Sloppy.
    wet(svg, w, h, col, toC, look, z) {
      const cx = w / 2 + toC * 6, small = h < 150, b = h * .9;
      const body = mk('g', { class: 'body' }, svg);
      const d = `M${f1(cx - 50)} ${f1(h * .36)} C${f1(cx - 52)} ${f1(h * .02)} ${f1(cx + 52)} ${f1(h * .02)} ${f1(cx + 50)} ${f1(h * .36)}`
        + ` C${f1(cx + 50)} ${f1(h * .54)} ${w - 4} ${f1(h * .56)} ${w - 4} ${f1(h * .76)} C${w - 4} ${f1(b)} ${w - 22} ${f1(b + 2)} ${w - 30} ${f1(b)}`
        + ` C${w - 36} ${f1(b)} ${w - 36} ${f1(h * .985)} ${w - 44} ${f1(h * .985)} C${w - 52} ${f1(h * .985)} ${w - 52} ${f1(b)} ${w - 62} ${f1(b + 1)}`
        + ` L60 ${f1(b + 2)} C50 ${f1(b + 2)} 48 ${f1(b + h * .06)} 40 ${f1(b + h * .06)} C32 ${f1(b + h * .06)} 32 ${f1(b)} 22 ${f1(b)}`
        + ` C6 ${f1(b)} 4 ${f1(h * .8)} 6 ${f1(h * .74)} C10 ${f1(h * .58)} ${f1(cx - 50)} ${f1(h * .55)} ${f1(cx - 50)} ${f1(h * .36)}Z`;
      celPart(body, d, col, toC, `${z}-body`);
      const calm = mk('g', { class: 'calm' }, body), ouchG = mk('g', { class: 'ouch' }, body);
      const ey = h * .24, eyes = mk('g', { class: 'eyes' }, calm);
      // uneven droopy eyes: heavy lids that sag outward
      [[-22, small ? 12 : 15, 1], [22, small ? 10 : 12, -1]].forEach(([dx, r, sd], i) => {
        const x = cx + dx, y = ey + (sd < 0 ? 4 : 0), id = `${z}-eye${i}`;
        mk('circle', { cx: f1(x), cy: f1(y), r: f1(r) }, mk('clipPath', { id }, mk('defs', {}, eyes)));
        const g = mk('g', { 'clip-path': `url(#${id})` }, eyes);
        mk('circle', { cx: f1(x), cy: f1(y), r: f1(r), fill: T.cream }, g);
        mk('circle', { class: 'pupil', cx: f1(x + look * r * .2), cy: f1(y + r * .35), r: f1(r * .45) }, g);
        const yl = sd > 0 ? y + r * .3 : y - r * .1, yr = sd > 0 ? y - r * .1 : y + r * .3;   // the lid sags on the outer side
        mk('path', { d: `M${f1(x - r - 2)} ${f1(y - r - 2)} H${f1(x + r + 2)} V${f1(yr)} L${f1(x - r - 2)} ${f1(yl)}Z`, fill: col }, g);
        line(g, `M${f1(x - r - 2)} ${f1(yl)} L${f1(x + r + 2)} ${f1(yr)}`, T2);
        mk('circle', { cx: f1(x), cy: f1(y), r: f1(r), fill: 'none', stroke: T.night, 'stroke-width': 3 }, eyes);
      });
      // lopsided open mouth, tongue hanging out of one side, drool drip off the other
      const my = h * .4, mw = small ? 18 : 22;
      mk('path', { class: 'mouth', d: `M${f1(cx - mw)} ${f1(my - 3)} Q${f1(cx)} ${f1(my + 2)} ${f1(cx + mw)} ${f1(my - 7)} Q${f1(cx + 4)} ${f1(my + 16)} ${f1(cx - mw)} ${f1(my - 3)}Z` }, calm);
      mk('path', { d: `M${f1(cx + 2)} ${f1(my + 3)} q4 ${small ? 14 : 20} 12 ${small ? 14 : 20} q8 0 6 -${small ? 16 : 22}Z`, fill: T.pink, stroke: T.night, 'stroke-width': T3, 'stroke-linejoin': 'round' }, calm);
      const drool = mix(col, T.cream, .55);
      mk('path', { class: 'drool', d: `M${f1(cx - mw + 3)} ${f1(my - 2)} q-3 10 -1 ${small ? 12 : 17} a4 4 0 1 0 6 0 q1 -8 0 -${small ? 12 : 17}Z`, fill: drool, stroke: T.night, 'stroke-width': T3 }, calm);
      // splat face: eyes squeezed into wavy lines, mouth a wide "bleh" with the tongue flapping
      [-22, 22].forEach(dx => line(ouchG, `M${f1(cx + dx - 12)} ${f1(ey + 2)} q4 -6 8 0 t8 0 t8 0`, 4));
      mk('path', { class: 'mouth', d: `M${f1(cx - mw - 6)} ${f1(my - 6)} Q${f1(cx)} ${f1(my - 2)} ${f1(cx + mw + 6)} ${f1(my - 6)} Q${f1(cx)} ${f1(my + 22)} ${f1(cx - mw - 6)} ${f1(my - 6)}Z` }, ouchG);
      mk('ellipse', { cx: f1(cx), cy: f1(my + 10), rx: 11, ry: 6, fill: T.pink }, ouchG);
      return { parts: { body }, origin: [cx, b], label: { top: h * (small ? .6 : .63), size: small ? 24 : 28 }, keyGap: small ? 22 : 28 };
    },
    // SQUEAK: a tall skinny yellow teardrop on tiptoe, huge bulging eyes with tiny pupils, a wobbly little O. Nervous.
    squeak(svg, w, h, col, toC, look, z) {
      const cx = w / 2, small = h < 150, tip = h * .03, bulge = h * .66, bot = h * .88, hw = small ? 52 : 62;
      const legs = mk('g', { class: 'legs' }, svg);
      [-13, 13].forEach(dx => {
        line(legs, `M${f1(cx + dx)} ${f1(bot - 6)} L${f1(cx + dx * 1.15)} ${f1(h - 7)}`, 5);
        mk('path', { d: `M${f1(cx + dx * 1.15 - 6)} ${f1(h - 3)} L${f1(cx + dx * 1.15)} ${f1(h - 12)} L${f1(cx + dx * 1.15 + 6)} ${f1(h - 3)}Z`, fill: col, stroke: T.night, 'stroke-width': T3, 'stroke-linejoin': 'round' }, legs);
      });
      const body = mk('g', { class: 'body' }, svg);
      // nervous little arms clenched up by the chest
      [-1, 1].forEach(s => { line(body, `M${f1(cx + s * (hw - 10))} ${f1(h * .55)} q${s * 16} -2 ${s * 14} -${small ? 12 : 18}`, 5); mk('circle', { cx: f1(cx + s * (hw + 4)), cy: f1(h * .55 - (small ? 13 : 19)), r: 6, fill: col, stroke: T.night, 'stroke-width': T3 }, body); });
      celPart(body, `M${f1(cx + toC * 10)} ${f1(tip)} C${f1(cx + 8)} ${f1(h * .2)} ${f1(cx + hw)} ${f1(h * .4)} ${f1(cx + hw)} ${f1(bulge)} C${f1(cx + hw)} ${f1(h * .8)} ${f1(cx + 26)} ${f1(bot)} ${f1(cx)} ${f1(bot)} C${f1(cx - 26)} ${f1(bot)} ${f1(cx - hw)} ${f1(h * .8)} ${f1(cx - hw)} ${f1(bulge)} C${f1(cx - hw)} ${f1(h * .4)} ${f1(cx - 8)} ${f1(h * .2)} ${f1(cx + toC * 10)} ${f1(tip)}Z`, col, toC, `${z}-body`);
      const ey = h * (small ? .34 : .33), er = small ? 17 : 22;
      const pop = mk('g', { class: 'pop' }, body);
      const calm = mk('g', { class: 'calm' }, pop), ouchG = mk('g', { class: 'ouch' }, pop);
      const eyes = mk('g', { class: 'eyes' }, calm);
      [-1, 1].forEach(s => eye(eyes, cx + s * (er + 2), ey, er, small ? 3.5 : 4, look * .6));
      [-1, 1].forEach(s => { mk('circle', { class: 'eye', cx: f1(cx + s * (er + 2)), cy: f1(ey), r: f1(er * 1.08) }, ouchG); mk('circle', { class: 'pupil', cx: f1(cx + s * (er + 2)), cy: f1(ey), r: 2.5 }, ouchG); });
      // worried brows and a sweat drop
      [-1, 1].forEach(s => line(calm, `M${f1(cx + s * 8)} ${f1(ey - er - 6)} L${f1(cx + s * (er * 2 - 2))} ${f1(ey - er + 1)}`, 3.5));
      mk('path', { d: `M${f1(cx - toC * (hw - 6))} ${f1(h * .2)} q-5 9 0 12 q5 -3 0 -12Z`, fill: mix(T.cyan, T.cream, .5), stroke: T.night, 'stroke-width': T3 }, body);
      const my = ey + er + (small ? 7 : 10);
      const wob = (rx, ry) => { let d = ''; for (let i = 0; i <= 16; i++) { const a = i / 16 * TAU, k = 1 + .12 * Math.sin(a * 5); d += `${i ? 'L' : 'M'}${f1(cx + Math.cos(a) * rx * k)} ${f1(my + Math.sin(a) * ry * k)} `; } return d + 'Z'; };
      mk('path', { class: 'mouth', d: wob(5, 7) }, calm);
      mk('path', { class: 'mouth', d: wob(7, 11) }, ouchG);
      return { parts: { body, legs, pop }, origin: [cx, bot], eyeC: [cx, ey], label: { top: h * (small ? .6 : .615), size: small ? 20 : 23 }, keyGap: small ? 19 : 25 };
    },
    // SNARE: an orange punk with a zig-zag mohawk, one eye half shut, a smirk, a drumstick in each little fist.
    snare(svg, w, h, col, toC, look, z) {
      const cx = w / 2 - toC * 2, small = h < 150, top = h * .32, bot = h * .93, hw = small ? 54 : 58;
      const crown = mk('g', { class: 'crown' }, svg);
      const spikes = [];
      const hs = [.5, .82, 1, .82, .5], sw = small ? 15 : 17;
      hs.forEach((k, i) => {
        const x = cx + (i - 2) * sw * 1.15, tipY = top - (top - h * .02) * k;
        const g = mk('g', {}, crown);
        celPart(g, `M${f1(x - sw * .72)} ${f1(top + 10)} L${f1(x + (i - 2) * 3)} ${f1(tipY)} L${f1(x + sw * .72)} ${f1(top + 10)}Z`, col, toC, `${z}-sp${i}`);
        spikes.push({ g, x, y: top + 8 });
      });
      const body = mk('g', { class: 'body' }, svg);
      celPart(body, `M${f1(cx - hw + 14)} ${f1(top)} H${f1(cx + hw - 14)} Q${f1(cx + hw)} ${f1(top)} ${f1(cx + hw)} ${f1(top + 16)} L${f1(cx + hw - 4)} ${f1(bot - 14)} Q${f1(cx + hw - 6)} ${f1(bot)} ${f1(cx + hw - 20)} ${f1(bot)} H${f1(cx - hw + 20)} Q${f1(cx - hw + 6)} ${f1(bot)} ${f1(cx - hw + 4)} ${f1(bot - 14)} L${f1(cx - hw)} ${f1(top + 16)} Q${f1(cx - hw)} ${f1(top)} ${f1(cx - hw + 14)} ${f1(top)}Z`, col, toC, `${z}-body`);
      // drumsticks: cream with a night outline, held in little fists at the body's sides
      const sticks = [];
      [-1, 1].forEach(s => {
        const gx = cx + s * (hw + 2), gy = h * (small ? .66 : .64);
        const g = mk('g', { class: 'stick' }, svg);
        const ex = gx + s * 26, eyy = gy - (small ? 44 : 52);
        line(g, `M${f1(gx - s * 6)} ${f1(gy + 6)} L${f1(ex)} ${f1(eyy)}`, 10);
        mk('path', { d: `M${f1(gx - s * 6)} ${f1(gy + 6)} L${f1(ex)} ${f1(eyy)}`, stroke: T.cream, 'stroke-width': 5, 'stroke-linecap': 'round', fill: 'none' }, g);
        mk('circle', { cx: f1(ex), cy: f1(eyy), r: 5.5, fill: T.cream, stroke: T.night, 'stroke-width': T3 }, g);
        mk('circle', { cx: f1(gx), cy: f1(gy), r: small ? 9 : 10, fill: col, stroke: T.night, 'stroke-width': T3 }, g);
        sticks.push({ g, gx, gy, s });
      });
      const calm = mk('g', { class: 'calm' }, body), ouchG = mk('g', { class: 'ouch' }, body);
      const ey = top + (bot - top) * (small ? .2 : .22), er = small ? 11 : 13, gap = 22, eyes = mk('g', { class: 'eyes' }, calm);
      const open = -toC, shut = toC;                                   // the eye toward the rail stays open
      eye(eyes, cx + open * gap, ey, er, er * .45, look * .6);
      eye(eyes, cx + shut * gap, ey, er, er * .45, look * .6);
      const sx = cx + shut * gap;                                      // half-shut lid
      mk('path', { d: `M${f1(sx - er - 2)} ${f1(ey - er - 2)} H${f1(sx + er + 2)} V${f1(ey + 1)} H${f1(sx - er - 2)}Z`, fill: col }, eyes);
      line(eyes, `M${f1(sx - er - 1)} ${f1(ey + 1)} H${f1(sx + er + 1)}`, T2);
      line(calm, `M${f1(cx + open * (gap - 12))} ${f1(ey - er - 7)} Q${f1(cx + open * gap)} ${f1(ey - er - 14)} ${f1(cx + open * (gap + 13))} ${f1(ey - er - 6)}`, 4);
      const my = ey + er + (small ? 9 : 12);
      line(calm, `M${f1(cx - 15 * open)} ${f1(my)} Q${f1(cx + open * 2)} ${f1(my + 6)} ${f1(cx + 16 * open)} ${f1(my - 7)}`, 4);
      // rimshot face: both eyes squeezed, a wide toothy yell
      [-1, 1].forEach(s => line(ouchG, `M${f1(cx + s * gap - 10)} ${f1(ey + 3)} Q${f1(cx + s * gap)} ${f1(ey - 9)} ${f1(cx + s * gap + 10)} ${f1(ey + 3)}`, 4.5));
      mk('path', { class: 'mouth', d: `M${f1(cx - 18)} ${f1(my - 5)} H${f1(cx + 18)} Q${f1(cx + 16)} ${f1(my + 14)} ${f1(cx)} ${f1(my + 14)} Q${f1(cx - 16)} ${f1(my + 14)} ${f1(cx - 18)} ${f1(my - 5)}Z` }, ouchG);
      mk('rect', { x: f1(cx - 14), y: f1(my - 4), width: 28, height: 5, fill: T.cream }, ouchG);
      return { parts: { body, crown }, spikes, sticks, origin: [cx, bot], label: { top: my + (small ? 11 : 15), size: small ? 24 : 28 }, keyGap: small ? 22 : 27 };
    },
  };
  const MAIN4 = { LT: 'wet', LB: 'kick', RT: 'squeak', RB: 'snare' };
  // labels live in a .tag wrapper: the beat bob moves the wrapper (CSS transform), hit poses tween b/span (GSAP)
  function tagOf(el) {
    let tag = el.querySelector(':scope > .tag');
    if (!tag) {
      tag = document.createElement('div'); tag.className = 'tag';
      el.querySelectorAll(':scope > b, :scope > span').forEach(n => tag.appendChild(n));
      el.appendChild(tag);
    }
    return tag;
  }
  function buildCharacter(el) {
    const z = el.dataset.zone, kind = MAIN4[z], side = z[0];
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return null;
    const col = PAD_COL[z] || T.pink, toC = side === 'L' ? 1 : -1, look = side === 'L' ? -1 : 1;
    el.style.setProperty('--deep', deep(col));
    const svg = mk('svg', { class: 'critter', viewBox: `0 0 ${w} ${h}`, 'aria-hidden': 'true' });
    el.insertBefore(svg, el.firstChild);
    const r = CHAR[kind](svg, w, h, col, toC, look, z);
    const tag = tagOf(el), lb = tag.querySelector('b'), ks = tag.querySelector('span');
    if (lb) { lb.style.top = `${f1(r.label.top)}px`; lb.style.fontSize = `${r.label.size}px`; }
    if (ks) ks.style.top = `${f1(r.label.top + r.keyGap)}px`;
    return { el, kind: 'drum', who: kind, zone: z, side, toC, svg, tag, col, ...r, blinkAt: nowS() + 1 + rand() * 4 };
  }
  // hit poses: anticipation, a held extreme (hit-stop), then CustomBounce / CustomWiggle recovery. Labels ride along.
  function poseHit(c, v) {
    const p = c.parts, [ox, oy] = c.origin, so = `${ox} ${oy}`, lbls = [...c.tag.children];
    const lc = c.label.top + c.label.size / 2, ride = (dy, sy) => f1(dy + (oy - lc) * (1 - sy));   // keep the label on the same spot of the squashed body
    // reset every part first and give each ONE origin: mixing origins across tweens made the body creep downward on loops
    const all = [p.body, p.legs, p.crown].filter(Boolean);
    gsap.set(all, { clearProps: 'transform' }); gsap.set(all, { svgOrigin: so, x: 0, y: 0, scale: 1, rotation: 0 });
    if (p.pop) { gsap.set(p.pop, { clearProps: 'transform' }); gsap.set(p.pop, { svgOrigin: `${c.eyeC[0]} ${c.eyeC[1]}` }); }
    gsap.set(lbls, { y: 0 });
    const tl = gsap.timeline();
    if (c.who === 'kick') {              // stomp: hop up 40 ms, slam down squashed, ground shake, heavy settle
      tl.to(p.body, { y: -10, scaleY: 1.06, scaleX: .96, duration: .04, ease: 'power2.out' })
        .to(p.body, { y: 4, scaleY: .88, scaleX: 1.12, duration: .05, ease: 'power4.in' })
        .to(p.legs, { scaleY: .55, duration: .05, ease: 'power4.in' }, '<')
        .to(lbls, { y: ride(4, .88), duration: .05, ease: 'power4.in' }, '<')
        .to([p.body, p.legs], { x: 3, duration: .3, ease: P.CustomWiggle ? 'fbJiggle' : 'none' }, '>')
        .to([p.body, p.legs], { y: 0, scaleY: 1, scaleX: 1, duration: .32, ease: 'back.out(3)' }, '<+.04')
        .to(lbls, { y: 0, duration: .32, ease: 'back.out(3)' }, '<');
    } else if (c.who === 'wet') {        // splat: sags, then spreads wide and flat, jelly wobble back
      tl.to(p.body, { scaleY: 1.05, scaleX: .95, duration: .04, ease: 'power2.out' })
        .to(p.body, { scaleY: .72, scaleX: 1.2, duration: .05, ease: 'power3.in' })
        .to(lbls, { y: ride(0, .72), duration: .05, ease: 'power3.in' }, '<')
        .to(p.body, { scaleY: 1, scaleX: 1, duration: .7, ease: 'elastic.out(1.1, .28)' }, '+=.05')
        .to(lbls, { y: 0, duration: .7, ease: 'elastic.out(1.1, .28)' }, '<')
        .to(p.body, { rotation: 3 * c.toC, duration: .6, ease: P.CustomWiggle ? 'fbJiggle' : 'none' }, '<');
    } else if (c.who === 'squeak') {     // shriek: crouch, shoot up on tiptoe with eyes popping, bounce down
      const [ex, ey] = c.eyeC;
      tl.to([p.body, p.legs], { scaleY: .9, scaleX: 1.06, duration: .04, ease: 'power2.out' })
        .to([p.body, p.legs], { y: -14, scaleY: 1.18, scaleX: .84, duration: .05, ease: 'power3.out' })
        .to(p.pop, { scale: 1.28, duration: .05, ease: 'back.out(4)' }, '<')
        .to(lbls, { y: ride(-14, 1.18), duration: .05, ease: 'power3.out' }, '<')
        .to([p.body, p.legs], { y: 0, duration: .45, ease: P.CustomBounce ? 'fbLand' : 'bounce.out' }, '+=.05')
        .to([p.body, p.legs], { scaleY: 1, scaleX: 1, duration: .45, ease: 'elastic.out(1, .35)' }, '<')
        .to(lbls, { y: 0, duration: .45, ease: P.CustomBounce ? 'fbLand' : 'bounce.out' }, '<')
        .to(p.pop, { scale: 1, duration: .3, ease: 'power2.out' }, '<+.1');
    } else if (c.who === 'snare') {      // rimshot: wind up, the rail-side stick cracks down, spikes flick, cocky lean
      const [a, b] = c.sticks, hitS = c.sticks.find(s => s.s === -c.toC) || a, other = hitS === a ? b : a;
      tl.to(hitS.g, { svgOrigin: `${hitS.gx} ${hitS.gy}`, rotation: -18 * hitS.s, duration: .04, ease: 'power2.out' })
        .to(hitS.g, { svgOrigin: `${hitS.gx} ${hitS.gy}`, rotation: 62 * hitS.s, duration: .04, ease: 'power4.in' })
        .to(other.g, { svgOrigin: `${other.gx} ${other.gy}`, rotation: -22 * other.s, duration: .06, ease: 'power2.out' }, '<')
        .to([p.body, p.crown], { rotation: 7 * c.toC, scaleY: .94, duration: .05, ease: 'power3.in' }, '<')
        .to([hitS.g, other.g], { rotation: 0, duration: .35, ease: 'back.out(2.5)' }, '+=.05')
        .to([p.body, p.crown], { rotation: 0, scaleY: 1, duration: .35, ease: 'back.out(2.5)' }, '<');
      c.spikes.forEach((s, i) => tl.fromTo(s.g, { rotation: 0 }, { svgOrigin: `${s.x} ${s.y}`, rotation: (i % 2 ? -16 : 16) * (.6 + v * .4), duration: .5, ease: P.CustomWiggle ? 'fbFlick' : 'none' }, .08));
    }
    return tl;
  }
  // beat bobs, one groove each (ph = phase within the quarter note, bp = beat position)
  function bobFor(c, ph, bp) {
    const land = Math.max(0, 1 - ph / .14);
    if (c.who === 'kick') { const y = -6 * Math.sin(Math.PI * Math.pow(ph, .7)); return `translateY(${f1(y)}px) scale(${(1 + .07 * land).toFixed(3)}, ${(1 - .08 * land).toFixed(3)})`; }
    if (c.who === 'squeak') { const air = 4 * ph * (1 - ph), y = -18 * air; return `translateY(${f1(y)}px) scale(${(1 - .06 * air + .06 * land).toFixed(3)}, ${(1 + .1 * air - .08 * land).toFixed(3)})`; }
    if (c.who === 'wet') { const r = 5 * Math.sin(Math.PI * bp); return `rotate(${f1(r)}deg) scale(${(1 + .03 * Math.abs(Math.sin(Math.PI * bp))).toFixed(3)}, ${(1 - .03 * Math.abs(Math.sin(Math.PI * bp))).toFixed(3)})`; }
    if (c.who === 'snare') { const r = -8 * c.toC * Math.exp(-ph * 9); return `rotate(${f1(r)}deg)`; }
    const y = -8 * Math.sin(Math.PI * ph);
    return `translateY(${f1(y)}px) scale(${(1 + .06 * land).toFixed(3)}, ${(1 - .06 * land).toFixed(3)})`;
  }
  function buildCritters() {
    document.querySelectorAll('.zone > svg.critter, .pad > svg.critter').forEach(s => s.remove());
    critters.clear();
    document.querySelectorAll('.zone').forEach(el => { const c = MAIN4[el.dataset.zone] ? buildCharacter(el) : buildDrum(el); if (c) critters.set(el, c); });
    critterList = [...critters.values()];
    buildTrackpadCells();
    const tp = document.querySelector('.trackpad');
    if (tp && !tp.querySelector(':scope > svg.frame')) {
      const svg = mk('svg', { class: 'frame', viewBox: '0 0 640 400', 'aria-hidden': 'true' });
      const d = rrect(0, 0, 640, 400, 26);
      mk('path', { d, fill: C.pad, stroke: T.night, 'stroke-width': T1 }, svg);
      mk('path', { d: rrect(5, 5, 630, 390, 22), fill: 'none', stroke: rgba(T.cream, .12), 'stroke-width': T3 }, svg);
      tp.insertBefore(svg, tp.firstChild);
    }
  }

  // pad geometry in stage units (for wedges and words), read from layout, not from transformed rects
  function padBox(el) { return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }; }

  // ------------------------------------------------------------ the cushion (canvas, hero): revision 2
  // A real whoopee cushion seen at 3/4: a round disc (two sheets glued at a crimped rim), a short flat
  // tapered neck at 4 o'clock with a rolled lip, matte rubber, creases when slack. Air thickens the side
  // wall and smooths the rim; the disc never shrinks, so it reads as a cushion even when flat.
  function makeCushion() {
    return { air: 0, squash: 0, squashV: 0, flat: 0, flatHold: 0, flap: 0, flapV: 0, blinkAt: 2, blinkT: -9, sad: 0, deadpan: 0,
      mouth: 0, oMouth: 0, look: { x: .1, y: .15 }, lookT: { x: .1, y: .15 }, lookUntil: 0, shut: 0 };
  }
  const cushion = makeCushion();
  const CU_SHADE = mix(T.pink, T.night, .26), CU_TONGUE = mix(T.pink, T.cream, .35);
  function stepCushion(st, dt, targetAir, t, frozen) {
    st.air = lerp(st.air, targetAir, 1 - Math.exp(-dt * 5));
    st.squashV += (-260 * st.squash - 12 * st.squashV) * dt;
    st.squash = clamp(st.squash + st.squashV * dt, -.12, .3);
    st.flapV += (-1500 * st.flap - 14 * st.flapV) * dt;           // about two flaps in 160 ms
    st.flap = clamp(st.flap + st.flapV * dt, -1, 1);
    if (t > st.flatHold) st.flat = Math.max(0, st.flat - dt / .25);
    st.sad = Math.max(0, st.sad - dt / 1.6);
    st.oMouth = Math.max(0, st.oMouth - dt / .3);
    st.shut = Math.max(0, st.shut - dt / .22);
    st.deadpan = Math.max(0, st.deadpan - dt / 1.6);
    if (t > st.lookUntil) { st.lookT.x = .1; st.lookT.y = .15; }
    const k = 1 - Math.exp(-dt * 16);
    st.look.x = lerp(st.look.x, st.lookT.x, k); st.look.y = lerp(st.look.y, st.lookT.y, k);
    if (!frozen && t > st.blinkAt) { st.blinkT = t; st.blinkAt = t + 3 + rand() * 3; }
  }
  function rimPath(ctx, cx, cy, r, yr, dy, wob) {
    ctx.beginPath();
    for (let i = 0; i <= 72; i++) {
      const t = i / 72 * TAU, w = wob * Math.sin(t * 9 + .6);
      const x = cx + (r + w) * Math.cos(t), y = cy + dy + (yr + w * .6) * Math.sin(t);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  }
  // g: { cx, cy (disc centre), R (disc radius) }
  function drawCushion(ctx, rc, st, g, t, level) {
    const air = clamp(st.air, 0, 1);
    const calm = RM || st.deadpan > .3 || st.flat > .1;
    const breathe = calm ? 0 : Math.sin(t * (2 + air * 4)) * (.006 + .01 * air);
    const tremble = calm ? 0 : Math.max(0, air - .85) * 5 * Math.sin(t * 57);
    const sq = clamp(st.squash + st.flat * .3, -.03, .4);           // no stretch: the top never rises into the hinge
    const sy = 1 - sq + breathe, sx = 1 + sq * .83 - breathe * .5;
    const R = g.R, ry = R * .6, wall = (10 + 30 * air) * (1 - st.flat * .6), slack = 5 * (1 - air) + st.flat * 2;
    const floor = g.cy + ry + wall;                                  // squash keeps the bottom on the keys
    ctx.save();
    ctx.translate(g.cx + tremble, floor);
    ctx.fillStyle = rgba(T.night, .6);
    ctx.beginPath(); ctx.ellipse(0, -6, R * .95 * sx, 10, 0, 0, TAU); ctx.fill();   // stays 24 px clear of the trackpad
    ctx.scale(sx, sy);
    ctx.translate(0, -(ry + wall));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = C.ink;
    // Direction B "valve lips": a smooth puffy pillow (top sheet + thick side wall, no lumpy rim) and the
    // nozzle on the right ends in a pair of rubber lips that lipOpen and flap on every fart and note.
    const lipOpen = clamp(Math.max(st.flat, st.oMouth, (st.playing || 0) * clamp(level, 0, 1) * 1.4, Math.abs(st.flap) * .8), 0, 1);
    const a0 = .2, base = [R * Math.cos(a0) - 6, ry * Math.sin(a0) + wall * .5];
    const na = .12 + st.flap * .16 + st.sad * .25;                    // the tube droops when sad, flaps when it farts
    const dir = [Math.cos(na), Math.sin(na)], nrm = [-dir[1], dir[0]];
    const L = R * .24, hw0 = R * .11, hw1 = R * .09;
    const end = [base[0] + dir[0] * L, base[1] + dir[1] * L];
    // tube (drawn first, the body sits on top of its root)
    ctx.fillStyle = C.pink; ctx.lineWidth = T2;
    ctx.beginPath();
    ctx.moveTo(base[0] - dir[0] * 30 + nrm[0] * hw0, base[1] - dir[1] * 30 + nrm[1] * hw0);
    ctx.lineTo(end[0] + nrm[0] * hw1, end[1] + nrm[1] * hw1);
    ctx.lineTo(end[0] - nrm[0] * hw1, end[1] - nrm[1] * hw1);
    ctx.lineTo(base[0] - dir[0] * 30 - nrm[0] * hw0, base[1] - dir[1] * 30 - nrm[1] * hw0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.globalAlpha = .9; ctx.fillStyle = CU_SHADE;            // cel tone on the tube's underside
    ctx.beginPath();
    ctx.moveTo(base[0] - nrm[0] * hw0 * .2, base[1] - nrm[1] * hw0 * .2); ctx.lineTo(end[0] - nrm[0] * hw1 * .2, end[1] - nrm[1] * hw1 * .2);
    ctx.lineTo(end[0] - nrm[0] * (hw1 - 3), end[1] - nrm[1] * (hw1 - 3)); ctx.lineTo(base[0] - nrm[0] * (hw0 - 3), base[1] - nrm[1] * (hw0 - 3));
    ctx.closePath(); ctx.fill(); ctx.restore();
    // lips: two rounded lobes at the tube's end, the mouth between them opens with "lipOpen"
    ctx.save(); ctx.translate(end[0], end[1]); ctx.rotate(na);
    const lipH = hw1 * 1.7, gap = 3 + lipOpen * hw1 * 1.2, lipW = R * .1;
    ctx.fillStyle = C.ink;
    ctx.beginPath(); ctx.ellipse(lipW * .55, 0, lipW * .55, gap, 0, 0, TAU); ctx.fill();          // dark mouth
    ctx.fillStyle = C.pinkDeep; ctx.strokeStyle = C.ink; ctx.lineWidth = T2;
    ctx.beginPath(); ctx.ellipse(lipW * .5, -gap - lipH * .42, lipW, lipH * .5, -lipOpen * .25, 0, TAU); ctx.fill(); ctx.stroke();   // top lip
    ctx.beginPath(); ctx.ellipse(lipW * .5, gap + lipH * .42, lipW, lipH * .5, lipOpen * .25, 0, TAU); ctx.fill(); ctx.stroke();    // bottom lip
    ctx.strokeStyle = rgba(T.cream, .5); ctx.lineWidth = T3;
    ctx.beginPath(); ctx.ellipse(lipW * .5, -gap - lipH * .42, lipW * .6, lipH * .25, -lipOpen * .25, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
    if (lipOpen > .35 && !RM) {                                          // spray ticks fly out of the lips
      ctx.strokeStyle = C.green; ctx.lineWidth = T2; ctx.lineCap = 'round';
      const k = 10 + lipOpen * 14, x0 = lipW * 1.7;
      ctx.beginPath();
      ctx.moveTo(x0, -gap * 1.4); ctx.lineTo(x0 + k, -gap * 1.4 - k * .6);
      ctx.moveTo(x0 + 4, 0); ctx.lineTo(x0 + 4 + k * 1.2, 0);
      ctx.moveTo(x0, gap * 1.4); ctx.lineTo(x0 + k, gap * 1.4 + k * .6);
      ctx.stroke();
    }
    ctx.restore();
    if (st === cushion) st.tip = { x: g.cx + (end[0] + dir[0] * lipW * 1.5) * sx, y: floor + (end[1] - ry - wall) * sy };
    // side wall: a smooth thick band (thin and flat at zero air, fat and puffy when full)
    ctx.strokeStyle = C.ink; ctx.lineWidth = T1;
    ctx.beginPath(); ctx.ellipse(0, wall, R, ry, 0, 0, Math.PI); ctx.lineTo(-R, 0); ctx.ellipse(0, 0, R, ry, 0, Math.PI, 0, true); ctx.closePath();
    ctx.fillStyle = C.pinkDeep; ctx.fill(); ctx.stroke();
    // top sheet: flat pink, one cel tone on the far side, a soft lighter-pink highlight arc, cream rim light
    ctx.beginPath(); ctx.ellipse(0, 0, R, ry, 0, 0, TAU); ctx.fillStyle = CU_SHADE; ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, R, ry, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = C.pink; ctx.beginPath(); ctx.ellipse(-R * .05, -ry * (.1 + .05 * air), R * .98, ry * .92, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = mix(T.pink, T.cream, .55); ctx.lineWidth = 12 + 6 * air; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(-R * .08, -ry * .05, R * .78, ry * .7, 0, Math.PI * 1.13, Math.PI * 1.42); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = C.ink; ctx.lineWidth = T1;
    ctx.beginPath(); ctx.ellipse(0, 0, R, ry, 0, 0, TAU); ctx.stroke();
    // glued seam: a dotted stitch ring just inside the rim
    ctx.save(); ctx.globalAlpha = .55; ctx.lineWidth = T3; ctx.setLineDash([2, 10]); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(0, 0, R - 16, ry - 11, 0, 0, TAU); ctx.stroke(); ctx.restore();
    // two soft creases only when nearly empty
    if (air < .3) {
      ctx.globalAlpha = .45 * (1 - air / .3); ctx.lineWidth = T3;
      [[-.5, .4, 15], [.4, .45, -20]].forEach(([u, v, rot]) => {
        ctx.save(); ctx.translate(u * R * .8, v * ry * .8); ctx.rotate(rot * Math.PI / 180);
        ctx.beginPath(); ctx.moveTo(-16, 0); ctx.quadraticCurveTo(0, -8, 16, 0); ctx.stroke(); ctx.restore();
      });
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // face, unsquashed so the eyes keep their shape
    const es = R * .11, ey = floor + (-(ry + wall) - ry * .18) * sy;
    const bp = t - st.blinkT, blink = bp < .13 ? Math.sin(bp / .13 * Math.PI) : 0;
    const sleepy = air < .15 && st.flat < .1 && st.oMouth < .05;
    [-1, 1].forEach((s, i) => drawEye(ctx, g.cx + tremble + s * es * 2, ey, es, st, blink, i, sleepy));
    const mx = g.cx + tremble, my = ey + es * 2.1;
    ctx.strokeStyle = C.ink; ctx.fillStyle = C.ink; ctx.lineWidth = T2; ctx.lineCap = 'round';
    const open = Math.max(st.mouth, st.flat > .1 ? .9 : 0);
    if (open > .08) {
      const mw = es * .62 * (1 - .15 * open), mh = es * (.35 + .55 * open);
      ctx.beginPath(); ctx.ellipse(mx, my, mw, mh, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.clip(); ctx.fillStyle = CU_TONGUE; ctx.beginPath(); ctx.ellipse(mx, my + mh * .75, mw * .7, mh * .4, 0, 0, TAU); ctx.fill(); ctx.restore();
    } else if (st.oMouth > .05) {
      ctx.beginPath(); ctx.ellipse(mx, my, es * .45, es * .55, 0, 0, TAU); ctx.fill();
    } else if (st.sad > .2 || sleepy) {
      ctx.beginPath(); ctx.moveTo(mx - 12, my + 4); ctx.quadraticCurveTo(mx, my - 5, mx + 12, my + 4); ctx.stroke();
    } else if (st.deadpan > .3) {
      ctx.beginPath(); ctx.moveTo(mx - 12, my); ctx.lineTo(mx + 12, my); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(mx - 14, my); ctx.quadraticCurveTo(mx, my + 12, mx + 14, my); ctx.stroke();
    }
  }
  function drawEye(ctx, x, y, r, st, blink, i, sleepy) {
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = C.ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (st.flat > .3 || st.shut > .3) {                              // squeezed shut: > <
      ctx.lineWidth = T2; const s = i === 0 ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(-r * .8 * s, -r * .7); ctx.lineTo(r * .5 * s, 0); ctx.lineTo(-r * .8 * s, r * .7); ctx.stroke();
      ctx.restore(); return;
    }
    const sy = 1 - .9 * blink;
    ctx.fillStyle = C.cream; ctx.lineWidth = T2;
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * sy, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = C.ink;
    ctx.beginPath(); ctx.arc(st.look.x * r * .45, (st.look.y * r * .45 + (sleepy ? 3 : 0)) * sy, r * .45, 0, TAU); ctx.fill();
    const lid = Math.max(st.deadpan * .48, st.sad * .5, sleepy ? .45 : 0);
    if (lid > .02) {
      const tilt = st.sad * r * .5 * (i === 0 ? -1 : 1), ly = -r + 2 * r * lid;
      ctx.fillStyle = C.pink;
      ctx.beginPath(); ctx.moveTo(-r - 2, -r - 2); ctx.lineTo(r + 2, -r - 2); ctx.lineTo(r + 2, ly + tilt); ctx.lineTo(-r - 2, ly - tilt); ctx.closePath(); ctx.fill();
      ctx.lineWidth = T2; ctx.beginPath(); ctx.moveTo(-r, ly - tilt); ctx.lineTo(r, ly + tilt); ctx.stroke();
    }
    ctx.restore();
    ctx.lineWidth = T2; ctx.beginPath(); ctx.ellipse(0, 0, r, r * sy, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------ board: loop beads and speaker grilles
  let boardKey = '';
  let analyser = null, fbuf = null, tbuf = null, level = 0;
  const bands = [0, 0, 0, 0];
  const dimGrille = { L: 0, R: 0 };
  function readAudio(dt) {
    if (!analyser) { level = Math.max(0, level - dt * 3); bands.fill(0); return; }
    analyser.getFloatTimeDomainData(tbuf);
    let s = 0;
    for (let i = 0; i < tbuf.length; i += 2) s += tbuf[i] * tbuf[i];
    const target = clamp(Math.sqrt(s / (tbuf.length / 2)) * 4.5, 0, 1);
    level = target > level ? lerp(level, target, .7) : lerp(level, target, 1 - Math.exp(-dt * 12));
    analyser.getByteFrequencyData(fbuf);
    const ranges = [[1, 3], [3, 6], [6, 13], [13, 40]];
    ranges.forEach(([a, b], i) => {
      let m = 0; for (let j = a; j < b; j++) m = Math.max(m, fbuf[j]);
      const v = clamp((m - 90) / 140, 0, 1);
      bands[i] = v > bands[i] ? v : Math.max(0, bands[i] - dt * 2.2);
    });
  }
  function drawBoard(f, t) {
    const B = canvases.board; if (!B) return;
    const steps = f.steps || 32;
    const rec = new Set((f.events || []).map(e => Math.floor(e.step / (steps / 16))));
    const head = f.looping ? Math.floor(f.loopPos * 16) % 16 : 0;
    const lit = bands.map(b => Math.round(b * 11));
    const dl = t < dimGrille.L, dr = t < dimGrille.R;
    const key = `${[...rec].join(',')}|${head}|${f.recording ? 1 : 0}|${lit.join(',')}|${dl ? 1 : 0}${dr ? 1 : 0}`;
    if (key === boardKey) return;
    boardKey = key;
    const ctx = B.ctx;
    ctx.clearRect(440, 76, 520, 34);
    ctx.clearRect(GRILLE.lx - 8, GRILLE.y - 8, 72, 304);
    ctx.clearRect(GRILLE.rx - 8, GRILLE.y - 8, 72, 304);
    // beads: Pocket Operator style step lights
    ctx.font = '800 15px Gluten'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = f.recording ? C.pink : rgba(T.cream, .8);
    ctx.fillText(f.recording ? 'rec' : 'loop', 500, 99);
    for (let i = 0; i < 16; i++) {
      const x = BEAD.x + i * BEAD.dx, cur = i === head;
      ctx.fillStyle = rec.has(i) ? C.pink : rgba(T.cream, cur ? .9 : .22);
      ctx.beginPath(); ctx.arc(x, BEAD.y, cur ? 10 : 7.5, 0, TAU); ctx.fill();
      if (cur) { ctx.strokeStyle = T.cream; ctx.lineWidth = 3; ctx.stroke(); }
    }
    // speaker grilles = spectrum: ink dots at 28%, lit pink from the bottom up
    for (const [x0, dim] of [[GRILLE.lx, dl], [GRILLE.rx, dr]]) {
      for (let r = 0; r < GRILLE.rows; r++) for (let c = 0; c < GRILLE.cols; c++) {
        const on = (GRILLE.rows - 1 - r) < lit[c];
        ctx.globalAlpha = dim ? .1 : (on ? 1 : .16);
        ctx.fillStyle = on ? C.pink : T.cream;
        ctx.beginPath(); ctx.arc(x0 + c * GRILLE.dx, GRILLE.y + r * GRILLE.dy, 4, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------ haze: discrete outlined bands behind everything
  let hazeLevel = 0, hazeKey = '', hazeT = 0, wipe = null;
  function drawHaze(t) {
    const Hz = canvases.haze; if (!Hz) return;
    const L = clamp(hazeLevel / 100, 0, 1);
    const tq = RM ? 0 : Math.round(t * 8) / 8;
    const wx = wipe ? wipe.x : -1;
    const key = `${Math.round(L * 200)}|${tq}|${Math.round(wx)}`;
    if (key === hazeKey) return;
    hazeKey = key;
    const ctx = Hz.ctx;
    ctx.clearRect(0, 560, W, 340);
    if (L < .01) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(82, 560, 1276, 297);                  // inside the deck, clear of the rails and the outline
    if (wx > -1) { ctx.rect(82, 560, Math.max(0, wx - 82), 297); }
    ctx.clip(wx > -1 ? 'evenodd' : 'nonzero');
    const total = DECK.h * .3 * L, n = L > .8 ? 5 : (L > .5 ? 4 : 3), bottom = 857;
    for (let k = n - 1; k >= 0; k--) {
      const top = bottom - total * (k + 1) / n;
      ctx.beginPath(); ctx.moveTo(82, bottom);
      for (let x = 82; x <= 1358; x += 12) ctx.lineTo(x, top + Math.sin(x * .012 + tq * .9 + k * 1.7) * 7 + Math.sin(x * .031 - tq * .6 + k) * 3);
      ctx.lineTo(1358, bottom); ctx.closePath();
      ctx.fillStyle = rgba(T.lime, .2); ctx.fill();
      ctx.beginPath();
      for (let x = 82; x <= 1358; x += 12) { const y = top + Math.sin(x * .012 + tq * .9 + k * 1.7) * 7 + Math.sin(x * .031 - tq * .6 + k) * 3; x === 82 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.strokeStyle = rgba(T.lime, .55); ctx.lineWidth = T3; ctx.stroke();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ fx: impact wedges, sound words, squiggles, freshener
  const wedges = [], words = [], squiggles = [], vpuffs = [];
  let can = null;
  const dirty = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
  const mark = (x0, y0, x1, y1) => { dirty.x0 = Math.min(dirty.x0, x0); dirty.y0 = Math.min(dirty.y0, y0); dirty.x1 = Math.max(dirty.x1, x1); dirty.y1 = Math.max(dirty.y1, y1); };
  let word46 = {};
  function measureWords() {
    const ctx = canvases.fx && canvases.fx.ctx; if (!ctx) return;
    ctx.font = '900 44px Gluten';
    for (const z in WORDS) word46[z] = ctx.measureText(WORDS[z]).width;
  }
  // where each pad's sound word sits: inner side over the grille (top pads), above the pad (bottom pads, 4 squares)
  function wordSpot(z) {
    const top = z === 'LT' || z === 'RT';
    const left = z[0] === 'L';
    if (top) return { x: left ? 208 : 1232, y: z === 'LT' ? 178 : 168, align: 'center', maxW: 168 };   // the gap above the pad
    if (!eight) return { x: left ? 208 : 1232, y: z === 'LB' ? 598 : 590, align: 'center', maxW: 168 };
    const el = document.querySelector(`.zone[data-zone="${z}"]`), b = padBox(el);
    return { x: left ? 306 : 1134, y: b.y + b.h / 2 + 16, align: left ? 'left' : 'right', maxW: 98, grille: b.y + b.h / 2 < 440 };   // 8 squares: the gutter is narrow, words shrink
  }
  function addSideTap(c, vel, t) {
    const z = c.zone, b = padBox(c.el), left = c.side === 'L';
    const n = 3 + Math.round(clamp(vel, 0, 1) * 4);
    const y0 = b.y + b.h * .14, y1 = b.y + b.h * .86, mid = (y0 + y1) / 2;
    for (let i = 0; i < n; i++) {
      const y = n === 1 ? mid : y0 + (y1 - y0) * i / (n - 1);
      const edge = 1 - Math.abs(y - mid) / ((y1 - y0) / 2 || 1);
      const len = 22 + 12 * vel * (.4 + .6 * edge);               // 22 to 34 px: never reaches the pad
      wedges.push({ x: left ? RAIL.lx + RAIL.w + 6 : RAIL.rx - 6, y, len, dir: left ? 1 : -1, tilt: (y - mid) * .06, t0: t });
    }
    const sp = wordSpot(z);
    words.push({ z, text: WORDS[z], ...sp, size: Math.min(44, 44 * sp.maxW / (word46[z] || 140)), col: c.col || C.pink, t0: t });
    if (sp.grille) dimGrille[c.side] = t + .4;
    for (let i = words.length - 2; i >= 0; i--) if (words[i].z === z) words.splice(i, 1);
  }
  function drawFx(t) {
    const F = canvases.fx; if (!F) return;
    const ctx = F.ctx;
    if (dirty.x1 > dirty.x0) ctx.clearRect(dirty.x0 - 4, dirty.y0 - 4, dirty.x1 - dirty.x0 + 8, dirty.y1 - dirty.y0 + 8);
    dirty.x0 = dirty.y0 = 1e9; dirty.x1 = dirty.y1 = -1e9;
    // wedges: solid ink, only in the 44 px gutter, fade over 160 ms
    ctx.fillStyle = C.cream;
    for (let i = wedges.length - 1; i >= 0; i--) {
      const w = wedges[i], p = (t - w.t0) / .16;
      if (p >= 1) { wedges.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - p * p;
      const x1 = w.x + w.dir * w.len;
      ctx.beginPath(); ctx.moveTo(w.x, w.y - 4); ctx.lineTo(x1, w.y + w.tilt); ctx.lineTo(w.x, w.y + 4); ctx.closePath(); ctx.fill();
      mark(Math.min(w.x, x1), w.y - 8, Math.max(w.x, x1), w.y + 8 + Math.abs(w.tilt));
    }
    ctx.globalAlpha = 1;
    // sound words: pop in at 1.15, settle, gone by 400 ms
    for (let i = words.length - 1; i >= 0; i--) {
      const w = words[i], p = (t - w.t0) / .4;
      if (p >= 1) { words.splice(i, 1); continue; }
      const s = RM ? 1 : (p < .15 ? 1.15 - .15 * easeOut(p / .15) : 1);
      ctx.save();
      ctx.font = `900 ${f1(w.size)}px Gluten`; ctx.textBaseline = 'alphabetic';
      const tw = ctx.measureText(w.text).width;
      const cx = w.align === 'left' ? w.x + tw / 2 : (w.align === 'right' ? w.x - tw / 2 : w.x);
      ctx.translate(cx, w.y - w.size * .3); ctx.rotate(-10 * Math.PI / 180); ctx.scale(s, s);
      ctx.textAlign = 'center'; ctx.lineJoin = 'round';
      ctx.strokeStyle = C.ink; ctx.lineWidth = T1; ctx.strokeText(w.text, 0, w.size * .3);
      ctx.fillStyle = w.col; ctx.fillText(w.text, 0, w.size * .3);
      ctx.restore();
      mark(cx - tw * .65 - 10, w.y - w.size * 1.2 - 16, cx + tw * .65 + 10, w.y + w.size * .5 + 16);
    }
    // squiggles: only from the valve, inside the keyboard area
    ctx.strokeStyle = rgba(T.lime, .9); ctx.lineWidth = T3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const s of squiggles) {
      const q = s.life / s.dur, y0 = s.y0 - 150 * q;
      if (y0 - s.len < 148) continue;
      ctx.globalAlpha = Math.sin(Math.PI * q) * .8;
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) { const y = y0 - i / 8 * s.len, x = s.x + Math.sin(s.ph + i * .8 + t * 4) * 5; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      mark(s.x - 9, y0 - s.len - 4, s.x + 9, y0 + 4);
    }
    ctx.globalAlpha = 1;
    // small air puffs out of the valve when a note plays (detail tier outline)
    for (let i = vpuffs.length - 1; i >= 0; i--) {
      const v = vpuffs[i], p = (t - v.t0) / v.dur;
      if (p >= 1) { vpuffs.splice(i, 1); continue; }
      if (p < 0) continue;
      const r = v.r * (p < .3 ? easeOutBack(p / .3) : 1 - easeIn((p - .3) / .7));
      if (r < 1) continue;
      const x = v.x + v.vx * (t - v.t0), y = v.y + v.vy * (t - v.t0);
      ctx.fillStyle = C.blue; ctx.strokeStyle = C.ink; ctx.lineWidth = T3;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
      mark(x - r - 3, y - r - 3, x + r + 3, y + r + 3);
    }
    // freshener: a spray can drops in on the right grille and sprays the cushion, the haze wipes away
    if (can) {
      const p = (t - can.t0) / 1.1;
      if (p >= 1) can = null;
      else {
        const inP = clamp(p / .2, 0, 1), outP = clamp((p - .8) / .2, 0, 1);
        const x = 1046, y = 150 + 40 * easeOutBack(inP) - 60 * easeIn(outP);
        ctx.globalAlpha = 1 - outP;
        ctx.lineJoin = 'round'; ctx.strokeStyle = C.ink; ctx.lineWidth = T2;
        ctx.fillStyle = C.blue; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y + 26, 60, 120, 10) : ctx.rect(x, y + 26, 60, 120); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.cream; ctx.fillRect(x + 2, y + 66, 56, 34); ctx.lineWidth = T3; ctx.strokeRect(x + 2, y + 66, 56, 34);
        ctx.fillStyle = C.ink; ctx.fillRect(x + 16, y + 4, 28, 22); ctx.fillRect(x + 2, y + 8, 14, 7);
        for (let k = 0; k < 3; k++) {
          const q = (p - .18 - k * .12) / .3;
          if (q <= 0 || q >= 1) continue;
          const r = 14 * (q < .3 ? easeOutBack(q / .3) : 1 - easeIn((q - .3) / .7)) + 1;
          ctx.fillStyle = C.cream; ctx.lineWidth = T3;
          ctx.beginPath(); ctx.arc(x - 10 - q * 30, y + 14 - k * 8, r, 0, TAU); ctx.fill(); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        mark(x - 70, y - 20, x + 66, y + 150);
      }
    }
  }

  // ------------------------------------------------------------ burst: punchline cloud and uncle captions
  let punch = null, caption = null, burstDrawn = false;
  const dimEl = document.getElementById('dim');
  const spaceEl = document.querySelector('.spacebar');
  const captionEl = document.getElementById('caption');
  let dimUntil = 0;
  function setDim(on) { if (dimEl) dimEl.classList.toggle('on', !!on); }
  function startPunch(name, t) {
    const big = name === 'fart_03' || name === 'synth_crash' || name === 'synth_slow';
    const tip = cushion.tip || { x: 1030, y: 340 };
    const grow = name === 'synth_slow' ? DUR.synth_slow : .18;
    punch = { name, t0: t, grow, hold: .45, exit: .6, from: tip, cx: 720, cy: 536, rx: big ? 360 : 300, ry: big ? 262 : 210,
      word: PUNCH_WORD[name], seed: rand() * 6, puffs: null };
    caption = null;
    if (spaceEl) spaceEl.classList.remove('hush');
    setDim(true);
  }
  function cloudPath(ctx, cx, cy, rx, ry, seed) {
    ctx.beginPath();
    const n = 96;
    for (let i = 0; i <= n; i++) {
      const th = i / n * TAU, sc = Math.abs(Math.sin(6 * th + seed));            // 12 lobes
      const k = .9 + .1 * sc;
      const x = cx + Math.cos(th) * rx * k, y = cy + Math.sin(th) * ry * k;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  }
  function drawBurst(t) {
    const B = canvases.burst; if (!B) return;
    const busy = punch || caption;
    if (!busy && !burstDrawn) return;
    const ctx = B.ctx;
    ctx.clearRect(0, 0, W, H);
    burstDrawn = !!busy;
    if (punch) {
      const P = punch, e = t - P.t0;
      const total = P.grow + P.hold + P.exit;
      if (e >= total) { punch = null; setDim(false); }
      else {
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        if (e < P.grow + P.hold) {
          const g = RM ? 1 : (P.name === 'synth_slow' ? easeOut(clamp(e / P.grow, 0, 1)) * .75 + .25 : easeOut(clamp(e / P.grow, 0, 1)));
          const k = clamp(g, 0, 1);
          const cx = lerp(P.from.x, P.cx, clamp(g, 0, 1)), cy = lerp(P.from.y, P.cy, clamp(g, 0, 1));
          const rx = P.rx * k, ry = P.ry * k;
          // flat lime, one cel tone underneath, cream rim light on top, thick night outline
          cloudPath(ctx, cx, cy, rx, ry, P.seed);
          ctx.fillStyle = C.limeDeep; ctx.fill();
          ctx.save(); ctx.clip();
          cloudPath(ctx, cx - rx * .03, cy - ry * .1, rx * .98, ry * .94, P.seed); ctx.fillStyle = C.green; ctx.fill();
          ctx.strokeStyle = rgba(T.cream, .6); ctx.lineWidth = T2;
          ctx.beginPath(); ctx.ellipse(cx - rx * .03, cy - ry * .1, rx * .86, ry * .8, 0, Math.PI * 1.1, Math.PI * 1.55); ctx.stroke();
          ctx.restore();
          cloudPath(ctx, cx, cy, rx, ry, P.seed);
          ctx.strokeStyle = C.ink; ctx.lineWidth = T1; ctx.stroke();
          if (k > .6) {                                                 // 8 speed lines just outside the outline
            ctx.lineWidth = T2; ctx.strokeStyle = C.cream;
            for (const deg of [10, 195, 228, 262, 298, 332]) {        // none point at the bank tabs or the squares
              const th = deg / 360 * TAU;
              ctx.beginPath();
              ctx.moveTo(cx + Math.cos(th) * rx * 1.07, cy + Math.sin(th) * ry * 1.07);
              ctx.lineTo(cx + Math.cos(th) * rx * 1.17, cy + Math.sin(th) * ry * 1.17);
              ctx.stroke();
            }
          }
          let word = P.word;
          if (P.name === 'synth_slow') word = 'p' + 'f'.repeat(1 + Math.floor(clamp(e / P.grow, 0, 1) * 7)) + (e > P.grow * .7 ? '...' : '');
          ctx.font = '900 104px Gluten'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          const tw = ctx.measureText(word).width, fs = Math.min(104, 104 * (rx * 1.65) / tw);
          if (fs > 20) {
            ctx.font = `900 ${f1(fs)}px Gluten`;
            ctx.fillStyle = C.ink; ctx.fillText(word, cx, cy + ry * .38);
          }
        } else {
          // exit: the cloud splits into small outlined puffs that drift up and fade
          // six small puffs leave beside the space bar and drift up behind the cushion (never over a label)
          if (!P.puffs) { P.puffs = [440, 478, 516, 924, 962, 1000].map((x, i) => ({ x, y: 404 - (i % 3) * 6, r: 16 + (i % 3) * 3 })); setDim(false); }
          const q = (e - P.grow - P.hold) / P.exit;
          ctx.globalAlpha = 1 - q;
          ctx.lineWidth = T2; ctx.strokeStyle = C.ink; ctx.fillStyle = C.green;
          for (const p of P.puffs) {
            const y = p.y - 150 * easeOut(q);
            ctx.beginPath(); ctx.arc(p.x, y, p.r * (1 - .3 * q), 0, TAU); ctx.fill(); ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }
    }
    if (caption && t - caption.t0 > caption.dur) { caption = null; if (!punch) setDim(false); }
  }
  // the uncle's words: a subtitle across the cushion's lower half (the trackpad stays clear for the next press)
  function drawCaption(ctx, t) {
    if (!caption) return;
    const e = t - caption.t0, s = RM ? 1 : (e < .12 ? .7 + .3 * easeOutBack(e / .12) : 1);
    ctx.save(); ctx.translate(700, 384); ctx.scale(s, s);
    ctx.font = '900 104px Gluten'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    ctx.strokeStyle = C.night; ctx.lineWidth = 16; ctx.strokeText(caption.text, 0, 30);
    ctx.fillStyle = C.cream; ctx.fillText(caption.text, 0, 30);
    ctx.restore();
  }

  // ------------------------------------------------------------ audio level for mouths and grilles
  FB.bus.addEventListener('audio-ready', e => {
    try {
      const { master, context } = e.detail;
      analyser = context.createAnalyser();
      analyser.fftSize = 512; analyser.smoothingTimeConstant = .5;
      fbuf = new Uint8Array(analyser.frequencyBinCount);
      tbuf = new Float32Array(analyser.fftSize);
      master.connect(analyser);
    } catch (err) { analyser = null; }
    requestAnimationFrame(layout);
  });

  // ------------------------------------------------------------ layout
  const laptopEl = document.querySelector('.laptop');
  let measured = false;
  function layout() {
    eight = !!document.querySelector('.zone.extra:not(.disabled)');
    if (laptopEl) laptopEl.classList.toggle('eight', eight);
    if (hasGsap) gsap.set('.zone, .pad', { clearProps: 'transform' });
    fit();
    buildDeck();
    buildCritters();
    measureWords();
    measured = true;
  }
  let resizeTimer;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(fit, 100); });
  const extrasObs = new MutationObserver(() => {
    const on = !!document.querySelector('.zone.extra:not(.disabled)');
    if (on !== eight) requestAnimationFrame(layout);
  });
  document.querySelectorAll('.zone.extra').forEach(z => extrasObs.observe(z, { attributes: true, attributeFilter: ['class'] }));

  // ------------------------------------------------------------ reactions
  let freezeUntil = 0, endcard = document.body.classList.contains('show-endcard');
  const rig = document.querySelector('.rig');
  const cushionCv = document.getElementById('cushion');
  function flashRail(z) {
    const r = railEls[z]; if (!r) return;
    r.fill.setAttribute('fill', C.pink); r.shade.setAttribute('fill', C.pinkDeep);
    clearTimeout(r.timer);
    r.timer = setTimeout(() => { r.fill.setAttribute('fill', C.silver); r.shade.setAttribute('fill', mix(C.silver, T.night, .22)); }, 220);
    if (hasGsap && !RM) gsap.fromTo(r.g, { x: r.side === 'L' ? 4 : -4 }, { x: 0, duration: .22, ease: 'elastic.out(1, 0.45)', overwrite: true });
  }
  function ouch(el, ms) {
    el.classList.add('ouch');
    clearTimeout(el._ouch);
    el._ouch = setTimeout(() => el.classList.remove('ouch'), ms);
  }
  function lookAt(x, y, t) {
    const dx = x - CUSH.cx, dy = y - CUSH.cy, d = Math.hypot(dx, dy) || 1;
    cushion.lookT.x = dx / d; cushion.lookT.y = clamp(dy / d, -.6, .8); cushion.lookUntil = t + 1.1;
  }

  // mouths: MorphSVG between a closed smile and a wide-open O (same path structure), plain swap without the plugin
  function openMouth(c, hold) {
    if (!c.mouth) return;
    if (P.MorphSVGPlugin && !RM) {
      gsap.timeline({ overwrite: true }).to(c.mouth, { morphSVG: c.openD, duration: .04, ease: 'power2.out' })
        .to(c.mouth, { morphSVG: c.shutD, duration: .14, ease: 'power2.in' }, `+=${hold}`);
    } else { c.mouth.setAttribute('d', c.openD); clearTimeout(c._m); c._m = setTimeout(() => c.mouth.setAttribute('d', c.shutD), hold * 1000 + 80); }
  }
  // little fart puffs that arc off a performer's mouth (Physics2D), pooled DOM dots in the performer's colour
  const brapPool = [];
  function braps(c, v) {
    const b = padBox(c.el), n = 2 + Math.round(v);
    const host = document.querySelector('.rig');
    for (let i = 0; i < n; i++) {
      let d = brapPool.find(x => !x._busy);
      if (!d) { d = document.createElement('i'); d.className = 'brap'; host.appendChild(d); brapPool.push(d); }
      d._busy = true;
      let dir = c.side === 'L' ? 1 : -1, sz = .6 + rand() * .6, x0 = b.x + b.w / 2 + dir * b.w * .3, y0 = b.y + b.h * .42, vel = 260 + rand() * 160, ang = dir > 0 ? -75 + rand() * 30 : -105 - rand() * 30, grav = 900;
      if (c.who === 'kick') { dir = i % 2 ? 1 : -1; x0 = b.x + b.w / 2 + dir * b.w * .3; y0 = b.y + b.h - 6; vel = 120 + rand() * 60; ang = dir > 0 ? -12 : -168; grav = 60; sz = .7 + rand() * .5; }
      if (c.who === 'wet') { dir = i % 2 ? 1 : -1; x0 = b.x + b.w / 2 + dir * 44; y0 = b.y + b.h * .22; vel = 170 + rand() * 80; ang = dir > 0 ? -35 - rand() * 15 : -145 + rand() * 15; grav = 1100; sz = .5 + rand() * .4; }
      d.style.background = c.who === 'kick' ? mix(T.cream, T.night, .55) : c.col;
      gsap.killTweensOf(d);
      gsap.set(d, { left: x0, top: y0, x: 0, y: 0, scale: sz, opacity: 1 });
      gsap.to(d, { duration: .55, physics2D: { velocity: vel, angle: ang, gravity: grav }, ease: 'none' });
      gsap.to(d, { opacity: 0, scale: sz * .4, duration: .2, delay: .35, onComplete: () => { d._busy = false; } });
    }
  }
  FB.bus.addEventListener('hit', e => {
    const { name = '', vel = .8, el, group = 'drum', source = 'key' } = e.detail || {};
    if (!measured) layout();
    const t = nowS(), v = clamp(vel, .15, 1);
    const c = el && critters.get(el);
    freezeUntil = 0;
    cushion.playing = group === 'note' ? 1 : 0;
    if (c && c.kind === 'drum') {
      // the side tap: rail, impact marks, pad and word land on the frame the sound starts
      flashRail(c.zone);
      ouch(el, c.who === 'wet' ? 320 : 240);
      if (hasGsap && !RM) {
        const dir = c.side === 'L' ? 1 : -1;
        // anticipation 40 ms (pre-squash into the rail), hit-stop 40 ms on the stretch, recover 220 ms with overshoot
        if (c.who) {
          if (c.tl) c.tl.progress(1).kill();
          c.tl = poseHit(c, v);
          if (P.Physics2DPlugin && (c.who === 'wet' || c.who === 'kick')) braps(c, v);
        } else {
          gsap.timeline({ overwrite: true })
            .fromTo(el, { x: 0, scaleX: 1, scaleY: 1 }, { x: -6 * dir, scaleX: 1.1, scaleY: .86, duration: .04, ease: 'power2.in', immediateRender: true })
            .to(el, { x: 16 * dir, scaleX: .8, scaleY: 1.16, duration: .03, ease: 'power3.out' })
            .to(el, { x: 0, scaleX: 1, scaleY: 1, duration: .22, ease: E_HIT }, '+=.04');
          openMouth(c, .22);
          if (P.Physics2DPlugin) braps(c, v);
        }
        if (source === 'sensor') gsap.fromTo([rig, cushionCv], { x: -3 * dir }, { x: 0, duration: .08, ease: 'power1.out', overwrite: true });
      }
      if (!endcard) addSideTap(c, v, t);
      const b = padBox(el); lookAt(b.x + b.w / 2, b.y + b.h / 2, t);
      cushion.oMouth = 1; cushion.shut = 1; cushion.squash = Math.max(cushion.squash, .18 * v); cushion.flapV += 14;
      return;
    }
    if (el && el.matches('.trackpad .pad[data-slot]')) {
      pressSquare(el, group === 'note' ? .45 : (DUR[name] || .35));
      const tp = el.parentElement;
      lookAt(tp.offsetLeft + el.offsetLeft + el.offsetWidth / 2, tp.offsetTop + el.offsetTop + el.offsetHeight / 2, t);
    }
    if (PUNCH.has(name)) {
      startPunch(name, t);
      cushion.flat = 1; cushion.flatHold = t + (name === 'synth_slow' ? DUR.synth_slow : .18) + .45;
    } else if (group === 'vocal') {
      if (CAPTIONS[name] && source !== 'loop') {         // a looped "uncle..." only bobs the head; the caption is for the live bit
        caption = { text: CAPTIONS[name], t0: t, dur: (DUR[name] || 1) + .5 };
        if (captionEl) captionEl.textContent = CAPTIONS[name];
        setDim(true);
      }
      if (name === 'voice_02' && source !== 'loop') { freezeUntil = t + (DUR.voice_02 || 1.1) * .6 + .35; cushion.deadpan = 1.6; cushion.freezeFrom = t + (DUR.voice_02 || 1.1) * .6; }
    } else if (group === 'note') {
      cushion.mouth = 1; cushion.flapV += (rand() < .5 ? -1 : 1) * 8 * v;
      if (cushion.air < .15) cushion.sad = Math.max(cushion.sad, .4);
      const tip = cushion.tip;
      if (tip) for (let i = 0; i < 2; i++) vpuffs.push({ x: tip.x + 6, y: tip.y - 6, vx: 30 + rand() * 30, vy: -50 - rand() * 40, r: 8 + rand() * 4, t0: t + i * .06, dur: .45 });
    }
  });

  FB.bus.addEventListener('outofair', e => {
    // no air: the square does not go pink, it shakes "no" inside its own cell, and the cushion goes sleepy
    const el = document.querySelector(`.pad.note[data-note="${e.detail && e.detail.note}"]`);
    cushion.sad = 1;
    const cell = el && el.querySelector('.cell');
    if (cell && hasGsap && !RM) {
      if (P.CustomWiggle) gsap.fromTo(cell, { x: 0 }, { x: 7, duration: .42, ease: 'fbNo', overwrite: true });
      else gsap.fromTo(cell, { x: 0 }, { keyframes: { x: [-6, 6, -6, 6, -6, 6, 0] }, duration: .42, ease: 'none', overwrite: true });
    }
  });

  // ------------------------------------------------------------ trackpad: pressed squares, finger dots, bank flip
  const tpEl = document.querySelector('.trackpad');
  function pressSquare(el, holdS) {
    el.classList.add('held');
    clearTimeout(el._held);
    el._held = setTimeout(() => el.classList.remove('held'), Math.max(.18, holdS) * 1000);
    const cell = el.querySelector('.cell');
    if (cell && hasGsap && !RM) gsap.fromTo(cell, { scale: .96 }, { scale: 1, duration: .22, delay: Math.min(holdS, .6), ease: 'elastic.out(1, 0.45)', overwrite: true });
  }
  const dots = new Map();                                    // finger id -> element
  function fingerAt(id, x, y) {
    if (!tpEl) return;
    let d = dots.get(id);
    if (!d) { d = document.createElement('i'); d.className = 'finger'; tpEl.appendChild(d); dots.set(id, d); }
    clearTimeout(d._gone);
    d.classList.remove('lift');
    d.style.left = `${f1(clamp(x, 0, 1) * 640)}px`;          // normalised 0..1, origin bottom left, mapped 1:1 into the frame
    d.style.top = `${f1((1 - clamp(y, 0, 1)) * 400)}px`;
  }
  function fingerUp(id) {
    const d = dots.get(id); if (!d) return;
    d.classList.add('lift');
    dots.delete(id);
    d._gone = setTimeout(() => d.remove(), 120);
  }
  FB.bus.addEventListener('touch', e => {
    const m = e.detail || {};
    if (m.phase === 'down') {
      fingerAt(m.id, m.x, m.y);
      const sq = tpEl && tpEl.querySelector(`.pad[data-slot="${m.slot}"]`);
      if (sq && !sq.classList.contains('held')) { sq.classList.add('touched'); setTimeout(() => sq.classList.remove('touched'), 150); }
    } else if (m.phase === 'move') {
      const seen = new Set();
      (m.fingers || []).forEach(fg => { seen.add(fg.id); fingerAt(fg.id, fg.x, fg.y); });
      [...dots.keys()].forEach(id => { if (!seen.has(id)) fingerUp(id); });
    } else if (m.phase === 'up') fingerUp(m.id);
  });
  let bankSeen = true;                                       // app.js renders the first bank before this file loads
  FB.bus.addEventListener('bank', () => {
    buildTrackpadCells();
    if (bankSeen && hasGsap && !RM) {                         // card flip, staggered left to right
      const pads = [...document.querySelectorAll('.trackpad .pad[data-slot]')].sort((a, b) => (a.dataset.slot % 4) - (b.dataset.slot % 4));
      gsap.fromTo(pads, { scaleX: 1 }, { keyframes: { scaleX: [1, 0, 1], easeEach: 'power2.out' }, duration: .16, ease: 'none', stagger: .02, overwrite: true, clearProps: 'transform' });
    }
    bankSeen = true;
  });
  FB.bus.addEventListener('freshener', () => {
    if (RM) { const Hz = canvases.haze; hazeLevel = 0; hazeKey = ''; if (Hz) Hz.ctx.clearRect(0, 0, W, H); return; }
    can = { t0: nowS() }; wipe = { t0: nowS() + .3, x: 82 };
  });
  FB.bus.addEventListener('endcard', e => { endcard = !!(e.detail && e.detail.on); punch = null; caption = null; setDim(false); words.length = 0; wedges.length = 0; });
  FB.bus.addEventListener('stage', () => requestAnimationFrame(fit));

  // ------------------------------------------------------------ per frame
  let last = nowS(), spectrumOff = false;
  function stepCritters(t, frozen) {
    for (const c of critterList) {
      if (!frozen && t > c.blinkAt) {                       // every face blinks on its own 3 to 6 s timer
        c.el.classList.add('blink');
        setTimeout(() => c.el.classList.remove('blink'), 120);
        c.blinkAt = t + 3 + rand() * 3;
      }
    }
  }
  // the band grooves: every performer that has hits in the loop bobs on the beat (92 BPM quarters);
  // it lands on the beat with a 6% squash and rises 8 px on the off-beat. Trackpad glyphs nod along.
  const SOUND_ZONE = {};
  Object.entries(FB.ZONE_SOUND || {}).forEach(([z, n]) => { SOUND_ZONE[z] = n; });
  let lastBeat = -1;
  function bobToBeat(f) {
    const names = new Set((f.events || []).map(e => e.name));
    const active = f.looping && names.size > 0 && !RM && !endcard;
    const beatPos = active ? f.loopPos * (f.steps || 32) / 4 : 0, ph = beatPos % 1, beat = Math.floor(beatPos);
    const k = Math.max(0, 1 - ph / .18), y = -8 * Math.sin(Math.PI * ph);
    const tr = `0 ${f1(y)}px`, sq = `scale(${(1 + .06 * k).toFixed(3)}, ${(1 - .06 * k).toFixed(3)})`;
    for (const c of critterList) {
      const on = active && names.has(SOUND_ZONE[c.zone]);
      // never `translate` on the zone itself: GSAP owns its transform (hit squash) and would absorb it
      if (!c.tag) c.tag = tagOf(c.el);
      if (on) {
        if (!c.bob) { c.el.classList.add('bobbing'); c.bob = true; }
        const tf = bobFor(c, ph, beatPos);
        c.svg.style.transform = tf; c.tag.style.transform = tf;
      } else if (c.bob) { c.bob = false; c.el.classList.remove('bobbing'); c.svg.style.transform = ''; c.tag.style.transform = ''; }
    }
    document.querySelectorAll('.trackpad .pad[data-slot]').forEach(el => {
      const g = el.querySelector('svg.glyph'); if (!g) return;
      const on = active && names.has(el.dataset.sound || el.dataset.note);
      g.style.translate = on ? `0 ${f1(y * .6)}px` : '';
    });
    if (active && beat !== lastBeat) { cushion.squashV += 1.6; }
    lastBeat = active ? beat : -1;
  }
  FB.bus.addEventListener('frame', e => {
    const f = e.detail, t = nowS(), dt = Math.min(.05, t - last);
    last = t;
    if (!measured) layout();
    if (!spectrumOff && FB.spectrum && typeof FB.spectrum.toggleAnalyzer === 'function') { try { FB.spectrum.toggleAnalyzer(false); } catch (err) {} spectrumOff = true; }
    readAudio(dt);
    const frozen = !RM && t < freezeUntil && t > (cushion.freezeFrom || 0);

    // haze (and the freshener wipe)
    if (wipe) { const p = (t - wipe.t0) / .6; if (p >= 1) { wipe = null; hazeLevel = f.stink; } else if (p > 0) wipe.x = 82 + 1276 * easeOut(p); }
    if (!wipe) hazeLevel = lerp(hazeLevel, f.stink, 1 - Math.exp(-dt * (f.stink > hazeLevel ? 5 : 2)));
    drawHaze(t);
    // squiggles from the valve: at most 3
    const want = RM || endcard ? 0 : Math.min(3, Math.ceil(Math.max(0, f.stink - 20) / 25));
    while (squiggles.length < want) squiggles.push({ x: 1004 + rand() * 16, y0: 330, life: rand(), dur: 1.6 + rand(), ph: rand() * 6, len: 40 + rand() * 20 });
    for (let i = squiggles.length - 1; i >= 0; i--) { const s = squiggles[i]; s.life += dt; if (s.life > s.dur) { if (squiggles.length > want) squiggles.splice(i, 1); else Object.assign(s, { life: 0, x: 1004 + rand() * 16 }); } }

    drawBoard(f, t);
    stepCritters(t, frozen);
    bobToBeat(f);
    drawFx(t);
    drawBurst(t);

    // cushion
    if (cushion.playing) cushion.mouth = Math.max(cushion.mouth - dt * 2.5, level * .9); else cushion.mouth = Math.max(0, cushion.mouth - dt * 4);
    stepCushion(cushion, dt, f.air / 100, t, frozen);
    const K = canvases.cushion;
    if (K) {
      K.ctx.clearRect(280, 60, 900, 384);
      drawCushion(K.ctx, K.rc, cushion, CUSH, t, level);
      drawCaption(K.ctx, t);
    }
  });

  // ------------------------------------------------------------ start screen: the cushion inflates and says hi
  const startCv = document.getElementById('startCushion');
  const startEl = document.getElementById('start');
  if (startCv && startEl) {
    const st = makeCushion();
    let sctx = null, src = null;
    const t0 = nowS(); let sl = t0;
    const loop = () => {
      if (startEl.style.display === 'none') return;
      const r = startCv.getBoundingClientRect();
      if (!sctx) {
        const d = Math.min(2, window.devicePixelRatio || 1);
        startCv.width = Math.round(r.width * d); startCv.height = Math.round(r.height * d);
        sctx = startCv.getContext('2d'); sctx.setTransform(d, 0, 0, d, 0, 0);
        if (hasRough) src = rough.canvas(startCv);
      }
      const t = nowS(), dt = Math.min(.05, t - sl); sl = t;
      const p = clamp((t - t0 - .3) / 1.2, 0, 1);
      stepCushion(st, dt, RM ? .9 : easeOut(p) * .9, t, false);
      sctx.clearRect(0, 0, r.width, r.height);
      drawCushion(sctx, src, st, { cx: r.width / 2 - 40, cy: r.height * .42, R: 170 }, t, 0);
      requestAnimationFrame(loop);
    };
    startEl.addEventListener('mousemove', ev => {
      const r = startCv.getBoundingClientRect();
      st.lookT.x = clamp((ev.clientX - (r.left + r.width / 2)) / 400, -1, 1);
      st.lookT.y = clamp((ev.clientY - (r.top + r.height / 2)) / 300, -1, 1);
      st.lookUntil = nowS() + 1.5;
    });
    requestAnimationFrame(loop);
  }

  fit();
  const first = () => requestAnimationFrame(layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(first); else addEventListener('load', first);
})();
