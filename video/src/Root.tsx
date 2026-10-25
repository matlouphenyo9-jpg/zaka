import { Composition } from 'remotion';
import { DEMO_DURATION, Demo } from './Demo';
import { FPS } from './timeline';

export function Root() {
  return <Composition id="ZakaDemo" component={Demo} durationInFrames={DEMO_DURATION} fps={FPS} width={1920} height={1080} />;
}
