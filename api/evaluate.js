// POST { image: dataURL, mode: "check"|"design", style, theme }
// Returns the designer's evaluation as JSON, including a render_brief for the image model.
import { GUIDE, CATS, STYLES } from "../lib/guide.js";
import { checkPassword, parseDataUrl, extractJson } from "../lib/util.js";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

function buildPrompt({ mode, style, theme }) {
  const styleLine = style === "themed"
    ? `Themed: ${theme || "they haven't named the theme yet; suggest one that suits what you see"}.`
    : STYLES[style] || "Classic";

  const task = mode === "design"
    ? `TASK: DESIGN this tree. They are starting fresh (the photo may show a bare or just-lit tree). Do not score it. Plan the whole tree following the order of work.`
    : `TASK: CHECK this tree. First decide from the photo whether it is PARTWAY decorated or FINISHED (report it as tree.stage). If partway: score what's there, work out which steps of the order of work are done, and plan the remaining steps in order. If finished: suggest only fixes that don't require stripping the tree (fluffing reachable spots, moving ornaments or clusters, adding ribbon, stems, flowers, or large ornaments pushed deep; lights only to fill a dark section).`;

  const scoring = mode === "check" ? `
SCORING: first decide where the eye lands first, then score each category 1-10. Use the whole scale: 1-2 missing; 3-4 present but weak; 5-6 typical home tree with obvious fixes; 7-8 careful decorator, small refinements left; 9-10 magazine quality. Most home trees land 4-7. Keep words kind and numbers honest. Category guides:
${CATS.map(c => `- ${c[0]}: ${c[2]}`).join("\n")}
` : "";

  const cats = CATS.map(c => `   {"name":"${c[0]}","score":<1-10>,"note":"<1 sentence explaining the score>"}`).join(",\n");

  return `You are an expert Christmas tree designer helping someone who loves Christmas but is not a designer.

${GUIDE}

${task}

Tree facts: work them out from the photo: real or artificial, open or dense, snowy (flocked) or not, and the height (estimate it from the room; ceilings are usually 8-9 ft).
Style: ${styleLine}
${scoring}
RENDER BRIEF: you also write instructions for a photo-editing AI that will edit THIS photo to show the tree after your advice. Write it as direct edit instructions in plain physical terms (what object, how many, size in inches, color, finish, and where on the tree: e.g. "upper left third, pushed deep toward the trunk"). Include ribbon (width, color, texture, and whether it's short drops or loops tucked into branches), stems (type, color), flowers, ornaments by size, top-of-tree changes, and lights if added. ${mode === "design" ? "Describe the complete finished tree." : "Describe only what to ADD or move; everything already on the tree stays."} 90-180 words. No scores, no reasons, no designer jargon.

Reply with ONLY this JSON:
{
 "tree": {"kind":"artificial|natural","density":"open|dense","flocked":true|false,"height_ft":<number>${mode === "check" ? ',"stage":"partial|finished"' : ""}},
 "eye_first": "${mode === "check" ? "<where the eye lands first and why, one plain sentence>" : ""}",
 "headline": "<warm, specific, under 9 words>",
 "summary": "<2 short sentences>",
 "categories": ${mode === "check" ? `[\n${cats}\n ]` : "[]"},
 ${mode === "check" ? '"potential": {"after_quick_fixes":<0-100>,"after_full_plan":<0-100>},\n ' : ""}"quick_fixes": [ {"title":"<plain, under 8 words>","how":"<one short sentence>"} ],
 "plan": [ {"step":"<plain step name, e.g. Ribbon>","title":"<under 8 words>","how":"<1-2 specific sentences: sizes, counts, where>","effort":"<e.g. 20 minutes>","shop":"<3-7 word store search, or empty>"} ],
 "render_brief": "<edit instructions as described above>"
}
quick_fixes: 3-5, ${mode === "check" ? "biggest improvement for the least effort first" : "the plan at a glance, in order"}. plan: 6-12 items following the order of work.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!checkPassword(req)) return res.status(401).json({ error: "Wrong password" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set in Vercel" });

  const { image, mode = "check", style = "keep", theme = "" } = req.body || {};
  const img = parseDataUrl(image);
  if (!img) return res.status(400).json({ error: "Missing photo" });

  const started = Date.now();
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } },
            { type: "text", text: buildPrompt({ mode, style, theme }) }
          ]
        }]
      })
    });
    const body = await r.json();
    if (!r.ok) return res.status(502).json({ error: body?.error?.message || `Claude error ${r.status}` });
    const text = (body.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    const result = extractJson(text);
    // Weighted overall score, 0-100
    if (Array.isArray(result.categories) && result.categories.length) {
      let sum = 0, w = 0;
      for (const [name, weight] of CATS) {
        const c = result.categories.find(x => x.name === name);
        if (c && typeof c.score === "number") { sum += c.score * weight; w += weight; }
      }
      result.overall = w ? Math.round(sum / w * 10) : null;
    }
    result._meta = { model: MODEL, seconds: Math.round((Date.now() - started) / 100) / 10, usage: body.usage };
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
