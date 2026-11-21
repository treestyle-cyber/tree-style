// Tree log (Eric, Nov 20): every finished preview is kept on our side with what made it (their photo, answers, score,
// plan, step data, picture instructions and every version), so a complaint can be looked into without a screenshot.
// POST { record, photo, after, keyPhoto }  (a signed-in person or the test password) -> { ok, id }
//   The same tree sends again after each change; its records share one id and the newest is what the admin page shows.
// GET  ?list=1   (test password) -> { trees: [{ id, at, email, mode, style, overall, versions, thumb }] }, newest first
// GET  ?id=<id>  (test password) -> { record } with picture addresses that open without the password (signed links)
// GET  ?img=<path>&k=<sig>       -> the picture
import { put, list, get } from "@vercel/blob";
import { createHmac } from "crypto";
import { blobToken, blobConnected, envPath } from "../lib/blob.js";
import { checkPassword, parseDataUrl } from "../lib/util.js";
import { whoIs } from "../lib/account.js";

const tok = () => (blobToken() ? { token: blobToken() } : {});
const DIR = "treelog/";
const okId = s => /^[a-z0-9]{6,32}$/.test(String(s || ""));
const sig = p => createHmac("sha256", String(process.env.TEST_PASSWORD || process.env.CLERK_SECRET_KEY || "treestyle")).update(p).digest("hex").slice(0, 24);
const imgUrl = p => p ? `/api/treelog?img=${encodeURIComponent(p)}&k=${sig(p)}` : null;
const t = b => new Date(b.uploadedAt).getTime() || 0;

async function putPrivate(path, buf, type) {
  try { return await put(path, buf, { ...tok(), access: "private", contentType: type, addRandomSuffix: false }); }
  catch (e) { return await put(path, buf, { ...tok(), access: "public", contentType: type, addRandomSuffix: true }); }
}
async function read(b) {
  const r = await get(b.pathname, { ...tok(), access: "private" }).catch(() => null);
  if (r && r.stream) return Buffer.from(await new Response(r.stream).arrayBuffer());
  return Buffer.from(await (await fetch(b.url)).arrayBuffer());
}
async function all(prefix) {
  const out = []; let cursor;
  do { const page = await list({ ...tok(), prefix, cursor, limit: 1000 }); out.push(...page.blobs); cursor = page.hasMore ? page.cursor : null; } while (cursor && out.length < 5000);
  return out;
}
async function saveImg(dir, name, dataUrl) {
  const img = parseDataUrl(dataUrl); if (!img) return null;
  const path = `${dir}${name}.${img.mediaType.includes("png") ? "png" : "jpg"}`;
  const b = await putPrivate(path, Buffer.from(img.data, "base64"), img.mediaType);
  return b.pathname;
}

export default async function handler(req, res) {
  if (!blobConnected()) return res.status(200).json({ ok: false, stored: false });

  if (req.method === "GET" && req.query?.img) {
    const p = String(req.query.img);
    if (!p.includes(DIR) || req.query.k !== sig(p)) return res.status(403).end();
    const hit = (await list({ ...tok(), prefix: p, limit: 1 }).catch(() => ({ blobs: [] }))).blobs[0];
    if (!hit) return res.status(404).end();
    res.setHeader("content-type", hit.contentType || "image/jpeg");
    res.setHeader("cache-control", "private, max-age=86400");
    return res.status(200).send(await read(hit));
  }

  if (req.method === "GET") {
    if (!checkPassword(req)) return res.status(401).json({ error: "Wrong password" });
    res.setHeader("cache-control", "no-store");
    try {
      if (req.query?.id) {
        if (!okId(req.query.id)) return res.status(400).json({ error: "Bad id" });
        const blobs = (await all(envPath(`${DIR}${req.query.id}/`))).filter(b => b.pathname.endsWith(".json")).sort((a, b) => t(b) - t(a));
        if (!blobs.length) return res.status(404).json({ error: "Not found" });
        const rec = JSON.parse((await read(blobs[0])).toString("utf8"));
        rec.photo = imgUrl(rec.photo); rec.after = imgUrl(rec.after); rec.keyPhoto = imgUrl(rec.keyPhoto);
        (rec.versions || []).forEach(v => { v.after = imgUrl(v.after); });
        return res.status(200).json({ record: rec, saves: blobs.length });
      }
      // the list: one small summary file per save, newest first, one row per tree
      const idx = (await all(envPath(`${DIR}index/`))).sort((a, b) => t(b) - t(a)).slice(0, 600);
      const seen = new Set(), rows = [];
      for (const b of idx) { const id = (b.pathname.split("/").pop().split("_")[1] || "").replace(/(-[A-Za-z0-9]+)?\.json$/, ""); if (!id || seen.has(id)) continue; seen.add(id); rows.push(b); if (rows.length >= 150) break; }
      const trees = (await Promise.all(rows.map(b => read(b).then(x => JSON.parse(x.toString("utf8"))).catch(() => null)))).filter(Boolean);
      trees.forEach(s => { s.thumb = imgUrl(s.thumb); });
      return res.status(200).json({ trees });
    } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
  }

  if (req.method !== "POST") return res.status(405).end();
  const who = await whoIs(req);
  if (!who) return res.status(401).json({ error: "Please sign in.", code: "sign_in" });
  try {
    const { record, photo, after, keyPhoto } = req.body || {};
    if (!record || !record.result || !okId(record.id)) return res.status(400).json({ error: "Nothing to save" });
    const id = record.id, stamp = Date.now(), dir = envPath(`${DIR}${id}/`);
    // the photo is sent once per tree; later saves point at the first one
    const prev = photo ? null : (await all(dir)).filter(b => b.pathname.endsWith(".json")).sort((a, b) => t(b) - t(a))[0];
    const prevRec = prev ? JSON.parse((await read(prev)).toString("utf8")) : null;
    const rec = Object.assign({}, record, {
      saved: new Date(stamp).toISOString(),
      email: who.email || (who.viaPassword ? "tester (password)" : ""),
      userId: who.id || null,
      photo: photo ? await saveImg(dir, `photo-${stamp}`, photo) : prevRec?.photo || null,
      keyPhoto: keyPhoto ? await saveImg(dir, `pieces-${stamp}`, keyPhoto) : prevRec?.keyPhoto || null,
      after: after ? await saveImg(dir, `after-${stamp}`, after) : null
    });
    rec.versions = (rec.versions || []).map((v, i) => Object.assign({}, v, { after: i === rec.current ? rec.after : (prevRec?.versions?.[i]?.after || null) }));
    const text = JSON.stringify(rec);
    if (text.length > 3500000) return res.status(400).json({ error: "Too large" });
    await putPrivate(`${dir}${stamp}.json`, Buffer.from(text), "application/json");
    const r = rec.result || {};
    const summary = { id, at: rec.saved, email: rec.email, mode: rec.mode, src: rec.src, style: (rec.form || {}).style || "", theme: (rec.form || {}).theme || "", overall: r.overall ?? null, headline: String(r.headline || "").slice(0, 120), versions: (rec.versions || []).length, thumb: rec.after || rec.photo };
    await putPrivate(envPath(`${DIR}index/${String(9e15 - stamp).padStart(16, "0")}_${id}.json`), Buffer.from(JSON.stringify(summary)), "application/json");
    console.log("TREELOG", JSON.stringify({ id, email: rec.email, versions: summary.versions }));
    return res.status(200).json({ ok: true, id });
  } catch (e) {
    console.error("TREELOG FAILED", e);
    return res.status(500).json({ error: String(e.message || e) });
  }
}
