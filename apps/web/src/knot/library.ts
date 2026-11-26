/**
 * The knots of the library that the interface can show. They are the files under `content/knots`,
 * built into the application: an instance shows the library it was built with.
 */
import type { KnotDocument } from '@idontknot/core';
import bowlineEntry from '../../../../content/knots/bowline/entry.json';
import bowline from '../../../../content/knots/bowline/knot.json';
import doubleOverhandEntry from '../../../../content/knots/double-overhand/entry.json';
import doubleOverhand from '../../../../content/knots/double-overhand/knot.json';
import figureEightEntry from '../../../../content/knots/figure-eight/entry.json';
import figureEight from '../../../../content/knots/figure-eight/knot.json';
import figureEightLoopEntry from '../../../../content/knots/figure-eight-loop/entry.json';
import figureEightLoop from '../../../../content/knots/figure-eight-loop/knot.json';
import overhandEntry from '../../../../content/knots/overhand/entry.json';
import overhand from '../../../../content/knots/overhand/knot.json';

/** What a knot is for in one discipline, by language code; and what it is shown tied to there, if anything. */
export interface KnotUse {
  readonly text: Readonly<Record<string, string>>;
  readonly object?: string;
}

/**
 * What the library says about a knot that is not its shape: what it and its parts are called, what kind of
 * knot it is, and what it is for in each discipline that uses it.
 */
export interface LibraryEntry {
  readonly knot: string;
  /** The name of the knot in each language, by language code. */
  readonly names: Readonly<Record<string, string>>;
  /** What it is for, as a kind: one of the categories of the library. */
  readonly category?: string;
  /** What it is for in each discipline that uses it, by discipline. A discipline that is not here does not show it. */
  readonly uses?: Readonly<Record<string, KnotUse>>;
  /** Whether it jams after it has taken a load, or still unties easily, by language code. Every knot says it. */
  readonly afterLoad: Readonly<Record<string, string>>;
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
  bowline: { document: bowline as unknown as KnotDocument, entry: bowlineEntry },
  'double-overhand': { document: doubleOverhand as unknown as KnotDocument, entry: doubleOverhandEntry },
  'figure-eight': { document: figureEight as unknown as KnotDocument, entry: figureEightEntry },
  'figure-eight-loop': { document: figureEightLoop as unknown as KnotDocument, entry: figureEightLoopEntry },
  overhand: { document: overhand as unknown as KnotDocument, entry: overhandEntry },
};

/** A text of an entry in this language, or in English when the entry does not have it. */
export function inLanguage(texts: Readonly<Record<string, string>> | undefined, language: string): string {
  return texts?.[language] ?? texts?.['en'] ?? '';
}
