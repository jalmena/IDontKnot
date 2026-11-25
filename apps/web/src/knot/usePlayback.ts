import { useEffect, useState } from 'react';
import { done, tick, type Playback, type Timeline } from './playback.ts';

/**
 * The playing of a method of tying, as state of a component. It begins with the knot tied; while it plays,
 * the clock moves the end, and a hidden page stops the clock, so the end waits. Another timeline, which is
 * another knot, begins tied again.
 */
export function usePlayback(timeline: Timeline) {
  const [state, setState] = useState<Playback>(() => done(timeline));
  const [speed, setSpeed] = useState(1);
  const [told, setTold] = useState(timeline);
  if (told !== timeline) {
    setTold(timeline);
    setState(done(timeline));
  }

  useEffect(() => {
    if (!state.playing) return;
    let last = performance.now();
    let request = requestAnimationFrame(function step(now) {
      const seconds = Math.min((now - last) / 1000, 0.1);
      last = now;
      setState((current) => tick(current, timeline, seconds, speed));
      request = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(request);
  }, [state.playing, speed, timeline]);

  return { state, setState, speed, setSpeed };
}
