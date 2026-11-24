/**
 * The Kauffman bracket and the Jones polynomial.
 *
 * Conventions, fixed here once and tested against independent software:
 * - For a crossing with planar diagram code [a, b, c, d], the A-smoothing joins a with b and c with d;
 *   the B-smoothing joins b with c and d with a.
 * - <D> is the sum over all smoothings of A^(#A - #B) (-A^2 - A^-2)^(loops - 1).
 * - V(t) = (-A^3)^(-writhe) <D>, with A = t^(-1/4).
 * With these, the right-handed trefoil has V(t) = t + t^3 - t^4.
 *
 * The state sum takes 2^n steps for n crossings. That is fine for the diagrams of practical knots and
 * is refused beyond a limit, rather than left to hang.
 */

import { writhe, type Diagram } from './diagram.ts';
import { planarDiagram, type PlanarDiagram } from './operations.ts';

/** A Laurent polynomial in one variable: exponent to coefficient. */
export type Laurent = ReadonlyMap<number, number>;

export const MAX_CROSSINGS_FOR_STATE_SUM = 22;

function multiply(p: Laurent, q: Laurent): Map<number, number> {
  const out = new Map<number, number>();
  for (const [e1, c1] of p) for (const [e2, c2] of q) out.set(e1 + e2, (out.get(e1 + e2) ?? 0) + c1 * c2);
  for (const [e, c] of out) if (c === 0) out.delete(e);
  return out;
}

/** The Kauffman bracket, as a polynomial in A. `freeLoops` counts closed components without crossings. */
export function kauffmanBracket(code: PlanarDiagram, freeLoops = 0): Laurent {
  const n = code.length;
  if (n > MAX_CROSSINGS_FOR_STATE_SUM) {
    throw new Error(`the state sum is limited to ${MAX_CROSSINGS_FOR_STATE_SUM} crossings; this diagram has ${n}`);
  }
  const labels = [...new Set(code.flat())].sort((a, b) => a - b);
  const indexOf = new Map(labels.map((label, index) => [label, index]));
  const rows = code.map((row) => row.map((label) => indexOf.get(label) as number));
  const arcCount = labels.length;

  // tally[k][j]: number of smoothings with exponent (k - n) and j + 1 loops
  const maxLoops = Math.max(1, arcCount + freeLoops);
  const tally = Array.from({ length: 2 * n + 1 }, () => new Array<number>(maxLoops).fill(0));
  const parent = new Int32Array(arcCount);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x] as number] as number;
      x = parent[x] as number;
    }
    return x;
  };
  for (let state = 0; state < 2 ** n; state++) {
    for (let i = 0; i < arcCount; i++) parent[i] = i;
    let bSmoothings = 0;
    let loops = arcCount;
    for (let i = 0; i < n; i++) {
      const [a, b, c, d] = rows[i] as [number, number, number, number];
      const useB = (state >>> i) & 1;
      bSmoothings += useB;
      for (const [x, y] of useB
        ? [
            [b, c],
            [d, a],
          ]
        : [
            [a, b],
            [c, d],
          ]) {
        const rx = find(x as number);
        const ry = find(y as number);
        if (rx !== ry) {
          parent[rx] = ry;
          loops -= 1;
        }
      }
    }
    const total = loops + freeLoops;
    (tally[n - 2 * bSmoothings + n] as number[])[Math.max(total, 1) - 1]! += 1;
  }

  const delta: Laurent = new Map([
    [2, -1],
    [-2, -1],
  ]);
  const deltaPowers: Laurent[] = [new Map([[0, 1]])];
  for (let j = 1; j < maxLoops; j++) deltaPowers.push(multiply(deltaPowers[j - 1] as Laurent, delta));

  const bracket = new Map<number, number>();
  tally.forEach((byLoops, k) => {
    byLoops.forEach((count, j) => {
      if (count === 0) return;
      for (const [e, c] of deltaPowers[j] as Laurent) {
        const exponent = k - n + e;
        bracket.set(exponent, (bracket.get(exponent) ?? 0) + count * c);
      }
    });
  });
  for (const [e, c] of bracket) if (c === 0) bracket.delete(e);
  return bracket;
}

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

/** Writes the exponent -k/4 of t as "3", "-5/2", and so on. */
function exponentKey(powerOfA: number): string {
  const numerator = -powerOfA;
  const divisor = gcd(numerator, 4) || 1;
  const n = numerator / divisor;
  const d = 4 / divisor;
  return d === 1 ? String(n === 0 ? 0 : n) : `${n}/${d}`;
}

/**
 * The Jones polynomial V(t) of a diagram whose components are all closed, as a map from the exponent of t
 * (written "3" or "-5/2") to its coefficient. Links with an even number of components have half-integer exponents.
 */
export function jonesPolynomial(diagram: Diagram): Record<string, number> {
  const { code, freeLoops } = planarDiagram(diagram);
  const w = writhe(diagram);
  const sign = w % 2 === 0 ? 1 : -1;
  const out: Record<string, number> = {};
  const terms = [...kauffmanBracket(code, freeLoops)].map(([e, c]) => [e - 3 * w, c * sign] as const);
  for (const [powerOfA, coefficient] of terms.sort((x, y) => y[0] - x[0])) out[exponentKey(powerOfA)] = coefficient;
  return out;
}

/** The mirror image's polynomial: V(1/t). */
export function reverseExponents(polynomial: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, coefficient] of Object.entries(polynomial)) {
    const flipped = key.startsWith('-') ? key.slice(1) : key === '0' ? '0' : `-${key}`;
    out[flipped] = coefficient;
  }
  return out;
}
