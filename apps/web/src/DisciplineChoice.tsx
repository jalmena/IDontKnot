import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { isDiscipline, ropeOf, type DisciplineId } from './disciplines.ts';
import { go } from './route.tsx';
import { useRope } from './viewer/RopeChoice.tsx';

/**
 * The discipline the person ties knots for. It is chosen on entering, remembered in the browser, and can be
 * changed at any time: choosing one leads to its knots and draws them in its rope.
 */
const KEY = 'idk.discipline';

function remembered(): DisciplineId | null {
  try {
    const stored = window.localStorage.getItem(KEY);
    return isDiscipline(stored) ? stored : null;
  } catch {
    return null;
  }
}

const Choice = createContext<readonly [DisciplineId | null, (discipline: DisciplineId) => void]>([
  null,
  () => undefined,
]);

export function DisciplineChoice({ children }: { readonly children: ReactNode }) {
  const [discipline, setDiscipline] = useState<DisciplineId | null>(remembered);
  const [, setRope] = useRope();
  const value = useMemo(
    () =>
      [
        discipline,
        (next: DisciplineId): void => {
          setDiscipline(next);
          setRope(ropeOf(next));
          try {
            window.localStorage.setItem(KEY, next);
          } catch {
            // not remembered, then
          }
          go('/');
        },
      ] as const,
    [discipline, setRope],
  );
  return <Choice value={value}>{children}</Choice>;
}

export function useDiscipline(): readonly [DisciplineId | null, (discipline: DisciplineId) => void] {
  return useContext(Choice);
}
