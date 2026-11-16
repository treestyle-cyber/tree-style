// Lab test "clarify" (Eric, Nov 15): the live rules exactly as they are, with only the wording he clarified in his
// designer's brief swapped in. The statement ribbon, ornament counts and everything else stay as live.
import { GUIDE } from "./guide.js";

function swap(text, from, to) {
  if (!text.includes(from)) throw new Error("clarify.js: passage not found: " + from.slice(0, 60));
  return text.replace(from, to);
}

let g = GUIDE;
// Depth: the biggest ornaments partway in toward the trunk, still clearly visible
g = swap(g, "the largest go in first, filling gaps and pushed DEEP toward the trunk as a background (on dense trees use fewer; pushing them in spreads branches and opens space)",
  "the largest go in first, filling gaps, set partway in toward the trunk so they add depth while staying clearly visible, never every big ornament on the outside (on dense trees use fewer; setting them in spreads branches and opens space)");
// No black unless the person, their style or their theme calls for it; colour and contrast in Eric's agreed words
g = swap(g, g.slice(g.indexOf("NO BLACK ORNAMENTS"), g.indexOf("WORK WITH WHAT'S THERE:")),
  `NO BLACK unless the person, their style or their theme calls for it (a MacKenzie-Childs tree, a Halloween tree). Black can also appear inside a pattern already on the tree (buffalo check, a stripe).
COLOR AND CONTRAST: build on the strongest color already on the tree for contrast and definition (on a red and white tree, deepen and repeat the red in ribbon, flowers and ornaments so the tree reads crisp and defined). Don't add a near-match of a color that's there, like ivory beside white or champagne beside gold. Tonal looks are fine when the shades are clearly different and used on purpose. Read the existing palette carefully and name its colors precisely.
`);
// Anything built into the tree is part of the design (Eric liked live framing a train track with greenery and berries)
g = swap(g, "MIXED COLLECTIONS:", "BUILT-IN PIECES: anything built into the tree (a train track or shelf, a village platform, a ring of lights) is part of the design. Frame it with greenery, stems and filler so it looks intentional and tied into the tree, never left bare.\nMIXED COLLECTIONS:");
export const CLARIFY_GUIDE = g;

// The plan's picture instructions: the biggest ornaments described as partway in, still visible
export function clarifyBrief(b) {
  return swap(b, "describe the extra-large ones as set back toward the trunk, partly hidden by the branches in front of them", "describe the extra-large ones as set partway in toward the trunk, still clearly visible");
}

// The picture: same tree (branches opened, never added; what stays keeps its place and color) and the same depth wording
export function clarifyPicture(p) {
  p = p.split("ORNAMENT DEPTH (important): the biggest ornaments sit deep in the tree toward the trunk, partly covered by the branches in front of them, so they add depth and glow from within;")
    .join("ORNAMENT DEPTH (important): the biggest ornaments are set partway in toward the trunk, still clearly visible, so they add depth and glow from within; smaller ones sit nearer the tips;");
  return swap(p, "Keep everything already on the tree unless the instructions say otherwise.", "Keep everything already on the tree unless the instructions say otherwise: what stays keeps its exact place and color. Branches may be opened but never added. Greenery stems, picks and other filler are decorations, not branches: always add them where the instructions and map call for them, including around anything built into the tree, like a train track or a shelf.");
}
