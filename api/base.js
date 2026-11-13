// "Design my tree" without a tree photo: make a realistic photo of a bare, lit tree to design on.
// POST { kind: "room", image, marker, tree?, facts } -> the person's room with a bare tree standing at the marked spot
//      (tree: optional photo of their own tree; then it's that tree, taken down to bare, that stands in the room)
// POST { kind: "idea", idea, inspo, facts }      -> a bare tree in a room that suits the idea
// -> { image: dataURL }. The rest of the app then works on this photo exactly as on a real tree photo.
import { checkPassword, parseDataUrl } from "../lib/util.js";

const MODELS = [process.env.GEMINI_IMAGE_MODEL, "gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"].filter(Boolean);
const ASPECTS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9"];

function treeWords(f = {}) {
  const h = Number(f.height) || 7.5;
  const kind = f.kind === "natural" ? "real (fresh-cut)" : "artificial";
  const dens = f.density === "open" ? "an open tree like a noble fir, with natural gaps between its tiers of branches that come from how the tree grows" : "a full, lush tree";
  return { h, line: `a ${Math.round(h * 2) / 2} ft ${kind} Christmas tree, ${dens}` };
}
const BARE = "It is completely undecorated and ready to be styled: only warm white string lights glowing softly within the branches, a simple tree stand at the base, and NO ornaments, ribbon, garland, flowers, picks, topper or tree skirt. Fully shaped, the way a decorator sets up a tree: every branch pulled out of its folded shipping position and every tip spread and fanned out, so it looks full and natural with no flat, folded or bunched branches.";

async function gemini(parts, aspect) {
  let lastErr = "";
  for (const model of MODELS) {
    const generationConfig = { responseModalities: ["IMAGE"] };
    if (ASPECTS.includes(aspect)) generationConfig.imageConfig = { aspectRatio: aspect };
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig })
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      lastErr = body?.error?.message || `Image service error ${r.status}`;
      if (r.status === 404 || (r.status === 429 && /limit: 0/.test(lastErr))) continue;
      throw new Error(lastErr);
    }
    const ps = body?.candidates?.[0]?.content?.parts || [];
    const pic = ps.find(p => p.inlineData || p.inline_data);
    if (!pic) throw new Error("No image came back (" + (body?.candidates?.[0]?.finishReason || "try again") + ")");
    const d = pic.inlineData || pic.inline_data;
    return `data:${d.mimeType || d.mime_type || "image/png"};base64,${d.data}`;
  }
  throw new Error(lastErr || "No image model available");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!checkPassword(req)) return res.status(401).json({ error: "Wrong password" });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY is not set in Vercel" });
  const { kind, image, marker, tree, idea, inspo, facts, aspect } = req.body || {};
  const t = treeWords(facts);
  try {
    if (kind === "room") {
      const img = parseDataUrl(image), mk = parseDataUrl(marker);
      if (!img) return res.status(400).json({ error: "Missing room photo" });
      const own = parseDataUrl(tree);
      if (own) {
        const f = facts || {}, h = Number(f.height);
        const text = `Edit this photo of a room. Add the homeowner's own Christmas tree, shown in the separate tree photo, standing on the floor where they want it. It must be recognizably that same tree: the same kind of tree (real or artificial, its species or style), needle color and length, shape and silhouette, how full or open the branches are, and any flocking. If it has lights in the tree photo, keep those same lights (same color); if not, give it warm white string lights glowing softly within the branches.
Show it undecorated and ready to be styled: take off any ornaments, ribbon, garland, flowers, picks, topper and tree skirt it has in its photo, leaving only the tree, its lights and a simple stand. ${f.kind === "natural" ? "" : "If it's artificial, show it fully shaped: every branch pulled out and every tip spread, with no flat or folded branches, while keeping its own silhouette and height. "}
Size it correctly for this room: ${h ? `a ${h} ft tree` : "the tree's real height, judged from its own photo"} measured against the ceiling, doors and furniture, so it looks like it really stands there. Its base sits on the floor with natural contact shadows, lit by the room's own light, not the light in the tree photo. The whole tree, from the top to the stand, is in the frame. Nothing from the tree photo's room comes along: only the tree.
Keep the room, camera angle, framing, lighting and everything else exactly the same. The result must be an ordinary real photograph with no markings.`;
        const parts = [{ text }, { inline_data: { mime_type: img.mediaType, data: img.data } }, { text: "Their tree (use this tree; ignore its surroundings):" }, { inline_data: { mime_type: own.mediaType, data: own.data } }];
        if (mk) parts.push({ text: "Placement reference (do not copy its marking): the same room with a soft gold mark on the floor where the tree's base should stand. Center the tree on that spot." }, { inline_data: { mime_type: mk.mediaType, data: mk.data } });
        return res.status(200).json({ image: await gemini(parts, ASPECTS.includes(aspect) ? aspect : null) });
      }
      const text = `Edit this photo of a room. Add ${t.line}, standing on the floor where the homeowner wants it. ${BARE}
Size it correctly for this room: a ${t.h} ft tree measured against the ceiling, doors and furniture, so it looks like it really stands there. Its base sits on the floor with natural contact shadows, lit by the room's own light. The whole tree, from the top to the stand, is in the frame.
Keep the room, camera angle, framing, lighting and everything else exactly the same. The result must be an ordinary real photograph with no markings.`;
      const parts = [{ text }, { inline_data: { mime_type: img.mediaType, data: img.data } }];
      if (mk) parts.push({ text: "Placement reference (do not copy its marking): the same room with a soft gold mark on the floor where the tree's base should stand. Center the tree on that spot." }, { inline_data: { mime_type: mk.mediaType, data: mk.data } });
      return res.status(200).json({ image: await gemini(parts, ASPECTS.includes(aspect) ? aspect : null) });
    }
    if (kind === "idea") {
      const ins = parseDataUrl(inspo);
      const text = `Photorealistic photograph of ${t.line} standing in a beautiful, lived-in home at dusk. ${BARE}
The room's decor, colors and mood suit the homeowner's idea for their tree: "${String(idea || "a classic, elegant Christmas").slice(0, 600)}".${ins ? " The attached photo is their inspiration: let the room's colors and mood relate to the thing they love in it (their words say what that is; otherwise its clear subject), not to its background or surroundings, and keep the tree itself undecorated. Do NOT put the inspiration piece itself in the room, and don't turn it into anything else there (a fabric does not become framed art, wallpaper or upholstery): the room only shares its mood and a few of its colors." : ""}
Shot straight on at eye level, as a homeowner would take it: the whole tree visible from the top to the floor with a little room around it, slightly off center, in sharp focus. Natural warm light, magazine quality, no people, no text.`;
      const parts = [{ text }];
      if (ins) parts.push({ inline_data: { mime_type: ins.mediaType, data: ins.data } });
      return res.status(200).json({ image: await gemini(parts, "3:4") });
    }
    return res.status(400).json({ error: "Unknown starting point" });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
