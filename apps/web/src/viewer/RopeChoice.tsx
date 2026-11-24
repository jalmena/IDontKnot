import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { ROPE_MATERIAL_IDS, type RopeMaterialId } from './materials.ts';

/**
 * The rope that knots are drawn with. It is one choice for the whole application, kept from one page to
 * the next and remembered in the browser.
 */
const KEY = 'idk.rope';

function remembered(): RopeMaterialId {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored && (ROPE_MATERIAL_IDS as readonly string[]).includes(stored)) return stored as RopeMaterialId;
  } catch {
    // a browser that keeps nothing still draws rope
  }
  return 'jute';
}

const Choice = createContext<readonly [RopeMaterialId, (rope: RopeMaterialId) => void]>(['jute', () => undefined]);

export function RopeChoice({ children }: { readonly children: ReactNode }) {
  const [rope, setRope] = useState<RopeMaterialId>(remembered);
  const value = useMemo(
    () =>
      [
        rope,
        (next: RopeMaterialId): void => {
          setRope(next);
          try {
            window.localStorage.setItem(KEY, next);
          } catch {
            // not remembered, then
          }
        },
      ] as const,
    [rope],
  );
  return <Choice value={value}>{children}</Choice>;
}

export function useRope(): readonly [RopeMaterialId, (rope: RopeMaterialId) => void] {
  return useContext(Choice);
}
