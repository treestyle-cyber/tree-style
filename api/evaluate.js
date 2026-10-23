// POST { image: dataURL, mode: "check"|"design", style, theme }
//   -> the designer's evaluation, including a mockup (for the step diagrams)
//      and a render_brief (for the realistic preview).
// POST { image, revise: { current, request, history, style, theme, mode, tree }, extra?: dataURL }
//   -> the design partner: a revised plan based on the homeowner's request.
import { GUIDE, CATS, STYLES } from "../lib/guide.js";
import { checkPassword, parseDataUrl, extractJson } from "../lib/util.js";
import { EVAL_SCHEMA, LOOK_SCHEMA, PLAN_SCHEMA, REVISE_SCHEMA, DETAILS_SCHEMA } from "../lib/schema.js";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

const styleLine = (style, theme) => style === "themed"
  ? `Themed: ${theme || "they haven't named the theme yet; suggest one that suits what you see"}.`
  : STYLES[style] || "Classic";

const COORDS = `COORDINATES: x,y are fractions of the image width and height (0,0 top-left; 1,1 bottom-right). Locate the foliage of the tree carefully: apex = tip of the top branch; left/right = outermost lowest branch tips. Every moment and ornament must sit inside that triangle.`;

const BRIEF_RULES = (mode, variant) => `RENDER BRIEF: instructions for a photo-editing AI that will edit the ORIGINAL photo to show the tree after this plan. Write direct edit instructions in plain physical terms (what object, how many, size in inches, color, finish, and where on the tree: e.g. "upper left third, pushed deep toward the trunk"). Cover ornament clusters (e.g. "a tight cluster of 5 green 3-inch balls, middle right"), ribbon (width, color, texture, and whether it's short drops or loops tucked into branches; list each ribbon placement as its own separate spot, e.g. "6 separate clusters of 2-3 loops: upper center, upper right, middle left...", and say the ribbon disappears into the branches between spots; ${mode === "design" ? 'for cascades, describe each one as its own spot: wide ribbon spilling out of the branches and falling in a soft waterfall over 2-3 branches, about 12-18 inches, then tucking back in, e.g. "5 separate cascades: upper left, upper right, middle center..."; never one long run, wrap or swag down or across the tree' : "never describe it as running, cascading, wrapping or swagging across or down the tree"}), stems, flowers, ornaments by size, the top of the tree, and lights if added. ${mode === "design" ? "Describe the complete finished tree." : "Describe what to REMOVE or MOVE first (e.g. \"remove the gold plaid ribbon that runs diagonally across the middle of the tree\"), then what to ADD (including re-placing the same ribbon as loops or short drops). Everything not mentioned stays exactly as it is."} Match the mockup. 90-180 words. No scores, no reasons, no designer jargon.`;


const PLAN_SHAPE = (mode, compact) => `"quick_fixes": [ {"title":"<plain, under 8 words>","how":"<one short sentence>","x":<0-1>,"y":<0-1>} ],
 "plan": [ {"element":"fluff|lights|primary_picks|ribbon|florals|statement|medium|small|small_picks|crown|base","step":"<plain step name, e.g. Ribbon>","title":"<under 8 words>",${compact ? "" : '"how":"<1-2 specific sentences: sizes, counts, where>","effort":"<e.g. 20 minutes>",'}"shop":"<3-7 word store search, e.g. '6 inch wired velvet ribbon burgundy', or empty>"} ],
 "ideas": [ {"label":"<2-4 words>","request":"<one sentence asking the design partner for this change>"} ],
 "mockup": {
   "lights": {"add":true|false,"kind":"warm|multicolor|solid","color":"#hex","density":"light|medium|heavy"},
   "ribbon_technique": "cascade|loops",
   "ribbons": [ {"role":"base|overlay|accent","width_in":<number>,"color":"#hex","color_name":"<the color as a designer would name it, e.g. burgundy, champagne, olive>","texture":"satin|velvet|metallic|sheer|plaid|stripe|print|burlap","accent":"#hex or null","owned":true|false} ],
   "picks": {"primary":{"kind":"pine|cedar|eucalyptus|magnolia|none","finish":"natural|frosted|gold|silver"},"floral":{"kind":"poinsettia|rose|magnolia|hydrangea|orchid|none","color":"#hex","color_name":"<name>"},"small":{"kind":"berries|spray|none","color":"#hex","color_name":"<name>","label":"<what they are, plainly, e.g. red berry stems, crystal sprays, small white flowers, frosted pinecone picks>"}},
   "moments": [ {"x":<0-1>,"y":<0-1>,"size":1|2|3,"floral":true|false} ],
   "ornaments": [ {"x":<0-1>,"y":<0-1>,"color":"#hex","color_name":"<name>","size":"xl|l|m|s","shape":"ball|drop|finial|geometric|candy","finish":"shiny|matte|glitter"} ],
   "clusters": [ {"x":<0-1>,"y":<0-1>,"color":"#hex","color_name":"<name>","size":"m|s","count":3-5,"finish":"shiny|matte|glitter"} ],
   "crown": "light|medium|full",
   "topper": {"style":"star|bow|floral|finial|none","color":"#hex","color_name":"<name>","label":"<what it is, plainly, e.g. oversized velvet bow with long tails, spray of gold leaves and stems>","delicate":true|false}
 },
 "render_brief": "<see RENDER BRIEF>"`;

const PLAN_NOTES = (mode, compact) => `quick_fixes: 3-5, ${mode === "check" ? "biggest improvement for the least effort first; x,y = where on the photo" : "the plan at a glance, in order"}.
plan: 6-12 items following the order of work.${compact ? " Titles only here: the written instructions for each step are written in a separate pass, so keep this part short." : ""} Fill "shop" for every step that needs something bought (lights, stems, ribbon, flowers, each ornament step, berry stems, topper, a new skirt or collar); leave it empty only for steps like fluffing or moving what they already own.
QUANTITIES: pack sizes vary by store, so never mention packs or boxes. Give counts ("about 18 greenery stems", "about 6 extra-large ornaments"), lights in strands of 100, and ribbon in yards plus 10-yard bolts (always "bolts", not rolls). Ribbon math, so your words match the shopping list: yards = tree height in feet × 2.0 for the widest ribbon, × 1.5 for the ribbon laid on top, × 1.3 for the thin accent; give the yards plus whole bolts, rounding up (e.g. "about 15 yards, 2 bolts"), with a range only when fuller loops could need one more (e.g. "about 18 yards, 2-3 bolts"). For a full designer look use about 2-3 greenery stems per foot of tree.
RIBBON NAMES: all ribbon is wired; always say so (e.g. "6-inch burgundy velvet wired ribbon"). A ribbon printed with a motif (tiger print, leopard, chinoiserie, floral, toile) has texture "print" and its color_name names the print, e.g. "tiger-print" or "blue and white chinoiserie". Sheer ribbon is "sheer ribbon", never gauze or chiffon.
ORNAMENTS: use a tight palette: 2-3 colors, and at most 2 finishes per size. Give sizes in whole inches. Call the biggest "extra-large ornaments".
COLOR NAMES: every color_name is the name you use in your words (e.g. "champagne", "olive", "burgundy"), and your words never use a different name for the same thing.
ideas: exactly 3 genuinely different directions worth seeing for this tree.
mockup.ribbon_technique: cascade for OPEN trees, loops for DENSE. ribbons: 2-3, widest first, following the layering rule; [] if no ribbon should be added.
mockup.moments: 5-12 hidden-vine moments: larger and fuller low, smaller and sparser high, never in rows. Going down the tree they zigzag left and right across the full width; three in a row must never line up into a diagonal.
mockup.ornaments: 12-26 NEW ornaments: a few xl in gaps, then l, mostly m and s; shapes and finishes true to the style. These are sample placements: repeat each color/size/finish combination several times (it stands for a box) rather than many one-off combinations.
mockup.clusters: optional ornament clusters (see ORNAMENT CLUSTERS). They are one design tool among many, not a signature: many trees should have none, so people who try several trees see real variety. Include them (1-3) only when this particular design calls for them; otherwise []. Each is 3-5 medium or small balls of one color and finish grouped at one spot (x,y = the center of the group). Don't repeat cluster balls in mockup.ornaments. Anything you put here is drawn in the step-by-step guide and the preview, so only include what you want called out.
mockup.topper.style: none if the current topper is right. Don't default to a star: consider an oversized bow with long tails, a burst of stems and flowers rising from the crown, a finial, or a spray of sprigs and ornaments; use a star only when the style truly calls for it. Vary toppers from tree to tree.
mockup.picks.small: small accents are not only berries: small flowers, crystal or glitter sprays, frosted sprigs, pinecone picks and similar. Choose what suits the style, and say it plainly in small.label.${mode === "check" ? " The mockup shows what they should add or re-place, not what stays as it is. If the plan re-uses ribbon they already own, include it in mockup.ribbons with owned: true (it still shows on the shopping list as a top-up, since they may not have enough); new ribbon has owned: false. Owning some ribbon never excuses breaking the ribbon rules: if theirs is too narrow, too little, or only one width, add the right ribbon (e.g. a 5-6 inch wired ribbon as the widest layer, owned: false) and re-use theirs as the narrower layer or the accent. The same goes for everything else: if they have some large ornaments but not enough, still plan the right number and say to add to what they have." : " ribbons[].owned is false."}`;

function factsLine(f) {
  if (!f) return "Tree facts: work them out from the photo: real or artificial, open or dense, snowy (flocked) or not, and the height (estimate it from the room; ceilings are usually 8-9 ft).";
  const kind = f.kind === "natural" ? "real" : f.kind === "artificial" ? "artificial" : "real or artificial: decide from the photo";
  const height = Number(f.height) ? `${f.height} ft` : "height not given (estimate it from the room)";
  const density = f.density === "open" ? "open, with natural gaps" : f.density === "dense" ? "full and dense" : "density not sure (decide from the photo)";
  return `Tree (confirmed by the homeowner; trust these over the photo): ${kind}, ${height}, ${density}. Work out whether it's snowy (flocked) from the photo.`;
}

function evalPrompt({ mode, style, theme, facts, imgNotes, part, variant }) {
  const stage = facts && ["partial", "finished"].includes(facts.stage) ? facts.stage : null;
  const task = mode === "design"
    ? `TASK: DESIGN this tree. They are starting fresh (the photo may show a bare or just-lit tree). Do not score it. Plan the whole tree following the order of work, and make the mockup a complete, finished design.`
    : stage === "partial"
    ? `TASK: CHECK a tree that is PARTWAY decorated (tree.stage = "partial"). Score what's there. First look for anything already on the tree that's placed in a way that hurts the design (see WORK WITH WHAT'S THERE and RIBBON MISTAKES) and fix it. Then work out which steps of the order of work are done, and plan the remaining steps in order.`
    : stage === "finished"
    ? `TASK: CHECK a FINISHED tree (tree.stage = "finished"). Score it. First look for anything already on the tree that's placed in a way that hurts the design (see WORK WITH WHAT'S THERE and RIBBON MISTAKES): re-placing their own ribbon, moving ornaments or clusters, fixing the topper. Those free fixes come first. Then suggest additions that don't require stripping the tree: fluffing reachable spots, adding ribbon, stems, flowers, or large ornaments set back toward the trunk. Only suggest lights if it's adding a strand to a dark section.`
    : `TASK: CHECK this tree. First decide from the photo whether it is PARTWAY decorated or FINISHED (report it as tree.stage). If partway: score what's there, work out which steps of the order of work are done, and plan the remaining steps in order. Either way, first look for anything already on the tree that's placed in a way that hurts the design (see WORK WITH WHAT'S THERE and RIBBON MISTAKES): re-placing their own ribbon, moving ornaments or clusters, fixing the topper. Those free fixes come first. If finished, then suggest additions that don't require stripping the tree (fluffing reachable spots, adding ribbon, stems, flowers, or large ornaments set back toward the trunk; lights only to fill a dark section).`;

  const scoring = mode === "check" ? `
SCORING: judge like a professional tree designer comparing against designer-decorated trees, not against other home trees. First decide where the eye lands first, then score each category 1-10. Use the whole scale: 1-2 missing, or hurting the tree (e.g. a ribbon swag cutting across it); 3-4 a typical home tree: present but not designed; 5-6 thoughtfully done with clear fixes left; 7-8 designer level, small refinements only; 9-10 magazine quality. Most home trees land 3-5; reserve 7+ for work a designer would be proud of, and don't round up out of kindness. Keep words kind and numbers honest. Category guides:
${CATS.map(c => `- ${c[0]}: ${c[2]}`).join("\n")}
` : "";
  const cats = CATS.map(c => `   {"name":"${c[0]}","score":<1-10>,"note":"<1 sentence explaining the score>"}`).join(",\n");

  return `You are an expert Christmas tree designer helping someone who loves Christmas but is not a designer.

${GUIDE}\n\n${VARIETY}${DESIGN_RIBBON(mode) ? "\n\n" + DESIGN_RIBBON(mode) : ""}${variant === "v2" && LAB_RULE ? "\n\n" + LAB_RULE : ""}

${task}

${imgNotes}
${factsLine(facts)}
Style: ${styleLine(style, theme)}
${scoring}
${COORDS}
${part === "look" ? LOOK_PART : BRIEF_RULES(mode, variant)}${part === "plan" ? PLAN_PART : ""}

Reply with this JSON:
{
${[
  part !== "plan" && ` "tree": {"kind":"artificial|natural","density":"open|dense","flocked":true|false,"height_ft":<number>${mode === "check" ? ',"stage":"partial|finished"' : ""}},
 "eye_first": "${mode === "check" ? "<where the eye lands first and why, one plain sentence>" : ""}",
 "headline": "<warm, specific, under 9 words>",
 "summary": "<2 short sentences${mode === "check" ? ": start with where the eye lands first, then the biggest opportunity" : ""}>",
 "categories": ${mode === "check" ? `[\n${cats}\n ]` : "[]"},
 "potential": ${mode === "check" ? '{"after_quick_fixes":<0-100>,"after_full_plan":<0-100>}' : '{"after_quick_fixes":0,"after_full_plan":0}'},
 "cone": {"apex":[x,y],"left":[x,y],"right":[x,y]}`,
  part !== "look" && ` ${PLAN_SHAPE(mode, true)}`
].filter(Boolean).join(",\n")}
}
${part === "look" ? "" : PLAN_NOTES(mode, true) + "\n"}${part === "plan" ? "" : mode === "design" ? 'Because this is a design (not a check): set tree.stage to "bare", eye_first to "", categories to [], and potential to 0 and 0.' : 'tree.stage is "partial" or "finished".'}${part === "look" ? "" : ' For ribbons with no accent color, set accent to "".'}`;
}

// Under test in /lab (variant "v2"): one design rule at a time, against the live app.
// Cascading ribbon on trees designed from scratch (won in the Lab, Oct 22). Not for checks: there they work around ribbon already on the tree.
const DESIGN_RIBBON = mode => mode !== "design" ? "" : `RIBBON WHEN DESIGNING FROM SCRATCH: use the waterfall cascade technique (mockup.ribbon_technique "cascade"), whatever the tree's density. Wide wired ribbon spills out from deep in the branches and falls in a soft, full waterfall over 2-3 branches, 12-18 inches, then tucks back in; the next cascade starts lower and to one side, so the cascades step left and right down the tree and never line up. The narrower ribbon is laid over the widest in the same cascades; the accent ribbon peeks out on its own. This flowing ribbon is the backbone of the design, so make it generous.`;
// Variety and layered detail, for every tree (won in the Lab, Oct 22)
const VARIETY = `VARIETY AND DETAIL: what makes a designer tree is variety, so that everywhere the eye lands there is something to discover. Mix ornament shapes and finishes (rounds with teardrops, finials, figural and novelty pieces), use several kinds of flowers and picks rather than one, and let the 2-3 ribbons differ in texture as well as width. Variety comes from mixing kinds, not from adding clutter: keep the hidden-vine placement, the balance and the palette.`;
const LAB_RULE = ``;   // nothing under test in the guide right now
// Drawing more from an inspiration photo (won in the Lab, Oct 22)
const INSPO_MORE = ` Draw more fully from it: beyond its two or three main colors, bring in a few of its supporting colors as accents, including its warmer or bolder ones (they give the tree life), so the tree carries the image's range (distinct colors, not near-matches of each other). Keep its proportions: the colors that fill most of the inspiration lead the tree (the widest ribbon, the most ornaments, the skirt), and a color that appears only in small amounts stays a small accent on the tree too, however strong or dark it is. Lines, stripes and outlines (a tiger's stripes, a pattern's outlines, a dark background showing between motifs) are part of the drawing, not a main color: bring them in through a few small accents, never as the skirt, the extra-large ornaments or the widest ribbon. To echo a motif in ribbon, a ribbon printed with the motif itself is often the strongest choice (a tiger print for a tiger, a chinoiserie or floral print for those). Layering solid ribbons in its colors can be lovely too when they complement the other pieces (blue and white ribbons beside blue and white ginger-jar ornaments); just notice what a color pairing reads as on its own, since some read as another holiday (orange and black looks like Halloween). If it features flowers, bring in two or three different kinds from it, not just one.`;
const LOOK_PART = `YOUR PART: you only write the first impression and the scores. The plan, mockup and preview brief are being written separately at the same time, so don't plan anything here. Be quick and specific.`;
const PLAN_PART = `

YOUR PART: the scores and first impression are being written separately at the same time. You write only the plan, ideas, mockup and render brief.`;

function revisePrompt(rv, hasExtra) {
  const t = rv.tree || {}, mode = rv.mode === "design" ? "design" : "check";
  const history = (rv.history || []).slice(-6).map(h => `${h.role === "user" ? "Homeowner" : "You"}: ${String(h.text).slice(0, 400)}`).join("\n");
  return `You are an expert Christmas tree designer acting as a design partner for someone who loves Christmas but isn't a designer. You already made the plan below. Revise it based on their request. Image 1 is their tree as it is now (the original photo).${hasExtra ? " Image 2 shows pieces they own: design around them and give them the best spots." : ""}

${GUIDE}

TREE: ${t.kind || "artificial"}, ${t.height_ft || 7} ft, ${t.density || "dense"}${t.flocked ? ", snowy (flocked)" : ""}. MODE: ${mode === "design" ? "designing from scratch" : "checking their tree; the mockup shows only additions, and fixes must not require stripping the tree"}. STYLE: ${styleLine(rv.style, rv.theme)}
${rv.cone ? `Tree outline in the photo (fractions of width/height): apex ${JSON.stringify(rv.cone.apex)}, lower-left ${JSON.stringify(rv.cone.left)}, lower-right ${JSON.stringify(rv.cone.right)}. Keep every x,y inside that triangle.` : COORDS}

CURRENT PLAN (JSON):
${JSON.stringify(rv.current)}
${history ? "\nEARLIER IN THIS CONVERSATION:\n" + history + "\n" : ""}
HOMEOWNER'S REQUEST: ${String(rv.request || "").slice(0, 800)}

Use plain everyday words in reply and changes (stems not picks, flowers not florals, top of the tree not crown).
Rules: change only what the request calls for and keep everything else exactly as it is. Make the requested change CLEARLY VISIBLE: if they ask to add something, add enough of it, big enough to read from across the room, and give it a starring role (for example, a ribbon they ask for becomes the widest or the laid-on-top ribbon at every ribbon spot, not just the thin accent, unless they say accent). Keep following the guide (ribbon widths and layering, hidden-vine moments, ornament sizes, finishes by style). If they pick a color, weave it into the mockup and the plan so it looks intentional. If the request would hurt the design, do it anyway and add one gentle tip in your reply.

${BRIEF_RULES(mode)} The brief must describe the whole revised plan relative to the ORIGINAL photo, not just this change.

Reply with this JSON:
{
 "reply": "<1-2 friendly sentences>",
 "changes": ["<1-5 short items>"],
 "version_label": "<3-5 words>",
 "change_brief": "<edit instructions for the CURRENT preview photo, which already shows the previous version: describe ONLY what to add, remove or swap for this request, with sizes, colors, how many and where (e.g. 'Add red and black buffalo check wired ribbon, 2.5 inches wide, as 2-3 loops tucked into the branches at each of the 7 existing ribbon spots: upper left, upper right, ...'). Everything else stays exactly as it is. 40-120 words.>",
 ${PLAN_SHAPE(mode, true)}
}
${PLAN_NOTES(mode, true)}
For ribbons with no accent color, set accent to "".`;
}

function detailsPrompt(dt) {
  const r = dt.result || {}, mode = dt.mode === "design" ? "design" : "check", t = r.tree || {};
  const plan = (r.plan || []).map((p, i) => ({ n: i + 1, element: p.element, step: p.step, title: p.title, shop: p.shop }));
  return `You are an expert Christmas tree designer. You already planned this tree; now write the step-by-step instructions the homeowner will follow. The image is their tree${mode === "design" ? " before decorating" : ""}.

${GUIDE}

TREE: ${t.kind || "artificial"}, about ${t.height_ft || 7} ft, ${t.density || "dense"}${t.flocked ? ", snowy (flocked)" : ""}. STYLE: ${styleLine(dt.style, dt.theme)}. MODE: ${mode === "design" ? "designing from scratch" : "improving their tree; fix what's already there first, then add"}.
${factsLine(dt.facts)}

THE PLAN (write instructions for exactly these steps, in this order):
${JSON.stringify(plan)}

WHAT GOES ON THE TREE (the diagrams show this; your words must match it):
${JSON.stringify(r.mockup || {})}

${PLAN_NOTES(mode).split("\n").filter(l => /^(QUANTITIES|RIBBON NAMES|ORNAMENTS:|COLOR NAMES)/.test(l)).join("\n")}
${dt.shopping && dt.shopping.length ? `
THE SHOPPING LIST the homeowner sees (use exactly these names, colors and amounts when you mention something to buy; never a different color name or amount):
${dt.shopping.map(g => `- ${g.title}: ${g.items.map(i => `${i.label} (${i.qty})`).join("; ")}`).join("\n")}
` : ""}
Your words are the ONLY instructions on each step's screen (there is no other paragraph above them), so each "how" must stand on its own: two or three short sentences that blend the technique with what's specific to THIS tree and plan: where on their tree (e.g. "the bare patch low on the left"), what to fix in what's already there, and which colors and how many. When one step has several plan items (e.g. three ribbons), each item covers only its own piece; don't repeat the shared technique in every item. Never mention packs, boxes or how long a step takes. Plain, elevated words: "shape the branches", never "fluff"; "ornaments", never "balls"; "the crown" for the top of the tree is fine.

Reply with: {"steps":[{"how":"..."}]} with exactly ${plan.length} items, one per plan step, same order.`;
}

async function callClaude(images, text, maxTokens, schema) {
  try { return await callClaudeOnce(images, text, maxTokens, schema); }
  catch (e) {
    // Cut off: retry once with plenty more room and a nudge to keep the words tight.
    if (e.cutoff) return await callClaudeOnce(images, text + "\n\nKeep every text field brief (one or two short sentences).", Math.max(maxTokens * 2, 32000), schema);
    // If the structured format itself is rejected, fall back to plain text + repair.
    if (schema && e.status === 400) return await callClaudeOnce(images, text + "\n\nReply with ONLY the JSON, no other text.", maxTokens, null);
    throw e;
  }
}

async function callClaudeOnce(images, text, maxTokens, schema) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      // Structured outputs: the API guarantees the reply matches this shape.
      ...(schema ? { output_config: { format: { type: "json_schema", schema } } } : {}),
      messages: [{
        role: "user",
        content: [
          ...images.map(img => ({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } })),
          { type: "text", text }
        ]
      }]
    })
  });
  const body = await r.json();
  if (!r.ok) { const e = new Error(body?.error?.message || `Claude error ${r.status}`); e.status = r.status; throw e; }
  const out = (body.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  if (body.stop_reason === "max_tokens") { const e = new Error("The answer ran long and got cut off. Please try again."); e.cutoff = true; throw e; }
  return { json: extractJson(out), usage: body.usage };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!checkPassword(req)) return res.status(401).json({ error: "Wrong password" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set in Vercel" });

  const { image, mode = "check", style = "keep", theme = "", revise, extra, facts, pieces, inspo, details, part, variant } = req.body || {};
  const img = parseDataUrl(image);
  if (!img) return res.status(400).json({ error: "Missing photo" });

  const started = Date.now();
  try {
    let result, usage;
    if (details) {
      ({ json: result, usage } = await callClaude([img], detailsPrompt(details), 8000, DETAILS_SCHEMA));
    } else if (revise) {
      const ex = parseDataUrl(extra);
      ({ json: result, usage } = await callClaude(ex ? [img, ex] : [img], revisePrompt(revise, !!ex), 16000, REVISE_SCHEMA));
    } else {
      const imgs = [img], notes = ["Image 1 is their tree" + (mode === "design" ? " before decorating (bare, or with just lights)." : ".")];
      const pc = parseDataUrl(pieces), ins = mode === "design" ? parseDataUrl(inspo) : null;
      if (pc) { imgs.push(pc); notes.push(`Image ${imgs.length} shows special pieces they own (ornaments, heirlooms or found objects): design around them, give them the best spots, and let them set the theme and colors if they fit the style.`); }
      if (ins) { imgs.push(ins); notes.push(`Image ${imgs.length} is an inspiration photo (art, a room, fabric, an object). First decide what in the photo is the inspiration and what is just background: use their own words (if they say they love the fabric on a chair, the inspiration is the fabric, not the chair, its frame or the room; brass sconces photographed on a towel are about the sconces, not the towel), and otherwise the clear subject. Draw only from that, never from the surroundings, surface or setting. Design the tree the way a top designer would around it: read more than its colors. Notice what is actually in it (its hero subject, its flowers and plants by kind, its objects and patterns, its materials, its cultural or period style) and translate those into real decor. Echo its hero subject in a figural piece or two; carry its flowers in as matching floral stems in the same kinds and colors; find ornaments shaped like or patterned after its objects (glass flowers, figural or patterned pieces), not only round ornaments, and repeat a signature object in a few sizes through the tree; let its pattern or style show in the ribbon choice, and small bows in one of its accent colors can carry that color through the tree; the base can echo it too, in a way that suits the tree's overall feel (an elegant design gets a tree skirt in its colors or fabric; a collar or basket suits a rustic or casual one), with its colors drawn from the image. Keep it to a considered handful of these motifs woven through the whole tree, and follow the guide for placement, ribbon and balance. Name these pieces specifically in the plan and the brief so the preview shows them.${INSPO_MORE}`); }
      ({ json: result, usage } = await callClaude(imgs, evalPrompt({ mode, style, theme, facts, imgNotes: notes.join(" "), part, variant }), part === "look" ? 4000 : 16000, part === "look" ? LOOK_SCHEMA : part === "plan" ? PLAN_SCHEMA : EVAL_SCHEMA));
      // Weighted overall score, 0-100
      if (Array.isArray(result.categories) && result.categories.length) {
        let sum = 0, w = 0;
        for (const [name, weight] of CATS) {
          const c = result.categories.find(x => x.name === name);
          if (c && typeof c.score === "number") { sum += c.score * weight; w += weight; }
        }
        result.overall = w ? Math.round(sum / w * 10) : null;
      }
    }
    result._meta = { model: MODEL, seconds: Math.round((Date.now() - started) / 100) / 10, usage };
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
