// POST { image: dataURL, brief: string, aspect: "3:4" etc. }
// Edits the photo with Google's Gemini image model and returns { image: dataURL }.
import { checkPassword, parseDataUrl } from "../lib/util.js";

const MODELS = [
  process.env.GEMINI_IMAGE_MODEL,
  "gemini-3.1-flash-image-preview",
  "gemini-2.5-flash-image"
].filter(Boolean);

const ASPECTS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9"];

function editPrompt(brief) {
  return `Edit this photo of a Christmas tree to show it after a professional holiday decorator finished it.

The first image is the photo to edit. Keep exactly the same room, camera angle, framing, lighting, tree shape and tree size. Keep everything already on the tree unless the instructions say otherwise. Make every addition photorealistic, at true real-world scale, lit by the room's light, and physically tucked into the branches (not floating or pasted on).

Changes to make:
${brief}

RIBBON RULES (important): ribbon never forms a continuous line, stripe, swag or spiral across or down the tree. It appears as SEPARATE short pieces: loops or short drops that start and stop, each tucked deep into the branches at one spot, with plenty of green branches showing between them. Picture a vine hidden inside the tree that peeks out here and there. Never wrap ribbon around the tree or drape it from the top to the bottom.

The result must look like an ordinary real photograph of the same tree in the same room, not an illustration.`;
}

async function callGemini(model, img, prompt, aspect, pieces, map) {
  const generationConfig = { responseModalities: ["IMAGE"] };
  if (aspect) generationConfig.imageConfig = { aspectRatio: aspect };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: prompt },
        { inline_data: { mime_type: img.mediaType, data: img.data } },
        ...(map ? [{ text: "Placement map (reference only, do not edit or copy its drawing style): the same photo with colored marks showing WHERE each addition goes: soft ovals in the ribbon color = a spot where ribbon loops poke out of the branches; small dots in the accent ribbon color = small accent loops; dots ringed in green = flowers; plain colored circles = ornaments at their real size and color. Follow its positions and spacing so the result matches the homeowner's step-by-step guide, and don't add groupings or extra pieces the map and instructions don't show." }, { inline_data: { mime_type: map.mediaType, data: map.data } }] : []),
        ...(pieces ? [{ text: "Reference only (do not edit this one): the homeowner's own special pieces. Show these exact pieces on the tree where the instructions place them." }, { inline_data: { mime_type: pieces.mediaType, data: pieces.data } }] : [])
      ] }],
      generationConfig
    })
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!checkPassword(req)) return res.status(401).json({ error: "Wrong password" });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY is not set in Vercel" });

  const { image, brief, aspect, pieces, map } = req.body || {};
  const pc = parseDataUrl(pieces), mp = parseDataUrl(map);
  const img = parseDataUrl(image);
  if (!img || !brief) return res.status(400).json({ error: "Missing photo or brief" });
  const ar = ASPECTS.includes(aspect) ? aspect : null;

  const started = Date.now();
  let lastErr = "";
  for (const model of MODELS) {
    let out = await callGemini(model, img, editPrompt(brief), ar, pc, mp);
    // Some models reject imageConfig; retry once without it.
    if (!out.ok && out.status === 400 && ar) out = await callGemini(model, img, editPrompt(brief), null, pc, mp);
    if (!out.ok) {
      lastErr = out.body?.error?.message || `Gemini error ${out.status}`;
      // Model not available, or no quota for it on this account: try the next one
      if (out.status === 404 || (out.status === 429 && /limit: 0/.test(lastErr))) continue;
      return res.status(502).json({ error: lastErr, model });
    }
    const parts = out.body?.candidates?.[0]?.content?.parts || [];
    const pic = parts.find(p => p.inlineData || p.inline_data);
    if (!pic) {
      const why = out.body?.candidates?.[0]?.finishReason || parts.find(p => p.text)?.text || "no image returned";
      return res.status(502).json({ error: `No image came back (${why})`, model });
    }
    const d = pic.inlineData || pic.inline_data;
    return res.status(200).json({
      image: `data:${d.mimeType || d.mime_type || "image/png"};base64,${d.data}`,
      _meta: { model, seconds: Math.round((Date.now() - started) / 100) / 10 }
    });
  }
  return res.status(502).json({ error: lastErr || "No image model available" });
}
