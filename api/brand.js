// Brand photography for the app and site, made in the Studio (/studio).
// GET  /api/brand                      -> { photos: { slot: url }, storage: true|false }   (public: the app reads this)
// GET also returns { essentials: [...] } once the Studio's Essentials editor has saved a list
// POST /api/brand { action:"essentials", items }          -> { ok }                        (password)
// GET  /api/brand?img=<slot>           -> the chosen image itself (used when the store is private)
// POST /api/brand { action:"generate", prompt, aspect }   -> { image: dataURL }            (password)
// POST /api/brand { action:"use", slot, image }           -> { url }                       (password)
// POST /api/brand { action:"vid-crop", slot, x, y, z | reset } -> { crop }  where a step video sits in its card (password)
// POST /api/brand { action:"use-clip", slot, clip }       -> { url }  a Reels clip (or uploaded video) as a step video (password)
// GET  /api/brand?kit=1                -> { kit, updated }   the Brand kit (colors, fonts, buttons, background, icons, logos)
// GET  /api/brand?kitfile=<path>       -> a file the Brand kit uses (font, logo, texture) when the store is private
// POST /api/brand { action:"kit-save", kit }              -> { ok }                        (password)
// POST /api/brand { action:"kit-file", data, name }       -> { url }                       (password)
// GET  /api/brand?sample=1[&kind=design] -> { sample }  the sample tree (or design) the Studio's Screens page shows
// POST /api/brand { action:"sample-save", sample }        -> { ok }                        (password)
// GET  /api/brand?notes=1              -> { notes }    notes left on screens in Studio → Screens
// POST /api/brand { action:"note", op:"add"|"update"|"delete", note } -> { notes }          (password)
import { put, list, get } from "@vercel/blob";
import { blobToken, blobVarNames, blobConnected, IS_PREVIEW, envPath } from "../lib/blob.js";
const tok = () => (blobToken() ? { token: blobToken() } : {});
import { ribbonRef, RIBBON_REF_NOTE } from "../lib/ribbonref.js";
import { checkPassword, parseDataUrl } from "../lib/util.js";

const SLOTS = ["before", "after", "ribbonref", "ribbon_billows", "ribbon_cascades", "ribbon_layered", "ribbon_loops", "ribbon_bursts", "ribbon_curls", "velvet", "velvetberry", "hero", "homebg", "scan", "roomscan", "splash", "signin", "check", "design", "keep", "classic", "rustic", "modern", "elegant", "playful", "themed", "ess_hooks", "ess_wire", "ess_ties", "ess_remote", "ess_cord", "ess_scissors"];
// Stylist's essentials cards each have a photo spot named ess_<card id>, so cards added in the Studio get one too
const isSlot = s => SLOTS.includes(s) || /^ess_[a-z0-9]{1,24}$/.test(s) || /^(fill|top|base|orn)_[a-z]{1,16}$/.test(s) || /^how_[a-z_]{1,16}$/.test(s) || /^vid_[a-z_]{1,16}$/.test(s);   // vid_<step>: step video clips   // fill_<kind>: filler photos
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
// Step video crops (Kylie: adjust the crop of a video in its card): one small map { vid_<step>: { x, y, z } }, newest wins
const CROP_DIR = "brand/vidcrop/";
async function cropMap() {
  if (!blobConnected()) return {};
  const mine = IS_PREVIEW ? await newestJson("preview/" + CROP_DIR).catch(() => null) : null;
  return (mine || await newestJson(CROP_DIR).catch(() => null))?.data || {};
}
async function saveCrops(map) { await put(envPath(`${CROP_DIR}${Date.now()}.json`), JSON.stringify(map), { ...tok(), access: "private", contentType: "application/json" }); }
async function setCrop(slot, c) {
  const m = await cropMap();
  if (c) m[slot] = c; else if (m[slot]) delete m[slot]; else return;
  await saveCrops(m);
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

// ---- Brand kit: one small JSON file (newest wins) plus the files it points to ----
const KIT_DIR = "brand/kit/settings/", KIT_FILES = "brand/kit/files/", SAMPLE_DIR = "brand/sample/", SAMPLE_DESIGN_DIR = "brand/sample-design/", NOTES_DIR = "brand/notes/";
const FILE_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg", "font/woff2": "woff2", "font/woff": "woff", "font/otf": "otf", "font/ttf": "ttf", "application/font-woff": "woff", "application/x-font-otf": "otf", "application/x-font-ttf": "ttf", "application/vnd.ms-opentype": "otf", "application/octet-stream": "" };
async function newestIn(prefix) {
  let best = null, cursor;
  do {
    const page = await list({ ...tok(), prefix, cursor, limit: 1000 });
    for (const b of page.blobs) if (!best || t(b) > t(best)) best = b;
    cursor = page.hasMore ? page.cursor : null;
  } while (cursor);
  return best;
}
async function readBlob(b) {
  const r = await get(b.pathname, { ...tok(), access: "private" }).catch(() => null);
  if (r && r.stream) return Buffer.from(await new Response(r.stream).arrayBuffer());
  return Buffer.from(await (await fetch(b.url)).arrayBuffer());
}
// A preview copy uses its own kit once it has saved one, otherwise the live kit
async function kitBlob() {
  if (!blobConnected()) return null;
  return (IS_PREVIEW && await newestIn("preview/" + KIT_DIR)) || await newestIn(KIT_DIR);
}
async function putEither(path, buf, contentType) {
  try { return await put(path, buf, { ...tok(), access: "public", contentType }); }
  catch (e) { return await put(path, buf, { ...tok(), access: "private", contentType }); }
}
const fileUrl = b => /\.public\.blob\.vercel-storage\.com/.test(b.url) ? b.url : `/api/brand?kitfile=${encodeURIComponent(b.pathname)}`;

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
  if (req.method === "GET" && req.query?.kit) {
    res.setHeader("cache-control", "public, max-age=30");
    try {
      const b = await kitBlob();
      if (!b) return res.status(200).json({ kit: null });
      return res.status(200).json({ kit: JSON.parse((await readBlob(b)).toString("utf8")), updated: b.uploadedAt });
    } catch (e) { return res.status(200).json({ kit: null, error: String(e.message || e) }); }
  }
  if (req.method === "GET" && (req.query?.sample || req.query?.notes)) {
    res.setHeader("cache-control", "no-store");
    try {
      if (!blobConnected()) return res.status(200).json({});
      // The sample tree: a preview copy's own, else the live one. Notes stay with the copy they were left on.
      // Two samples: a checked tree (?sample=1) and a design (?sample=1&kind=design)
      const dir = req.query.kind === "design" ? SAMPLE_DESIGN_DIR : SAMPLE_DIR;
      const b = req.query.sample ? (IS_PREVIEW && await newestIn("preview/" + dir)) || await newestIn(dir) : await newestIn(envPath(NOTES_DIR));
      const data = b ? JSON.parse((await readBlob(b)).toString("utf8")) : null;
      return res.status(200).json(req.query.sample ? { sample: data, updated: b && b.uploadedAt } : { notes: data || [] });
    } catch (e) { return res.status(200).json({ error: String(e.message || e) }); }
  }
  if (req.method === "GET" && req.query?.kitfile) {
    const path = String(req.query.kitfile);
    if (!/^(preview\/)?brand\/kit\/files\/[\w.-]+$/.test(path)) return res.status(400).end();
    const r = await get(path, { ...tok(), access: "private" }).catch(() => null);
    let buf = r && r.stream ? Buffer.from(await new Response(r.stream).arrayBuffer()) : null;
    if (!buf) {   // a public store: find the file and pass it through, so the page reads it from its own site
      const hit = (await list({ ...tok(), prefix: path, limit: 1 }).catch(() => ({ blobs: [] }))).blobs[0];
      if (hit) buf = Buffer.from(await (await fetch(hit.url)).arrayBuffer());
    }
    if (!buf) return res.status(404).end();
    res.setHeader("cache-control", "public, max-age=31536000, immutable");
    const ext = path.split(".").pop();
    res.setHeader("content-type", { png: "image/png", jpg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml", woff2: "font/woff2", woff: "font/woff", otf: "font/otf", ttf: "font/ttf" }[ext] || "application/octet-stream");
    return res.status(200).send(buf);
  }
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
      const crops = Object.keys(photos).some(k => /^vid_/.test(k)) ? await cropMap().catch(() => ({})) : {};
      return res.status(200).json({ photos, storage: true, essentials: essentials || undefined, crops });
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

  if (action === "sample-save" || action === "note") {
    if (!blobConnected()) return res.status(400).json({ error: "Storage isn't connected yet." });
    try {
      if (action === "sample-save") {
        const text = JSON.stringify(req.body.sample || {});
        if (text.length > 4000000) return res.status(400).json({ error: "The sample tree is too large to save." });
        const dir = (req.body.sample || {}).mode === "design" ? SAMPLE_DESIGN_DIR : SAMPLE_DIR;   // a design is kept as its own sample
        await putEither(envPath(`${dir}${Date.now()}.json`), Buffer.from(text), "application/json");
        return res.status(200).json({ ok: true });
      }
      // Notes: read the newest list, change it, save it again
      const b = await newestIn(envPath(NOTES_DIR));
      let notes = b ? JSON.parse((await readBlob(b)).toString("utf8")) : [];
      const n = req.body.note || {}, op = req.body.op;
      const clean = o => ({ id: String(o.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).slice(0, 40), screen: String(o.screen || "").slice(0, 60), x: Math.max(0, Math.min(1, Number(o.x) || 0)), y: Math.max(0, Math.min(1, Number(o.y) || 0)), text: String(o.text || "").slice(0, 2000), by: String(o.by || "").slice(0, 40), done: !!o.done, at: o.at || new Date().toISOString() });
      if (op === "add") notes.push(clean(n));
      else if (op === "update") notes = notes.map(x => x.id === n.id ? clean(Object.assign({}, x, n)) : x);
      else if (op === "delete") notes = notes.filter(x => x.id !== n.id);
      else return res.status(400).json({ error: "Unknown note change" });
      await putEither(envPath(`${NOTES_DIR}${Date.now()}.json`), Buffer.from(JSON.stringify(notes)), "application/json");
      return res.status(200).json({ notes });
    } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
  }

  if (action === "kit-save" || action === "kit-file") {
    if (!blobConnected()) return res.status(400).json({ error: "Storage isn't connected yet. In Vercel: Storage → Create → Blob → connect it to this project, then Redeploy." });
    try {
      if (action === "kit-save") {
        const text = JSON.stringify(req.body.kit || {});
        if (text.length > 400000) return res.status(400).json({ error: "The brand kit is too large to save (icons should be simple SVG line drawings)." });
        await putEither(envPath(`${KIT_DIR}${Date.now()}.json`), Buffer.from(text), "application/json");
        return res.status(200).json({ ok: true });
      }
      const m = /^data:([\w.+\/-]*);base64,(.+)$/.exec(String(req.body.data || ""));
      const ext = (String(req.body.name || "").match(/\.(png|jpe?g|webp|svg|woff2?|otf|ttf)$/i) || [])[1];
      if (!m || !(m[1] in FILE_TYPES || ext)) return res.status(400).json({ error: "That file type isn't supported. Use PNG, JPG, WebP or SVG for pictures, and WOFF2, WOFF, OTF or TTF for fonts." });
      const e = (ext || FILE_TYPES[m[1]] || "bin").toLowerCase().replace("jpeg", "jpg");
      const type = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml", woff2: "font/woff2", woff: "font/woff", otf: "font/otf", ttf: "font/ttf" }[e] || "application/octet-stream";
      const b = await putEither(envPath(`${KIT_FILES}${Date.now()}.${e}`), Buffer.from(m[2], "base64"), type);
      // Same-site address when asked (the sample tree's pictures are read back into the app)
      return res.status(200).json({ ok: true, url: req.body.local ? `/api/brand?kitfile=${encodeURIComponent(b.pathname)}` : fileUrl(b) });
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
      const pc = await newestJson("preview/" + CROP_DIR).catch(() => null), lc = await newestJson(CROP_DIR).catch(() => null);
      const cropNew = pc && (!lc || t(pc.blob) > t(lc.blob));
      if (cropNew) slots.push("video crops");
      const pk = await newestIn("preview/" + KIT_DIR), lk = await newestIn(KIT_DIR);
      const kitNewer = !!pk && (!lk || t(pk) > t(lk));
      if (kitNewer) slots.push("brand kit");
      if (req.body.dry) return res.status(200).json({ slots });
      if (kitNewer) await putEither(`${KIT_DIR}${Date.now()}.json`, await readBlob(pk), "application/json");
      if (cropNew) await put(`${CROP_DIR}${Date.now()}.json`, JSON.stringify(pc.data), { ...tok(), access: "private", contentType: "application/json" });
      if (essNew) await put(`brand/essentials/${Date.now()}.json`, JSON.stringify(pe.data), { ...tok(), access: "private", contentType: "application/json" });
      for (const b of picks) {
        const slot = b.pathname.split("/")[3];
        let buf;
        const r = await get(b.pathname, { ...tok(), access: "private" }).catch(() => null);
        if (r && r.stream) buf = Buffer.from(await new Response(r.stream).arrayBuffer());
        else buf = Buffer.from(await (await fetch(b.url)).arrayBuffer());
        const path = `brand/photos/${slot}/${Date.now()}.${/png/.test(b.contentType || "") ? "png" : /video/.test(b.contentType || "") ? "mp4" : "jpg"}`;
        try { await put(path, buf, { ...tok(), access: "public", contentType: b.contentType || "image/jpeg" }); }
        catch (e) { await put(path, buf, { ...tok(), access: "private", contentType: b.contentType || "image/jpeg" }); }
      }
      return res.status(200).json({ ok: true, slots });
    } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
  }

  if (action === "vid-crop") {
    if (!/^vid_[a-z_]{1,16}$/.test(slot || "")) return res.status(400).json({ error: "Unknown video spot" });
    if (!blobConnected()) return res.status(400).json({ error: "Storage isn't connected." });
    const n = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v * 100) / 100)) : d; };
    const c = req.body.reset ? null : { x: n(req.body.x, 0, 100, 50), y: n(req.body.y, 0, 100, 50), z: n(req.body.z, 1, 3, 1) };
    try { await setCrop(slot, c); return res.status(200).json({ ok: true, crop: c }); }
    catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
  }

  // A step video: a clip made in Reels (saved under brand/videos/), copied into the slot so the app can play it
  if (action === "use-clip") {
    if (!/^vid_[a-z_]{1,16}$/.test(slot || "")) return res.status(400).json({ error: "Unknown video spot" });
    if (!blobConnected()) return res.status(400).json({ error: "Storage isn't connected." });
    try {
      const c = String(req.body.clip || ""); let buf = null;
      const file = (/[?&]file=([^&]+)/.exec(c) || [])[1];
      if (file) {
        const pn = decodeURIComponent(file);
        if (!/^(preview\/)?brand\/videos\/[\w/.-]+\.mp4$/.test(pn)) return res.status(400).json({ error: "Not a TreeStyle clip" });
        const r = await get(pn, { ...tok(), access: "private" }).catch(() => null);
        if (r && r.stream) buf = Buffer.from(await new Response(r.stream).arrayBuffer());
      } else {
        let u; try { u = new URL(c); } catch { return res.status(400).json({ error: "Missing clip" }); }
        if (!/\.blob\.vercel-storage\.com$/.test(u.hostname) || !u.pathname.includes("/brand/videos/") || !/\.mp4$/.test(u.pathname)) return res.status(400).json({ error: "Not a TreeStyle clip" });
        const r = await fetch(u.href); if (r.ok) buf = Buffer.from(await r.arrayBuffer());
      }
      if (!buf) return res.status(404).json({ error: "Couldn't read that clip" });
      const path = envPath(`brand/photos/${slot}/${Date.now()}.mp4`);
      await setCrop(slot, null).catch(() => {});   // a new clip starts centered
      let b;
      try { b = await put(path, buf, { ...tok(), access: "public", contentType: "video/mp4" }); }
      catch (e) { b = await put(path, buf, { ...tok(), access: "private", contentType: "video/mp4" }); }
      return res.status(200).json({ ok: true, url: b.url });
    } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
  }

  if (action === "use") {
    if (!isSlot(slot)) return res.status(400).json({ error: "Unknown slot" });
    if (!blobConnected()) return res.status(400).json({ error: "Storage isn't connected yet. In Vercel: Storage → Create → Blob → connect it to this project, then Redeploy." });
    const vm = /^vid_/.test(slot) ? /^data:(video\/[a-z0-9.+-]+);base64,(.+)$/i.exec(image || "") : null;
    const img = vm ? { mediaType: "video/mp4", data: vm[2] } : parseDataUrl(image);
    if (!img) return res.status(400).json({ error: "Missing image" });
    const buf = Buffer.from(img.data, "base64");
    if (vm) await setCrop(slot, null).catch(() => {});   // a new clip starts centered
    const path = envPath(`brand/photos/${slot}/${Date.now()}.${img.mediaType.includes("png") ? "png" : /video/.test(img.mediaType) ? "mp4" : "jpg"}`);   // a step video can be uploaded too (small clips)
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
