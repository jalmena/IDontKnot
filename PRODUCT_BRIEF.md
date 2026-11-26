# Product brief

Draft, discovery in progress. Decisions are recorded here as the Product Owner takes them, so that none is asked twice.

## What it is

IDontKnot is an interactive knot encyclopedia and an experimental laboratory. It has three complementary sides:

- **Explore**: discover, inspect and compare knots and rope structures.
- **Experiment**: manipulate rope, explore mathematical representations, create new configurations.
- **Learn**: understand how knots are constructed through interactive tutorials.

Its differentiator is that the system reasons about knots through a mathematical model. It does not merely draw them.

## Principles

- Six disciplines are first-class from the start: climbing, mountaineering and arboriculture; nautical; shibari; pioneering, lashings and rope structures; general and decorative; mathematical knot theory. A new discipline must not need an architectural change.
- No gamification: no streaks, points or engagement mechanics.
- Safety: a description is never presented as proof that a knot is safe. Claims are sourced and carry an evidence class. No strength or working load is computed or invented.
- English by default, Spanish selectable from the first release, more languages possible. Translations are kept apart from knot data.
- Self-hosted, Docker-compatible, configured by environment variables, with no cloud dependency. The running application is not exposed publicly.

## Decisions taken

| Date | Topic | Decision |
| --- | --- | --- |
| 2026-11-23 | Library structure | One library. Each knot has one page. A discipline is a lens that filters the library, changes the visual theme and brings forward that discipline's names, uses and safety notes. Discovery by purpose lives inside as filters. |
| 2026-11-23 | Tutorials in the first release | Guided manipulation: the user drags the working end, and each move (over, under, through a loop, round an object) is recognised and checked against the step. The rope follows constraints, not physics. Step-by-step playback is always available and is built first. |
| 2026-11-23 | Accounts | Reading is open to anyone who can reach the instance. Creating or editing knots and saving configurations needs an account. |
| 2026-11-23 | Shibari | Always visible, like the other five disciplines. No gate. Its content carries consent, circulation and nerve-compression information as part of each knot's documentation. |
| 2026-11-23 | Repository | Public. This reverses the initial plan of a private repository. |
| 2026-11-23 | CI | GitHub-hosted runners. No self-hosted runner. |
| 2026-11-23 | Licence | AGPL-3.0-only for all code, as in Nevus. |
| 2026-11-23 | Devices | Desktop and tablet are equal first-class targets: mouse and touch are both designed for from the start. A tablet propped beside a real rope is the typical learning setup. Phones work, with simplified manipulation. |
| 2026-11-23 | Editor | Opens to users after the tutorials. It exists earlier as an internal authoring tool for library content. The first release can save, import and export configurations, not draw them from scratch. |
| 2026-11-23 | First content | Few and complete: about a dozen essential knots spread over the six disciplines, each with every layer (3D view, diagram, guided tutorial, uses, limits, sources). |
| 2026-11-23 | Name | The product is written **IDontKnot**. |
| 2026-11-23 | Logo brief | The mark should integrate the initials IDK as `:DK`: the I split into two segments like a colon. Read vertically, as an emoticon, it is a happy person (eyes, smile) with hands together as if tying a knot. |
| 2026-11-24 | Brand identity | Mark: the `:DK` figure in rope-weight strokes with flat ends, a hand on each side of the knot. Typeface: Bitter. Colours: a near-black forest green, ivory and a satin gold, with flat gold at small sizes and in the interface. Detailed in `docs/design/brand/README.md`. |
| 2026-11-24 | Reviewing alternatives | Alternatives are shown and chosen locally. Only the chosen result and a short record of the decision go into the repository. |
| 2026-11-24 | Decision records | The seven architecture decision records proposed with the research are accepted. |
| 2026-11-24 | Server | TypeScript on Node, so that the server validates knots with the same core as the browser. |
| 2026-11-24 | Library content | Files in the repository, reviewed by pull request and packaged into the image. What users create is stored in the instance's database. |
| 2026-11-24 | Rope style and discipline | Each discipline has a rope style it is drawn with. Where the discipline is chosen, the rope selector sits beside it and follows the discipline unless a "customise" checkbox is ticked. Rope names carry no discipline. |
| 2026-11-24 | Library order by discipline | The same knots, ordered by their importance in the chosen discipline; knots a discipline does not use can be hidden. |
| 2026-11-24 | Rope drawing | Each rope is drawn as it is made, with treated jute for shibari. How light each rope is, and how strongly the grooves of laid rope are marked, were chosen from rendered alternatives. |
| 2026-11-24 | First knot | The figure-eight knot is the first knot of the library, and the one a knot page is built round. |
| 2026-11-24 | Parts of a rope | The names of the parts (standing part, loops, tail) are written on both the 3D view and the diagram. Choosing a part brings it out in both. |
| 2026-11-24 | Home page | The application opens on the library ("Explore"). The torus knot laboratory is "Experiment". |
| 2026-11-24 | Page layout | Every page shows everything on one screen of a laptop, and all pages share one layout: the view on the left with the title of the page inside it, and beside it a panel of the same height with the controls and what the core computes. Both boxes keep to one grid of margins and columns. The knot is centred and fills the view. |
| 2026-11-24 | Diagram | The 2D diagram is not shown beside the 3D view: a switch on the view shows one or the other in the same place. |
| 2026-11-24 | Material | The choice of rope is labelled "Material" and sits inside the view, opposite the title. It is one choice for the whole application, kept from page to page. |
| 2026-11-24 | Words on controls | Controls carry words, not icons. Icons were tried and declined. |
| 2026-11-24 | Margins of the picture | The knot keeps clear of the edges of the view by twice the margin of the writing, leaves the title its own line, and sits a little above the middle of the space left. |
| 2026-11-24 | Checks | A check that passes says nothing. One that fails is shown at the bottom edge of the panel. |
| 2026-11-25 | Tying a knot | A knot is tied on screen by leading the end of the rope along the finished knot, step by step, with the instruction of each step beside it. |
| 2026-11-25 | Organisation | The application is organised by knot, not by activity: the same knot is not found in two sections. It opens on the list of knots. A knot that is chosen opens above the list, which stays under it as a row on the same screen. The menu has two entries, "Knots" and "Laboratory". This replaces the entry of 2026-11-24 on the home page. |
| 2026-11-25 | Tightening | A knot can be tightened on screen: a "Tighten" button to the right of "Next", in the same style, which shows the knot being drawn tight at once, and then reads "Loosen". The knot is drawn very tight. While it tightens the key light moves from the side to above it, so that strands lying together are told apart; the loose knot keeps the light it had. |
| 2026-11-25 | Rope fed while tying | While a knot is tied step by step the rope does not appear at its end: its standing part feeds it, and it slides along the way of the knot as the end is led. This refines the entry on tying a knot. |
| 2026-11-25 | How tight | A tight knot presses its rope a tenth thinner where it bears on itself. Chosen from four rendered degrees, from rope that keeps all its thickness to rope pressed by three tenths. |
| 2026-11-25 | Names while tying | While a knot is tied step by step, the names of the parts of the rope appear as the rope forms them. |
| 2026-11-25 | Cut ends | The end of a laid rope shows the cut end of each strand, not a disc across the rope. |
| 2026-11-25 | Rope ends | Each rope ends as rope of its kind does: natural fibre a little frayed, with a few short fibres and no more; synthetic laid rope melted into one end; rope with a core and a sheath cut across, with its core showing. |
| 2026-11-25 | First dozen knots | Figure-eight knot, overhand knot, bowline, figure-eight loop, trefoil knot, reef knot, sheet bend, carrick bend, clove hitch, lark's head, single column tie and square lashing. They are built in the order of what they ask of the application: first the knots of one rope, then those of two ropes, then those tied to an object. |
| 2026-11-25 | Licence of the content | Creative Commons Attribution-ShareAlike 4.0 for everything under `content/`: shapes, names, instructions, texts and pictures. The code stays under AGPL-3.0-only. |
| 2026-11-25 | Knot page | Exploring a knot and learning to tie it happen in one place. One tab, "The knot", holds the parts of the rope and how it is tied; a second tab, "Mathematics", holds what the core computes. The knot is shown tied until it is played. |
| 2026-11-26 | Disciplines first | The application opens on the disciplines until one is chosen, and the choice is remembered. Afterwards it can be changed at the top right of every page. Choosing a discipline leads to its knots, grouped by category, and draws them in its rope, which the "Material" choice can still change; no "customise" checkbox. A knot that several disciplines use stays one page with one shape: what is said of its use, and what it is shown tied to, depend on the discipline. This replaces the entries of 2026-11-23 on the library structure and of 2026-11-24 on the rope of a discipline and on the order of the library. |
| 2026-11-26 | The name of the application | Pressing the logo leads back to the choice of discipline. |
| 2026-11-26 | Use | A third tab on the page of a knot, "Use", between "The knot" and "Mathematics": the category of the knot, what it is for in the discipline, and a button that shows in the view what it is tied to, named by what it shows ("Show the post"). |
| 2026-11-26 | Categories | Stopper knot, loop, bend, hitch, binding knot, lashing, tie, mathematical knot. Each knot has one; a discipline's knots are listed under them, in that order. |
| 2026-11-26 | Polyester | The three-strand polyester of Nautical is satin and ivory, not bright white: chosen from four rendered degrees. |
| 2026-11-26 | Things a knot is tied to | An eye is shown round a post, which stands nearly upright and passes over the upper side of the eye and under the lower. A stopper is shown against a plate that its standing part runs through, by the middle of the plate whether the knot is tied or tight, and stands out beyond. The things stay where they are: as the knot is tightened, it is the rope that moves, so that the knot rests against the plate and the eye stays round the post. This holds for most knots, unless one needs otherwise. Things are drawn in realistic wood, and in realistic metal when a thing of metal comes. |
| 2026-11-26 | Joined ends | A knot whose rope has an end inside it, such as the bowline, shows its Jones polynomial with its ends joined over the whole knot and under it, the two closures that do not depend on the way the join takes. |
| 2026-11-26 | After a load | Whether a knot jams after it has taken a load, or still unties easily, is said for every knot: it is the last sentence of what it is for, in the Use tab. |
| 2026-11-26 | Three knots for every discipline | At least three knots in each discipline, from the first dozen: Climbing, the figure-eight loop, the clove hitch and the lark's head (as a girth hitch); Nautical, the figure-eight knot, the bowline, the clove hitch and the reef knot; Shibari, the overhand knot (at the ends of the rope), the lark's head and the single column tie; Pioneering, the bowline, the clove hitch and the square lashing; General, the overhand and figure-eight knots, the bowline, the reef knot and the figure-eight loop; Mathematics, the overhand and figure-eight knots and the double overhand knot. The double overhand knot takes the place of the closed trefoil, which is the knot the overhand knot already closes into. Then the sheet bend and the carrick bend. |
| 2026-11-26 | Posts when asked for | The post a knot is tied round appears only when it is asked for, in the Use tab, as the plate and the post of the other knots do. |
| 2026-11-26 | Cautions | The Use tab of every knot has three sections: Category; What it is for, with whether it jams after a load as its last sentence; and Cautions, what to take care of with it. Every knot states its cautions. |

## Open decisions

- Visual identity, remaining: a variant for light surfaces, themes by discipline, iconography and motion.
- The typeface of the wordmark: the Product Owner would like the name to sit closer to the mark (asked on 2026-11-25; to be studied from rendered alternatives).
- 3D interaction details, editor capabilities and content organisation.
- App store integration: name, identifier, port, category, store card.

## Not goals

- Gamification.
- Computing strength, security or any safety judgement.
- Hosting the application for the public.
