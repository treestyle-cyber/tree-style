// Ribbon styles (Eric, Nov 14): six approved ways to put ribbon on a tree, each with its own reference photo in the
// Studio (slot "ribbon_<key>"). Under test in the Lab as variant "ribbon6": the plan picks the style that suits the tree
// and the preview gets only that style's photo and description. The live app still uses the single ribbon photo.
export const RIBBON_STYLES = {
  woven_billows: {
    slot: "ribbon_billows",
    name: "Woven billows",
    plan: "one wide ribbon (or two, used separately) comes out of deep in the branches in a soft open puff, tucks back in, and pops out again further along, so it reads as one ribbon weaving in and out with green between. Quiet and classic; works on any style and on sparse trees.",
    paint: "Each ribbon piece emerges from deep inside the branches in one soft, open billow, tucks back in, and appears again further along, so each ribbon reads as weaving in and out of the tree with green branches between its appearances. Both ends of every piece are hidden in the branches. Nothing is tied: no bows, no knots."
  },
  waterfall_cascades: {
    slot: "ribbon_cascades",
    name: "Waterfall cascades",
    plan: "three to five long drops of wide ribbon that start near the top and fall down the tree over several branches, tucked in every foot or so so they ripple, spaced around the tree. Dramatic and tall; strongest on Traditional and Elegant trees 7 ft and up.",
    paint: "The ribbon falls in three to five long, separate waterfall drops that start near the top and spill down the tree over several branches, tucked into the branches every foot or so so each drop ripples in and out, spaced apart around the tree with green between them. The drops run down, never around: no spiral, no garland, no wrap. Nothing is tied into a bow unless the instructions ask for one at the very top."
  },
  layered_ribbons: {
    slot: "ribbon_layered",
    name: "Layered ribbons",
    plan: "two or three different ribbons (for example a wide velvet with a narrower metallic, stripe or sheer laid over it) billow out together at each spot, with a few short drops. Rich and full; suits Elegant, Traditional and Themed trees with a strong palette.",
    paint: "At each ribbon spot two or three different ribbons come out of the branches together, laid over one another (the widest at the back, a narrower one over it), in soft billows and short drops, then tuck back in. The spots are separate and scattered across the tree with green between them. Nothing is tied: no bows, no knots."
  },
  big_loops: {
    slot: "ribbon_loops",
    name: "Big loops",
    plan: "large, generous loops of wide ribbon (often velvet), pinched and tucked into the branches in a loose zigzag down the tree, reading as full, bow-like loops with a few short tails. Bold and graphic; good on Traditional and Elegant trees with one strong ribbon color.",
    paint: "The ribbon forms large, generous loops of wide ribbon, each pinched and tucked into the branches, stacked in a loose zigzag down the tree. They may read as full, bow-like loops with a few short tails, but each is tucked into the branches rather than tied around them. Green branches show between the loops."
  },
  loop_bursts: {
    slot: "ribbon_bursts",
    name: "Loop bursts",
    plan: "clusters of many narrow ribbon loops (about 1-2.5 inches wide, in several colors and textures) gathered like a florist's spray and tucked in, with a few streaming tails, scattered over the tree and gathered fuller at the top. Festive and abundant; suits Playful and Themed trees and very full ornament designs.",
    paint: "The ribbon is narrow (about 1 to 2.5 inches wide) and gathered into clusters of many loops, like a florist's spray, each cluster tucked into the branches with a few streaming tails, scattered across the tree and fuller at the top. Several ribbon colors and textures mix within the clusters."
  },
  curls: {
    slot: "ribbon_curls",
    name: "Curls",
    plan: "many short, springy curls of wired ribbon in two or three patterns (for example gingham, dots and sheer metallic), each a single loop or S-curl tucked at both ends, scattered evenly all over the tree. Playful, casual and lively; suits Playful and relaxed Traditional or Rustic trees.",
    paint: "Many short, springy curls of wired ribbon in two or three patterns, each a single loop or S-curl tucked into the branches at both ends, scattered evenly all over the tree so the whole tree looks lively. No long drops, no bows."
  }
};
export const RIBBON_STYLE_KEYS = Object.keys(RIBBON_STYLES);

export const RIBBON6_RULE = `RIBBON STYLE (choose one): set mockup.ribbon_technique to the ribbon style that best suits this tree, its style, palette, size and fullness, and the person's words, then design and describe all ribbon in that style. The approved styles:
${RIBBON_STYLE_KEYS.map(k => `- ${k} (${RIBBON_STYLES[k].name}): ${RIBBON_STYLES[k].plan}`).join("\n")}
This choice replaces any cascade or loop technique mentioned elsewhere in these instructions; there is no default style. If the tree already has ribbon or garland wrapped, swagged or running in a line across or around it, take it off first: the plan says so, and the picture instructions begin by removing it, before the new ribbon goes in. Pick with judgment, not by habit: vary it across trees the way a designer would. In the render brief, begin the ribbon part with "Ribbon style: <the style's name>." and then say plainly how the ribbon sits in this style (for example "three long waterfall drops" or "small curls of gingham and sheer gold all over") and never write bows unless the style is big loops or loop bursts or the person asked for a bow.`;

// The plan's answer as one of the six keys, even if it came back in other words ("loops", "cascade"); otherwise the style named in the picture
// instructions wins ("Ribbon style: Curls."), then to woven billows.
export function ribbonStyleKey(v, brief = "") {
  const pick = t => {
    t = String(t || "").toLowerCase();
    if (RIBBON_STYLES[t]) return t;
    if (/burst|spray|cluster/.test(t)) return "loop_bursts";
    if (/curl/.test(t)) return "curls";
    if (/layer/.test(t)) return "layered_ribbons";
    if (/cascade|waterfall|drop/.test(t)) return "waterfall_cascades";
    if (/big.?loop|^loops?$/.test(t)) return "big_loops";
    if (/billow|woven|weave/.test(t)) return "woven_billows";
    return null;
  };
  const m = String(brief).match(/ribbon style:\s*([a-z ]+)/i);
  if (RIBBON_STYLES[String(v || "").toLowerCase()]) return String(v).toLowerCase();
  return (m && pick(m[1])) || pick(v) || "woven_billows";
}
