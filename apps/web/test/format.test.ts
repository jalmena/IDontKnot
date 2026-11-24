import { expect, it } from 'vitest';
import { byLabel, polynomialText, terms } from '../src/lab/format.ts';

it('writes the trefoil polynomial', () => {
  expect(polynomialText({ '1': 1, '3': 1, '4': -1 })).toBe('t + t^3 − t^4');
});

it('writes constants, coefficients and a leading minus', () => {
  expect(polynomialText({ '0': 1 })).toBe('1');
  expect(polynomialText({ '-2': 1, '-1': -1, '0': 1, '1': -1, '2': 1 })).toBe('t^(-2) − t^(-1) + 1 − t + t^2');
  expect(polynomialText({ '2': 1, '4': 2, '5': -2 })).toBe('t^2 + 2t^4 − 2t^5');
  expect(polynomialText({ '-1/2': -1, '-5/2': -1 })).toBe('−t^(-5/2) − t^(-1/2)');
});

it('orders terms by exponent and drops zeros', () => {
  expect(terms({ '3': 1, '1/2': 4, '-1': 0, '-2': 2 }).map((term) => term.exponent)).toEqual(['-2', '1/2', '3']);
});

it('writes the zero polynomial', () => {
  expect(polynomialText({})).toBe('0');
});

it('orders options by their label in the language given', () => {
  const options = [{ label: 'Yute' }, { label: 'Línea lisa' }, { label: 'algodón' }, { label: 'Alma y funda' }];
  expect(byLabel(options, 'es').map((option) => option.label)).toEqual([
    'algodón',
    'Alma y funda',
    'Línea lisa',
    'Yute',
  ]);
  expect(options[0]?.label).toBe('Yute'); // the original is left as it was
});
