// POST { image: dataURL, mode: "check"|"design", style, theme }
//   -> the designer's evaluation, including a mockup (for the step diagrams)
//      and a render_brief (for the realistic preview).
// POST { image, revise: { current, request, history, style, theme, mode, tree }, extra?: dataURL }
//   -> the design partner: a revised plan based on the homeowner's request.
import { GUIDE, CATS, STYLES } from "../lib/guide.js";
import { checkPassword, parseDataUrl, extractJson } from "../lib/util.js";
import { EVAL_SCHEMA, REVISE_SCHEMA } from "../lib/schema.js";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

const styleLine = (style, theme) => style === "themed"
  ? `Themed: ${theme || "they haven't named the theme yet; suggest one that suits what you see"}.`
  : STYLES[style] || "Classic";

const COORDS = `COORDINATES: x,y are fractions of the image width and height (0,0 top-left; 1,1 bottom-right). Locate the foliage of the tree carefully: apex = tip of the top branch; left/right = outermost lowest branch tips. Every moment and ornament must sit inside that triangle.`;

const BRIEF_RULES = (mode) => `RENDER BRIEF: instructions for a photo-editing AI that will edit the ORIGINAL photo to show the tree after this plan. Write direct edit instructions in plain physical terms (what object, how many, size in inches, color, finish, and where on the tree: e.g. "upper left third, pushed deep toward the trunk"). Cover ribbon (width, color, texture, and whether it's short drops or loops tucked into branches), stems, flowers, ornaments by size, the top of the tree, and lights if added. ${mode === "design" ? "Describe the complete finished tree." : "Describe what to REMOVE or MOVE first (e.g. \"remove the gold plaid ribbon that runs diagonally across the middle of the tree\"), then what to ADD (including re-placing the same ribbon as loops or short drops). Everything not mentioned stays exactly as it is."} Match the mockup. 90-180 words. No scores, no reasons, no designer jargon.`;

const PLAN_SHAPE = (mode) => `"quick_fixes": [ {"title":"<plain, under 8 words>","how":"<one short sentence>","x":<0-1>,"y":<0-1>} ],
 "plan": [ {"element":"fluff|lights|primary_picks|ribbon|florals|statement|medium|small|small_picks|crown|base","step":"<plain step name, e.g. Ribbon>","title":"<under 8 words>","how":"<1-2 specific sentences: sizes, counts, where>","effort":"<e.g. 20 minutes>","shop":"<3-7 word store search, e.g. '6 inch wired velvet ribbon burgundy', or empty>"} ],
 "ideas": [ {"label":"<2-4 words>","request":"<one sentence asking the design partner for this change>"} ],
 "mockup": {
   "lights": {"add":true|false,"kind":"warm|multicolor|solid","color":"#hex","density":"light|medium|heavy"},
   "ribbon_technique": "cascade|loops",
   "ribbons": [ {"role":"base|overlay|accent","width_in":<number>,"color":"#hex","texture":"satin|velvet|metallic|sheer|plaid|stripe|burlap","accent":"#hex or null","owned":true|false} ],
   "picks": {"primary":{"kind":"pine|cedar|eucalyptus|magnolia|none","finish":"natural|frosted|gold|silver"},"floral":{"kind":"poinsettia|rose|magnolia|hydrangea|orchid|none","color":"#hex"},"small":{"kind":"berries|spray|none","color":"#hex"}},
   "moments": [ {"x":<0-1>,"y":<0-1>,"size":1|2|3,"floral":true|false} ],
   "ornaments": [ {"x":<0-1>,"y":<0-1>,"color":"#hex","size":"xl|l|m|s","shape":"ball|drop|finial|geometric|candy","finish":"shiny|matte|glitter"} ],
   "crown": "light|medium|full",
   "topper": {"style":"star|bow|floral|finial|none","color":"#hex","delicate":true|false}
 },
 "render_brief": "<see RENDER BRIEF>"`;

const PLAN_NOTES = (mode) => `quick_fixes: 3-5, ${mode === "check" ? "biggest improvement for the least effort first; x,y = where on the photo" : "the plan at a glance, in order"}.
plan: 6-12 items following the order of work. Fill "shop" for every step that needs something bought (lights, stems, ribbon, flowers, each ornament step, berry stems, topper, a new skirt or collar); leave it empty only for steps like fluffing or moving what they already own.
EVERYTHING IS SOLD IN PACKS: almost nothing is bought as a single item (a topper is the exception). Give every quantity in "how" as packs, boxes or rolls: ribbon in 10-yard rolls. Use exactly this math so your steps match the shopping list: yards = tree height in feet × 2.0 for the widest ribbon, × 1.5 for the ribbon laid on top, × 1.3 for the thin accent${mode === "check" ? ", then × 0.6 because the tree is already decorated" : ""}; rolls = yards × 1.1 ÷ 10, rounded up. (Designers use about 20-30 yards of main and supporting ribbon plus about 10 of accent on a 7.5 ft tree.) stems and flowers in packs of 6, berry stems in packs of 12, lights in strands of 100. For a full designer look use about 2-3 greenery stems per foot of tree.
ORNAMENTS ARE SOLD IN BOXES: nobody buys one ornament. Use a tight palette: 2-3 colors, and at most 2 finishes per size. In plan "how", give ornament quantities in boxes (e.g. "2 boxes of 12 matte gold 3-inch balls"), never single ornaments (except heirlooms they already own).
ideas: exactly 3 genuinely different directions worth seeing for this tree.
mockup.ribbon_technique: cascade for OPEN trees, loops for DENSE. ribbons: 2-3, widest first, following the layering rule; [] if no ribbon should be added.
mockup.moments: 5-12 hidden-vine moments: larger and fuller low, smaller and sparser high, never in rows.
mockup.ornaments: 12-26 NEW ornaments: a few xl in gaps, then l, mostly m and s; shapes and finishes true to the style. These are sample placements: repeat each color/size/finish combination several times (it stands for a box) rather than many one-off combinations.
mockup.topper.style: none if the current topper is right.${mode === "check" ? " The mockup shows what they should add or re-place, not what stays as it is. If the plan re-uses ribbon they already own, include it in mockup.ribbons with owned: true (it still shows on the shopping list as a top-up, since they may not have enough); new ribbon has owned: false. Owning some ribbon never excuses breaking the ribbon rules: if theirs is too narrow, too little, or only one width, add the right ribbon (e.g. a 5-6 inch wired ribbon as the widest layer, owned: false) and re-use theirs as the narrower layer or the accent. The same goes for everything else: if they have some large ornaments but not enough, still plan the right number and say to add to what they have." : " ribbons[].owned is false."}`;

function factsLine(f) {
  if (!f) return "Tree facts: work them out from the photo: real or artificial, open or dense, snowy (flocked) or not, and the height (estimate it from the room; ceilings are usually 8-9 ft).";
  const kind = f.kind === "natural" ? "real" : f.kind === "artificial" ? "artificial" : "real or artificial: decide from the photo";
  const height = Number(f.height) ? `${f.height} ft` : "height not given (estimate it from the room)";
  const density = f.density === "open" ? "open, with natural gaps" : f.density === "dense" ? "full and dense" : "density not sure (decide from the photo)";
  return `Tree (confirmed by the homeowner; trust these over the photo): ${kind}, ${height}, ${density}. Work out whether it's snowy (flocked) from the photo.`;
}

function evalPrompt({ mode, style, theme, facts, imgNotes }) {
  const stage = facts && ["partial", "finished"].includes(facts.stage) ? facts.stage : null;
  const task = mode === "design"
    ? `TASK: DESIGN this tree. They are starting fresh (the photo may show a bare or just-lit tree). Do not score it. Plan the whole tree following the order of work, and make the mockup a complete, finished design.`
    : stage === "partial"
    ? `TASK: CHECK a tree that is PARTWAY decorated (tree.stage = "partial"). Score what's there. First look for anything already on the tree that's placed in a way that hurts the design (see WORK WITH WHAT'S THERE and RIBBON MISTAKES) and fix it. Then work out which steps of the order of work are done, and plan the remaining steps in order.`
    : stage === "finished"
    ? `TASK: CHECK a FINISHED tree (tree.stage = "finished"). Score it. First look for anything already on the tree that's placed in a way that hurts the design (see WORK WITH WHAT'S THERE and RIBBON MISTAKES): re-placing their own ribbon, moving ornaments or clusters, fixing the topper. Those free fixes come first. Then suggest additions that don't require stripping the tree: fluffing reachable spots, adding ribbon, stems, flowers, or large ornaments pushed deep. Only suggest lights if it's adding a strand to a dark section.`
    : `TASK: CHECK this tree. First decide from the photo whether it is PARTWAY decorated or FINISHED (report it as tree.stage). If partway: score what's there, work out which steps of the order of work are done, and plan the remaining steps in order. Either way, first look for anything already on the tree that's placed in a way that hurts the design (see WORK WITH WHAT'S THERE and RIBBON MISTAKES): re-placing their own ribbon, moving ornaments or clusters, fixing the topper. Those free fixes come first. If finished, then suggest additions that don't require stripping the tree (fluffing reachable spots, adding ribbon, stems, flowers, or large ornaments pushed deep; lights only to fill a dark section).`;

  const scoring = mode === "check" ? `
SCORING: first decide where the eye lands first, then score each category 1-10. Use the whole scale: 1-2 missing; 3-4 present but weak; 5-6 typical home tree with obvious fixes; 7-8 careful decorator, small refinements left; 9-10 magazine quality. Most home trees land 4-7. Keep words kind and numbers honest. Category guides:
${CATS.map(c => `- ${c[0]}: ${c[2]}`).join("\n")}
` : "";
  const cats = CATS.map(c => `   {"name":"${c[0]}","score":<1-10>,"note":"<1 sentence explaining the score>"}`).join(",\n");

  return `You are an expert Christmas tree designer helping someone who loves Christmas but is not a designer.

${GUIDE}

${task}

${imgNotes}
${factsLine(facts)}
Style: ${styleLine(style, theme)}
${scoring}
${COORDS}

${BRIEF_RULES(mode)}

Reply with this JSON:
{
 "tree": {"kind":"artificial|natural","density":"open|dense","flocked":true|false,"height_ft":<number>${mode === "check" ? ',"stage":"partial|finished"' : ""}},
 "eye_first": "${mode === "check" ? "<where the eye lands first and why, one plain sentence>" : ""}",
 "headline": "<warm, specific, under 9 words>",
 "summary": "<2 short sentences>",
 "categories": ${mode === "check" ? `[\n${cats}\n ]` : "[]"},
 ${mode === "check" ? '"potential": {"after_quick_fixes":<0-100>,"after_full_plan":<0-100>},\n ' : ""}"cone": {"apex":[x,y],"left":[x,y],"right":[x,y]},
 ${PLAN_SHAPE(mode)}
}
${PLAN_NOTES(mode)}
${mode === "design" ? 'Because this is a design (not a check): set tree.stage to "bare", eye_first to "", categories to [], and potential to 0 and 0.' : 'tree.stage is "partial" or "finished".'} For ribbons with no accent color, set accent to "".`;
}

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
Rules: change only what the request calls for and keep everything else exactly as it is. Keep following the guide (ribbon widths and layering, hidden-vine moments, ornament sizes, finishes by style). If they pick a color, weave it into the mockup and the plan so it looks intentional. If the request would hurt the design, do it anyway and add one gentle tip in your reply.

${BRIEF_RULES(mode)} The brief must describe the whole revised plan relative to the ORIGINAL photo, not just this change.

Reply with this JSON:
{
 "reply": "<1-2 friendly sentences>",
 "changes": ["<1-5 short items>"],
 "version_label": "<3-5 words>",
 ${PLAN_SHAPE(mode)}
}
${PLAN_NOTES(mode)}
For ribbons with no accent color, set accent to "".`;
}

async function callClaude(images, text, maxTokens, schema) {
  try { return await callClaudeOnce(images, text, maxTokens, schema); }
  catch (e) {
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
  if (body.stop_reason === "max_tokens") throw new Error("The answer ran long and got cut off. Please try again.");
  return { json: extractJson(out), usage: body.usage };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!checkPassword(req)) return res.status(401).json({ error: "Wrong password" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set in Vercel" });

  const { image, mode = "check", style = "keep", theme = "", revise, extra, facts, pieces, inspo } = req.body || {};
  const img = parseDataUrl(image);
  if (!img) return res.status(400).json({ error: "Missing photo" });

  const started = Date.now();
  try {
    let result, usage;
    if (revise) {
      const ex = parseDataUrl(extra);
      ({ json: result, usage } = await callClaude(ex ? [img, ex] : [img], revisePrompt(revise, !!ex), 8000, REVISE_SCHEMA));
    } else {
      const imgs = [img], notes = ["Image 1 is their tree" + (mode === "design" ? " before decorating (bare, or with just lights)." : ".")];
      const pc = parseDataUrl(pieces), ins = mode === "design" ? parseDataUrl(inspo) : null;
      if (pc) { imgs.push(pc); notes.push(`Image ${imgs.length} shows special pieces they own (ornaments, heirlooms or found objects): design around them, give them the best spots, and let them set the theme and colors if they fit the style.`); }
      if (ins) { imgs.push(ins); notes.push(`Image ${imgs.length} is an inspiration photo: design toward its feel using the guide, adapted to their tree.`); }
      ({ json: result, usage } = await callClaude(imgs, evalPrompt({ mode, style, theme, facts, imgNotes: notes.join(" ") }), 8000, EVAL_SCHEMA));
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
