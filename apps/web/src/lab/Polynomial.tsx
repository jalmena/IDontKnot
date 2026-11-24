import { magnitude, polynomialText, terms } from './format.ts';

/** A Laurent polynomial in t, written as mathematics for the eye and as words for a screen reader. */
export function Polynomial({ value, testId }: { value: Readonly<Record<string, number>>; testId: string }) {
  return (
    <span className="polynomial" role="math" aria-label={polynomialText(value)} data-testid={testId}>
      {terms(value).map((term, index) => (
        <span key={term.exponent} aria-hidden="true">
          {index === 0 ? (term.coefficient < 0 ? '−' : '') : term.coefficient < 0 ? ' − ' : ' + '}
          {magnitude(term)}
          {term.exponent !== '0' && (
            <>
              <i>t</i>
              {term.exponent !== '1' && <sup>{term.exponent.replace('-', '−')}</sup>}
            </>
          )}
        </span>
      ))}
    </span>
  );
}
