// The designer's own reference photo of tucked ribbon (uploaded in the Studio). Every image generation
// and preview gets it, so the model copies the real technique instead of guessing (it tends to draw bows).
import { list, get } from "@vercel/blob";
import { blobToken, blobConnected } from "./blob.js";

let cache = { at: 0, ref: null };
export async function ribbonRef() {
  if (!blobConnected()) return null;
  if (Date.now() - cache.at < 10 * 60 * 1000) return cache.ref;
  let ref = null;
  try {
    const tok = blobToken() ? { token: blobToken() } : {};
    const page = await list({ ...tok, prefix: "brand/photos/ribbonref/", limit: 100 });
    const b = page.blobs.sort((x, y) => String(y.uploadedAt).localeCompare(String(x.uploadedAt)))[0];
    if (b) {
      let buf = null;
      const r = await get(b.pathname, { ...tok, access: "private" }).catch(() => null);
      if (r && r.stream) buf = Buffer.from(await new Response(r.stream).arrayBuffer());
      else buf = Buffer.from(await (await fetch(b.url)).arrayBuffer());
      ref = { mediaType: b.contentType || "image/jpeg", data: buf.toString("base64") };
    }
  } catch (e) { console.error("ribbonRef", e); }
  cache = { at: Date.now(), ref };
  return ref;
}
export const RIBBON_REF_NOTE = "Reference photo of the designer's own work. Do not copy its room, tree, colors or ornaments; copy ONLY how the ribbon is used: wide ribbon that emerges from deep inside the branches in soft billows and short drops, then disappears back into the tree, so it reads as one ribbon weaving in and out, with green branches between appearances. No bows, no knots, no tails, no ribbon wrapped around or draped across the tree.";
