/**
 * The knots of the library that the interface can show. They are the files under `content/knots`,
 * built into the application: an instance shows the library it was built with.
 */
import type { KnotDocument } from '@idontknot/core';
import figureEightEntry from '../../../../content/knots/figure-eight/entry.json';
import figureEight from '../../../../content/knots/figure-eight/knot.json';
import overhandEntry from '../../../../content/knots/overhand/entry.json';
import overhand from '../../../../content/knots/overhand/knot.json';

/** What the library says about a knot that is not its shape: for now, what it and its parts are called. */
export interface LibraryEntry {
  readonly knot: string;
  /** The name of the knot in each language, by language code. */
  readonly names: Readonly<Record<string, string>>;
  /** The name of each named part of its ropes, by part and by language code. */
  readonly parts: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** For each method of tying: its name, and what each of its steps tells the person to do, by language code. */
  readonly methods?: Readonly<
    Record<
      string,
      {
        readonly name: Readonly<Record<string, string>>;
        readonly steps: Readonly<Record<string, Readonly<Record<string, string>>>>;
      }
    >
  >;
}

export interface LibraryKnot {
  readonly document: KnotDocument;
  readonly entry: LibraryEntry;
}

export const KNOTS: Readonly<Record<string, LibraryKnot>> = {
  // JSON has no tuples and no literal types, so the file is taken on trust here; `checkDocument` then checks it
  'figure-eight': { document: figureEight as unknown as KnotDocument, entry: figureEightEntry },
  overhand: { document: overhand as unknown as KnotDocument, entry: overhandEntry },
};

/** A text of an entry in this language, or in English when the entry does not have it. */
export function inLanguage(texts: Readonly<Record<string, string>> | undefined, language: string): string {
  return texts?.[language] ?? texts?.['en'] ?? '';
}
