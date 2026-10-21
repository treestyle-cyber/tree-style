// POST  { rating, pay, comment, name, mode, style, theme, overall, version, photo, after }  -> saves one feedback entry
// GET   (x-test-password)                                                                    -> lists all entries, newest first
import { put, list, get } from "@vercel/blob";
import { blobToken } from "../lib/blob.js";
import { checkPassword } from "../lib/util.js";

const clip = (v, n) => String(v ?? "").slice(0, n);
const smallImg = v => (typeof v === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(v) && v.length < 400000) ? v : "";

async function save(path, body) {
  try { return await put(path, body, { token: blobToken(), access: "private", contentType: "application/json", addRandomSuffix: true }); }
  catch (e) {
    if (/access|private|public/i.test(String(e.message))) return await put(path, body, { token: blobToken(), access: "public", contentType: "application/json", addRandomSuffix: true });
    throw e;
  }
}
async function readJson(b) {
  try {
    const r = await get(b.pathname, { token: blobToken(), access: "private" });
    if (r && r.stream) return JSON.parse(await new Response(r.stream).text());
  } catch {}
  const r = await fetch(b.url); return r.json();
}

export default async function handler(req, res) {
  if (!checkPassword(req)) return res.status(401).json({ error: "Wrong password" });

  if (req.method === "POST") {
    const b = req.body || {};
    const entry = {
      at: new Date().toISOString(),
      rating: Math.max(0, Math.min(5, Number(b.rating) || 0)),
      pay: clip(b.pay, 10), comment: clip(b.comment, 2000), name: clip(b.name, 80),
      mode: clip(b.mode, 10), style: clip(b.style, 20), theme: clip(b.theme, 80),
      overall: Number(b.overall) || null, version: Number(b.version) || 1,
      headline: clip(b.headline, 120),
      photo: smallImg(b.photo), after: smallImg(b.after)
    };
    // Always leave a copy in the Vercel logs, even if storage isn't set up yet.
    console.log("FEEDBACK", JSON.stringify({ ...entry, photo: !!entry.photo, after: !!entry.after }));
    if (!blobToken()) return res.status(200).json({ ok: true, stored: false });
    try {
      await save(`feedback/${entry.at.replace(/[:.]/g, "-")}.json`, JSON.stringify(entry));
      return res.status(200).json({ ok: true, stored: true });
    } catch (e) {
      console.error("FEEDBACK STORE FAILED", e);
      return res.status(200).json({ ok: true, stored: false });
    }
  }

  if (req.method === "GET") {
    if (!blobToken()) return res.status(200).json({ entries: [], setup: false });
    try {
      const blobs = [];
      let cursor;
      do { const page = await list({ token: blobToken(), prefix: "feedback/", cursor, limit: 1000 }); blobs.push(...page.blobs); cursor = page.hasMore ? page.cursor : null; } while (cursor && blobs.length < 500);
      blobs.sort((a, b) => String(b.pathname).localeCompare(String(a.pathname)));
      const entries = (await Promise.all(blobs.slice(0, 200).map(b => readJson(b).catch(() => null)))).filter(Boolean);
      return res.status(200).json({ entries, setup: true });
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  }
  return res.status(405).json({ error: "POST or GET" });
}
