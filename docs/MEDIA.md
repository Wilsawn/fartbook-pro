# FartBook Pro demo video (under 60 s)

One Cap take, edited and exported by 4 PM.

## Tool stack

**Primary: Cap (free for personal use).** Records screen, system audio, mic and camera together; auto-zoom on clicks, camera bubble, camera-only scenes, local captions, 16:9 and vertical export, no watermark. Setup: 10 min.

1. Install from cap.so/download. Allow Screen Recording, Microphone, Camera (System Settings > Privacy & Security), reopen Cap.
2. Camera: iPhone via Continuity Camera, mounted on the lid, locked, landscape. Keep it off the light sensor next to the Mac camera (or use F for the freshener).
3. Mic: wired earbuds mic if you have one, else the iPhone mic.
4. Mode **Studio**, turn on **Record System Audio** (Safari's farts, recorded digitally, no BlackHole).
5. 10 s test: talk, tap a pad, play back. Hear both? Go.

**Free fallback: OBS Studio 30+** with macOS Screen Capture, **macOS Audio Capture** and Video Capture Device (iPhone) sources. No auto-zoom or captions. On macOS 27, Shift-Cmd-5 > Options > Include System Audio also works.

Paid alternative: Screen Studio, $29/month (no export without a plan), more polish.

## Shot list and script (about 57 s)

Talk in the gaps; let every fart land alone. Cap zooms on clicks only: **click** pads you want zoomed, use keys for the rest.

| Time | Shot | You say / do |
|---|---|---|
| 0 to 4 | **Selfie** (Cap camera-only scene) | "What's up guys, so I built a fart instrument. Out of my MacBook." |
| 4 to 10 | **CUT + ZOOM** into the screen, bubble bottom-right | "Apple hid a motion sensor in this MacBook and never told anyone. So the silver sides are drum pads." |
| 10 to 12 | Screen (or phone insert: hands) | Tap left side, right side. |
| 12 to 19 | **ZOOM** on the uncle pads (click them) | "The trackpad is my uncle." Click V1, V2 ("uncle... not now"). Hands off 1 s. Click uncle fart 1. |
| 19 to 24 | Zoom out | "Hit space, it loops." SPACE, tap kick and snare. |
| 24 to 30 | **ZOOM** on the air tank (or phone insert: lid) | "But farts need air. So the lid is a bellows." Pump the lid 3 times. |
| 30 to 38 | **ZOOM** on the note row | "Fill the tank, and the bottom row plays fart notes." Q W E R T. Run dry. "No air, no notes." |
| 38 to 44 | No zoom | CRASH + uncle fart 3 (EVACUATE). "Oh no. Air freshener." Cover the camera. |
| 44 to 48 | Slow zoom on the cushion | "Your laptop was a whoopee cushion the whole time." |
| 48 to 55 | **CUT** to selfie | "I'm Wilsawn, this is FartBook Pro, made at Stupid Ideas Hackathon Ottawa." Look at the laptop: "Uncle, not now." Press 9 (fart). |
| 55 to 58 | End card | Name, project, uncle clip credit. |

## Recording in a noisy room

- A hallway or stairwell beats any mic setting. Mic 15 cm from your mouth, talk a bit loud.
- **Headphones on:** farts are recorded digitally, so the mic only hears you. No headphones? Mac volume low, check the test clip.
- Voice peaks around -6 dB, never red. System audio a bit under the mic.
- Selfie: face a window or bright wall, nothing bright behind you. Camera at eye level, landscape, face centred so the 9:16 crop keeps you.
- Safari full screen, stage mode (P), Do Not Disturb on.

## Edit plan (Cap editor, 20 min)

1. Trim dead air to 55 to 58 s.
2. Scene track: camera-only 0 to 4 and 48 to 55, screen + bubble between.
3. Zoom track: keep zooms on uncle pads, tank, notes; delete jittery ones; add a slow cushion zoom at 44 s.
4. Captions: generate, fix "FartBook" and "Wilsawn", big, bottom centre, burned in (people watch muted).
5. No music: the farts are the music.
6. Export MP4 1080p 30 fps: **16:9** (Devpost/YouTube, X, LinkedIn) and **Vertical 9:16** (Reels, TikTok, Shorts). Re-check zooms in vertical.
7. Devpost: YouTube unlisted link. Discord: 20 MB max, else Cap's Social preset or the YouTube link.

Phone inserts (hand taps, lid pump): join in iMovie or the template below.

## Optional: Remotion template (rendered in the sandbox)

`media/remotion/`, Rubber Room style: cushion title stinger at the cut, punch-in zoom, name lower-third, word-highlight captions, end card, 16:9 and 9:16 from the same clips. Proof renders: `media/sample-16x9.mp4`, `media/sample-9x16.mp4` (11 s, real FartBook clip, placeholder selfie).

```bash
cd media/remotion && npm install
# put selfie.mp4 + screen.mp4 (Cap export) in public/, set clip lengths in src/Root.tsx
node scripts/make-captions.mjs captions/script-lines.json public/captions.json
npm run studio            # preview
npm run render            # out/fartbook-16x9.mp4
npm run render:vertical   # out/fartbook-9x16.mp4
```

Only if Cap's export needs more. Untested on your Mac (first render downloads Chrome Headless Shell). Free for individuals. Claude skills: `npx skills add remotion-dev/skills`. Word-timed captions from your voice: `npx create-video@latest --tiktok` (local whisper.cpp).

## Links

- Cap: https://cap.so/download, pricing https://cap.so/pricing, system audio https://cap.so/blog/record-screen-mac-system-audio
- Screen Studio pricing (Aug 2026): https://trainn.co/blog/screen-studio-pricing/; 4.0 captions: https://alternativeto.net/news/2026/10/screen-studio-4-0-adds-transcript-editing-a-camera-cutout-tool-and-more-mouse-effects/
- Apple screen recording (system audio on macOS 27+): https://support.apple.com/102618
- Continuity Camera: https://support.apple.com/102546
- OBS desktop audio on macOS: https://obsproject.com/kb/macos-desktop-audio-capture-guide
- Remotion skills: https://www.remotion.dev/docs/ai/skills; TikTok captions template: https://www.remotion.dev/templates/tiktok
- Claude Code video toolkit (Remotion + more, MIT): https://github.com/digitalsamba/claude-code-video-toolkit
- Discord free uploads raised to 20 MB (Aug 2026): https://www.gadgetreview.com/?p=402010
