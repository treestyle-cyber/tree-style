// POST { image: dataURL, brief: string, aspect: "3:4" etc. }
// Edits the photo with Google's Gemini image model and returns { image: dataURL }.
import { checkPassword, parseDataUrl } from "../lib/util.js";

const MODELS = [
  process.env.GEMINI_IMAGE_MODEL,
  "gemini-3.1-flash-image-preview",
  "gemini-2.5-flash-image"
].filter(Boolean);

// Under test in the Lab: does the higher-quality model, with a checklist, paint every piece the plan names?
const LAB_MODEL = "gemini-3-pro-image-preview";
const LAB_CHECK = `

BEFORE YOU FINISH, CHECK EVERY PIECE: go through the changes above one by one (each ribbon, each kind of flower and stem, each ornament size and color, the topper and the base) and make sure every one is in the picture, clearly visible from across the room, at its stated size, color and count. A piece that is missing or too faint to notice counts as a mistake. Pale pieces on a pale or snowy tree need enough shine, shadow and depth to read.`;
// Added when the image model refuses: themed trees are painted with generic, unbranded pieces
const GENERIC = `

IMPORTANT: show the theme only through generic, unbranded decorations in its colors and spirit (for a space or sci-fi theme: stars, planets, rockets, metallic silver and deep blue; for a sports team: its colors and a generic ball). No logos, insignia, emblems, named characters, faces of real people, lettering or trademarked designs anywhere in the picture.`;
const ASPECTS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9"];

// When the plan includes shaping the branches, the preview shows them shaped: the same tree, fuller,
// with the see-through gaps filled in by its own branches. Otherwise the plan says "shape the branches"
// and the preview shows the same sparse tree.
const SHAPE = `FIRST AND MOST IMPORTANT: MAKE THE TREE FULLER. In the original photo the tree is sparse: you can see the trunk and the room behind it through gaps between the branches, especially in the lower half. Show it after a decorator shaped every branch: each branch spread away from the trunk and its tips fanned up, out and down. Fill every see-through gap and bare patch with more of this tree's own branches and needles, so in the result you cannot see through the tree anywhere, top to bottom, including just above the floor and the tree skirt. It must look clearly lusher than the original at a glance. Use only this tree's own kind of branches (same needles, same green, same snow or flocking if any), so it is plainly the same tree. Keep its height and top tip; the sides may widen a little, as shaped branches do. Nothing below or around the tree changes. Then make the decorating changes below on the fuller tree.`;

function editPrompt(brief, revision, shape) {
  if (revision) return `EDIT this exact photo; do not redraw it. It shows a decorated Christmas tree that the homeowner has already seen and wants to build on. The result must be recognizably the same picture with one change made: someone comparing them side by side should see the same tree, the same room and the same decorations in the same places, plus the change below. Make ONLY that change and keep everything else exactly as it is: same room, camera angle, framing and lighting, and every ornament, ribbon, flower and stem not mentioned stays exactly where it is, at the same size and color. Do not restyle, rearrange or re-render anything the change doesn't name. Make the change photorealistic, at true real-world scale, tucked into the branches, and clearly visible. The tree itself never changes: its height, outline, top tip and every branch stay exactly as they are. Removing a decoration only takes that decoration off and shows the branches that were behind it; a new topper sits on the tree's existing tip, with the upper branches still full around it. If a topper doesn't fit between the tree's tip and the top of the photo, let it run off the top edge of the frame; never shorten, cut, flatten or shrink the tree to make room for it.

Change to make:
${brief}

RIBBON SIZE (important): ribbon sizes are WIDTHS across the ribbon's face, not lengths. A 6-inch-wide ribbon is about as wide as a spread hand or a large ornament, far wider than gift ribbon, and reads bold from across the room; 4 inches wide is a little narrower; 1.5-2 inches is the thin accent. Paint each ribbon at its stated width, in true scale to the tree. Jeweled, embroidered and brocade ribbons are full-width wired ribbons with the jewels or embroidery across their whole face, never a narrow trim or braid. A cascade is a long piece of that wide ribbon, 12-18 inches long, spilling out of the branches and falling in a soft waterfall over 2-3 branches before tucking back in.

RIBBON RULES (important): ribbon never forms a continuous line, stripe, swag or spiral across or down the tree. It appears as separate loops or short drops tucked into the branches, with green showing between them, winding back and forth across the tree, never lined up in a diagonal row.

The result must look like an ordinary real photograph, with no circles, rings, outlines or other markings drawn on it.`;
  return `Edit this photo of a Christmas tree to show it after a professional holiday decorator ${shape ? "shaped its branches and " : ""}finished it.
${shape ? "\n" + SHAPE + "\n" : ""}
The first image is the photo to edit. Keep exactly the same room, camera angle, framing and lighting${shape ? ", and the tree's height and top tip" : ", tree shape and tree size: the tree keeps its exact height, outline, top tip and every branch"}. If a topper doesn't fit between the tree's tip and the top of the photo, let it run off the top edge of the frame; never shorten, cut, flatten or shrink the tree to make room for it. Keep everything already on the tree unless the instructions say otherwise. Make every addition photorealistic, at true real-world scale, lit by the room's light, and physically tucked into the branches (not floating or pasted on).

Changes to make:
${brief}
${shape ? "\nRemember: the tree itself must look clearly fuller than the original, with no see-through gaps.\n" : ""}

RIBBON SIZE (important): ribbon sizes are WIDTHS across the ribbon's face, not lengths. A 6-inch-wide ribbon is about as wide as a spread hand or a large ornament, far wider than gift ribbon, and reads bold from across the room; 4 inches wide is a little narrower; 1.5-2 inches is the thin accent. Paint each ribbon at its stated width, in true scale to the tree. Jeweled, embroidered and brocade ribbons are full-width wired ribbons with the jewels or embroidery across their whole face, never a narrow trim or braid. A cascade is a long piece of that wide ribbon, 12-18 inches long, spilling out of the branches and falling in a soft waterfall over 2-3 branches before tucking back in.

RIBBON RULES (important): ribbon never forms a continuous line, stripe, swag or spiral across or down the tree. It appears as SEPARATE pieces that start and stop (cascades, loops or drops, as the instructions say), each tucked deep into the branches at one spot, with plenty of green branches showing between them. Picture a vine hidden inside the tree that peeks out here and there, winding back and forth across the full width. The ribbon spots must NOT line up: no diagonal row of bows or loops from top to bottom, which reads as a swag. Never wrap ribbon around the tree or drape it from the top to the bottom.

The result must look like an ordinary real photograph of the same tree in the same room, not an illustration, with no circles, rings, outlines or other markings drawn on it.`;
}

async function callGemini(model, img, prompt, aspect, pieces, map) {
  // (map is skipped for small revisions: the current preview already shows the placements)
  const generationConfig = { responseModalities: ["IMAGE"] };
  if (aspect) generationConfig.imageConfig = { aspectRatio: aspect };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: prompt },
        { inline_data: { mime_type: img.mediaType, data: img.data } },
        ...(map ? [{ text: "Placement map (reference only, do not edit or copy its drawing style): the same photo with soft colored blobs showing WHERE each addition goes: ovals in the ribbon color = a spot where ribbon loops poke out of the branches; small blobs in the accent ribbon color = small accent loops; blobs with a yellow center = flowers; round blobs = ornaments in that color at that size. The blobs are position hints only: the finished photo must contain NO circles, rings, outlines, dots, blobs, labels or markings of any kind, only real decorations. Follow its positions and spacing so the result matches the homeowner's step-by-step guide, and don't add groupings or extra pieces the map and instructions don't show. If the written instructions and the map disagree about where something goes, follow the map." }, { inline_data: { mime_type: map.mediaType, data: map.data } }] : []),
        ...(pieces ? [{ text: "Reference only (do not edit this one): the homeowner's own special pieces. Show these exact pieces on the tree where the instructions place them." }, { inline_data: { mime_type: pieces.mediaType, data: pieces.data } }] : [])
      ] }],
      generationConfig
    })
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!checkPassword(req)) return res.status(401).json({ error: "Wrong password" });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY is not set in Vercel" });

  const { image, brief, aspect, pieces, map, revision, shape, variant } = req.body || {};
  const pc = parseDataUrl(pieces), mp = parseDataUrl(map);
  const img = parseDataUrl(image);
  if (!img || !brief) return res.status(400).json({ error: "Missing photo or brief" });
  const ar = ASPECTS.includes(aspect) ? aspect : null;

  const started = Date.now();
  let retried = false;
  let lastErr = "";
  // Lab test (variant "v2"): Google's higher-quality image model first, plus a closing checklist
  const models = variant === "v2" ? [...new Set([LAB_MODEL, ...MODELS])] : MODELS;
  const prompt = editPrompt(brief, revision, !!shape && !revision) + (variant === "v2" ? LAB_CHECK : "");
  for (const model of models) {
    let out = await callGemini(model, img, prompt, ar, pc, revision ? null : mp);
    // Some models reject imageConfig; retry once without it.
    if (!out.ok && out.status === 400 && ar) out = await callGemini(model, img, prompt, null, pc, revision ? null : mp);
    if (!out.ok) {
      lastErr = out.body?.error?.message || `Gemini error ${out.status}`;
      // Model not available, or no quota for it on this account: try the next one
      if (out.status === 404 || (out.status === 429 && /limit: 0/.test(lastErr))) continue;
      return res.status(502).json({ error: lastErr, model });
    }
    const parts = out.body?.candidates?.[0]?.content?.parts || [];
    const pic = parts.find(p => p.inlineData || p.inline_data);
    if (!pic) {
      const why = out.body?.candidates?.[0]?.finishReason || out.body?.promptFeedback?.blockReason || parts.find(p => p.text)?.text || "no image returned";
      console.error("RENDER_REFUSED", JSON.stringify({ model, why: String(why).slice(0, 300), revision: !!revision }));
      // Refused (usually a themed tree naming a film, show, team or brand): try once more with generic designs
      if (!retried && /SAFETY|PROHIBIT|RECITATION|BLOCK|IMAGE_OTHER|OTHER|copyright|trademark/i.test(String(why))) {
        retried = true;
        const again = await callGemini(model, img, prompt + GENERIC, ar, pc, revision ? null : mp);
        const p2 = again.body?.candidates?.[0]?.content?.parts || [], pic2 = p2.find(p => p.inlineData || p.inline_data);
        if (again.ok && pic2) { const d2 = pic2.inlineData || pic2.inline_data; return res.status(200).json({ image: `data:${d2.mimeType || d2.mime_type || "image/png"};base64,${d2.data}`, _meta: { model, seconds: Math.round((Date.now() - started) / 100) / 10, shaped: !!shape && !revision, edited: !!revision, generic: true } }); }
        console.error("RENDER_REFUSED_AGAIN", JSON.stringify({ model, why: String(again.body?.candidates?.[0]?.finishReason || again.status).slice(0, 200) }));
      }
      return res.status(502).json({ error: `No image came back (${why})`, model });
    }
    const d = pic.inlineData || pic.inline_data;
    return res.status(200).json({
      image: `data:${d.mimeType || d.mime_type || "image/png"};base64,${d.data}`,
      _meta: { model, seconds: Math.round((Date.now() - started) / 100) / 10, shaped: !!shape && !revision, edited: !!revision }
    });
  }
  return res.status(502).json({ error: lastErr || "No image model available" });
}
