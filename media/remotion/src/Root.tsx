import React from 'react';
import { CalculateMetadataFunction, Composition } from 'remotion';
import { Demo, DemoProps } from './Demo';

const FPS = 30;

const calc: CalculateMetadataFunction<DemoProps> = ({ props }) => ({
  durationInFrames: Math.max(
    1,
    Math.round((props.introSec + props.screenSec + props.outroSec + props.endSec) * FPS),
  ),
});

// Edit these to match your real clips (files go in public/).
// introSec / screenSec / outroSec are how long each clip plays, in seconds.
const real: DemoProps = {
  introSrc: 'selfie.mp4',
  introStartSec: 0,
  introSec: 4,
  screenSrc: 'screen.mp4',
  screenStartSec: 0,
  screenSec: 44,
  outroSrc: 'selfie.mp4',
  outroStartSec: 4,
  outroSec: 8,
  endSec: 3,
  screenFocusX: 0.5,
  captionsFile: 'captions.json',
  name: 'Wilsawn Dideh',
  tagline: 'software engineer + community builder, ottawa',
  project: 'FartBook Pro',
  line: 'your laptop was a whoopee cushion the whole time.',
  event: 'stupid ideas hackathon ottawa 2026',
  handle: '@wilsawn_stack',
  credits: 'uncle clip: jovonnie b (youtube). sound effects from uppbeat.',
  sfx: [],
  vertical: false,
};

// Short proof render: placeholder selfie, a real 6 s FartBook screen clip, end card.
const sample: DemoProps = {
  ...real,
  introSrc: null,
  introSec: 2.5,
  screenSec: 6,
  outroSrc: null,
  outroSec: 0,
  endSec: 2.5,
  captionsFile: 'sample-captions.json',
  sfx: [
    { src: 'sfx/synth_wet.wav', atSec: 2.4, volume: 0.9 },
    { src: 'sfx/synth_kick.wav', atSec: 3.6, volume: 0.8 },
    { src: 'sfx/synth_kick.wav', atSec: 4.3, volume: 0.8 },
    { src: 'sfx/synth_crash.wav', atSec: 6.2, volume: 0.6 },
    { src: 'sfx/spray.wav', atSec: 8.6, volume: 0.7 },
  ],
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Demo"
      component={Demo}
      width={1920}
      height={1080}
      fps={FPS}
      durationInFrames={1770}
      defaultProps={real}
      calculateMetadata={calc}
    />
    <Composition
      id="DemoVertical"
      component={Demo}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={1770}
      defaultProps={{ ...real, vertical: true }}
      calculateMetadata={calc}
    />
    <Composition
      id="Sample"
      component={Demo}
      width={1920}
      height={1080}
      fps={FPS}
      durationInFrames={330}
      defaultProps={sample}
      calculateMetadata={calc}
    />
    <Composition
      id="SampleVertical"
      component={Demo}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={330}
      defaultProps={{ ...sample, vertical: true }}
      calculateMetadata={calc}
    />
  </>
);
