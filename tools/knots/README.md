# Tools for the knots of the library

Scripts that write computed content into the files under `content/knots`. What they write is kept in the repository and checked by the tests of the core, like content written by hand.

## A knot from its drawing

```sh
node --conditions=source tools/knots/lay.mjs overhand
pnpm exec prettier --write content
```

Makes `content/knots/<id>/knot.json` from the drawing beside it, `layout.json`, and computes its tightening too. The drawing gives the path of the rope in the plane, how it passes at each crossing, and its parts and the steps that tie it, placed by the crossings the rope meets. Nothing is written if the document breaks a rule; `--dry` writes nothing in any case.

To add a knot: write its `layout.json` and its `entry.json` (names and instructions, by language), run the tool, and add the knot to `apps/web/src/knot/library.ts`.

## Tightening

```sh
node --conditions=source tools/knots/tighten.mjs figure-eight
pnpm exec prettier --write content
```

Computes the frames a knot passes through as it is drawn tight, from the frame it is tied in, and writes them into the knot's `knot.json` with the list `geometry.tightening`. It refuses to write a frame that breaks a rule of the geometry layer.

Run it again after changing the shape a knot is tied in, or the way the core tightens (`packages/core/src/tighten.ts`): a test compares the file with what the core computes. Only a knot of one open rope can be tightened so far.
