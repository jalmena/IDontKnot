/**
 * A knot diagram: the projection of ropes and rigid objects onto a plane, with over and under at every crossing.
 * See docs/spec/knot-document-model.md, section 4.
 *
 * Conventions
 * - The diagram is seen from +z. "o" (over) is nearer the viewer.
 * - The sign of a crossing is the sign of (tangent of the over strand × tangent of the under strand) · z,
 *   so +1 is the right-handed crossing.
 * - A strand lists the crossings its component passes through, in order of travel. A closed strand is cyclic.
 */

export type Pass = 'o' | 'u';
export type Sign = 1 | -1;

/** One passage of a component through a crossing. */
export type Visit = readonly [crossing: string, pass: Pass];

export interface End {
  readonly role?: string;
}

export interface Component {
  readonly id: string;
  /** A rope is flexible. A rigid component is the axis of an object a rope is tied to: a pole, a ring, a bar. */
  readonly kind: 'rope' | 'rigid';
  readonly closed: boolean;
  readonly ends?: { readonly start?: End; readonly end?: End };
}

export interface Crossing {
  readonly id: string;
  readonly sign: Sign;
}

export interface Diagram {
  readonly components: readonly Component[];
  readonly crossings: readonly Crossing[];
  readonly strands: Readonly<Record<string, readonly Visit[]>>;
}

/** A violation of a validity rule. Rule names follow the specification. */
export interface Issue {
  readonly rule: 'shape' | 'T1' | 'T2' | 'T3' | 'T5';
  readonly message: string;
  readonly crossing?: string;
  readonly component?: string;
}

export function strandOf(diagram: Diagram, component: string): readonly Visit[] {
  return diagram.strands[component] ?? [];
}

/** The sum of the crossing signs. A property of the diagram, not of the knot. */
export function writhe(diagram: Diagram): number {
  return diagram.crossings.reduce((sum, crossing) => sum + crossing.sign, 0);
}

/**
 * Checks everything that can be checked without tracing the drawing: identifiers, references,
 * signs (rule T2), and that each crossing is visited exactly twice, once over and once under (rule T1).
 * An empty result means the other functions of this package may be applied to the diagram.
 */
export function checkStructure(diagram: Diagram): Issue[] {
  const issues: Issue[] = [];
  const componentIds = new Set<string>();
  for (const component of diagram.components) {
    if (componentIds.has(component.id)) {
      issues.push({ rule: 'shape', message: `component "${component.id}" is declared twice`, component: component.id });
    }
    componentIds.add(component.id);
  }
  for (const id of Object.keys(diagram.strands)) {
    if (!componentIds.has(id)) {
      issues.push({ rule: 'shape', message: `strand "${id}" belongs to no declared component`, component: id });
    }
  }

  const passes = new Map<string, { o: number; u: number }>();
  for (const crossing of diagram.crossings) {
    if (passes.has(crossing.id)) {
      issues.push({ rule: 'shape', message: `crossing "${crossing.id}" is declared twice`, crossing: crossing.id });
    }
    passes.set(crossing.id, { o: 0, u: 0 });
    if (crossing.sign !== 1 && crossing.sign !== -1) {
      issues.push({
        rule: 'T2',
        message: `crossing "${crossing.id}" has a sign other than +1 or -1`,
        crossing: crossing.id,
      });
    }
  }

  for (const [component, visits] of Object.entries(diagram.strands)) {
    for (const [crossing, pass] of visits) {
      const count = passes.get(crossing);
      if (!count) {
        issues.push({
          rule: 'shape',
          message: `strand "${component}" visits undeclared crossing "${crossing}"`,
          crossing,
          component,
        });
      } else if (pass !== 'o' && pass !== 'u') {
        issues.push({
          rule: 'shape',
          message: `a visit to "${crossing}" is neither over nor under`,
          crossing,
          component,
        });
      } else {
        count[pass] += 1;
      }
    }
  }

  for (const [crossing, count] of passes) {
    if (count.o !== 1 || count.u !== 1) {
      issues.push({
        rule: 'T1',
        message: `crossing "${crossing}" must be visited once over and once under; found ${count.o} over and ${count.u} under`,
        crossing,
      });
    }
  }
  return issues;
}
