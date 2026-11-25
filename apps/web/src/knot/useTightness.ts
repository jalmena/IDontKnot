import { useCallback, useEffect, useRef, useState } from 'react';

/** The seconds a knot takes to be tightened, or to be loosened again. */
const TIME = 1.8;

/**
 * How tight a knot is drawn, from 0 (as it was tied) to 1 (tight), as state of a component. Asked to
 * tighten or to loosen, it gets there a little with each frame; with less movement asked for, at once.
 */
export function useTightness() {
  const [tight, setTight] = useState(false);
  const [amount, setAmount] = useState(0);
  const now = useRef(0);

  useEffect(() => {
    const goal = tight ? 1 : 0;
    if (now.current === goal) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      now.current = goal;
      setAmount(goal);
      return;
    }
    let last = performance.now();
    let request = requestAnimationFrame(function step(time) {
      const moved = Math.min((time - last) / 1000, 0.1) / TIME;
      last = time;
      now.current = goal > now.current ? Math.min(now.current + moved, goal) : Math.max(now.current - moved, goal);
      setAmount(now.current);
      if (now.current !== goal) request = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(request);
  }, [tight]);

  const tighten = useCallback(() => setTight(true), []);
  const loosen = useCallback(() => setTight(false), []);
  /** Loose at once, without being seen to loosen. */
  const slacken = useCallback(() => {
    now.current = 0;
    setAmount(0);
    setTight(false);
  }, []);
  return { tight, amount, tighten, loosen, slacken };
}
