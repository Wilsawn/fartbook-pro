# Visual research notes (Rubber Room)

**Chrome Music Lab, Kandinsky** ([Active Theory](https://medium.com/@activetheory/chrome-music-lab-making-kandinsky-7de5ab04f4fe)).
Faces live inside the same physics as the shape: eyes blink, mouths sing, and on sound the
points "scale up and snap back ... with a spring". No instructions; people "just dive in".
Take: every pad is a creature with eyes; a hit opens its mouth with a spring pop.

**Patatap** ([Wikipedia](https://en.wikipedia.org/wiki/Patatap), [VICE](https://www.vice.com/en/article/patatap-turns-qwerty-into-a-real-time-instrument)).
Empty stage, one bold flat shape per key, palette and sounds switch together.
Take: punchlines (uncle farts, CRASH, H) own the whole screen for a beat with one giant shape.
Everything else stays small so the big one lands.

**Teenage Engineering, OP-1 and Pocket Operators** ([guide](https://blakecrosley.com/guides/design/teenage-engineering), [PO](https://en.wikipedia.org/wiki/Pocket_Operators)).
"The constraint is the point": a tiny palette where orange always means action, each mode
takes the full screen, the screen graphics are toys (tape reels spin, a little character
dances to the beat on the PO LCD). Take: one action colour (hot pink = the cushion = you
did something), ink + paper for everything else, and the screen character reacts to the music.

**Nintendo, Rhythm Heaven and WarioWare** ([Iwata Asks](https://iwataasks.nintendo.com/interviews/ds/rhythm-heaven/0/2), [Sakamoto GDC](https://www.gamedeveloper.com/game-platforms/gdc-nintendo-s-sakamoto-s-four-creative-tenets)).
Players must feel "I just pressed a button!" right away; Sakamoto wants to "engineer the laugh"
with mood, timing, foreshadowing, contrast. Take: the uncle bit is staged: dim, caption,
the cushion turns to the audience, a held beat, then the burst (contrast after quiet).

**Apple, springs** ([WWDC23 Animate with springs](https://developer.apple.com/wwdc23/10158)).
Springs keep velocity continuous and are interruptible; bounce above 0.4 is cartoonish for
UI. Take: more bounce than Apple would use (cartoon), but interruptible so rolls never stutter.

**Squash and stretch** ([Josh Comeau](https://www.joshwcomeau.com/animation/squash-and-stretch)).
Event triggered, snap back fast, keep area constant (scaleX = 1/scaleY), respect reduced motion.

**Anthropic, frontend design skills** ([article](https://claude.com/resources/articles/improving-frontend-design-through-skills)).
One named theme, one distinctive font used decisively, extreme weights, 3x size jumps, a
dominant colour with sharp accents, an atmospheric background, one orchestrated motion moment.

## Decisions this led to
- Theme: Rubber Room. Paper `#F6EBD9` with grain, ink `#1F1A17`, cushion pink `#EF5B7B` as the
  only loud colour; green, mustard, blue only for gas, uncle and notes.
- Font: **Gluten** (OFL, variable 100 to 900, bundled offline). 900 looks like inflated
  balloon letters; 300 stays readable in the wizard. Two sizes on stage.
- Hero: one giant cushion with a face. Pads become creatures. No numbers on screen.
- The orchestrated moment: the uncle punchline sequence.
