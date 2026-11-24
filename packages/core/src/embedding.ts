/**
 * The surface a diagram is drawn on.
 *
 * Strands and crossing signs define a combinatorial map: at every crossing the four arc ends have a
 * rotational order, fixed by the sign. Tracing the faces of that map and applying Euler's formula gives
 * the genus of the surface the diagram lives on. Genus 0 means the diagram can be drawn on a sphere,
 * which is rule T3 of the specification. A higher genus means the code describes a virtual diagram.
 *
 * Rope ends are vertices of degree one, so each end lies in exactly one face. That is what tells an open
 * rope whose ends can be joined outside the knot from one whose end is trapped inside it.
 */

import { strandOf, type Diagram } from './diagram.ts';

export interface Embedding {
  /** 0 when the diagram can be drawn on a sphere. */
  readonly genus: number;
  /** Connected pieces that have at least one crossing or one end. */
  readonly pieces: number;
  /** Closed components with no crossing at all. They float free of everything else. */
  readonly freeLoops: number;
  readonly faceCount: number;
  /** The face each end lies in, keyed "component:start" or "component:end". */
  readonly endFace: Readonly<Record<string, number>>;
}

/** Requires a diagram for which `checkStructure` reports nothing. */
export function embed(diagram: Diagram): Embedding {
  const next = new Map<string, string>(); // rotation: each dart to the following dart around its vertex
  const vertexOf = new Map<string, string>();
  const slots = new Map<string, Record<string, string>>();
  const ends: Record<string, string> = {};
  let freeLoops = 0;

  const dart = (component: string, arc: number, side: 'h' | 't') => `${component}|${arc}|${side}`;
  const twin = (d: string) => d.slice(0, -1) + (d.endsWith('h') ? 't' : 'h');

  for (const component of diagram.components) {
    const visits = strandOf(diagram, component.id);
    const count = visits.length;
    if (component.closed && count === 0) {
      freeLoops += 1;
      continue;
    }
    visits.forEach(([crossing, pass], index) => {
      // arc `index` arrives at this visit; the arc that leaves is the next one, cyclically if the component is closed
      const leaving = component.closed ? (index + 1) % count : index + 1;
      const slot = slots.get(crossing) ?? {};
      slot[`${pass}in`] = dart(component.id, index, 'h');
      slot[`${pass}out`] = dart(component.id, leaving, 't');
      slots.set(crossing, slot);
    });
    if (!component.closed) {
      ends[`${component.id}:start`] = dart(component.id, 0, 't');
      ends[`${component.id}:end`] = dart(component.id, count, 'h');
    }
  }

  for (const crossing of diagram.crossings) {
    const slot = slots.get(crossing.id);
    if (!slot) continue;
    const around =
      crossing.sign > 0
        ? [slot['uin'], slot['oout'], slot['uout'], slot['oin']]
        : [slot['uin'], slot['oin'], slot['uout'], slot['oout']];
    around.forEach((d, index) => {
      if (d === undefined) throw new Error(`crossing "${crossing.id}" is not visited once over and once under`);
      next.set(d, around[(index + 1) % 4] as string);
      vertexOf.set(d, `x:${crossing.id}`);
    });
  }
  for (const [key, d] of Object.entries(ends)) {
    next.set(d, d);
    vertexOf.set(d, `e:${key}`);
  }

  // faces are the orbits of "cross the arc, then turn to the next dart around the vertex"
  const faceOf = new Map<string, number>();
  let faceCount = 0;
  for (const start of next.keys()) {
    if (faceOf.has(start)) continue;
    let d = start;
    while (!faceOf.has(d)) {
      faceOf.set(d, faceCount);
      const across = twin(d);
      const onward = next.get(across);
      if (onward === undefined) throw new Error(`arc end "${across}" is attached to nothing`);
      d = onward;
    }
    faceCount += 1;
  }

  // connected pieces, by joining the two vertices of every arc
  const parent = new Map<string, string>();
  const find = (v: string): string => {
    let root = v;
    while (parent.get(root) !== undefined && parent.get(root) !== root) root = parent.get(root) as string;
    parent.set(v, root);
    return root;
  };
  for (const vertex of vertexOf.values()) if (!parent.has(vertex)) parent.set(vertex, vertex);
  for (const d of next.keys()) {
    const a = find(vertexOf.get(d) as string);
    const b = find(vertexOf.get(twin(d)) as string);
    if (a !== b) parent.set(a, b);
  }
  const pieces = new Set([...parent.keys()].map(find)).size;

  const vertices = new Set(vertexOf.values()).size;
  const edges = next.size / 2;
  const doubleGenus = 2 * pieces - (vertices - edges + faceCount);
  if (doubleGenus < 0 || doubleGenus % 2 !== 0) throw new Error('the diagram does not define a surface');

  const endFace: Record<string, number> = {};
  for (const [key, d] of Object.entries(ends)) endFace[key] = faceOf.get(d) as number;

  return { genus: doubleGenus / 2, pieces, freeLoops, faceCount, endFace };
}

/** Rule T3: the code can be drawn on a sphere. */
export function isPlanar(diagram: Diagram): boolean {
  return embed(diagram).genus === 0;
}

/**
 * Rule T5: every rope end lies in one common face, so the ends can be regarded as held outside the knot.
 * True when there are no rope ends at all.
 */
export function ropeEndsShareOneFace(diagram: Diagram): boolean {
  const { endFace } = embed(diagram);
  const ropes = new Set(diagram.components.filter((c) => c.kind === 'rope').map((c) => c.id));
  const faces = new Set(
    Object.entries(endFace)
      .filter(([key]) => ropes.has(key.slice(0, key.lastIndexOf(':'))))
      .map(([, face]) => face),
  );
  return faces.size <= 1;
}
