import { checkDocument, checkFrame } from '@idontknot/core';
import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '../src/languages.ts';
import { inLanguage, KNOTS } from '../src/knot/library.ts';

describe.each(Object.entries(KNOTS))('the library knot %s', (id, { document, entry }) => {
  it('is a valid document under the name the interface knows it by', () => {
    expect(document.id).toBe(id);
    expect(entry.knot).toBe(id);
    expect(checkDocument(document)).toEqual([]);
    for (const frame of document.geometry?.frames ?? []) expect(checkFrame(document, frame)).toEqual([]);
  });

  it('has a name, and a name for each of its parts, in every language of the interface', () => {
    const parts = (document.parts ?? []).map((part) => part.id);
    expect(Object.keys(entry.parts).sort()).toEqual([...parts].sort());
    for (const { code } of LANGUAGES) {
      expect(entry.names[code]).toBeTruthy();
      for (const part of parts) expect(entry.parts[part]?.[code]).toBeTruthy();
    }
  });
});

it('falls back to English for a text that a language lacks', () => {
  expect(inLanguage({ en: 'Tail', es: 'Chicote' }, 'es')).toBe('Chicote');
  expect(inLanguage({ en: 'Tail' }, 'es')).toBe('Tail');
  expect(inLanguage(undefined, 'es')).toBe('');
});
