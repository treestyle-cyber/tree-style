// Brand photography for the app and site, made in the Studio (/studio).
// GET  /api/brand                      -> { photos: { slot: url }, storage: true|false }   (public: the app reads this)
// GET  /api/brand?img=<slot>           -> the chosen image itself (used when the store is private)
// POST /api/brand { action:"generate", prompt, aspect }   -> { image: dataURL }            (password)
// POST /api/brand { action:"use", slot, image }           -> { url }                       (password)
import { put, list, get } from "@vercel/blob";
import { blobToken, blobVarNames, blobConnected } from "../lib/blob.js";
const tok = () => (blobToken() ? { token: blobToken() } : {});
import { ribbonRef, RIBBON_REF_NOTE } from "../lib/ribbonref.js";
import { checkPassword, parseDataUrl } from "../lib/util.js";

const SLOTS = ["ribbonref", "velvet", "velvetberry", "hero", "check", "design", "keep", "classic", "rustic", "modern", "elegant", "playful", "themed"];
const MODELS = [process.env.GEMINI_IMAGE_MODEL, "gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"].filter(Boolean);
const ASPECTS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9"];

async function latest() {
  if (!blobConnected()) return null;
  const out = {};
  let cursor;
  do {
    const page = await list({ ...tok(), prefix: "brand/photos/", cursor, limit: 1000 });
    for (const b of page.blobs) {
      const slot = b.pathname.split("/")[2];
      if (!SLOTS.includes(slot)) continue;
      if (!out[slot] || String(b.uploadedAt) > String(out[slot].uploadedAt)) out[slot] = b;
    }
    cursor = page.hasMore ? page.cursor : null;
  } while (cursor);
  return out;
}

async function generate(prompt, aspect, base, map) {
  const ref = await ribbonRef();
  let lastErr = "";
  for (const model of MODELS) {
    const generationConfig = { responseModalities: ["IMAGE"] };
    if (ASPECTS.includes(aspect)) generationConfig.imageConfig = { aspectRatio: aspect };
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, ...(base ? [{ inline_data: { mime_type: base.mediaType, data: base.data } }] : []), ...(map ? [{ text: "Placement map (reference only, do not copy its drawing style): the same photo with soft colored marks showing EXACTLY where the ribbon peeks out of the branches. At every mark, a billow or short drop of wide ribbon in that color emerges from deep in the branches and tucks back in; nowhere else. The finished photo must contain no marks, blobs or outlines, only real ribbon." }, { inline_data: { mime_type: map.mediaType, data: map.data } }] : []), ...(ref ? [{ text: RIBBON_REF_NOTE }, { inline_data: { mime_type: ref.mediaType, data: ref.data } }] : [])] }], generationConfig })
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      lastErr = body?.error?.message || `Image service error ${r.status}`;
      if (r.status === 404 || (r.status === 429 && /limit: 0/.test(lastErr))) continue;
      throw new Error(lastErr);
    }
    const parts = body?.candidates?.[0]?.content?.parts || [];
    const pic = parts.find(p => p.inlineData || p.inline_data);
    if (!pic) throw new Error("No image came back (" + (body?.candidates?.[0]?.finishReason || "try rewording") + ")");
    const d = pic.inlineData || pic.inline_data;
    return `data:${d.mimeType || d.mime_type || "image/png"};base64,${d.data}`;
  }
  throw new Error(lastErr || "No image model available");
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const slot = String(req.query?.img || "");
    try {
      const found = await latest();
      if (slot) {
        const b = found && found[slot];
        if (!b) return res.status(404).end();
        const r = await get(b.pathname, { ...tok(), access: "private" }).catch(() => null);
        res.setHeader("cache-control", "public, max-age=300");
        if (r && r.stream) { res.setHeader("content-type", b.contentType || "image/jpeg"); return res.status(200).send(Buffer.from(await new Response(r.stream).arrayBuffer())); }
        return res.redirect(302, b.url);
      }
      res.setHeader("cache-control", "public, max-age=60");
      if (!found) return res.status(200).json({ photos: {}, storage: false, vars: blobVarNames() });
      const photos = {};
      for (const [k, b] of Object.entries(found)) photos[k] = /\.public\.blob\.vercel-storage\.com/.test(b.url) ? b.url : `/api/brand?img=${k}&v=${encodeURIComponent(b.uploadedAt)}`;
      return res.status(200).json({ photos, storage: true });
    } catch (e) {
      return res.status(200).json({ photos: {}, storage: !!blobConnected(), error: String(e.message || e) });
    }
  }

  if (req.method !== "POST") return res.status(405).end();
  if (!checkPassword(req)) return res.status(401).json({ error: "Wrong password" });
  const { action, prompt, aspect, slot, image, map } = req.body || {};

  if (action === "generate") {
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY is not set in Vercel" });
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });
    try { return res.status(200).json({ image: await generate(String(prompt).slice(0, 3000), aspect) }); }
    catch (e) { return res.status(502).json({ error: String(e.message || e) }); }
  }

  if (action === "edit") {
    // Correct a generated photo: same scene, only the requested change (much more reliable than regenerating)
    const base = parseDataUrl(image);
    if (!base || !prompt) return res.status(400).json({ error: "Missing photo or instruction" });
    const text = `Edit this photograph. Keep the room, camera angle, lighting, colors, style and everything else exactly the same, photorealistic, magazine quality. Make only these changes to the Christmas tree:\n${String(prompt).slice(0, 2000)}\nThe result must be an ordinary photograph with no text, markings or outlines.`;
    try { return res.status(200).json({ image: await generate(text, aspect, base, parseDataUrl(map)) }); }
    catch (e) { return res.status(502).json({ error: String(e.message || e) }); }
  }

  if (action === "use") {
    if (!SLOTS.includes(slot)) return res.status(400).json({ error: "Unknown slot" });
    if (!blobConnected()) return res.status(400).json({ error: "Storage isn't connected yet. In Vercel: Storage → Create → Blob → connect it to this project, then Redeploy." });
    const img = parseDataUrl(image);
    if (!img) return res.status(400).json({ error: "Missing image" });
    const buf = Buffer.from(img.data, "base64");
    const path = `brand/photos/${slot}/${Date.now()}.${img.mediaType.includes("png") ? "png" : "jpg"}`;
    try {
      let b;
      try { b = await put(path, buf, { ...tok(), access: "public", contentType: img.mediaType }); }
      catch (e) { b = await put(path, buf, { ...tok(), access: "private", contentType: img.mediaType }); }
      return res.status(200).json({ ok: true, url: b.url });
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  }
  return res.status(400).json({ error: "Unknown action" });
}
