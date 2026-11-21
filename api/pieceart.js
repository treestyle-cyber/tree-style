// Renderings of the pieces for the step-by-step pictures (Eric, Nov 20: "use renderings of the objects rather than the
// pictures currently being used"). Before, each spot showed a stock photo (a generic red ornament, a filler photo
// recolored). Now, once a tree's preview is painted, one picture renders every piece in this design as a clean product
// shot on white, in a grid; the app cuts the grid apart and places each piece on its spots.
// POST { pieces: [string] (up to 12 short descriptions), image?: dataURL of the finished preview, for matching }
// -> { image: dataURL, cols, rows }. Signed-in people only; it never counts as a preview.
import { parseDataUrl } from "../lib/util.js";
import { gate } from "../lib/account.js";

const MODELS = [process.env.GEMINI_IMAGE_MODEL, "gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"].filter(Boolean);

export const gridFor = n => { const cols = n <= 4 ? 2 : n <= 9 ? 3 : 4; return { cols, rows: Math.ceil(n / cols) }; };

function prompt(pieces, cols, rows, hasRef) {
  const cells = pieces.map((p, i) => `Cell ${i + 1} (row ${Math.floor(i / cols) + 1}, column ${i % cols + 1}): ${p}`).join("\n");
  return `Make one product catalog image: a grid of ${cols} columns and ${rows} rows of equal square cells on a pure white background (#FFFFFF), with generous white space between cells and no lines, borders, frames, numbers, labels or text anywhere.
In each cell, exactly one single Christmas decorating piece (one ornament, never a group of them; one stem; one short length of ribbon), photographed alone like a high-end catalog product shot: centered, filling about 70% of its cell, soft even studio light, a faint natural shadow underneath, realistic materials (glass shine, velvet nap, glitter, wired ribbon edges). Nothing else in the cell: no tree, no branches, no props, no background color.
Ribbon is shown as a short length gently curled into one loose loop, its wired edges visible (never tied in a bow, unless the cell says it is a bow). A stem or pick is shown as one stem lying at a slight angle. A tree skirt or collar is shown as a small three-quarter view of the skirt or collar itself.
${hasRef ? "The photo after this text is the finished tree these pieces are for: match each piece's exact colors, finish, pattern and character to how it looks there. Do not copy the tree or the room.\n" : ""}${cells}${pieces.length < cols * rows ? `\nThe remaining ${cols * rows - pieces.length} cell${cols * rows - pieces.length > 1 ? "s are" : " is"} left empty and pure white.` : ""}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!(await gate(req, res, { needsAllowance: false }))) return;
  const pieces = (Array.isArray(req.body?.pieces) ? req.body.pieces : []).map(p => String(p || "").slice(0, 160).trim()).filter(Boolean).slice(0, 12);
  if (!pieces.length) return res.status(400).json({ error: "No pieces" });
  const { cols, rows } = gridFor(pieces.length);
  const ref = parseDataUrl(req.body?.image);
  const parts = [{ text: prompt(pieces, cols, rows, !!ref) }, ...(ref ? [{ inline_data: { mime_type: ref.mediaType, data: ref.data } }] : [])];
  const aspect = cols === rows ? "1:1" : cols === 3 && rows === 2 ? "3:2" : cols === 4 && rows === 3 ? "4:3" : cols === 2 && rows === 1 ? "16:9" : cols === 4 && rows === 2 ? "16:9" : "1:1";
  let lastErr = "";
  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } } })
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { lastErr = body?.error?.message || `Image service error ${r.status}`; continue; }
      const pic = (body?.candidates?.[0]?.content?.parts || []).find(p => p.inlineData || p.inline_data);
      if (!pic) { lastErr = "No image came back"; continue; }
      const d = pic.inlineData || pic.inline_data;
      return res.status(200).json({ image: `data:${d.mimeType || d.mime_type || "image/png"};base64,${d.data}`, cols, rows, model });
    } catch (e) { lastErr = e.message; }
  }
  console.error("PIECEART_FAILED", lastErr);
  return res.status(502).json({ error: lastErr || "Couldn't render the pieces" });
}
