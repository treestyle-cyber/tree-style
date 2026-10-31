# Tree Style · project brief

Read this first in every session. It holds what the team has decided and why, so nobody (person or Claude) has to rediscover it. **When something new is decided, add a line to the Decisions log at the bottom in the same change.**

## What it is
**Tree Style · The art of styling.** A web app that looks at a photo of a Christmas tree and gives a designer's eye: a score, a step-by-step plan, a shopping list and a photorealistic preview of the finished tree. Owner: Eric Finley, a professional Christmas tree designer. His judgment on design is the final word.

- Audience: everyday Michaels / Hobby Lobby shoppers, from skilled crafters to eager beginners who don't want a big time or money investment.
- First release is Christmas trees only (wreaths, mantels, tables come later).
- Live site: https://tree-style.vercel.app (waitlist at `/`, the app at `/try`, password-protected while testing).

## Where things are
| Path | What it is |
|---|---|
| `index.html` | Public waitlist page (dark hero, live before/after slider from Studio photos) |
| `try/index.html` | The app: screens, flow, all UI (one file: markup, styles, script) |
| `try/engine.js`, `try/guide.js` | Draws the placement map and step diagrams; builds the step-by-step guide and shopping list |
| `style.css` | Shared brand styles (dark Midnight theme, gold accents, velvet background) |
| `brand/` | Logos (metallic antique gold), favicon, fabric textures |
| `api/evaluate.js` | Claude: scores ("look"), plan ("plan", in parallel), step instructions ("details"), revisions |
| `api/render.js` | Gemini: edits the tree photo into the preview |
| `api/base.js` | Gemini: makes a bare tree photo for the "room" and "idea" starting points |
| `api/brand.js` | Brand photos chosen in the Studio (Vercel Blob) |
| `api/feedback.js`, `review/` | Tester feedback and the page to read it |
| `lib/guide.js` | **The designer's rules** (GUIDE), style definitions, scoring categories and weights (CATS) |
| `lib/schema.js` | The JSON shapes Claude must return |
| `studio/` | Generates and picks brand photography for every photo spot in the app and site |
| `lab/` | Side-by-side testing of a proposed rule against the live app |

## How we work
- **Design rules: principles, not checklists.** Explain what good design is and why, with an example, and let the model use judgment. Exact counts and positions made trees look sporadic and less creative. Avoid "never" unless something keeps going wrong.
- **Test rule changes in the Lab first** (`/lab`), one change at a time. The right column is the live app; the proposed rule runs on the left via `variant`. Eric picks the winner; only then does it go live. Clear the Lab when nothing is under test.
- **Copy voice: simple yet elevated.** "Shape the branches" (never "fluff"), "ornaments" (never "balls"), "set back toward the trunk" (never "push deep inside"), "sheer wired ribbon" (never gauze), "bolts" of ribbon, no packs or boxes, no times.
- **Secrets:** API keys live only in Vercel Environment Variables. Never paste or ask for them in chat. Never enter passwords on anyone's behalf.
- **Every commit message says what changed and why in plain English**, so the history doubles as a record.

## Branches and publishing
- `main` is the live site. Every push to `main` deploys to production.
- `design` is for app look-and-feel work. Every push to any other branch gets its own Vercel **preview** link and never touches the live site.
- Preview copies keep their **own Studio photos and feedback** (stored under `preview/` in Blob; a preview starts from the live photos and overrides them). Picking a photo in the Studio on a preview does not change the live site.
- To go live: open a pull request from `design` into `main`, Eric reviews the preview link, then merge.
- Pull `main` into `design` regularly; design-rule and scoring changes keep landing on `main`.

## Brand
- Palette: Midnight (#141C2C, background), Winter Berry, Evergreen, Walnut, Oat, Ivory (text), Antique Gold (accent, buttons). Dark velvet background throughout.
- Fonts: serif headings (Cormorant Garamond stand-in for Sentiero), Inter for UI (stand-in for Neue Haas Grotesk) until licensed fonts arrive.
- Logo: arched pine in metallic antique gold (`brand/logo-*.png`). Buttons: uppercase gold pills.

## Design rules worth knowing (full text in `lib/guide.js` and `api/evaluate.js`)
- Ribbon: 2-3 widths, wired, wide enough (a 6 ft tree still gets 5-6"; Modern is the exception). Never swags, wraps or barber poles. Designed-from-scratch trees use waterfall **cascades**; checks work with what's there.
- Hidden vine: picks, florals and ribbon moments wind back and forth, fuller low, never in a diagonal line.
- Variety: everywhere the eye lands there's something to discover: mixed shapes, several kinds of flowers and picks, ribbons that differ in texture. Variety, not clutter.
- Balance means equal visual weight, not symmetry; deliberate asymmetry is good design.
- Textured statement ribbon: at least one jeweled, embroidered or brocade wired ribbon, as the widest (5-6" wide), on Traditional, Elegant, Playful and Themed; Rustic only an embroidered one that fits the motif; never Modern.
- No black ornaments unless the person asks for black.
- Styles: Traditional, Rustic, Modern, Elegant, Playful, Themed, Keep my style. Style comes from the kinds of pieces, not color; palettes are "typical" starting points.
- Inspiration photos: find what they love (their words first), ignore the background, pick the 2-4 defining elements, keep color proportions, keep everything shoppable.
- Scoring: strict, rounds down, out of 5 from weighted categories. Full credit for designer-level work; strong trees get 2-5 finishing touches, not invented work. Lights weigh little (photos mislead); the base isn't scored.

## Decisions log
- 2026-10-22: Idea path skips the style screen; the description is the style.
- 2026-10-22: Inspiration photos: translate motifs, flowers and style, not just colors; keep color proportions; stripes/outlines are accents; printed motif ribbon is often strongest; keep it shoppable; draw only from what they love, not the background; inspiration piece stays out of the room and goes on the tree only if they say so.
- 2026-10-22: Cascading ribbon on all trees designed from scratch (won in the Lab). Variety rule adopted for every tree (won in the Lab).
- 2026-10-22: Revisions and previews never change the tree itself; a topper runs off the frame rather than shortening the tree.
- 2026-10-22: Home screen: large, readable choice cards (wide photo above a solid label).
- 2026-10-23: Style definitions expanded and blended; "Classic" renamed "Traditional"; Modern may use one narrow ribbon.
- 2026-10-23: Scoring: lights weight 15 → 5; base removed from the score (still suggested in the plan); deliberate asymmetry isn't a flaw; hidden deep ornaments get the benefit of the doubt. No black ornaments unless asked.
- 2026-10-23: `design` branch and preview-only Studio photos and feedback set up for app design work.
- 2026-10-24: Keep my style reads the style from the tree's strongest signal piece (elf legs → Playful), not a default of Traditional.
- 2026-10-28: UX review applied on the `ux-review` branch (includes the earlier `ux-checklist-oct23` work): compact home with before/after, path-only step counts, clear disabled buttons, full-screen reveal, results reordered, Save and share with a mark, Show me where on fixes, score sorted with How to raise it, shopping list ticks and Share list, one voice ("we"). Name spelled TreeStyle in text.
- 2026-10-28: Step-by-step plan (Eric's review): ornaments in two steps (extra-large & large, then medium & small); no circles on flowers; ribbon widths about 6", 4", 1.5-2" on trees 5 ft+; small accents described as picks; the crown's shopping list names a findable topper plus an alternative and reuses earlier ribbon, flowers and stems; "All together" became "Your finished tree" with no numbered pins; shaping the branches is shown as a drawn branch animation; press and hold the picture to see your photo; lighter picture treatment instead of the dark dim.
- 2026-10-28: Results screen: "Change something" is a pill on the preview itself that opens a sheet (your words, idea chips, work in a color, design around my pieces, earlier versions); the score is one line of ornaments ("See how it scored"); the Quick fixes and More ways rows were folded into the top fixes and the sheet. Shopping list: each section a card with a chevron that turns, a progress bar for ticked items, and a shared list with an emoji per section and ⬜️/✅ per item. Each section has a gold line icon (fills gold when open) and each item shows a small drawing of the piece in its color (ornament or teardrop, ribbon spool, flower, sprig, berries, lights, star).
- 2026-10-28: "Try another look" (re-painting the same plan, often worse) replaced by "Try another style": a sheet of the other styles; picking one redesigns the tree in that style as a new saved version. "Change something" pill has a wand icon.
- 2026-10-28: When the plan includes shaping the branches, the first preview shows the tree shaped: the same tree, fuller, with see-through gaps (especially low) filled by its own branches; height, tip and silhouette stay the same. Small revisions still never change the tree; "Try another style" paints the new style fresh from the original photo (with the placement map and shaping), not over the old preview. The shaping instruction leads the preview prompt ("make the tree fuller" first), also applies when Fullness scores 7 or less, and Behind the scenes shows "branches shaped" when it was sent.
- 2026-10-28: Change something edits the picture on screen: the image model is told to edit, not redraw, and keep every unnamed piece in place; the change brief builds on the current preview even for broad requests ("more jeweled"). Behind the scenes says whether a preview edited the one on screen or was painted from the photo, and shows the change instructions used.
- 2026-10-28: Jeweled or embroidered statement ribbon by default (won in the Lab): the widest ribbon is jeweled, embroidered or brocade on Traditional, Elegant, Playful, Themed (and Keep my style leaning those ways); Rustic only embroidered with a fitting motif; never Modern. Ribbon sizes are written as widths ("6 inches wide"), designed trees get real 12-18" cascades, and design briefs remove an existing swag first.
- 2026-10-28: The UX review (`ux-review` branch) went live. The live Studio offers a one-tap "Use them on the live site" for photos picked in the preview Studio, since preview picks never go live on their own.
- 2026-10-29: The base is back in every design: plans end with a tree skirt, collar or basket (named the way stores sell it) unless the tree already has a good one, and preview instructions always include it. Still not scored.
- 2026-10-29: The base is finished in the same step as the crown ("The crown & base") so the plan has one step fewer; the shopping list still lists the base on its own. Base items show a skirt (or collar/basket) drawing.
- 2026-10-31: Creator picks in the shopping list: Eric wants products from Amazon creators he follows shown first when they fit the design. First batch is Miriam (@ahillcountryhome): her Christmas Tree Decor, Christmas Ornaments and Favorite Ribbons lists, about 340 products tagged by step, color, finish and ribbon width (`PICKS` in `try/index.html`). An item links straight to a pick only when the step, color, shape (round vs drop) and ribbon width all fit; otherwise it keeps the store search. Links go to the product page with TreeStyle's own Associates tag (once set), not the creator's storefront, so the commission is TreeStyle's. Matched items show "Our pick: …" under the quantity.
- 2026-10-31: Creator picks expanded with Kinsey Walsh (@kinsey_walsh) and El Peterson (@elpetersondesign), about 420 picks in all; QianRuu skipped (not holiday decor). Stems, flowers and bases must match the kind named, and plain greenery matches only natural green stems. Each pick records its creator for future credit.
- 2026-10-31: QianRuu brand store added after all (its holiday decor only shows when you search the store for ornaments): 52 ornaments, finials, ornament cluster picks and two toppers, ~470 picks in all. Toppers match by kind too (a star for a star, an angel for an angel).
- 2026-10-31: More from QianRuu (searched the store for ribbon, picks, toppers, skirts and flowers): ornament cluster picks, crystal icicle picks, bow, star and finial toppers, a woven vine collar and a rattan skirt. It has no tree ribbon or flower stems. 485 picks in all; a topper prefers full-size over small.
- 2026-10-31: In the Lab: designs built from creator picks (variant "picks"). The plan gets the full pick list (`lib/picks.js`, a copy of PICKS) and uses a pick wherever it truly suits the style, palette and sizes, describing it plainly in the preview instructions so the picture shows that product; the Lab lists the picks each design used. Replaces the image-model test in the Lab columns (still in `api/render.js` as variant "v2").
- 2026-10-31: Statement ribbon from picks (Lab, variant "picks" only): true 5-6" jeweled or embroidered ribbon barely exists on Amazon, so four 6" solid velvets were added as picks (burgundy, white, green, candy cane stripe; found by TreeStyle, creator T), and the picks rule lets the statement ribbon be a 6" solid velvet with a 4" jeweled or embroidered pick laid over it, or a 4" jeweled or embroidered pick as the widest when no 6" one suits. The live design rule is unchanged until this wins. Shopping list: a ribbon asked for as jeweled, embroidered or brocade only matches a pick that is.
- 2026-10-31: Searched for high-follower Amazon creators with luxury holiday decor. Added Lisa Chun (@ourhome.becoming, about 1M followers): her Blue Christmas list (blue and white chinoiserie ornaments, dusty blue and navy velvet ribbon and bows, a blue velvet skirt). Added the few new tree pieces from Glam Bytes (@glambytes). Checked but not added: Farah Merhi (empty Amazon storefront), Teresa Caruso and House and Hens (no tree lists). 507 picks in all.
- 2026-10-31: Searched Facebook for holiday decor creators; Eric liked Ashley Jernigan, Brianna Ancheta, Camila Estrella and Brittany Johnson. Added 62 new tree pieces from Ashley Jernigan's Amazon storefront (prettypackagestore): her Christmas Tree Ribbon and Christmas Decorating Essentials lists (mostly 4in velvets, plaids and stripes, plus 6in statement ornaments, Norfolk and snowy pine, magnolia branches, crystal icicle picks). Not added yet: Brianna (Amazon storefront briannaxliv has no tree lists yet), Camila (LTK only, product links hidden behind redirects), Brittany (no Amazon storefront found). 569 picks in all.
- 2026-10-31: Lab picks rule (variant "picks"): design the tree first, then fill it from picks; never change a color, flower, finish or kind of piece just to use a pick, and keep pieces the picks lack in the design as regular searches. Guards the thin categories (lights, teal, purple, blush, copper, roses, hydrangeas) from drifting toward what the catalog carries most.
