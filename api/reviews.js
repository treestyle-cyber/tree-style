// Community reviews (Kylie): when their tree is finished, people rate it, write a few words and share a photo of it.
// Reviews wait for approval (they show customers' photos and names); approved ones fill the "Trees our community
// styled" row, and each one's "Get this look" lets anyone style their own tree the same way.
// POST { name, avatar?, rating, text, photo?, preview, style, steps[], items[], consent }  -> { ok }   (waits for approval)
// GET  /api/reviews                         -> { reviews: [approved, newest first] }
// GET  /api/reviews?img=<id>-<kind>         -> a review picture (tree | preview | avatar)
// GET  /api/reviews?pending=1 (password)    -> { reviews: [waiting for approval] }
// POST { action:"approve"|"remove", id } (password)                                     -> { ok }
import { put, list, get, del } from "@vercel/blob";
import { blobToken, blobConnected, envPath } from "../lib/blob.js";
import { checkPassword } from "../lib/util.js";

const tok = () => (blobToken() ? { token: blobToken() } : {});
const DIR = () => envPath("reviews/");
const clip = (v, n) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, n);
const okId = id => /^[a-z0-9]{10,32}$/.test(String(id || ""));
const IMG = /^data:image\/jpeg;base64,(.+)$/;

async function putEither(path, body, contentType) {
  try { return await put(path, body, { ...tok(), access: "public", contentType, addRandomSuffix: false, allowOverwrite: true }); }
  catch (e) { return await put(path, body, { ...tok(), access: "private", contentType, addRandomSuffix: false, allowOverwrite: true }); }
}
async function readBlob(b) {
  const r = await get(b.pathname, { ...tok(), access: "private" }).catch(() => null);
  if (r && r.stream) return Buffer.from(await new Response(r.stream).arrayBuffer());
  return Buffer.from(await (await fetch(b.url)).arrayBuffer());
}
async function all(prefix) {
  const out = []; let cursor;
  do { const p = await list({ ...tok(), prefix, cursor, limit: 1000 }); out.push(...p.blobs); cursor = p.hasMore ? p.cursor : null; } while (cursor);
  return out;
}
async function readList(state) {
  const blobs = (await all(DIR() + state + "/")).filter(b => b.pathname.endsWith(".json"));
  const items = await Promise.all(blobs.map(async b => { try { return JSON.parse((await readBlob(b)).toString("utf8")); } catch { return null; } }));
  return items.filter(Boolean).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
function cleanSteps(v) {
  return (Array.isArray(v) ? v : []).slice(0, 10).map(s => ({ key: clip(s && s.key, 20), title: clip(s && s.title, 60), how: clip(s && s.how, 400) })).filter(s => s.title);
}
function cleanItems(v) {
  return (Array.isArray(v) ? v : []).slice(0, 40).map(i => ({ step: clip(i && i.step, 20), label: clip(i && i.label, 120), qty: clip(i && i.qty, 60), q: clip(i && i.q, 160), color: /^#[0-9a-f]{3,6}$/i.test(String(i && i.color)) ? i.color : "" })).filter(i => i.label);
}

export default async function handler(req, res) {
  if (!blobConnected()) return res.status(req.method === "GET" ? 200 : 400).json(req.method === "GET" ? { reviews: [] } : { error: "Storage isn't connected." });
  if (req.method === "GET") {
    const img = String(req.query?.img || "");
    if (img) {
      const m = /^([a-z0-9]{10,32})-(tree|preview|avatar)$/.exec(img); if (!m) return res.status(404).end();
      const b = (await list({ ...tok(), prefix: DIR() + "img/" + img + ".jpg", limit: 1 })).blobs[0]; if (!b) return res.status(404).end();
      res.setHeader("content-type", "image/jpeg"); res.setHeader("cache-control", "public, max-age=31536000, immutable");
      if (/\.public\.blob\.vercel-storage\.com/.test(b.url)) return res.redirect(302, b.url);
      return res.status(200).send(await readBlob(b));
    }
    if (req.query?.pending) {
      if (!checkPassword(req)) return res.status(401).json({ error: "Wrong password" });
      return res.status(200).json({ reviews: await readList("pending") });
    }
    res.setHeader("cache-control", "public, max-age=60");
    return res.status(200).json({ reviews: (await readList("approved")).slice(0, 40) });
  }
  if (req.method !== "POST") return res.status(405).end();
  if (!checkPassword(req)) return res.status(401).json({ error: "Wrong password" });
  const b = req.body || {};
  // approving or removing (the Review page)
  if (b.action === "approve" || b.action === "remove") {
    if (!okId(b.id)) return res.status(400).json({ error: "Unknown review" });
    const pend = (await all(DIR() + "pending/" + b.id + ".json"))[0], appr = (await all(DIR() + "approved/" + b.id + ".json"))[0];
    if (b.action === "approve") {
      if (!pend) return res.status(404).json({ error: "Not waiting for approval" });
      const data = JSON.parse((await readBlob(pend)).toString("utf8")); data.approvedAt = new Date().toISOString();
      await putEither(DIR() + "approved/" + b.id + ".json", JSON.stringify(data), "application/json");
      await del(pend.url, tok()).catch(() => {});
    } else {
      const imgs = await all(DIR() + "img/" + b.id + "-");
      await Promise.all([pend, appr, ...imgs].filter(Boolean).map(x => del(x.url, tok()).catch(() => {})));
    }
    return res.status(200).json({ ok: true });
  }
  // a new review
  if (!b.consent) return res.status(400).json({ error: "Please tick the box to share it in the gallery." });
  const rating = Math.round(Number(b.rating)); if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: "Please choose a star rating." });
  const name = clip(b.name, 40); if (!name) return res.status(400).json({ error: "Please add your first name." });
  const id = Date.now().toString(36) + Array.from({ length: 10 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
  const pics = {};
  for (const kind of ["tree", "preview", "avatar"]) {
    const m = IMG.exec(String(b[kind === "tree" ? "photo" : kind] || "")); if (!m) continue;
    const buf = Buffer.from(m[1], "base64"); if (buf.length > 1500000 || buf[0] !== 0xff || buf[1] !== 0xd8) continue;
    await putEither(DIR() + "img/" + id + "-" + kind + ".jpg", buf, "image/jpeg");
    pics[kind] = "/api/reviews?img=" + id + "-" + kind;
  }
  if (!pics.tree && !pics.preview) return res.status(400).json({ error: "Please add a photo of your tree." });
  const entry = {
    id, at: new Date().toISOString(), name, rating, text: clip(b.text, 600), style: clip(b.style, 20),
    tree: pics.tree || "", preview: pics.preview || "", avatar: pics.avatar || "",
    steps: cleanSteps(b.steps), items: cleanItems(b.items)
  };
  await putEither(DIR() + "pending/" + id + ".json", JSON.stringify(entry), "application/json");
  console.log("REVIEW_PENDING", id, name, rating);
  return res.status(200).json({ ok: true, id });
}
