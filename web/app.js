// FartBook Pro front end: visuals + sound (Tone.js) + loop station.
// Sensor events arrive from bridge.py over Server-Sent Events (/events).

const BPM = 92;
const STEPS_PER_LOOP = 32;            // 2 bars of 16th notes
const SOUNDS = {
  // drum slices on the silver sides
  synth_wet: 'sounds/drums/synth_wet.wav', synth_puff: 'sounds/drums/synth_puff.wav',
  synth_kick: 'sounds/drums/synth_kick.wav', synth_tom: 'sounds/drums/synth_tom.wav',
  synth_squeak: 'sounds/drums/synth_squeak.wav', synth_clap: 'sounds/drums/synth_clap.wav',
  synth_snare: 'sounds/drums/synth_snare.wav', synth_crash: 'sounds/drums/synth_crash.wav',
  synth_slow: 'sounds/drums/synth_slow.wav',
  // uncle clip chops
  voice_01: 'sounds/uncle/voice_01.wav', voice_02: 'sounds/uncle/voice_02.wav',
  voice_03: 'sounds/uncle/voice_03.wav', voice_04: 'sounds/uncle/voice_04.wav',
  voice_05: 'sounds/uncle/voice_05.wav', voice_06: 'sounds/uncle/voice_06.wav',
  voice_07: 'sounds/uncle/voice_07.wav',
  fart_01: 'sounds/uncle/fart_01.wav', fart_02: 'sounds/uncle/fart_02.wav', fart_03: 'sounds/uncle/fart_03.wav',
  spray: 'sounds/fx/spray.wav',
};
const ZONE_SOUND = { LT: 'synth_wet', LT2: 'synth_puff', LB: 'synth_kick', LB2: 'synth_tom',
                     RT: 'synth_squeak', RT2: 'synth_clap', RB: 'synth_snare', RB2: 'synth_crash' };
const STINK = { synth_kick: 1, synth_wet: 2, synth_puff: 0.5, synth_tom: 1, synth_squeak: 0.5, synth_clap: 1,
                synth_snare: 1, synth_crash: 22, synth_slow: 20, fart_01: 10, fart_02: 12, fart_03: 30 };   // drums barely move it: the punchlines push it to EVACUATE
const KEY_ZONE = { a: 'LT', s: 'LT2', z: 'LB', x: 'LB2', k: 'RT', l: 'RT2', ',': 'RB', '.': 'RB2' };
const KEY_PAD = { '1': 'voice_01', '2': 'voice_02', '3': 'voice_03', '4': 'voice_04', '5': 'voice_05',
                  '6': 'voice_06', '7': 'voice_07', '8': 'fart_01', '9': 'fart_02', '0': 'fart_03' };
const KEY_NOTE = { q: 'A2', w: 'C3', e: 'D3', r: 'E3', t: 'G3', y: 'A3', u: 'C4', i: 'D4' };
const NOTE_AIR_COST = 6;
// The real trackpad is 8 squares, 2 rows x 4 (like AudioSwift's 8-pad trigger mode). Slots 0-3 = top row
// left to right, 4-7 = bottom row. Tab switches bank. trackpad_server.py sends where the finger lands.
const BANKS = {
  uncle: [
    { kind: 'pad', name: 'voice_01', label: 'uncle', key: '1' }, { kind: 'pad', name: 'voice_02', label: 'not now', key: '2' },
    { kind: 'pad', name: 'voice_03', label: 'chop 3', key: '3' }, { kind: 'pad', name: 'voice_04', label: 'chop 4', key: '4' },
    { kind: 'pad', name: 'fart_01', label: 'fart 1', key: '8' }, { kind: 'pad', name: 'fart_02', label: 'fart 2', key: '9' },
    { kind: 'pad', name: 'fart_03', label: 'fart 3', key: '0' }, { kind: 'drum', name: 'synth_slow', label: 'long fart', key: 'H' },
  ],
  notes: [                                                          // pitch rises left to right, then up a row (Launchpad style)
    { kind: 'note', name: 'G3', label: 'G', key: 'T' }, { kind: 'note', name: 'A3', label: 'A', key: 'Y' },
    { kind: 'note', name: 'C4', label: 'C', key: 'U' }, { kind: 'note', name: 'D4', label: 'D', key: 'I' },
    { kind: 'note', name: 'A2', label: 'A', key: 'Q' }, { kind: 'note', name: 'C3', label: 'C', key: 'W' },
    { kind: 'note', name: 'D3', label: 'D', key: 'E' }, { kind: 'note', name: 'E3', label: 'E', key: 'R' },
  ],
};
const BANK_ORDER = ['uncle', 'notes'];
const CHOKE_GROUPS = {
  vocal: ['voice_01', 'voice_02', 'voice_03', 'voice_04', 'voice_05', 'voice_06', 'voice_07'],
  uncle: ['fart_01', 'fart_02', 'fart_03'],
};
const PUNCHLINES = ['fart_03', 'synth_slow', 'synth_crash'];
let duckTimer;
function duck(p, time) {
  const len = p.buffer && p.buffer.duration ? p.buffer.duration : 1.2;
  players.volume.rampTo(-6, 0.004, time); sampler.volume.rampTo(-6, 0.004, time);   // dip lands before the punchline peaks
  p.volume.value += 6;                                               // cancel the dip for the punchline itself
  clearTimeout(duckTimer);
  duckTimer = setTimeout(() => { players.volume.rampTo(0, 0.15); sampler.volume.rampTo(0, 0.15); }, len * 1000);
}
const CHOKE = {};
Object.entries(CHOKE_GROUPS).forEach(([g, names]) => names.forEach(n => { CHOKE[n] = g; }));

const state = {
  started: false, recording: false, looping: false, events: [], metronome: false,
  air: 0, stink: 0, eightZones: false, bank: 'uncle', trackpadLive: false, sensorsLive: false, lastLid: null,
  lightBase: null, covered: false, force: 0.7, calibrating: false, calZone: null,
};

let players, sampler, part, metro;

// Hook API for other modules (visuals.js, analyzer.js). See docs/TEAM.md.
const FB = window.FB = { bus: new EventTarget(), state, master: null, customVisuals: false, ZONE_SOUND };
function emit(type, detail = {}) { FB.bus.dispatchEvent(new CustomEvent(type, { detail })); }
const $ = sel => document.querySelector(sel);

// ---------------------------------------------------------------- audio
// Drop a file into web/sounds/meme/ named after a slot (kick.mp3, snare.wav, crash.mp3 ...)
// and it replaces that slot's synth fart. Files with other names are listed in the console.
const SLOT_FILES = { wet: 'synth_wet', puff: 'synth_puff', kick: 'synth_kick', tom: 'synth_tom',
  squeak: 'synth_squeak', clap: 'synth_clap', snare: 'synth_snare', crash: 'synth_crash', slow: 'synth_slow',
  spray: 'spray', fart1: 'fart_01', fart2: 'fart_02', fart3: 'fart_03',
  v1: 'voice_01', v2: 'voice_02', v3: 'voice_03', v4: 'voice_04', v5: 'voice_05', v6: 'voice_06', v7: 'voice_07' };
let melodyUrl = 'melody_base.wav', melodyBase = 'sounds/melody/';
async function applyDropInSounds() {
  try {
    const files = await (await fetch('/api/sounds')).json();
    const used = [], broken = [];
    for (const f of files) {
      const slot = f.replace(/\.[^.]+$/, '').toLowerCase();
      if (slot !== 'melody' && !SLOT_FILES[slot]) continue;
      const url = `sounds/meme/${encodeURIComponent(f)}`;
      try { await new Tone.ToneAudioBuffer().load(url); }             // a broken file must never silence the show
      catch (err) { broken.push(f); continue; }
      if (slot === 'melody') { melodyUrl = encodeURIComponent(f); melodyBase = 'sounds/meme/'; }
      else SOUNDS[SLOT_FILES[slot]] = url;
      used.push(f);
    }
    if (broken.length) { console.warn('Could not play these files, kept the built-in sounds:', broken); toast(`${broken.length} sound file${broken.length === 1 ? '' : 's'} could not load`); }
    if (used.length) toast(`${used.length} new sound${used.length === 1 ? '' : 's'} loaded`);
    const unused = files.filter(f => !used.includes(f) && !broken.includes(f));
    if (unused.length) console.info('Rename these to a slot name to use them:', unused, Object.keys(SLOT_FILES));
  } catch (e) { console.info('no drop-in sounds (bridge not running?)'); }
}

async function startAudio() {
  await Tone.start();
  await applyDropInSounds();
  Tone.Transport.bpm.value = BPM;
  const master = new Tone.Limiter(-1).toDestination();             // many farts at once never distort
  FB.master = master;
  players = new Tone.Players(SOUNDS).connect(master);
  sampler = new Tone.Sampler({ urls: { A2: melodyUrl }, baseUrl: melodyBase, release: 0.2 }).connect(master);
  await Tone.loaded();
  part = new Tone.Part((time, ev) => {
    // a hit snapped slightly forward already sounded live a moment ago: don't double it on this pass
    if (time - ev.playedAt < Tone.Time('16n').toSeconds() * 1.5) return;
    if (document.body.classList.contains('show-endcard')) return;          // the closing screen is silent
    playNow(ev, time, false);
  }, []);
  part.loop = true;
  part.loopEnd = '2m';
  part.start(0);
  const click = new Tone.MembraneSynth({ volume: -18 }).toDestination();
  metro = new Tone.Loop(time => { if (state.metronome) click.triggerAttackRelease('C5', '32n', time); }, '4n').start(0);
  Tone.Transport.start();
  state.started = true;
  emit('audio-ready', { master, context: Tone.getContext().rawContext });
  requestAnimationFrame(tick);
}

const autoSounds = [];                                              // when loop sounds actually play (speaker feedback guard)
function playNow(ev, time, fromUser) {
  if (!fromUser) { autoSounds.push(performance.now() + Math.max(0, (time - Tone.immediate()) * 1000)); if (autoSounds.length > 16) autoSounds.shift(); }
  if (ev.kind === 'note') {
    try { sampler.triggerAttackRelease(ev.name, '8n', time, ev.vel); } catch (err) { console.warn('skipped a note', ev.name); }
  } else {
    // How pads react when hit together (same rules as an MPC / sampler pad):
    //  - different pads: both play, layered (polyphony)
    //  - same pad again: restarts from the top (retrigger), keeps fast rolls tight
    //  - choke group: a new sound cuts the others in its group (vocal stutters, uncle farts)
    const group = CHOKE[ev.name];
    if (group) CHOKE_GROUPS[group].forEach(n => { if (n !== ev.name && players.player(n).state === 'started') players.player(n).stop(time); });
    const p = players.player(ev.name);
    p.volume.value = Tone.gainToDb(Math.max(0.05, ev.vel));
    p.playbackRate = ev.kind === 'drum' ? 0.97 + Math.random() * 0.06 : 1;   // tiny variation: repeats never sound robotic
    if (PUNCHLINES.includes(ev.name)) duck(p, time);                // everything else dips 6 dB so the punchline lands
    try { p.start(time); } catch (err) { console.warn('skipped a doubled start', ev.name); }   // never let one sound kill the beat
  }
  if (fromUser) flash(ev, ev.source || 'key');
  else Tone.Draw.schedule(() => flash(ev, 'loop'), time);                   // loop visuals land with the sound, not 70 ms early
  if (fromUser && STINK[ev.name]) addStink(STINK[ev.name], PUNCHLINES.includes(ev.name));   // loop replays never add stink
  if (fromUser && state.recording) record(ev);
}

// one entry point for every hit (sensor tap, mouse, keyboard)
function hit(kind, name, vel = 0.8, source = 'key') {
  if (!state.started) return;
  if (kind === 'note') {
    if (state.air < NOTE_AIR_COST) { outOfAir(name); return; }
    state.air -= NOTE_AIR_COST;
  }
  playNow({ kind, name, vel, source }, Tone.immediate(), true);    // live hits play now; the loop keeps Tone's look-ahead
}

// ---------------------------------------------------------------- loop station
function stepTicks() { return Tone.Transport.PPQ / 4; }           // ticks per 16th note
function loopTicks() { return stepTicks() * STEPS_PER_LOOP; }

function record(ev) {
  const t = Tone.Transport.getTicksAtTime(Tone.immediate()) % loopTicks();
  const snapped = Math.round(t / stepTicks()) * stepTicks();        // snap to the nearest 16th
  const step = (snapped / stepTicks()) % STEPS_PER_LOOP;
  if (state.events.some(e => e.step === step && e.name === ev.name)) return;   // already on that beat: don't stack duplicates
  const rec = { kind: ev.kind, name: ev.name, vel: ev.vel, step, time: `${step * stepTicks()}i`,
                playedAt: Tone.immediate() };                        // when it sounded live (audio clock)
  state.events.push(rec);
  part.add(rec.time, rec);
  drawLoopDots();
}

function toggleRecording() {
  if (!state.looping) { state.looping = true; state.recording = true; }
  else state.recording = !state.recording;
  updateLoopStatus();
}

function undoLast() {
  const last = state.events.pop();
  if (!last) return;
  part.clear();
  state.events.forEach(e => part.add(e.time, e));
  drawLoopDots();
}

function clearLoop() {
  if (songPart && !clearLoop.fromSong) stopSong();
  state.events = []; part.clear(); state.looping = false; state.recording = false;
  drawLoopDots(); updateLoopStatus();
}

// ---------------------------------------------------------------- song mode (B): "Uncle, Not Now (FartBook Remix)"
// A full 22-bar arrangement (about 57 s at 92 BPM) that plays through the same engine and visuals as the loop.
// You can still jam over it with taps, the trackpad and keys. Press B again to stop.
const SONG_BARS = 22;
const SONG_SECTIONS = [[0, 'intro'], [2, 'verse'], [6, 'hook'], [10, 'breakdown'], [12, 'build'], [14, 'DROP'], [20, 'outro']];
function buildSong() {
  const out = [];
  const add = (bar, step, kind, name, vel = 0.8) => out.push({ time: `${(bar * 16 + step) * stepTicks()}i`, kind, name, vel, bar, step });
  const drum = (b, st, n, v) => add(b, st, 'drum', n, v), pad = (b, st, n, v) => add(b, st, 'pad', n, v), note = (b, st, n, v) => add(b, st, 'note', n, v);
  const hats = (b, every = 2, v = .38) => { for (let st = 0; st < 16; st += every) drum(b, st, 'synth_squeak', st % 4 === 0 ? v + .12 : v); };
  const beat = (b, fill = false) => {
    drum(b, 0, 'synth_kick', .95); drum(b, 8, 'synth_kick', .9); if (fill) drum(b, 10, 'synth_kick', .75);
    drum(b, 4, 'synth_snare', .8); drum(b, 12, 'synth_snare', .85);
  };
  // intro: the meme, then the first fart
  pad(0, 0, 'voice_01', .95); pad(1, 0, 'voice_02', .95); pad(1, 10, 'fart_01', .9);
  for (let st = 8; st < 16; st += 2) drum(1, st, 'synth_squeak', .3 + st * .02);
  // verse: kick / snare / squeak hats, a wet fart answering every other bar
  for (let b = 2; b < 6; b++) { beat(b, b % 2 === 1); hats(b); if (b % 2 === 1) drum(b, 14, 'synth_wet', .7); }
  // hook: vocal chops on the beat + the air-powered fart bass line (A minor pentatonic)
  const bass = [['A2', 0], ['A2', 3], ['C3', 6], ['D3', 10], ['E3', 12]];
  for (let b = 6; b < 10; b++) {
    beat(b, true); hats(b);
    bass.forEach(([n, st]) => note(b, st, b === 9 && st === 12 ? 'G3' : n, .75));
  }
  pad(6, 0, 'voice_01', .9); pad(7, 8, 'voice_02', .9);
  [0, 2, 4].forEach(st => pad(8, st, 'voice_01', .8)); pad(9, 8, 'voice_02', .9);
  // breakdown: drums out, a sad fart melody, "not now"
  [['E3', 0], ['D3', 4], ['C3', 8], ['A2', 12]].forEach(([n, st]) => note(10, st, n, .8));
  [['C3', 0], ['D3', 4], ['E3', 8], ['G3', 12]].forEach(([n, st]) => note(11, st, n, .8));
  drum(10, 6, 'synth_puff', .6); pad(11, 14, 'voice_02', .85);
  // build: snare 8ths then 16ths, rising squeaks, tom fill
  for (let st = 0; st < 16; st += 2) drum(12, st, 'synth_snare', .45 + st * .02);
  for (let st = 0; st < 16; st++) drum(13, st, 'synth_snare', .5 + st * .025);
  [0, 4, 8, 12].forEach(st => drum(12, st, 'synth_kick', .85));
  [10, 12, 14].forEach(st => drum(13, st, 'synth_tom', .8));
  // drop: full band, melody up an octave, chops on the off-beats, uncle farts as accents
  const riff = [['A3', 0], ['C4', 3], ['D4', 6], ['C4', 8], ['A3', 10], ['G3', 12], ['A3', 14]];
  for (let b = 14; b < 20; b++) {
    [0, 4, 8, 12].forEach(st => drum(b, st, 'synth_kick', .95)); drum(b, 10, 'synth_kick', .7);
    [4, 12].forEach(st => { drum(b, st, 'synth_snare', .85); drum(b, st, 'synth_clap', .6); });
    hats(b, 1, .3);
    riff.forEach(([n, st]) => note(b, st, n, .7));
    if (b % 2 === 0) pad(b, 6, b % 4 === 2 ? 'voice_03' : 'voice_04', .8); else drum(b, 14, 'synth_wet', .75);
  }
  drum(14, 0, 'synth_crash', .85); pad(16, 0, 'fart_02', .9); pad(18, 0, 'fart_01', .9);
  // outro: the big one, then the uncle gets the last word
  pad(20, 0, 'fart_03', 1); drum(20, 0, 'synth_kick', 1);
  pad(21, 4, 'voice_01', .9); pad(21, 12, 'voice_02', .95);
  return out;
}
let songPart = null, songEndId = null;
function barSeconds() { return Tone.Time('1m').toSeconds(); }
function toggleSong() {
  if (!state.started) return;
  if (songPart) { stopSong(); return; }
  clearLoop.fromSong = true; clearLoop(); clearLoop.fromSong = false;
  const start = Tone.Transport.nextSubdivision('1m');
  songPart = new Tone.Part((time, ev) => {
    if (document.body.classList.contains('show-endcard')) return;
    playNow(ev, time, false);
    if (STINK[ev.name]) Tone.Draw.schedule(() => addStink(STINK[ev.name] * .6, PUNCHLINES.includes(ev.name)), time);
  }, buildSong());
  songPart.start(start);
  state.song = true; state.songStart = start; state.songSection = '';
  SONG_SECTIONS.forEach(([bar, name]) => Tone.Transport.scheduleOnce(t => Tone.Draw.schedule(() => {
    if (!songPart) return;
    state.songSection = name; updateLoopStatus(); toast(name === 'DROP' ? 'DROP' : name);
    emit('songsection', { name, bar });
  }, t), start + bar * barSeconds()));
  songEndId = Tone.Transport.scheduleOnce(t => Tone.Draw.schedule(() => stopSong(true), t), start + SONG_BARS * barSeconds());
  updateLoopStatus();
  emit('song', { on: true, bars: SONG_BARS, start, seconds: SONG_BARS * barSeconds() });
  toast('song: Uncle, Not Now');
}
function stopSong(finished = false) {
  if (!songPart) return;
  songPart.stop(); songPart.dispose(); songPart = null;
  if (songEndId != null) { Tone.Transport.clear(songEndId); songEndId = null; }
  state.song = false; state.songSection = '';
  updateLoopStatus();
  emit('song', { on: false, finished });
  toast(finished ? 'that was FartBook Pro' : 'song stopped');
}
function songProgress() {
  if (!state.song) return 0;
  return Math.max(0, Math.min(1, (Tone.immediate() - state.songStart) / (SONG_BARS * barSeconds())));
}

// P pauses and resumes the loop and the song where they are (live taps and keys still play while paused)
function togglePause() {
  if (!state.started) return;
  if (Tone.Transport.state === 'started') { Tone.Transport.pause(); state.paused = true; toast('paused (P to resume)'); }
  else { Tone.Transport.start(); state.paused = false; toast('playing'); }
  updateLoopStatus();
  emit('pause', { on: !!state.paused });
}

function updateLoopStatus() {
  const el = $('#loopStatus');
  el.className = 'pill' + (state.recording ? ' rec' : '') + (state.song ? ' song' : '');
  el.textContent = state.paused ? 'paused' : state.song ? `song: ${state.songSection || 'starting'}` : state.recording ? '● REC layer' : (state.looping ? 'looping' : 'loop off');
}

function colorFor(ev) {
  if (ev.kind === 'note') return 'var(--note)';
  if (ev.name.startsWith('voice')) return 'var(--vocal)';
  if (ev.name.startsWith('fart')) return 'var(--uncle)';
  return 'var(--gas)';
}

function drawLoopDots() {
  const bar = $('#loopbar');
  bar.querySelectorAll('.dot').forEach(d => d.remove());
  state.events.forEach(e => {
    const d = document.createElement('div');
    d.className = 'dot';
    d.style.left = `${(e.step / STEPS_PER_LOOP) * 100}%`;
    d.style.background = colorFor(e);
    bar.appendChild(d);
  });
}

// ---------------------------------------------------------------- meters + visuals
function addStink(n, punchline) { state.stink = Math.min(punchline ? 100 : 74, state.stink + n); }   // only punchlines reach EVACUATE

function airFreshener() {
  if (!state.started) return;
  players.player('spray').volume.value = 0;
  players.player('spray').start();
  state.stink = 0;
  document.body.classList.add('mint');
  setTimeout(() => document.body.classList.remove('mint'), 900);
  toast('air freshener');
  emit('freshener');
}

function outOfAir(note) {
  const el = document.querySelector(`.pad.note[data-note="${note}"]`);
  if (el) { el.classList.add('empty'); setTimeout(() => el.classList.remove('empty'), 300); }
  toast('OUT OF AIR, pump the lid');
  emit('outofair', { note });
}

function groupOf(ev) {
  if (ev.kind === 'note') return 'note';
  if (ev.name.startsWith('voice')) return 'vocal';
  if (ev.name.startsWith('fart')) return 'uncle';
  return 'drum';
}

function elementFor(ev) {
  if (ev.kind === 'note') return document.querySelector(`.pad.note[data-note="${ev.name}"]`);
  const zone = Object.keys(ZONE_SOUND).find(z => ZONE_SOUND[z] === ev.name);
  if (zone) return document.querySelector(`.zone[data-zone="${zone}"]`);
  return document.querySelector(`.pad[data-sound="${ev.name}"]`);
}

function flash(ev, source = 'key') {                              // source: sensor | key | pointer | loop
  const el = elementFor(ev);
  emit('hit', { kind: ev.kind, name: ev.name, vel: ev.vel, el, group: groupOf(ev), source });
  if (!el || FB.customVisuals) { if (el && FB.customVisuals) { el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 150); } return; }
  el.classList.add('hit');
  setTimeout(() => el.classList.remove('hit'), 150);
  const r = el.getBoundingClientRect();
  const p = document.createElement('div');
  p.className = 'puff';
  p.innerHTML = `💨<small>${el.querySelector('b').textContent}</small>`;
  p.style.left = `${r.left + r.width / 2}px`;
  p.style.top = `${r.top}px`;
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 1000);
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 900);
}

const STINK_WORDS = [[95, 'EVACUATE BAYVIEW YARDS'], [75, 'hazardous'], [50, 'concerning'], [25, 'mild'], [0, 'fresh']];
let lastFrame = performance.now();
// ---------------------------------------------------------------- guided tour: step-by-step, waits for each action (space in the ? card)
const TOUR = [
  { say: 'tap the BLUE spot: left palm rest, top half', key: 'or press A', zone: 'LT', ok: e => e.name === 'synth_wet' },
  { say: 'now PURPLE: left palm rest, bottom half', key: 'or press Z', zone: 'LB', ok: e => e.name === 'synth_kick' },
  { say: 'YELLOW: right palm rest, top half', key: 'or press K', zone: 'RT', ok: e => e.name === 'synth_squeak' },
  { say: 'ORANGE: right palm rest, bottom half', key: 'or press comma', zone: 'RB', ok: e => e.name === 'synth_snare' },
  { say: 'touch the trackpad, top left: the uncle', key: 'or press 1', slot: 0, bank: 'uncle', ok: e => e.name === 'voice_01' },
  { say: 'now the next square: "not now"', key: 'or press 2', slot: 1, bank: 'uncle', ok: e => e.name === 'voice_02' },
  { say: 'bottom row of the trackpad: his farts', key: 'or press 8', slot: 4, bank: 'uncle', ok: e => /^fart_0/.test(e.name) },
  { say: 'pump the lid: close it a little and open it again', key: 'or press G', air: 30 },
  { say: 'press TAB, then touch a note square', key: 'notes need air', bank: 'notes', ok: e => e.kind === 'note' },
  { say: 'press TAB to go back, SPACE to record, tap a beat, SPACE to stop', key: 'build your loop', loop: 4 },
  { say: 'big finish: the LONG FART, trackpad bottom right', key: 'or press H', slot: 7, bank: 'uncle', ok: e => e.name === 'synth_slow' },
];
const tour = { on: false, i: 0, el: null, doneT: 0 };
function buildTour() {
  const css = document.createElement('style');
  css.textContent = `
  #tour{position:fixed;left:50%;top:62px;transform:translateX(-50%);z-index:70;display:none;align-items:center;gap:16px;
    background:var(--night,#1B1730);color:var(--cream,#F3EBDD);border:5px solid var(--pink,#FF4470);border-radius:26px;padding:14px 22px;
    font-family:inherit;max-width:min(980px,94vw);box-shadow:8px 8px 0 #0f0c1e}
  body.touring #tour{display:flex}
  #tour .st{flex:none;font-size:18px;font-weight:900;background:var(--pink,#FF4470);color:var(--night,#1B1730);border-radius:14px;padding:8px 12px}
  #tour .say{font-size:26px;font-weight:900;line-height:1.2}
  #tour .key{font-size:16px;opacity:.75;margin-top:4px}
  #tour .skip{flex:none;font-size:14px;opacity:.6;margin-left:8px}
  #tour.low{top:auto;bottom:58px}
  #tour.yay{border-color:var(--lime,#B7E640)} #tour.yay .st{background:var(--lime,#B7E640)}
  .tour-target{outline:6px solid var(--pink,#FF4470);outline-offset:8px;border-radius:22px;animation:tourpulse .8s ease-in-out infinite alternate}
  @keyframes tourpulse{from{outline-color:var(--pink,#FF4470)}to{outline-color:transparent}}
  @media (prefers-reduced-motion: reduce){.tour-target{animation:none}}`;
  document.head.appendChild(css);
  tour.el = document.createElement('div'); tour.el.id = 'tour';
  tour.el.innerHTML = '<div class="st"></div><div><div class="say"></div><div class="key"></div></div><div class="skip">→ skip &nbsp; esc quit</div>';
  document.body.appendChild(tour.el);
  FB.bus.addEventListener('hit', e => { const t = TOUR[tour.i]; if (tour.on && t && t.ok && e.detail.source !== 'loop' && t.ok(e.detail)) tourNext(); });
  FB.bus.addEventListener('frame', e => {
    const t = TOUR[tour.i]; if (!tour.on || !t) return;
    if (t.air && e.detail.air >= t.air) tourNext();
    else if (t.loop && !e.detail.recording && (e.detail.events || []).length >= t.loop) tourNext();
  });
}
function tourMark() {
  document.querySelectorAll('.tour-target').forEach(el => el.classList.remove('tour-target'));
  const t = TOUR[tour.i]; if (!t) return;
  let el = null;
  if (t.zone) el = document.querySelector(`.zone[data-zone="${t.zone}"]`);
  else if (t.slot !== undefined && state.bank === (t.bank || state.bank)) el = document.querySelector(`.trackpad .pad[data-slot="${t.slot}"]`);
  else if (t.bank === 'notes') el = document.querySelector('#bankBtn') || document.querySelector('.trackpad');
  else if (t.air) el = document.querySelector('#hud .air');
  else if (t.loop) el = document.querySelector('#loopbar') || document.querySelector('#loopStatus');
  if (el) el.classList.add('tour-target');
}
function tourShow() {
  const t = TOUR[tour.i];
  tour.el.classList.remove('yay');
  tour.el.classList.toggle('low', !!t.loop);
  tour.el.querySelector('.st').textContent = `${tour.i + 1}/${TOUR.length}`;
  tour.el.querySelector('.say').textContent = t.say;
  tour.el.querySelector('.key').textContent = t.key || '';
  tourMark();
}
function tourStart() {
  if (!state.started) return;
  clearLoop(); state.air = 0; state.stink = 0;
  if (state.bank !== 'uncle') { state.bank = 'uncle'; renderBank(); }
  tour.on = true; tour.i = 0; document.body.classList.add('touring'); tourShow();
}
function tourNext() {
  tour.i += 1;
  if (tour.i < TOUR.length) { tourShow(); return; }
  tour.on = false; tourMark();
  tour.el.classList.add('yay');
  tour.el.querySelector('.st').textContent = 'done';
  tour.el.querySelector('.say').textContent = 'you just made a FartBook beat!';
  tour.el.querySelector('.key').textContent = 'B plays the full song · C clears · ? for help';
  clearTimeout(tour.doneT); tour.doneT = setTimeout(() => document.body.classList.remove('touring'), 6000);
}
function tourQuit() { tour.on = false; tourMark(); document.body.classList.remove('touring'); }

// ---------------------------------------------------------------- quick tutorial overlay: press ? (or /) to show, any key or click closes
let tut = null;
function buildTutorial() {
  const css = document.createElement('style');
  css.textContent = `
  #tut{position:fixed;inset:0;z-index:90;display:none;place-items:center;background:rgba(27,23,48,.86);font-family:inherit;color:var(--cream,#F3EBDD)}
  body.show-tut #tut{display:grid}
  #tut .card{width:min(1040px,94vw);background:var(--night,#1B1730);border:6px solid var(--cream,#F3EBDD);border-radius:32px;padding:30px 36px 26px}
  #tut h2{margin:0 0 6px;font-size:44px;line-height:1.15;font-weight:900}
  #tut .sub{margin:0 0 24px;font-size:20px;line-height:1.4;opacity:.8}
  #tut .rows{display:grid;grid-template-columns:1fr 1fr;gap:22px 30px}
  #tut .row{display:flex;gap:16px;align-items:center}
  #tut .n{flex:none;width:54px;height:54px;border-radius:16px;display:grid;place-items:center;font-size:28px;font-weight:900;color:var(--night,#1B1730);border:4px solid #0f0c1e}
  #tut .row b{display:block;font-size:23px;line-height:1.3;margin-bottom:4px}
  #tut .row span{display:block;font-size:17px;line-height:1.45;opacity:.85}
  #tut .pads{display:grid;grid-template-columns:repeat(2,26px);gap:5px;flex:none}
  #tut .pads i{width:26px;height:22px;border-radius:7px;border:3px solid #0f0c1e;display:block}
  #tut .foot{margin-top:22px;font-size:18px;opacity:.75;text-align:center}
  #tut kbd{display:inline-block;line-height:1.1;font-family:inherit;font-weight:900;padding:1px 8px;border-radius:8px;border:2px solid var(--cream,#F3EBDD);margin:0 2px}`;
  document.head.appendChild(css);
  tut = document.createElement('div'); tut.id = 'tut';
  tut.innerHTML = `<div class="card">
    <h2>how to play fartbook pro</h2>
    <p class="sub">your laptop is a fart band. no clicking needed.</p>
    <div class="rows">
      <div class="row"><div class="pads"><i style="background:var(--cyan,#45C8DA)"></i><i style="background:var(--yellow,#FFC23D)"></i><i style="background:var(--violet,#8E6BF2)"></i><i style="background:var(--orange,#FF8A3D)"></i></div>
        <div><b>tap the silver beside the trackpad</b><span>4 fart drums: left = wet / kick, right = squeak / snare</span></div></div>
      <div class="row"><div class="n" style="background:var(--yellow,#FFC23D)">8</div>
        <div><b>touch the trackpad</b><span>8 squares: the uncle's voice and his farts</span></div></div>
      <div class="row"><div class="n" style="background:var(--cyan,#45C8DA)">⇅</div>
        <div><b>pump the lid, then press <kbd>tab</kbd></b><span>moving the lid fills the cushion with air for fart notes</span></div></div>
      <div class="row"><div class="n" style="background:var(--pink,#FF4470)">●</div>
        <div><b><kbd>space</kbd> record a loop</b><span>play over it, <kbd>space</kbd> again to stop, <kbd>c</kbd> to clear</span></div></div>
      <div class="row"><div class="n" style="background:var(--lime,#B7E640)">♪</div>
        <div><b><kbd>b</kbd> play the full song</b><span>"Uncle, Not Now (FartBook Remix)", jam on top of it</span></div></div>
      <div class="row"><div class="n" style="background:var(--cream,#F3EBDD)">!</div>
        <div><b>watch the stink-o-meter</b><span>too many farts and it says EVACUATE. <kbd>f</kbd> sprays freshener</span></div></div>
    </div>
    <p class="foot"><kbd>space</kbd> guided tour, step by step &nbsp;·&nbsp; any other key: just play &nbsp;·&nbsp; <kbd>?</kbd> shows this again</p>
  </div>`;
  document.body.appendChild(tut);
  tut.addEventListener('mousedown', () => document.body.classList.remove('show-tut'));
}
function toggleTutorial(on) { document.body.classList.toggle('show-tut', on === undefined ? !document.body.classList.contains('show-tut') : on); }

// ---------------------------------------------------------------- meters HUD: air % (lid pumping) and stink-o-meter %
// Built here so it works with any stylesheet; colours come from the DESIGN.md tokens with fallbacks.
let hud = null, hudLastAir = 0, hudPumpT = 0;
function buildHud() {
  const css = document.createElement('style');
  css.textContent = `
  #hud{position:static;display:flex;gap:8px;white-space:nowrap;pointer-events:none;font-family:inherit;margin:0 auto 0 18px;align-self:center}
  #hud .m{display:flex;align-items:center;gap:8px;padding:5px 12px 5px 12px;border-radius:999px;background:var(--night,#1B1730);
    border:3px solid var(--cream,#F3EBDD);color:var(--cream,#F3EBDD);font-weight:800;font-size:15px;line-height:1;transition:transform .16s cubic-bezier(.2,.8,.2,1)}
  #hud .lab{opacity:.8;font-size:14px}
  #hud .bar{width:56px;height:12px;border-radius:999px;background:rgba(243,235,221,.18);overflow:hidden}
  #hud .fill{height:100%;width:0;border-radius:999px;transition:width .12s linear}
  #hud .air .fill{background:var(--cyan,#45C8DA)}
  #hud .stk .fill{background:var(--lime,#B7E640)}
  #hud .pct{min-width:42px;text-align:right;font-variant-numeric:tabular-nums}
  #hud .word{font-size:15px;opacity:.85;min-width:70px}
  #hud .air.pump{transform:scale(1.08);border-color:var(--cyan,#45C8DA)}
  #hud .air.low .pct{color:var(--pink,#FF4470)}
  #hud .stk.max{border-color:var(--lime,#B7E640)}
  #hud .plus{color:var(--cyan,#45C8DA);font-size:14px;min-width:34px}
  body.show-endcard #hud{visibility:hidden}
  @media (max-width:1240px){#hud .lab{display:none}#hud .bar{width:44px}}`;
  document.head.appendChild(css);
  hud = document.createElement('div'); hud.id = 'hud';
  hud.innerHTML = `<div class="m air"><span class="lab">air</span><div class="bar"><div class="fill"></div></div><span class="pct">0%</span><span class="plus"></span></div>
    <div class="m stk"><span class="lab">stink-o-meter</span><div class="bar"><div class="fill"></div></div><span class="pct">0%</span></div>`;
  const brand = document.querySelector('header .brand');
  if (brand) brand.insertAdjacentElement('afterend', hud); else document.body.appendChild(hud);
}
function updateHud() {
  if (!hud) return;
  const air = Math.round(state.air), stink = Math.round(state.stink);
  const a = hud.querySelector('.air'), k = hud.querySelector('.stk');
  if (state.air > hudLastAir + 0.4) {                                // the lid just pumped air in
    const plus = a.querySelector('.plus'); plus.textContent = `+${Math.max(1, Math.round(state.air - hudLastAir))}%`;
    hudPumpT = performance.now();
  }
  hudLastAir = state.air;
  const pumping = performance.now() - hudPumpT < 400;
  a.classList.toggle('pump', pumping);
  if (!pumping && performance.now() - hudPumpT > 900) a.querySelector('.plus').textContent = '';
  a.classList.toggle('low', air < NOTE_AIR_COST);
  a.querySelector('.fill').style.width = `${air}%`; a.querySelector('.pct').textContent = `${air}%`;
  k.querySelector('.fill').style.width = `${stink}%`; k.querySelector('.pct').textContent = `${stink}%`;
  k.classList.toggle('max', stink >= 95);
}

function tick(now) {
  const dt = (now - lastFrame) / 1000; lastFrame = now;
  state.stink = Math.max(0, state.stink - 2 * dt);
  state.air = Math.max(0, state.air - 2 * dt);                    // slow leak
  $('#stink').style.width = `${state.stink}%`;
  $('#stinkText').textContent = STINK_WORDS.find(([v]) => state.stink >= v)[1];
  document.body.classList.toggle('shake', state.stink >= 90);
  $('#air').style.width = `${state.air}%`;
  $('#airText').textContent = `${Math.round(state.air)}%`;
  $('#balloon').style.transform = `scale(${0.6 + state.air / 60})`;
  const loopPos = state.started ? (Tone.Transport.getTicksAtTime(Tone.immediate()) % loopTicks()) / loopTicks() : 0;
  if (state.looping) $('#playhead').style.left = `${loopPos * 100}%`;
  emit('frame', { air: state.air, stink: state.stink, loopPos, looping: state.looping || !!state.song, recording: state.recording,
                  song: !!state.song, songSection: state.songSection || '', songProgress: songProgress(),
                  events: state.events, steps: STEPS_PER_LOOP });
  updateHud();
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------------- sensors (bridge.py)
function onSensor(msg) {
  if (msg.type === 'tap') {
    if (wiz.active) { wizOnTap(msg); return; }
    if (state.tapsMuted) return;                                    // judge hand-off: moving the laptop plays nothing
    if (performance.now() - lastLocalInput < 120) return;           // that bump was a key/trackpad press
    if (msg.peak < 2.5 * threshold) {                               // a weak bump right after our own loop sound = speaker shaking the case
      const now = performance.now();
      if (autoSounds.some(t => now - t > -5 && now - t < 70)) return;
    }                                                               // real taps are stronger, so they still play on loop beats
    if (document.body.classList.contains('show-endcard')) return;
    if (!msg.accepted) return;                                      // not sure which square: skip, like crosstalk cancel
    const zone = (!state.eightZones && msg.zone.endsWith('2')) ? msg.zone.slice(0, 2) : msg.zone;
    if (ZONE_SOUND[zone]) hit('drum', ZONE_SOUND[zone], msg.vel, 'sensor');
  } else if (msg.type === 'touch') {
    onTouch(msg);
  } else if (msg.type === 'cal_tap' || msg.type === 'vel_tap' || msg.type === 'noise_done' || msg.type === 'cal_summary') {
    wizOnEvent(msg);
  } else if (msg.type === 'state') {
    state.sensorsLive = msg.connected;
    const s = $('#sensorStatus');
    s.className = 'pill ' + (msg.connected ? 'on' : 'off');
    s.textContent = msg.connected ? 'sensors live' : 'sensors offline';
    $('#ratePill').textContent = `${msg.rate || 0} Hz`;
    if (!!msg.trackpad !== state.trackpadLive) {                   // trackpad_server.py started or stopped
      state.trackpadLive = !!msg.trackpad;
      document.body.classList.toggle('trackpad-live', state.trackpadLive);
      toast(state.trackpadLive ? 'trackpad live: touch a square' : 'trackpad reader stopped');
      emit('trackpadlive', { on: state.trackpadLive });
    }
    if (typeof msg.threshold === 'number') threshold = msg.threshold;
    if (msg.lid != null) {                                          // pumping the lid fills the tank
      if (state.lastLid == null) state.lastLid = msg.lid;
      const moved = Math.abs(msg.lid - state.lastLid);
      if (moved >= 2) {                                             // ignore sensor flicker of 1 degree
        state.air = Math.min(100, state.air + moved * 0.8);
        state.lastLid = msg.lid;
      }
    }
    if (msg.light != null) {                                        // cover the light sensor = air freshener
      if (state.lightBase == null || msg.light > state.lightBase) state.lightBase = msg.light;
      else state.lightBase = state.lightBase * 0.999 + msg.light * 0.001;
      const covered = state.lightBase > 5 && msg.light < 0.15 * state.lightBase;
      if (covered && !state.covered) airFreshener();
      state.covered = covered;
    }
  }
}

// ---------------------------------------------------------------- trackpad squares
function slotAt(x, y) {                                             // x, y are 0..1 with (0, 0) bottom left
  const col = Math.max(0, Math.min(3, Math.floor(x * 4)));
  return (y >= 0.5 ? 0 : 4) + col;
}
function slotHit(i, vel, source) {
  const s = BANKS[state.bank][i];
  if (s) hit(s.kind, s.name, vel, source);
}
function onTouch(msg) {
  if (msg.tp === 'down') {
    emit('touch', { phase: 'down', id: msg.id, x: msg.x, y: msg.y, slot: slotAt(msg.x, msg.y) });
    if (!state.started || wiz.active || document.body.classList.contains('show-endcard')) return;
    localInput();                                                   // a finger on the trackpad can bump the motion sensor
    const vel = Math.max(0.55, Math.min(1, 0.55 + (msg.size || 0.8) * 0.3));
    slotHit(slotAt(msg.x, msg.y), vel, 'trackpad');
  } else if (msg.tp === 'move') {
    emit('touch', { phase: 'move', fingers: (msg.f || []).map(([id, x, y]) => ({ id, x, y, slot: slotAt(x, y) })) });
  } else if (msg.tp === 'up') {
    emit('touch', { phase: 'up', id: msg.id });
  }
}
function renderBank() {
  const bank = BANKS[state.bank];
  document.querySelectorAll('.trackpad .pad[data-slot]').forEach(el => {
    const s = bank[+el.dataset.slot];
    el.className = 'pad ' + (s.kind === 'note' ? 'note' : s.name.startsWith('voice') ? 'vocal' : 'ufart');
    el.dataset.kind = s.kind;
    if (s.kind === 'note') { el.dataset.note = s.name; delete el.dataset.sound; }
    else { el.dataset.sound = s.name; delete el.dataset.note; }
    el.innerHTML = `<b>${s.label}</b><span>${s.key}</span>`;
  });
  const tp = document.querySelector('.trackpad');
  if (tp) tp.dataset.bank = state.bank;
  const bl = document.querySelector('#bankName');
  if (bl) bl.textContent = state.bank;
  emit('bank', { bank: state.bank, slots: bank });
  if (typeof tour !== 'undefined' && tour.on) setTimeout(tourMark, 0);
}
function nextBank() {
  state.bank = BANK_ORDER[(BANK_ORDER.indexOf(state.bank) + 1) % BANK_ORDER.length];
  renderBank();
  toast(`${state.bank} bank`);
}

function connectSensors() {
  try {
    const es = new EventSource('/events');
    es.onmessage = e => onSensor(JSON.parse(e.data));
    es.onerror = () => {                                            // bridge stopped: say so (EventSource reconnects by itself)
      state.sensorsLive = false;
      const s = $('#sensorStatus'); s.className = 'pill off'; s.textContent = 'sensors offline';
    };
  } catch (err) { console.warn('no sensor bridge', err); }
}

let lastBridgeToast = -1e9;
function cmd(body) {
  return fetch('/cmd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .catch(() => { if (performance.now() - lastBridgeToast > 10000) { lastBridgeToast = performance.now(); toast('bridge not running'); } });
}

// ---------------------------------------------------------------- calibration wizard
// Same idea as tuning an e-drum module: measure the noise floor, teach each pad,
// set the soft/hard range, then test accuracy before the show.
const TAPS_PER_ZONE = 3, VEL_TAPS = 3, TEST_TRIALS = 8;
const ZONE_NAMES = { LT: 'left side, top', LB: 'left side, bottom', RT: 'right side, top', RB: 'right side, bottom',
                     LT2: 'left side, top inner', LB2: 'left side, bottom inner', RT2: 'right side, top inner', RB2: 'right side, bottom inner' };
const wiz = { active: false, step: 0, zones: [], zi: 0, phase: '', trials: 0, correct: 0, target: null };
let lastLocalInput = -1e9;

function activeZones() { return state.eightZones ? ['LT', 'LB', 'RT', 'RB', 'LT2', 'LB2', 'RT2', 'RB2'] : ['LT', 'LB', 'RT', 'RB']; }
function zoneEl(z) { return document.querySelector(`.zone[data-zone="${z}"]`); }
function clearTargets() { document.querySelectorAll('.zone').forEach(z => z.classList.remove('target', 'guess-right', 'guess-wrong')); }

function wizShow(title, text, pct, info = '', go = 'Start') {
  $('#wizTitle').textContent = title; $('#wizText').textContent = text;
  $('#wizBar').style.width = `${pct}%`; $('#wizInfo').innerHTML = info; $('#wizGo').textContent = go;
  document.querySelectorAll('.wiz-steps span').forEach(sp => {
    const n = +sp.dataset.s; sp.className = n < wiz.step ? 'done' : (n === wiz.step ? 'now' : '');
  });
}

function wizOpen() {
  Object.assign(wiz, { active: true, step: 0, zones: activeZones(), zi: 0, phase: 'intro', trials: 0, correct: 0, summary: '' });
  $('#wizard').classList.remove('hidden'); $('#calBtn').classList.add('active');
  wizShow('Hands off the laptop', 'First we measure how still your laptop is, so tiny bumps never trigger a fart. Takes 2 seconds.', 0);
}

function wizClose() {
  document.querySelectorAll('.cal-count').forEach(c => c.remove());
  wiz.active = false; clearTargets(); cmd({ cmd: 'stop' });
  $('#wizard').classList.add('hidden'); $('#calBtn').classList.remove('active');
}

function wizGo() {
  if (!state.sensorsLive && wiz.step < 4) {
    $('#wizInfo').innerHTML = '<b>Sensors offline.</b> Start ./scripts/run_sensors.sh in a terminal, then press Start again.';
    return;
  }
  if (wiz.phase === 'advancing' || wiz.phase === 'noise' || wiz.phase === 'zone' || wiz.phase === 'soft' || wiz.phase === 'hard') return;
  if (wiz.step === 0) {
    wiz.phase = 'noise'; cmd({ cmd: 'noise', seconds: 2 });
    let t = 0; const iv = setInterval(() => { t += 100; $('#wizBar').style.width = `${Math.min(100, t / 20)}%`; if (t >= 2000) clearInterval(iv); }, 100);
    wizShow('Measuring... stay still', 'Do not touch the laptop or the table.', 0, '', '...');
  } else if (wiz.step === 1) wizZone(0);
  else if (wiz.step === 2) wizVel('soft');
  else if (wiz.step === 3) wizTestNext();
  else wizClose();
}

function wizNextStep() {
  wiz.step += 1; clearTargets(); wiz.phase = 'ready';
  if (wiz.step === 1) wizShow('Teach the squares', `Tap each glowing square on your real laptop ${TAPS_PER_ZONE} times. Same spot, normal force.`, 0);
  else if (wiz.step === 2) wizShow('Soft and hard', 'Now we learn your range, so soft taps play quiet farts and hard taps play loud ones.', 0);
  else if (wiz.step === 3) { cmd({ cmd: 'stop' }); wizShow('Test run', `Tap the glowing square. We check ${TEST_TRIALS} taps.`, 0); }
  else wizShow('Ready for the show', 'Calibration saved. It loads automatically next time.', 100, wiz.summary || '', 'Done');
}

function wizZone(i) {
  wiz.zi = i; wiz.phase = 'zone'; clearTargets();
  const z = wiz.zones[i]; zoneEl(z).classList.add('target'); setCalCount(zoneEl(z), 0);
  cmd({ cmd: 'zone_start', zone: z });
  wizShow(`Tap: ${ZONE_NAMES[z]}`, `${TAPS_PER_ZONE} taps on that spot of your laptop. Square ${i + 1} of ${wiz.zones.length}.`,
          (i / wiz.zones.length) * 100, '', 'Waiting for taps...');
}

function wizVel(kind) {
  wiz.phase = kind; cmd({ cmd: `${kind}_start` });
  wizShow(kind === 'soft' ? 'Tap softly' : 'Now tap hard', `${VEL_TAPS} ${kind} taps anywhere on the silver sides.`, kind === 'soft' ? 0 : 50, '', 'Waiting for taps...');
}

function wizTestNext() {
  clearTargets(); wiz.phase = 'test';
  if (wiz.trials >= TEST_TRIALS) {
    const acc = Math.round((wiz.correct / TEST_TRIALS) * 100);
    const tip = acc >= 80 ? 'Great, stage ready.' : (state.eightZones ? 'Try 4 squares (press V) for a cleaner show.' : 'Try teaching again with firmer, more consistent taps.');
    wiz.summary = `Accuracy <b>${acc}%</b>. ${tip}` + (wiz.summary || '');
    wizNextStep(); return;
  }
  const zs = wiz.zones; wiz.target = zs[Math.floor(Math.random() * zs.length)];
  zoneEl(wiz.target).classList.add('target');
  wizShow(`Tap: ${ZONE_NAMES[wiz.target]}`, `Test ${wiz.trials + 1} of ${TEST_TRIALS}`, (wiz.trials / TEST_TRIALS) * 100,
          `Correct so far: <b>${wiz.correct}</b>`, 'Waiting for tap...');
}

function wizOnTap(msg) {                                            // only used in the test step
  if (wiz.phase !== 'test' || !wiz.target) return;
  const z = (!state.eightZones && msg.zone.endsWith('2')) ? msg.zone.slice(0, 2) : msg.zone;
  const right = z === wiz.target;
  if (right) wiz.correct += 1;
  wiz.trials += 1;
  clearTargets(); zoneEl(z) && zoneEl(z).classList.add(right ? 'guess-right' : 'guess-wrong');
  if (ZONE_SOUND[z]) hit('drum', ZONE_SOUND[z], msg.vel, 'sensor');
  $('#wizInfo').innerHTML = `${right ? 'Yes' : 'Missed'}: heard <b>${ZONE_NAMES[z] || z}</b>, sure ${Math.round(msg.conf * 100)}%`;
  wiz.target = null;
  setTimeout(wizTestNext, 650);
}

function wizOnEvent(msg) {
  if (!wiz.active) return;
  if (msg.type === 'noise_done' && wiz.phase === 'noise') {
    wiz.phase = 'advancing';
    $('#wizInfo').innerHTML = `Noise floor set: taps above <b>${msg.threshold.toFixed(3)} g</b> count as hits.`;
    setTimeout(wizNextStep, 900);
  } else if (msg.type === 'cal_tap' && wiz.phase === 'zone') {
    const el = zoneEl(msg.zone); setCalCount(el, msg.count);
    el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 120);
    const per = 100 / wiz.zones.length;
    $('#wizBar').style.width = `${wiz.zi * per + per * Math.min(1, msg.count / TAPS_PER_ZONE)}%`;
    $('#wizInfo').innerHTML = `<b>${msg.count}</b> / ${TAPS_PER_ZONE} taps, strength ${msg.peak}`;
    if (msg.count >= TAPS_PER_ZONE) {
      wiz.phase = 'advancing';
      if (wiz.zi + 1 < wiz.zones.length) setTimeout(() => wizZone(wiz.zi + 1), 350);
      else setTimeout(wizNextStep, 350);
    }
  } else if (msg.type === 'vel_tap' && (wiz.phase === 'soft' || wiz.phase === 'hard')) {
    $('#wizInfo').innerHTML = `<b>${msg.count}</b> / ${VEL_TAPS} ${msg.mode} taps, strength ${msg.peak}`;
    $('#wizBar').style.width = `${(msg.mode === 'soft' ? 0 : 50) + 50 * Math.min(1, msg.count / VEL_TAPS)}%`;
    if (msg.count >= VEL_TAPS) {
      wiz.phase = 'advancing';
      cmd({ cmd: `${msg.mode}_stop` });
      if (msg.mode === 'soft') setTimeout(() => wizVel('hard'), 400); else setTimeout(wizNextStep, 400);
    }
  } else if (msg.type === 'cal_summary') {
    const close = (msg.separation || []).filter(p => p.sim > 0.92);
    if (close.length) wiz.summary = (wiz.summary || '') + ` Hard to tell apart: ${close.map(p => `${p.a}/${p.b}`).join(', ')}.`;
  }
}

function wizSkip() {
  if (wiz.phase === 'advancing' || wiz.phase === 'noise') return;   // already moving on
  if (wiz.step === 1 && wiz.phase === 'zone') { if (wiz.zi + 1 < wiz.zones.length) return wizZone(wiz.zi + 1); }
  if (wiz.step === 2 && wiz.phase === 'soft') { cmd({ cmd: 'soft_stop' }); return wizVel('hard'); }
  if (wiz.step === 2 && wiz.phase === 'hard') cmd({ cmd: 'hard_stop' });
  if (wiz.step === 3) { wiz.trials = TEST_TRIALS; return wizTestNext(); }
  wiz.phase = 'advancing';
  wizNextStep();
}

function setCalCount(el, n) {
  let c = el.querySelector('.cal-count');
  if (!c) { c = document.createElement('div'); c.className = 'cal-count'; el.appendChild(c); }
  c.textContent = `${n} tap${n === 1 ? "" : "s"}`;
}

function zoneClicked(el) { if (!wiz.active && !state.trackpadLive) hit('drum', ZONE_SOUND[el.dataset.zone], 0.8, 'pointer'); }

function localInput() {                                             // keys and clicks shake the laptop too
  lastLocalInput = performance.now();
  if (state.sensorsLive) cmd({ cmd: 'suppress', ms: 120 });
}

// Closing screen (Enter key): loop stops, clean product shot, tagline, name. Press Enter again to come back.
function toggleEndCard() {
  const on = !document.body.classList.contains('show-endcard');
  document.body.classList.toggle('show-endcard', on);
  if (on) {
    clearLoop();                                                    // nothing left playing behind the closing screen or after it
    state.stink = 0;
  }
  emit('endcard', { on });
}

function setEightZones(on) {
  state.eightZones = on;
  document.querySelectorAll('.zone.extra').forEach(z => z.classList.toggle('disabled', !on));
  toast(on ? '8 squares' : '4 squares');
}

// ---------------------------------------------------------------- input wiring
let threshold = 0.08;
function wire() {
  $('#startBtn').addEventListener('click', async () => {
    $('#start').style.display = 'none';
    try { await startAudio(); }
    catch (err) { console.error(err); $('#start').style.display = ''; toast('sound failed to start, click again'); }
  });
  $('#calBtn').addEventListener('click', () => wiz.active ? wizClose() : wizOpen());
  $('#wizGo').addEventListener('click', wizGo);
  $('#wizSkip').addEventListener('click', wizSkip);
  $('#wizClose').addEventListener('click', wizClose);
  document.addEventListener('mousedown', localInput, true);
  document.querySelectorAll('.zone').forEach(el => el.addEventListener('mousedown', () => zoneClicked(el)));
  const pressure = e => (e.webkitForce >= 1 ? Math.min(1, Math.max(0.5, 0.5 + (e.webkitForce - 1) * 0.25)) : 0.8);
  const tpEl = document.querySelector('.trackpad');
  if (tpEl) tpEl.addEventListener('mousedown', e => {               // squares are rebuilt per bank, so listen on the frame
    const el = e.target.closest('.pad[data-slot]');
    if (el && !state.trackpadLive) slotHit(+el.dataset.slot, pressure(e), 'pointer');
  });
  const songBtn = document.querySelector('#songBtn');
  if (songBtn) songBtn.addEventListener('click', () => { songBtn.blur(); toggleSong(); });
  const bankBtn = document.querySelector('#bankBtn');
  if (bankBtn) bankBtn.addEventListener('click', nextBank);
  document.addEventListener('webkitmouseforcewillbegin', e => e.preventDefault());   // no Look Up popup on deep press
  // Safari reports Force Touch pressure: 1 = normal click, up to 3 = deep press


  document.addEventListener('keydown', e => {
    if (e.key === '?' || e.key === '/') { e.preventDefault(); toggleTutorial(); return; }
    if (document.body.classList.contains('show-tut')) { e.preventDefault(); toggleTutorial(false); if (e.key === ' ' || e.key === 'Enter') tourStart(); return; }
    if (tour.on && e.key === 'ArrowRight') { e.preventDefault(); tourNext(); return; }
    if (tour.on && e.key === 'Escape') { e.preventDefault(); tourQuit(); return; }
    if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); if (!e.repeat) nextBank(); return; }
    if (e.repeat || !state.started || e.metaKey || e.ctrlKey) return;
    localInput();
    const k = e.key.toLowerCase();
    if (KEY_ZONE[k]) {
      const z = KEY_ZONE[k];
      if (z.endsWith('2') && !state.eightZones) return;
      hit('drum', ZONE_SOUND[z], 0.85);
    } else if (KEY_PAD[k]) hit('pad', KEY_PAD[k], 0.9);
    else if (KEY_NOTE[k]) hit('note', KEY_NOTE[k], 0.8);
    else if (k === ' ') { e.preventDefault(); toggleRecording(); }
    else if (k === 'backspace') { e.preventDefault(); undoLast(); }
    else if (k === 'c') clearLoop();
    else if (k === 'b') toggleSong();
    else if (k === 'n') { state.metronome = !state.metronome; toast(state.metronome ? 'metronome on' : 'metronome off'); }
    else if (k === 'g') state.air = Math.min(100, state.air + 20);
    else if (k === 'f') airFreshener();
    else if (k === 'h') hit('drum', 'synth_slow', 0.9);
    else if (k === 'v') setEightZones(!state.eightZones);
    else if (k === 'm') {
      state.tapsMuted = !state.tapsMuted;
      document.body.classList.toggle('taps-muted', state.tapsMuted);                       // small corner badge, always visible
      if (!document.body.classList.contains('stage')) toast(state.tapsMuted ? 'taps muted (hand-off)' : 'taps live');
      emit('tapsmuted', { on: state.tapsMuted });
    }
    else if (k === 'enter') toggleEndCard();
    else if (k === 'p' && e.shiftKey) { document.body.classList.toggle('stage'); emit('stage', { on: document.body.classList.contains('stage') }); }
    else if (k === 'p') togglePause();
    else if (k === '[') { threshold = Math.max(0.01, threshold - 0.01); cmd({ cmd: 'threshold', value: threshold }); toast(`sensitivity ${threshold.toFixed(2)}g`); }
    else if (k === ']') { threshold += 0.01; cmd({ cmd: 'threshold', value: threshold }); toast(`sensitivity ${threshold.toFixed(2)}g`); }
  });
}

buildHud();
buildTutorial();
buildTour();
renderBank();
wire();
setEightZones(false);
connectSensors();
