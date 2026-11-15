// The designer's own reference photo of tucked ribbon (uploaded in the Studio). Every image generation
// and preview gets it, so the model copies the real technique instead of guessing (it tends to draw bows).
import { list, get } from "@vercel/blob";
import { blobToken, blobConnected, IS_PREVIEW } from "./blob.js";

const caches = {};
// slot "ribbonref" is the live app's single photo; "ribbon_<style>" are the six style photos (Lab variant "ribbon6").
// A preview copy uses its own photo for a slot when it has one.
export async function ribbonRef(slot = "ribbonref") {
  if (!blobConnected()) return null;
  const cache = caches[slot] ||= { at: 0, ref: null };
  if (cache.ref && Date.now() - cache.at < 2 * 60 * 1000) return cache.ref;   // a missing photo is looked up again every time, so a new upload works at once
  let ref = null;
  try {
    const tok = blobToken() ? { token: blobToken() } : {};
    let page = IS_PREVIEW ? await list({ ...tok, prefix: `preview/brand/photos/${slot}/`, limit: 100 }) : { blobs: [] };
    if (!page.blobs.length) page = await list({ ...tok, prefix: `brand/photos/${slot}/`, limit: 100 });
    const b = page.blobs.sort((x, y) => (new Date(y.uploadedAt).getTime() || 0) - (new Date(x.uploadedAt).getTime() || 0))[0];   // newest by date (the text sort picked by weekday name)
    if (b) {
      let buf = null;
      const r = await get(b.pathname, { ...tok, access: "private" }).catch(() => null);
      if (r && r.stream) buf = Buffer.from(await new Response(r.stream).arrayBuffer());
      else buf = Buffer.from(await (await fetch(b.url)).arrayBuffer());
      ref = { mediaType: b.contentType || "image/jpeg", data: buf.toString("base64") };
    }
  } catch (e) { console.error("ribbonRef", e); }
  caches[slot] = { at: Date.now(), ref };
  return ref;
}
export const RIBBON_REF_NOTE = "Reference photo of the designer's own work. Do not copy its room, tree, colors or ornaments; copy ONLY how the ribbon is used: wide ribbon that emerges from deep inside the branches in soft billows and short drops, then disappears back into the tree, so it reads as one ribbon weaving in and out, with green branches between appearances. No bows, no knots, no tails, no ribbon wrapped around or draped across the tree.";
