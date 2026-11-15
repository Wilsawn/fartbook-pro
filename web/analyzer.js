// Sound design department: live fart spectrum. See docs/TEAM.md.
// A quiet strip of rounded "gas column" bars along the bottom of the page, fed by the master
// limiter (everything you hear). It sits behind the instrument, never takes clicks, and shows
// in both normal and stage mode (style.css makes it quieter in stage mode).
// Farts live low, so it shows 30 Hz to 6 kHz on a log scale: kicks bounce the left end,
// squeaks the right. Colours are the Rubber Room inks from style.css: quiet bars gas green,
// louder bars cushion pink, the very loudest soft ink. Flat colour, no glow.
//
// Audio routing: Tone's Limiter -> a plain GainNode made in Tone's own context -> audioMotion.
// audioMotion takes its AudioContext from `source.context`, so it never makes a second one, and
// connectSpeakers:false keeps it off the speakers (nothing is heard twice).
// If anything fails, it logs one console.info line and the page carries on without it.

const STRIP_HEIGHT = 70;    // px, matches style.css (#fartSpectrum)
let done = false;

function quietFail(why) {
  if (done) return;
  done = true;
  console.info('fart spectrum off:', why);
}

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// Load the vendored module up front (not at the first click), but catch a missing or broken file.
const libReady = import('./vendor/audioMotion-analyzer.js')
  .then(m => m.default)
  .catch(err => { quietFail(`could not load audioMotion (${err && err.message})`); return null; });

async function attach(master, context) {
  const AudioMotionAnalyzer = await libReady;
  if (!AudioMotionAnalyzer || done) return;
  if (!master || !context || typeof context.createGain !== 'function') { quietFail('no master or context'); return; }

  const box = document.createElement('div');
  box.id = 'fartSpectrum';
  box.setAttribute('aria-hidden', 'true');
  Object.assign(box.style, {
    position: 'fixed', left: '0', right: '0', bottom: '0', height: `${STRIP_HEIGHT}px`,
    zIndex: '0', pointerEvents: 'none', opacity: '0.3',
  });
  document.body.appendChild(box);

  try {
    // Tone nodes connect to plain Web Audio nodes made in the same context.
    const tap = context.createGain();
    master.connect(tap);

    const am = new AudioMotionAnalyzer(box, {
      source: tap,
      connectSpeakers: false,
      mode: 5,                 // 1/3 octave bands: chunky columns, readable from the back row
      frequencyScale: 'log',
      minFreq: 30, maxFreq: 6000,
      minDecibels: -80, maxDecibels: -20,
      smoothing: 0.6,
      barSpace: 0.35,
      roundBars: true,
      showPeaks: false,        // fewer moving bits: the cushion is the star
      showScaleX: false, showScaleY: false,
      overlay: true, showBgColor: false, bgAlpha: 0,
      reflexRatio: 0,
      colorMode: 'bar-level',
      maxFPS: 30,              // cheap on a laptop that is also running the show
      start: true,
    });
    am.registerGradient('rubberRoom', {
      bgColor: 'transparent',
      colorStops: [
        { color: cssVar('--ink', '#1F1A17'), level: 1 },
        { color: cssVar('--pink', '#EF5B7B'), level: 0.85 },
        { color: cssVar('--green', '#9CCB3B'), level: 0.45 },
      ],
    });
    am.gradient = 'rubberRoom';
    done = true;
    window.FB.spectrum = am;   // handy for debugging in the console
  } catch (err) {
    box.remove();
    quietFail(err && err.message);
  }
}

if (!(window.FB && window.FB.bus)) {
  quietFail('FB.bus missing');
} else if (window.FB.state && window.FB.state.started && window.FB.master && window.Tone) {
  attach(window.FB.master, Tone.getContext().rawContext);          // audio was already running
} else {
  window.FB.bus.addEventListener('audio-ready', e => {
    const d = e.detail || {};
    attach(d.master, d.context);
  }, { once: true });
}
