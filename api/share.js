// Share a finished tree on social media (Kylie: Instagram, Facebook and Pinterest buttons on the finished tree).
// Facebook and Pinterest can only post an image that lives at a public web address, so the app uploads the
// watermarked picture here first.
// POST { image: dataURL (jpeg) }  -> { id, image, page }   image: the picture; page: a small page whose preview is the picture
// GET  /api/share?id=<id>         -> the picture
// GET  /api/share?id=<id>&p=1     -> the share page (Open Graph tags for Facebook and Pinterest, then on to TreeStyle)
import { put, list, get } from "@vercel/blob";
import { blobToken, blobConnected, envPath } from "../lib/blob.js";

const tok = () => (blobToken() ? { token: blobToken() } : {});
const DIR = () => envPath("shares/");
const okId = id => /^[a-z0-9]{12,32}$/.test(String(id || ""));
const MAX = 4 * 1024 * 1024;

async function find(id) {
  const page = await list({ ...tok(), prefix: DIR() + id + ".jpg", limit: 1 });
  return page.blobs[0] || null;
}

export default async function handler(req, res) {
  const origin = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
  if (req.method === "GET") {
    const id = String(req.query?.id || "");
    if (!okId(id)) return res.status(404).end();
    if (req.query?.p) {   // the share page: Facebook and Pinterest read its preview tags
      const img = `${origin}/api/share?id=${id}`, title = "My tree, styled with TreeStyle";
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.setHeader("cache-control", "public, max-age=86400");
      return res.status(200).send(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<meta property="og:type" content="website"><meta property="og:title" content="${title}">
<meta property="og:description" content="A designer's eye for your Christmas tree. AI preview by TreeStyle.">
<meta property="og:image" content="${img}"><meta property="og:image:type" content="image/jpeg">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${img}">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${origin}/">
</head><body style="margin:0;background:#141C2C"><img src="${img}" alt="${title}" style="display:block;max-width:100%;margin:0 auto"></body></html>`);
    }
    try {
      const b = await find(id); if (!b) return res.status(404).end();
      res.setHeader("content-type", "image/jpeg");
      res.setHeader("cache-control", "public, max-age=31536000, immutable");
      if (/\.public\.blob\.vercel-storage\.com/.test(b.url)) return res.redirect(302, b.url);
      const r = await get(b.pathname, { ...tok(), access: "private" });
      return res.status(200).send(Buffer.from(await new Response(r.stream).arrayBuffer()));
    } catch (e) { return res.status(404).end(); }
  }
  if (req.method !== "POST") return res.status(405).end();
  if (!blobConnected()) return res.status(400).json({ error: "Storage isn't connected." });
  const m = /^data:image\/jpeg;base64,(.+)$/.exec(String(req.body?.image || ""));
  if (!m) return res.status(400).json({ error: "Missing image" });
  const buf = Buffer.from(m[1], "base64");
  if (!buf.length || buf.length > MAX || buf[0] !== 0xff || buf[1] !== 0xd8) return res.status(400).json({ error: "That image can't be shared" });
  const id = Date.now().toString(36) + Array.from({ length: 10 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
  try {
    try { await put(DIR() + id + ".jpg", buf, { ...tok(), access: "public", contentType: "image/jpeg", addRandomSuffix: false }); }
    catch (e) { await put(DIR() + id + ".jpg", buf, { ...tok(), access: "private", contentType: "image/jpeg", addRandomSuffix: false }); }
    return res.status(200).json({ id, image: `${origin}/api/share?id=${id}`, page: `${origin}/api/share?id=${id}&p=1` });
  } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
}
