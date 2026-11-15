// Lab test "simple" (Eric's designer's brief, Nov 14): fewer, non-conflicting rules. Eric's own guide stays, with the
// pieces his brief decided changed in place; the four-step process and the hard limits are added once. Everything else
// that was patched on around the guide is left out of this test. Live app unchanged until it wins.
import { GUIDE } from "./guide.js";

// Swap one passage of the guide, and fail loudly if the guide's wording has moved, so a test never silently runs old rules.
function swap(text, from, to) {
  if (!text.includes(from)) throw new Error("simple.js: guide passage not found: " + from.slice(0, 60));
  return text.replace(from, to);
}

let g = GUIDE;
// Ribbon placement: one of the six approved ribbon styles, chosen per tree (decision 1)
g = swap(g, "Technique depends on the tree: OPEN trees get short waterfall cascades down 2-3 branches, then cut and start another lower, stepping diagonally left or right, never straight down or straight across. DENSE trees get large loops bursting out of the tree along the hidden-vine path (ribbon lying on the outside of a solid tree looks wrong).",
  "How the ribbon sits on the tree is one of the six approved ribbon styles (see RIBBON STYLE), chosen for this tree; on a dense tree the ribbon still comes out of the branches, never lies flat on the outside.");
g = swap(g, "If the widest is solid, sparkle or metallic, lay a narrower PATTERNED ribbon over it; if the widest is a bold pattern, tone it down with a solid over it.",
  "Choose the ribbons by what looks best together: they differ in width and texture, and a bold pattern is usually calmed by a solid beside it.");
// Jeweled or embroidered ribbon: an option, not a requirement (decision 2)
g = swap(g, g.slice(g.indexOf("RIBBON WITH SURFACE INTEREST:"), g.indexOf("RIBBON MISTAKES TO FIX:")),
  `RIBBON WITH SURFACE INTEREST (an option, not a rule): a tree whose ribbons are all plain solids can read flat, and a jeweled, embroidered or brocade wired ribbon is one lovely way to give the eye something to linger on; a velvet, a plaid or a print can do the same. Choose whatever looks best with the rest of the tree. A patterned ribbon (plaid, check, stripe, print) and an embroidered or jeweled ribbon rarely belong on the same tree unless they are very close in color and scale and don't fight, so pick one direction. Modern trees leave it out. Name every ribbon the way stores sell it (e.g. "6" ivory and gold jeweled wired ribbon").
`);
g = swap(g, "re-place the SAME ribbon the right way (loops or short drops along the hidden vine)", "re-place the SAME ribbon the right way, in the chosen ribbon style along the hidden vine");
g = swap(g, "larger floral clusters with ribbon loops popping out", "larger floral clusters with ribbon coming out of the branches");
g = swap(g, "Signature cluster: ribbon loops + a large floral + a small pick.", "Signature cluster: ribbon + a large floral + a small pick.");
// Depth: biggest ornaments partway in, still visible (hard limit 6)
g = swap(g, "the largest go in first, filling gaps and pushed DEEP toward the trunk as a background (on dense trees use fewer; pushing them in spreads branches and opens space)",
  "the largest go in first, filling gaps, set partway in toward the trunk so they add depth while staying clearly visible (on dense trees use fewer; setting them in spreads branches and opens space)");
// No black (hard limit 4) and colour and contrast (hard limit 5), in Eric's agreed words
g = swap(g, g.slice(g.indexOf("NO BLACK ORNAMENTS"), g.indexOf("WORK WITH WHAT'S THERE:")),
  `NO BLACK unless the person, their style or their theme calls for it (a MacKenzie-Childs tree, a Halloween tree). Black can also appear inside a pattern already on the tree (buffalo check, a stripe).
COLOR AND CONTRAST: build on the strongest color already on the tree for contrast and definition (on a red and white tree, deepen and repeat the red). Don't add a near-match of a color that's there, like ivory beside white or champagne beside gold. Tonal looks are fine when the shades are clearly different and used on purpose. Read the existing palette carefully and name its colors precisely.
`);
// Plain words: the ribbon style names are fine to use as they are
g = swap(g, "- cascade / waterfall -> short ribbon drops; poufs or loops bursting out -> ribbon loops tucked into the branches", "- ribbon: the ribbon style names (woven billows, waterfall cascades, layered ribbons, big loops, loop bursts, curls) are plain enough to use as they are");

export const SIMPLE_GUIDE = g;

export const PROCESS = `THE DESIGNER'S PROCESS: every tree goes through the same four steps, the way a designer walks up to a client's tree.
1. Read the tree. What kind of tree is it (real or artificial, full or sparse by nature, snowy or green), how tall, and is it shaped? What style does it lean toward, and which colors lead? Where does the eye land first, and what is already working?
2. Decide what stays and what goes. Keeping their style: keep their palette and favorite pieces, and re-place anything that hurts the design (a ribbon swag, ornaments clumped at one height) before buying anything. Anything wrapped or swagged across the tree always comes off.
3. Add what's missing for the style, using the style's own kinds of pieces: stems along the hidden vine, ribbon in the chosen ribbon style in widths and textures that look best together, a real range of ornament sizes with each color repeated, and a crown that builds toward the top. Add only what this tree needs: a strong tree needs only a few finishing touches, sometimes no new ornaments at all. Don't invent work.
4. Finish the details: small stems tucked in last, the topper, and a base (skirt, collar or basket) that suits the style. Then step back: is the visual weight balanced, does the eye travel around the tree, and is there something to discover wherever it lands?
The plan, the shopping list and the picture all describe the result of these four steps.`;

export const HARD_LIMITS = `HARD LIMITS (always, for every tree):
1. Same tree: same height, width and spot. Branches can be opened but never added. Anything the person keeps stays where it is and the same color.
2. No ribbon or garland wrapped around the tree in rings or spirals. Ribbon goes on only in the chosen ribbon style.
3. Loops from the chosen ribbon style aren't bows. No tied bows with tails unless the style or the person calls for them.
4. No black unless the person, their style or their theme calls for it.
5. Build on the strongest color for contrast; no near-matches beside each other; tonal shades only when clearly different and on purpose.
6. The biggest ornaments are set partway in toward the trunk, still clearly visible; smaller ones nearer the tips; never every big ornament on the outside.
7. No dots, blobs or markings in the picture.
8. Everything is something you can buy; licensed themes are shopped by name and painted as look-alikes.`;

// The picture's own short list: the hard limits that are about painting, said once (decision 5)
export const PICTURE_LIMITS = `ALWAYS:
- Same tree: same height, width, outline and top tip. Branches can be opened but never added. Everything already on the tree that the instructions don't take off stays exactly where it is, the same color. If a topper doesn't fit, let it run off the top of the frame; never shorten the tree.
- No ribbon or garland wrapped around the tree in rings or spirals or draped across it; ribbon goes on only in the ribbon style above. Ribbon sizes are widths across the ribbon's face (6 inches wide is about a spread hand), in true scale.
- Loops from that ribbon style aren't bows. No tied bows with tails unless the instructions ask for one.
- The biggest ornaments are set partway in toward the trunk, still clearly visible; smaller ones nearer the tips.
- Every addition is a real, photorealistic decoration at true scale, lit by the room and tucked into the branches. No dots, blobs, circles, labels or markings anywhere: the result is an ordinary photograph of the same tree in the same room.`;
