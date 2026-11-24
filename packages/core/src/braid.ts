/**
 * Closed braids. Every link is the closure of a braid, and whole families are a few numbers long:
 * torus knots, plaits, Turk's heads. Braid words are an input notation, not the stored form.
 *
 * Convention: strands run upward, positions are numbered from the left starting at 1, and the generator
 * +i takes the strand at position i over the strand at position i + 1. Its crossing is positive.
 */

import type { Diagram, Sign, Visit } from './diagram.ts';

/** The diagram of the closure of a braid word. Generators are non-zero integers between -(n-1) and n-1. */
export function closedBraid(word: readonly number[], strandCount: number): Diagram {
  if (!Number.isInteger(strandCount) || strandCount < 1) throw new Error('a braid needs at least one strand');
  const atPosition = Array.from({ length: strandCount }, (_, index) => index); // which strand sits at each position
  const visits: Visit[][] = Array.from({ length: strandCount }, () => []);
  const crossings: { id: string; sign: Sign }[] = [];

  word.forEach((generator, index) => {
    const position = Math.abs(generator) - 1;
    if (!Number.isInteger(generator) || generator === 0 || position > strandCount - 2) {
      throw new Error(`generator ${generator} is not valid for a braid on ${strandCount} strands`);
    }
    const id = `c${index + 1}`;
    const left = atPosition[position] as number;
    const right = atPosition[position + 1] as number;
    crossings.push({ id, sign: generator > 0 ? 1 : -1 });
    (visits[left] as Visit[]).push([id, generator > 0 ? 'o' : 'u']);
    (visits[right] as Visit[]).push([id, generator > 0 ? 'u' : 'o']);
    atPosition[position] = right;
    atPosition[position + 1] = left;
  });

  // closing the braid joins the top of each position to its bottom: follow each strand round
  const endsAt = new Array<number>(strandCount);
  atPosition.forEach((strand, position) => (endsAt[strand] = position));
  const seen = new Set<number>();
  const strands: Record<string, Visit[]> = {};
  const components: Diagram['components'][number][] = [];
  for (let start = 0; start < strandCount; start++) {
    if (seen.has(start)) continue;
    const sequence: Visit[] = [];
    for (let strand = start; !seen.has(strand); strand = endsAt[strand] as number) {
      seen.add(strand);
      sequence.push(...(visits[strand] as Visit[]));
    }
    const id = `k${components.length}`;
    components.push({ id, kind: 'rope', closed: true });
    strands[id] = sequence;
  }
  return { components, crossings, strands };
}

/** The braid word of the (p, q) torus link on p strands: (1 2 … p-1) repeated q times. All crossings positive. */
export function torusBraidWord(p: number, q: number): number[] {
  if (!Number.isInteger(p) || !Number.isInteger(q) || p < 1 || q < 0)
    throw new Error('p must be at least 1 and q at least 0');
  const turn = Array.from({ length: p - 1 }, (_, index) => index + 1);
  return Array.from({ length: q }, () => turn).flat();
}
