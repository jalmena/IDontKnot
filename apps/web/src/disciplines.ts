/**
 * The disciplines a person ties knots for. One is chosen on entering the application, and it decides which
 * knots are shown, in what order, in what rope, and what is said of their use.
 */
import { ROPE_OF_DISCIPLINE, type RopeMaterialId } from './viewer/materials.ts';
import type { ThingKind } from './viewer/things.ts';

export const DISCIPLINE_IDS = ['climbing', 'nautical', 'shibari', 'pioneering', 'decorative', 'theory'] as const;
export type DisciplineId = (typeof DISCIPLINE_IDS)[number];

export function isDiscipline(value: unknown): value is DisciplineId {
  return typeof value === 'string' && (DISCIPLINE_IDS as readonly string[]).includes(value);
}

/** The rope a discipline is drawn in, until the person chooses another. */
export function ropeOf(discipline: DisciplineId): RopeMaterialId {
  return ROPE_OF_DISCIPLINE[discipline] ?? 'jute';
}

/** What a knot is for, by kind; the order is the order in which a discipline's knots are listed. */
export const CATEGORY_IDS = ['stopper', 'loop', 'bend', 'hitch', 'binding', 'lashing', 'tie', 'mathematical'] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** Things a knot can be shown tied to, in the view: things, or another rope. */
export const OBJECT_KINDS = ['plate', 'post', 'ring', 'rope'] as const satisfies readonly (ThingKind | 'rope')[];
