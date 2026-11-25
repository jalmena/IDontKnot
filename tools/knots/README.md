# Tools for the knots of the library

Scripts that write computed content into the files under `content/knots`. What they write is kept in the repository and checked by the tests of the core, like content written by hand.

## Tightening

```sh
node --conditions=source tools/knots/tighten.mjs figure-eight
pnpm exec prettier --write content
```

Computes the frames a knot passes through as it is drawn tight, from the frame it is tied in, and writes them into the knot's `knot.json` with the list `geometry.tightening`. It refuses to write a frame that breaks a rule of the geometry layer.

Run it again after changing the shape a knot is tied in, or the way the core tightens (`packages/core/src/tighten.ts`): a test compares the file with what the core computes. Only a knot of one open rope can be tightened so far.
