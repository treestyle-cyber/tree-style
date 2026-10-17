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

Keep exactly the same room, camera angle, framing, lighting, tree shape and tree size. Keep everything already on the tree unless the instructions say otherwise. Make every addition photorealistic, at true real-world scale, lit by the room's light, and physically tucked into the branches (not floating or pasted on).

Changes to make:
${brief}

The result must look like an ordinary real photograph of the same tree in the same room, not an illustration.`;
}

async function callGemini(model, img, prompt, aspect) {
  const generationConfig = { responseModalities: ["IMAGE"] };
  if (aspect) generationConfig.imageConfig = { aspectRatio: aspect };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: img.mediaType, data: img.data } }] }],
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

  const { image, brief, aspect } = req.body || {};
  const img = parseDataUrl(image);
  if (!img || !brief) return res.status(400).json({ error: "Missing photo or brief" });
  const ar = ASPECTS.includes(aspect) ? aspect : null;

  const started = Date.now();
  let lastErr = "";
  for (const model of MODELS) {
    let out = await callGemini(model, img, editPrompt(brief), ar);
    // Some models reject imageConfig; retry once without it.
    if (!out.ok && out.status === 400 && ar) out = await callGemini(model, img, editPrompt(brief), null);
    if (!out.ok) {
      lastErr = out.body?.error?.message || `Gemini error ${out.status}`;
      if (out.status === 404) continue; // model name not available: try the next one
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
