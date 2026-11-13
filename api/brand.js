// Brand photography for the app and site, made in the Studio (/studio).
// GET  /api/brand                      -> { photos: { slot: url }, storage: true|false }   (public: the app reads this)
// GET also returns { essentials: [...] } once the Studio's Essentials editor has saved a list
// POST /api/brand { action:"essentials", items }          -> { ok }                        (password)
// GET  /api/brand?img=<slot>           -> the chosen image itself (used when the store is private)
// POST /api/brand { action:"generate", prompt, aspect }   -> { image: dataURL }            (password)
// POST /api/brand { action:"use", slot, image }           -> { url }                       (password)
import { put, list, get } from "@vercel/blob";
import { blobToken, blobVarNames, blobConnected, IS_PREVIEW, envPath } from "../lib/blob.js";
const tok = () => (blobToken() ? { token: blobToken() } : {});
import { ribbonRef, RIBBON_REF_NOTE } from "../lib/ribbonref.js";
import { checkPassword, parseDataUrl } from "../lib/util.js";

const SLOTS = ["before", "after", "ribbonref", "velvet", "velvetberry", "hero", "check", "design", "keep", "classic", "rustic", "modern", "elegant", "playful", "themed", "ess_hooks", "ess_wire", "ess_ties", "ess_remote", "ess_cord", "ess_scissors"];
// Stylist's essentials cards each have a photo spot named ess_<card id>, so cards added in the Studio get one too
const isSlot = s => SLOTS.includes(s) || /^ess_[a-z0-9]{1,24}$/.test(s);
const MODELS = [process.env.GEMINI_IMAGE_MODEL, "gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"].filter(Boolean);
const ASPECTS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9"];

// Upload time as a number (comparing the date text sorted by weekday name: "Thu Oct 29" < "Wed Oct 21")
const t = b => new Date(b.uploadedAt).getTime() || 0;
// Newest photo per slot under a prefix
async function readSlots(prefix) {
  {
    const out = {};
    let cursor;
    do {
      const page = await list({ ...tok(), prefix, cursor, limit: 1000 });
      for (const b of page.blobs) {
        const slot = b.pathname.slice(prefix.length).split("/")[0];
        if (!isSlot(slot)) continue;
        if (!out[slot] || t(b) > t(out[slot])) out[slot] = b;
      }
      cursor = page.hasMore ? page.cursor : null;
    } while (cursor);
    return out;
  }
}
async function latest() {
  if (!blobConnected()) return null;
  const live = await readSlots("brand/photos/");
  // A preview copy shows the live photos plus any it picked itself
  return IS_PREVIEW ? { ...live, ...(await readSlots(envPath("brand/photos/"))) } : live;
}
// Photos picked in the preview Studio that are newer than the live ones (they don't go live on their own)
async function previewPicks() {
  const live = await readSlots("brand/photos/"), prev = await readSlots("preview/brand/photos/");
  return Object.values(prev).filter(b => { const slot = b.pathname.split("/")[3]; return !live[slot] || t(b) > t(live[slot]); });
}

// The Stylist's essentials list saved in the Studio (newest wins; a preview copy falls back to the live list)
async function newestJson(prefix) {
  const page = await list({ ...tok(), prefix, limit: 1000 });
  const b = page.blobs.sort((a, c) => t(c) - t(a))[0];
  if (!b) return null;
  const r = await get(b.pathname, { ...tok(), access: "private" }).catch(() => null);
  const txt = r && r.stream ? await new Response(r.stream).text() : await (await fetch(b.url)).text();
  return { blob: b, data: JSON.parse(txt) };
}
async function essentialsList() {
  if (!blobConnected()) return null;
  const mine = IS_PREVIEW ? await newestJson("preview/brand/essentials/") : null;
  return (mine || await newestJson("brand/essentials/"))?.data || null;
}
const STEPS = ["", "lights", "primary_picks", "ribbon", "florals", "statement", "medium", "crown"];
const clean = (v, n) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, n);
function cleanItems(items) {
  if (!Array.isArray(items)) return null;
  return items.slice(0, 12).map(x => ({
    id: clean(x.id, 24).toLowerCase().replace(/[^a-z0-9]/g, "") || "x" + Math.random().toString(36).slice(2, 8),
    label: clean(x.label, 60), qty: clean(x.qty, 140), q: clean(x.q, 120),
    link: /^https:\/\/(www\.)?(amazon\.com|amzn\.to|a\.co)\//.test(String(x.link || "")) ? clean(x.link, 600) : "",
    step: STEPS.includes(x.step) ? x.step : "",
  })).filter(x => x.label);
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
      const essentials = await essentialsList().catch(() => null);
      const photos = {};
      for (const [k, b] of Object.entries(found)) photos[k] = /\.public\.blob\.vercel-storage\.com/.test(b.url) ? b.url : `/api/brand?img=${k}&v=${encodeURIComponent(b.uploadedAt)}`;
      return res.status(200).json({ photos, storage: true, essentials: essentials || undefined });
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

  if (action === "essentials") {
    if (!blobConnected()) return res.status(400).json({ error: "Storage isn't connected." });
    const items = cleanItems(req.body.items);
    if (!items) return res.status(400).json({ error: "Missing list" });
    try {
      await put(envPath(`brand/essentials/${Date.now()}.json`), JSON.stringify(items), { ...tok(), access: "private", contentType: "application/json" });
      return res.status(200).json({ ok: true, items });
    } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
  }

  if (action === "adopt-preview") {
    // Live Studio only: copy the photos picked in the preview Studio onto the live site
    if (IS_PREVIEW) return res.status(400).json({ error: "Open the live Studio to do this." });
    if (!blobConnected()) return res.status(400).json({ error: "Storage isn't connected." });
    try {
      const picks = await previewPicks(), slots = picks.map(b => b.pathname.split("/")[3]);
      const pe = await newestJson("preview/brand/essentials/").catch(() => null), le = await newestJson("brand/essentials/").catch(() => null);
      const essNew = pe && (!le || t(pe.blob) > t(le.blob));
      if (essNew) slots.push("essentials");
      if (req.body.dry) return res.status(200).json({ slots });
      if (essNew) await put(`brand/essentials/${Date.now()}.json`, JSON.stringify(pe.data), { ...tok(), access: "private", contentType: "application/json" });
      for (const b of picks) {
        const slot = b.pathname.split("/")[3];
        let buf;
        const r = await get(b.pathname, { ...tok(), access: "private" }).catch(() => null);
        if (r && r.stream) buf = Buffer.from(await new Response(r.stream).arrayBuffer());
        else buf = Buffer.from(await (await fetch(b.url)).arrayBuffer());
        const path = `brand/photos/${slot}/${Date.now()}.${/png/.test(b.contentType || "") ? "png" : "jpg"}`;
        try { await put(path, buf, { ...tok(), access: "public", contentType: b.contentType || "image/jpeg" }); }
        catch (e) { await put(path, buf, { ...tok(), access: "private", contentType: b.contentType || "image/jpeg" }); }
      }
      return res.status(200).json({ ok: true, slots });
    } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
  }

  if (action === "use") {
    if (!isSlot(slot)) return res.status(400).json({ error: "Unknown slot" });
    if (!blobConnected()) return res.status(400).json({ error: "Storage isn't connected yet. In Vercel: Storage → Create → Blob → connect it to this project, then Redeploy." });
    const img = parseDataUrl(image);
    if (!img) return res.status(400).json({ error: "Missing image" });
    const buf = Buffer.from(img.data, "base64");
    const path = envPath(`brand/photos/${slot}/${Date.now()}.${img.mediaType.includes("png") ? "png" : "jpg"}`);
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
