# Rendering, geometry and physics in the browser

Checked 2026-11-23. Version numbers were read from the npm registry and GitHub that day. Statements marked *from general knowledge* were not re-verified against a primary source in this pass and should be confirmed when the corresponding work starts.

## Rendering engines

| Engine | Version | Notes |
| --- | --- | --- |
| Three.js | r187, 2026-10-30, MIT | Two renderers ship: the classic `WebGLRenderer`, and `WebGPURenderer` (from `three/webgpu`) which uses WebGPU when present and falls back to a WebGL2 backend. Compute and other WebGPU-only features are missing on the fallback. Monthly releases with breaking changes: pin the version. |
| React Three Fiber | 9.8.2, 2026-10 | React 19 only (peer range `>=19.0 <19.4`). `drei` 10.7.9 supplies helpers. |
| Threlte | 8.7.0 | Svelte 5 binding for Three.js |
| TresJS | 5.12.0 | Vue binding for Three.js |
| Babylon.js | 9.37 | Complete and active; the core is large even when tree-shaken (*from general knowledge*) |
| PlayCanvas engine | 2.24, MIT | Capable; less used for bespoke geometry |
| OGL | 1.0.11, Unlicense | Minimal; no WebGPU, no picking or post-processing helpers |

## WebGPU availability

From the gpuweb implementation-status page (which can lag):

- Chrome and Edge: on by default on Windows, macOS and ChromeOS; on Android since Chrome 121; on Linux for Intel Gen12+ graphics since Chrome 144.
- Safari 26: on by default on macOS and iOS.
- Firefox: on by default on Windows (141) and macOS (145-147). **Firefox on Linux: not confirmed on by default. Assume off.**

The application must therefore treat WebGL2 as a first-class target. WebGPU can be an optional path, not a requirement.

## Drawing rope

**Tube frames.** Three.js `TubeGeometry` uses Frenet frames, which flip where curvature vanishes and are undefined on straight runs: the tube twists and pinches (*from general knowledge*). The remedy is rotation-minimising frames computed by the double-reflection method (Wang, Jüttler, Zheng and Liu, 2008): linear time, stable, and easy to correct for closed curves. This means a custom tube geometry with a fixed ring layout, updated in place in a pre-allocated buffer.

**Rope appearance.** A procedural shader on a plain tube is the recommended starting point: texture coordinates along and around the rope, a helical stripe pattern for laid rope or a braid pattern for kernmantle, a derived normal map, and a small displacement. True helical strand geometry is reserved for close-ups, and for the future case of representing strands as objects (splices).

**Cost.** A few thousand vertices per rope is cheap. Sixteen to thirty-two radial segments and an adaptive number of rings along the length are enough.

## Making over and under legible

This matters more here than in most 3D applications, because the whole point of the picture is which strand passes over which.

- Available in Three.js today: outline, SSAO, GTAO and SAO passes, and fog for depth cueing. Contact shadows are not built in (drei has them for React Three Fiber).
- **Not available off the shelf: the gap, or halo, at a crossing** that every printed knot diagram uses. It has to be written: an enlarged background-coloured shell behind each rope, depth-tested so the farther strand is erased near the nearer one.
- A separate **2D diagram view** with explicit gaps, drawn from the topological data and not from the 3D render, is the most reliable way to state over and under. It is also the natural accessible alternative.

## Picking, dragging and accessibility

- Pick against the rope's centerline in screen space, not against the tube mesh. It is faster and more forgiving on touch screens.
- Drag by projecting the pointer onto a camera-facing plane through the grabbed point, using Pointer Events, with `touch-action: none` on the canvas.
- A 3D canvas is not accessible by default. Each view needs a parallel DOM layer: a step list with previous and next buttons, a text description of each step, a live region announcing changes, keyboard controls for stepping, rotating and zooming, and respect for `prefers-reduced-motion`.

## Geometry

The representation of geometry is specified in the [knot document model](../spec/knot-document-model.md). The points that come from this research:

- **Centerline plus radius** is the standard model of a rope as a tube. It is the model used in the mathematics of rope length and ideal knots (Cantarella, Kusner and Sullivan, 2002) and in rod mechanics.
- **Thickness is checkable.** A tube of radius *r* around a curve does not overlap itself when non-neighbouring points stay at least 2*r* apart and the radius of curvature is at least *r*. For a polyline this is a segment-to-segment distance test with a spatial grid.
- **Diagram from geometry** is exact: project along the view direction, intersect the projected segments, compare depths. Degenerate views (two crossings on top of each other, a strand seen end-on) are detected and rejected or perturbed.
- **Geometry from a diagram** is a construction, not a unique answer: lay the diagram out in the plane, lift the strands apart at crossings, then relax. Relaxation methods of increasing sophistication are shrink-on-no-overlaps (Pierański), constrained gradient descent on rope length (Ashton, Cantarella, Piatek and Rawdon, 2011) and repulsive energies (Yu, Schumacher and Crane, 2021). Pierański's method is simple enough to implement first.

## Physics

**What exists for the browser.**

| Option | Assessment |
| --- | --- |
| Rapier (0.21, Apache-2.0) | Rigid bodies and joints. A rope as a chain of jointed bodies stretches, is unstable under tension and has no friction model suited to knots. |
| Jolt Physics, JavaScript build (MIT) | Soft bodies with self-collision; the strongest off-the-shelf option, at a large download size |
| Ammo.js, PhysX | Stale or not rope-oriented |
| Rod solvers (position-based Cosserat rods, discrete elastic rods, XPBD) | No maintained browser-ready implementation was found. The methods are published and a custom solver is feasible. |

**Expected performance** (an estimate, not a measurement): a few hundred segments with self-contact at 60 frames per second in optimised TypeScript or WebAssembly; two thousand segments with friction needs a spatial hash, several substeps and a worker thread, and perhaps 30 frames per second on a phone.

**What physics can and cannot establish.** See the physical-properties section of the [foundations report](01-mathematical-foundations.md). In short: tightening and dressing a knot into a plausible shape is realistic; predicting whether a knot holds, slips or where it breaks is not.

## WebAssembly and workers

- The Rust WebAssembly toolchain is maintained again: wasm-bindgen 0.2.130 and wasm-pack 0.15.1, both released 2026-10-30, after the original organisation was wound down in 2025.
- SIMD is available in all current browsers. Threads need `SharedArrayBuffer`, which requires the page to be cross-origin isolated: `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`, served over HTTPS (*from general knowledge*). Behind Caddy with internal certificates this is achievable, at the price of self-hosting every asset.
- The simplest route needs none of that: single-threaded code in a worker, exchanging transferable arrays.

## Recommendation

1. Three.js with the classic WebGL renderer, version pinned. WebGPU stays an optional experiment.
2. A custom tube geometry with rotation-minimising frames and a procedural rope shader.
3. A hand-written crossing halo, ambient occlusion and depth fog in 3D, plus a 2D diagram view generated from topology.
4. Centerline picking and pointer-event dragging.
5. No physics engine. Scripted, kinematic animation first; a small custom tightening solver in a worker later, in TypeScript unless profiling proves that too slow.

The choice of interface framework (React, Svelte or Vue around Three.js) is recorded in ADR 0008.

## Main risks

1. Legibility of over and under on thick tubes at grazing angles and on small screens.
2. Stability of self-contact in a custom rope solver.
3. Performance on phones once post-processing and per-frame geometry updates are combined; quality tiers will be needed.
4. Churn in Three.js and its bindings.
5. Dependence on WebGPU creeping in before Firefox on Linux supports it.
