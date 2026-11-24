/**
 * Operations that turn one diagram into another, or into another notation.
 * Every function requires a diagram for which `checkStructure` reports nothing.
 */

import { strandOf, type Component, type Crossing, type Diagram, type Sign, type Visit } from './diagram.ts';

/**
 * A planar diagram (PD) code: for every crossing, its four arcs in anticlockwise order starting from
 * the arc that arrives underneath. Arcs are numbered from 0. This is the exchange format of SnapPy,
 * Regina and the Knot Atlas.
 */
export type PlanarDiagram = readonly (readonly [number, number, number, number])[];

export interface PlanarDiagramResult {
  readonly code: PlanarDiagram;
  /** The crossing each row of the code belongs to. */
  readonly crossings: readonly string[];
  /** Closed components with no crossing, which a PD code cannot express. */
  readonly freeLoops: number;
}

/** PD codes describe closed curves only. Close open components first if that is what is meant. */
export function planarDiagram(diagram: Diagram): PlanarDiagramResult {
  const arcs = new Map<string, { in?: number; out?: number }>(); // keyed "crossing|pass"
  let nextArc = 0;
  let freeLoops = 0;
  for (const component of diagram.components) {
    const visits = strandOf(diagram, component.id);
    if (!component.closed) {
      throw new Error(`component "${component.id}" is open: a planar diagram code needs closed components`);
    }
    if (visits.length === 0) {
      freeLoops += 1;
      continue;
    }
    const first = nextArc;
    nextArc += visits.length;
    visits.forEach(([crossing, pass], index) => {
      // arc `first + index` arrives at this visit; the next arc, cyclically, leaves it
      arcs.set(`${crossing}|${pass}`, { in: first + index, out: first + ((index + 1) % visits.length) });
    });
  }
  const code: [number, number, number, number][] = [];
  const crossings: string[] = [];
  for (const crossing of diagram.crossings) {
    const under = arcs.get(`${crossing.id}|u`);
    const over = arcs.get(`${crossing.id}|o`);
    if (under?.in === undefined || under.out === undefined || over?.in === undefined || over.out === undefined) {
      throw new Error(`crossing "${crossing.id}" is not visited once over and once under`);
    }
    code.push(crossing.sign > 0 ? [under.in, over.out, under.out, over.in] : [under.in, over.in, under.out, over.out]);
    crossings.push(crossing.id);
  }
  return { code, crossings, freeLoops };
}

/** The mirror image: every over becomes an under, and every sign changes. */
export function mirror(diagram: Diagram): Diagram {
  const strands: Record<string, Visit[]> = {};
  for (const [component, visits] of Object.entries(diagram.strands)) {
    strands[component] = visits.map(([crossing, pass]) => [crossing, pass === 'o' ? 'u' : 'o'] as const);
  }
  return {
    components: diagram.components,
    crossings: diagram.crossings.map((crossing) => ({ id: crossing.id, sign: -crossing.sign as Sign })),
    strands,
  };
}

/** Removes components and every crossing they take part in. Removing the pole from a hitch shows what is left of it. */
export function withoutComponents(diagram: Diagram, ids: readonly string[]): Diagram {
  const removed = new Set(ids);
  const gone = new Set<string>();
  for (const id of removed) for (const [crossing] of strandOf(diagram, id)) gone.add(crossing);
  const strands: Record<string, Visit[]> = {};
  for (const component of diagram.components) {
    if (removed.has(component.id)) continue;
    strands[component.id] = strandOf(diagram, component.id).filter(([crossing]) => !gone.has(crossing));
  }
  return {
    components: diagram.components.filter((component) => !removed.has(component.id)),
    crossings: diagram.crossings.filter((crossing) => !gone.has(crossing.id)),
    strands,
  };
}

/**
 * Closes every open component on itself, joining its end to its start.
 * The result is the closure the specification calls "exterior" only if the two ends lie in one face;
 * check `ropeEndsShareOneFace` first. The crossings do not change.
 */
export function closeOpenComponents(diagram: Diagram): Diagram {
  return {
    components: diagram.components.map(({ id, kind }) => ({ id, kind, closed: true })),
    crossings: diagram.crossings,
    strands: diagram.strands,
  };
}

export interface JoinStep {
  readonly component: string;
  /** Travel this component from its end to its start. */
  readonly reversed?: boolean;
}

/**
 * Joins several open components end to end into one closed component, in the given order.
 * Reversing a component changes the sign of each crossing it shares with a component that is not reversed;
 * crossings of a component with itself keep their sign. Components not listed are left as they are.
 *
 * Joining two ropes of a bend "standing part to standing part, tail to tail" is
 * `joinComponents(d, [{ component: 'a' }, { component: 'b', reversed: true }])`.
 */
export function joinComponents(diagram: Diagram, order: readonly JoinStep[], id = 'joined'): Diagram {
  const reversed = new Map(order.map((step) => [step.component, step.reversed === true]));
  const owners = new Map<string, Set<string>>();
  for (const component of diagram.components) {
    for (const [crossing] of strandOf(diagram, component.id)) {
      const set = owners.get(crossing) ?? new Set<string>();
      set.add(component.id);
      owners.set(crossing, set);
    }
  }
  const joined: Visit[] = [];
  for (const step of order) {
    const visits = strandOf(diagram, step.component);
    joined.push(...(step.reversed ? [...visits].reverse() : visits));
  }
  const crossings: Crossing[] = diagram.crossings.map((crossing) => {
    const flips = [...(owners.get(crossing.id) ?? [])].filter((owner) => reversed.get(owner) === true).length;
    const shared = (owners.get(crossing.id)?.size ?? 0) === 2;
    return { id: crossing.id, sign: (shared && flips === 1 ? -crossing.sign : crossing.sign) as Sign };
  });
  const untouched = diagram.components.filter((component) => !reversed.has(component.id));
  const components: Component[] = [{ id, kind: 'rope', closed: true }, ...untouched];
  const strands: Record<string, readonly Visit[]> = { [id]: joined };
  for (const component of untouched) strands[component.id] = strandOf(diagram, component.id);
  return { components, crossings, strands };
}
