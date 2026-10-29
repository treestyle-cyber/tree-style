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
