# FartBook Pro: pitch and submission kit

60 seconds on stage. Post in #share-your-work on Discord before 5 PM (that is what gets judged), then Devpost.

## 1. Opening hooks

1. "Apple hid a motion sensor in this MacBook and never told anyone. I used it for farts."
2. (Silent. Tap the side of the laptop. It farts.) "That was the laptop."
3. "Everyone here brought a laptop. Only one of them farts."

**Pick: 2, then 1.** The first sound is a tapped laptop farting. Show, then explain.

Changed from DEMO.md's "every MacBook... used it for nothing": we only know M2 or newer works and the sensor is undocumented.

## 2. The 60-second run

Before: Safari full screen, volume 80%, calibrated, loop cleared, stage mode on.

| Time | On screen | You do | You say |
|---|---|---|---|
| 0 to 2 | Cushion squashes | Tap left side, top (WET) | nothing |
| 2 to 7 | Cushion idle | Hands up | "That was the laptop. Apple hid a motion sensor in this MacBook and never told anyone. I used it for farts." |
| 7 to 10 | "uncle..." then "...not now." | Trackpad V1, V2 | nothing |
| 10 to 11.5 | Freeze, cushion looks at the crowd | **Hands off, look at the audience** | nothing (the pause is the joke) |
| 11.5 to 15 | Full-screen green burst | Uncle fart (8) | nothing, wait for the laugh |
| 15 to 25 | Loop ring turns | SPACE, KICK and SNARE on the sides, add SQUEAK | "The sides are drum pads. It learned where I tap." |
| 25 to 34 | Captions stutter | "I'm sorry" chop on the beat | nothing |
| 34 to 46 | Air tank fills | SPACE to stop recording, hand a judge the laptop | "Pump the lid." (beat) "Now press a note." |
| 46 to 52 | Sad fart melody | Take it back, two more notes | "No air, no notes." |
| 52 to 57 | CRASH, EVACUATE, spray can | Uncle fart 3, cover the camera | "Oh no. Air freshener." |
| 57 to 60 | Cushion product shot | Step back | "FartBook Pro. Your laptop was a whoopee cushion the whole time." |

Judge out of air? The cushion goes flat and shakes "no". Keep it. No judge near the stage: pump it yourself.

Untested: moving the laptop may fire drum hits (TESTING.md test 7). Rehearse the hand-off at the venue; press M first (mutes laptop taps for the hand-off; press M again after).

## 3. 15-second backup

Tap the side (fart). "Hidden motion sensor in my MacBook. I used it for farts." V1, V2, pause, uncle fart. Cover the camera. "FartBook Pro."

## 4a. Discord #share-your-work

> **FartBook Pro**: my MacBook is a fart loop station. Tap the silver sides (the hidden motion sensor plays fart drums), pump the lid to fill an air tank for fart melodies, touch the trackpad (split into 8 real squares, 2 banks) for uncle vocal chops, farts and fart notes, cover the camera for air freshener. Song: "Uncle, Not Now".
> Video: [link] | Devpost: [link]
> Uncle clip by Jovonnie B (YouTube), sound effects from Uppbeat.

## 4b. Devpost

**Inspiration.** Newer MacBooks hide an undocumented motion sensor, lid angle sensor and light sensor. Patatap-style instrument, whoopee cushion you already own.

**What it does.** Silver sides are drum squares. The lid is a bellows filling an air tank. The real trackpad is split into 8 squares (2 rows x 4, like a pad controller) in two banks switched with Tab: uncle chops and farts, and air-powered fart notes. Touch a square, no cursor. It all loops. Covering the light sensor sprays air freshener. Every control has a keyboard backup.

**How I built it.** A Python server reads the accelerometer and gyroscope (about 800 Hz), lid angle and ambient light through macimu (sudo, M2 or newer). A stdlib Python bridge triggers like a drum module: high-pass filter, noise floor from 2 s of stillness, 4 ms peak scan, velocity curve from soft and hard taps, 70 ms mask so one tap is one hit. One sensor covers the whole laptop, so it finds the square by matching each tap's push direction and rotation to calibration taps (k-nearest neighbours) and drops unsure matches. A second helper reads raw finger positions from macOS's MultitouchSupport framework (the same one TrackpadOSC and TrackWeight use) so the physical trackpad becomes the pad grid. Key and trackpad presses briefly mute taps. The browser runs Tone.js: 2-bar loop, choke groups, limiter, and a cartoon stage (GSAP squash and stretch) where every drum is a character and the whoopee cushion is the lead singer, with lips on its valve.

**Challenges.** Two taps at the same instant become one bump. Typing shakes the laptop. The sensor library's method names had to be found at runtime.

**Accomplishments.** 40/40 square matches on simulated taps; on this laptop: [fill in from calibration test]. Fully offline, still plays if sensors die.

**What I learned.** How drum pads handle threshold, mask time and crosstalk. Longer, whinier farts are funnier (Trevor Cox).

**What's next.** Trackpad pressure for velocity, swipes for drops, tilt for stomach gurgles, Rive-animated characters.

**Built with.** Python, macimu, MultitouchSupport (ctypes), JavaScript, Tone.js, GSAP 3.13, audioMotion-analyzer, Safari, Claude Code (cut any not in the final build).

**Credits.** Uncle clip: "Drunk ahh uncle farting while apologizing in the morning" by Jovonnie B, https://www.youtube.com/watch?v=d2dTU7nUDzU (via a Voicemod soundboard; permission requested, not in the public repo). Meme farts: sound effects from Uppbeat. Synth farts, melody note and spray made in code. Tone.js (MIT). Inspired by the Socratica Symposium 2026 MacBook instrument demo, MacMonium, MAcordion, kickpads and Sam Gold's LidAngleSensor.

## 5. Judge questions

- **How does it know where I tapped?** Each spot rocks the laptop differently. Calibration records 8 taps per square; new taps are matched to the closest. Unsure taps are ignored.
- **Latency?** About 6 ms on paper before the browser's audio output. Then: "I measured [X] ms," or "I haven't filmed it on this laptop yet."
- **Did you use AI?** "Yes, I built it with Claude Code as a pair programmer. Nothing runs AI live: tap detection is signal processing plus nearest-neighbour matching, and the synth farts are made in code."
- **Today vs before?** Section 6, plainly.
- **What's next?** Pressure-sensitive trackpad squares, swipes for drops, more banks (one per meme).

## 6. Check the rules first

I couldn't load the official stupideas.com rules. Ask an organizer on Discord: is pre-event code allowed, and should AI tools be disclosed? Then one honest Devpost line:

> "Prepared before the event: [...]. Built at Bayview Yards today: [...]. Built with help from Claude Code."

Fill in only what's true. If pre-event code isn't allowed, tell organizers before demos, not after.

## Sources

- Toronto Stupid Ideas Hackathon (awards Stupid, Stupider, Stupidest, Most Breakup Worthy; no public rubric): https://luma.com/j52svjg0
- Judges: one clear "this is possible now" moment, one flow, honesty: https://blog.jetbrains.com/ai/2026/06/how-to-win-a-hackathon-notes-from-the-judging-table/
- 60-second demos: skip how you built it, joke through failures: https://ellemorrill.substack.com/p/tips-for-your-60-second-techcrunch-disrupt-demo
- Stupid hackathon project examples: https://torontolife.com/city/worst-inventions-stupid-shit-no-one-needs-hackathon-ryerson-university/
- Original Stupid Hackathon: https://tisch.nyu.edu/itp/events/spring-2016/stupid-hackathon
