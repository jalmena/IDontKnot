import { checkDocument, checkFrame, checkMethod } from '@idontknot/core';
import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS, DISCIPLINE_IDS, isDiscipline, OBJECT_KINDS } from '../src/disciplines.ts';
import { LANGUAGES } from '../src/languages.ts';
import { inLanguage, KNOTS } from '../src/knot/library.ts';

describe.each(Object.entries(KNOTS))('the library knot %s', (id, { document, entry }) => {
  // the largest knots take some seconds to check
  it('is a valid document under the name the interface knows it by', { timeout: 30_000 }, () => {
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

describe.each(Object.entries(KNOTS))('what the library knot %s is for', (_id, { document, entry }) => {
  it('is of one of the categories of the library', () => {
    expect(CATEGORY_IDS).toContain(entry.category);
  });

  it('is said for each discipline that uses it, in every language, and tied to a thing it can be tied to', () => {
    const uses = Object.entries(entry.uses ?? {});
    expect(uses.length).toBeGreaterThan(0);
    for (const [discipline, use] of uses) {
      expect(isDiscipline(discipline)).toBe(true);
      for (const { code } of LANGUAGES) expect(use.text[code]).toBeTruthy();
      if (use.object === undefined) continue;
      expect(OBJECT_KINDS).toContain(use.object);
      // a post stands in an eye: a knot shown on one has an eye
      if (use.object === 'post') expect(document.parts?.some((part) => part.type === 'eye')).toBe(true);
    }
  });

  it('says whether it jams after a load, in every language, and says it once', () => {
    for (const { code } of LANGUAGES) {
      const afterLoad = entry.afterLoad[code];
      expect(afterLoad).toBeTruthy();
      for (const use of Object.values(entry.uses ?? {})) expect(use.text[code]).not.toContain(afterLoad);
    }
  });
});

describe.each(Object.entries(KNOTS))('the ways of tying the library knot %s', (_id, { document, entry }) => {
  const methods = document.construction?.methods ?? [];

  it('are named, step by step, in every language of the interface', () => {
    expect(Object.keys(entry.methods ?? {}).sort()).toEqual(methods.map((method) => method.id).sort());
    for (const method of methods) {
      const texts = entry.methods?.[method.id];
      expect(Object.keys(texts?.steps ?? {}).sort()).toEqual(method.steps.map((step) => step.id).sort());
      for (const { code } of LANGUAGES) {
        expect(texts?.name[code]).toBeTruthy();
        for (const step of method.steps) expect(texts?.steps[step.id]?.[code]).toBeTruthy();
      }
    }
  });

  it('are valid methods', () => {
    for (const method of methods) expect(checkMethod(document, method)).toEqual([]);
  });
});

it('falls back to English for a text that a language lacks', () => {
  expect(inLanguage({ en: 'Tail', es: 'Chicote' }, 'es')).toBe('Chicote');
  expect(inLanguage({ en: 'Tail' }, 'es')).toBe('Tail');
  expect(inLanguage(undefined, 'es')).toBe('');
});

it('has a knot for every discipline', () => {
  for (const discipline of DISCIPLINE_IDS) {
    const knots = Object.values(KNOTS).filter(({ entry }) => entry.uses?.[discipline] !== undefined);
    expect(knots.length, discipline).toBeGreaterThan(0);
  }
});
