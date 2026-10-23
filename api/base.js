// "Design my tree" without a tree photo: make a realistic photo of a bare, lit tree to design on.
// POST { kind: "room", image, marker, facts }   -> the person's room with a bare tree standing at the marked spot
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
  const { kind, image, marker, idea, inspo, facts, aspect } = req.body || {};
  const t = treeWords(facts);
  try {
    if (kind === "room") {
      const img = parseDataUrl(image), mk = parseDataUrl(marker);
      if (!img) return res.status(400).json({ error: "Missing room photo" });
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
The room's decor, colors and mood suit the homeowner's idea for their tree: "${String(idea || "a classic, elegant Christmas").slice(0, 600)}".${ins ? " The attached photo is their inspiration: let the room's colors and mood relate to the thing they love in it (their words say what that is; otherwise its clear subject), not to its background or surroundings, and keep the tree itself undecorated. A nice touch: include the inspiration piece itself in the room exactly as it really is (the same chair, the same artwork, the same object), placed naturally near the tree. Never turn it into something else (a fabric does not become framed art or wallpaper)." : ""}
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
