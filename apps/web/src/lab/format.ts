/** Writing a Laurent polynomial in t for people. The core returns it as exponent ("3", "-5/2") to coefficient. */

export interface Term {
  readonly coefficient: number;
  readonly exponent: string;
}

function value(exponent: string): number {
  const [numerator, denominator] = exponent.split('/');
  return Number(numerator) / Number(denominator ?? 1);
}

/** The terms in ascending order of exponent, without zero coefficients. */
export function terms(polynomial: Readonly<Record<string, number>>): Term[] {
  return Object.entries(polynomial)
    .filter(([, coefficient]) => coefficient !== 0)
    .map(([exponent, coefficient]) => ({ exponent, coefficient }))
    .sort((a, b) => value(a.exponent) - value(b.exponent));
}

/** The size of a coefficient as it is written: nothing for 1 unless the term is a constant. */
export function magnitude(term: Term): string {
  const size = Math.abs(term.coefficient);
  return size === 1 && term.exponent !== '0' ? '' : String(size);
}

/** Plain text, for labels and tests: "t + t^3 − t^4", "−t^(-5/2) − t^(-1/2)". */
export function polynomialText(polynomial: Readonly<Record<string, number>>): string {
  const list = terms(polynomial);
  if (list.length === 0) return '0';
  return list
    .map((term, index) => {
      const negative = term.coefficient < 0;
      const sign = index === 0 ? (negative ? '−' : '') : negative ? ' − ' : ' + ';
      const plain = /^\d+$/.test(term.exponent);
      const power =
        term.exponent === '0'
          ? ''
          : term.exponent === '1'
            ? 't'
            : plain
              ? `t^${term.exponent}`
              : `t^(${term.exponent})`;
      return `${sign}${magnitude(term)}${power}`;
    })
    .join('');
}
