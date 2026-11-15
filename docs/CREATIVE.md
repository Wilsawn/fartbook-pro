# FartBook Pro creative direction

**Today (screenshot):** a generic dark dashboard with emoji, pills, grey cards, a puff covering "uncle fart 1" and an empty bottom band. Nothing says whoopee cushion, and near-black goes muddy on a projector.

## Three directions

**1. Rubber Room (cartoon whoopee cushion world)**
- Concept: the air tank is a whoopee cushion with a face that you slowly overfill.
- Palette: paper `#F6EBD9`, ink `#1F1A17`, cushion pink `#EF5B7B`, gas green `#9CCB3B`, mustard `#F5B700`, note blue `#4FB3E8`.
- Type: `ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", system-ui`, weight 800, lowercase.
- Shapes: wobbly Rough.js outlines, 4 px ink, flat fills. Puffs are three overlapping circles, never a smooth blob.
- Hit: f0 pad squashes (scaleY .82, scaleX 1.15) with the sound; f1 a group-colour puff pops off the outer edge; f2 to f12 elastic return, one overshoot; puff drifts up, gone by 600 ms.
- Tank: the cushion inflates, trembles near full, deflates as notes play. Haze: translucent green rising from the bottom.
- "Uncle, not now": V1 dims the screen, caption "uncle..."; V2 adds "...not now."; the cushion slowly looks at the audience (400 ms hold); uncle fart is a full-screen green burst, cushion squashed flat.
- Risk: twee or busy if every hit is big.

**2. Department of Flatulence (deadpan lab)**
- Concept: an instrument that logs every fart as a scientific event.
- Palette `#F2F1EC #111111 #D7263D #2F6FED #7FB800`; type `ui-monospace, Menlo`; thin rules, grids.
- Hit: a seismograph spikes and prints `EVENT 0042 WET 0.83`. Tank is a pressure gauge; haze is hatching in a chamber diagram.
- "Uncle, not now": `SUBJECT: UNCLE / REQUEST: DENIED`, then an `ANOMALY` stamp.
- Risk: the joke lives in small text a crowd can't read; not toy-like.

**3. Gas Giant (Patatap burst stage)**
- Concept: every key floods the screen with one bold shape.
- Palette `#2A1E26 #FF4F79 #FFB400 #00C2A8 #F6F1E9`; black-weight system sans; perfect circles and bars.
- Hit: the shape scales 0 to full screen in 80 ms, then wipes. Tank is a bar, haze a tint.
- "Uncle, not now": black screen, caption, giant brown circle.
- Risk: a Patatap clone with no farts, and the laptop's sides vanish.

## Pick: 1, Rubber Room, with Gas Giant's full-screen burst for punchlines only
- **Projector:** dark ink on light ground holds contrast in a lit room; 4 px lines read from the back row.
- **One-joke clarity (WarioWare):** one character, the cushion, explains the product in a glance.
- **Delo's references:** Patatap's one bold shape per sound, plus Kandinsky's blinking, singing faces.
- **Story:** fill, release, stink, freshen; the cushion acts it out.

## Taste checklist (Visual lead must pass all)
**Do / don't**
1. No emoji, pills, glow, blur shadows or gradients (haze excepted). If it could ship in a SaaS dashboard, cut it.
2. Hit visuals never cover a pad label; puffs spawn outside the pad edge.
3. The laptop fills the screen. A "stage mode" key hides footer, Hz and sensor pills.
4. One font family, two sizes. Wobble the outlines, not the text.
5. Three tiers: drums small and local; vocals get a caption; uncle farts, CRASH, H go full screen. Restraint makes the punchline land.

**Timing**
- Sound and squash on the same frame: animate synchronously in the `hit` handler, no delay, no ease-in. Peak at frame 0, return in 180 to 250 ms with `elastic.out(1, 0.4)`.
- Squash keeps volume (scaleX × scaleY ≈ 1); `vel` drives puff size.
- Taps can't be anticipated, so anticipation lives in the tank: the cushion swells and shakes faster as air rises.
- The pause: after V2, freeze all idle motion 300 to 400 ms before the uncle fart.
- Long sound, long visual: the H puff lasts the whole sample.

**Delight details**
1. The cushion's eyes squeeze shut on every fart and glance at the pad you hit.
2. Its valve lip flaps on melody notes; lip size follows pitch.
3. Out of air: cushion goes pancake-flat, the note pad shakes "no" three times.
4. Freshener: a cartoon spray can slides in, three "pshh" puffs, haze wipes off left to right.
5. Loop ring: the playhead is a tiny puff; recorded dots bounce as it passes.

## Sound taste notes
- **Funny:** long and whiny, rubbery buzz around 80 to 300 Hz, flutter around 15 to 40 Hz, pitch bending at the tail (Trevor Cox's study: longer and whinier rated funnier).
- **Gross:** wet gurgles and splatter. Keep wetness to the WET pad.
- **Fake:** clean sine sweeps, no breathy onset, one sample machine-gunned. Fix with ±1 semitone and start jitter.
- **Punchlines:** uncle fart 3 and H. Longest and biggest-feeling. Integrator request: duck the rest about 6 dB under them.
- **Drum farts:** under 250 ms, tight starts: rhythm, not jokes.
- **Mix:** uncle vocals on top (keep 1 to 4 kHz clear), drums second, melody a whiny reed bed underneath. Peaks near -6 dBFS so the limiter doesn't pump.

## Three surprising ideas (each under an hour)
1. **Fart receipt:** after the drop a till receipt prints the loop: `1x WET ... 0.4 L`, `uncle: not now ... priceless`, `TOTAL AIR 14.7 L`.
2. **Keynote end card:** final F fades to white, one thin line with the closing tagline, cushion beneath like a product shot. No logos.
3. **Laugh-O-Meter:** mic level fills a "crowd" meter; at the peak the cushion bows. Skip if the mic prompt is risky.

## References
- Patatap: one palette = colours + sounds + shapes, fewer melodic sounds so it never gets muddy. [Wikipedia](https://en.wikipedia.org/wiki/Patatap), [It's Nice That](https://www.itsnicethat.com/articles/patatap-1), [CAN](https://www.creativeapplications.net/project/patatap-portable-animation-and-sound-kit-by-jonobr1-and-lullatone)
- Chrome Music Lab Kandinsky: blinking eyes and singing mouths in the same physics as the line; one scale so anything sounds good. [Active Theory](https://medium.com/@activetheory/chrome-music-lab-making-kandinsky-7de5ab04f4fe)
- Pocket Operators: health bars double as VU meters, and specific samples trigger character moves. [Soundtech](https://www.soundtech.co.uk/musicians-blog/first-look-teenage-engineering-capcom-pocket-operator-series.html), [Wikipedia](https://en.wikipedia.org/wiki/Pocket_Operators)
- Rhythm Heaven: immediate, obvious response to every input, and sound as the timing cue. [Iwata Asks](https://iwataasks.nintendo.com/interviews/ds/rhythm-heaven/0/2)
- WarioWare: simplicity, humour with layers, art where "everything should match". [SuperJump](https://superjumpmagazine.com/what-are-the-components-of-a-perfect-warioware-microgame)
- Ableton Learning Music: minimal front end that removes distraction. [CDM](https://cdm.link/ableton-learn/)
- Whoopee cushion science: longer and whinier is funnier, and unexpected timing matters. [20K](https://www.20k.org/episodes/makinwhoopee), [Optimist Daily](https://optimistdaily.com/2009/08/what-makes-the-whoopee-cushion-so-funny)
- Anticipation and timing: [Toon Boom](https://learn.toonboom.com/modules/animation-principles/topic/anticipation-principle)
