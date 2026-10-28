// Studio → Reels: on-brand AI video for social media. Everything here needs the test password.
// POST { action:"plan", idea, format }           -> Claude writes the shot list { title, concept, shots[], caption, hashtags }
// POST { action:"make", prompt, first?, last?, label?, resolution? }
//                                                   -> Gemini Omni Flash makes one clip, saved in Blob -> { url, clip }
// POST { action:"list" }                           -> { clips[], today, limit }
// GET  /api/video?file=<pathname>                  -> streams a saved clip (when the store is private)
// Settings (Vercel env, all optional): VIDEO_MODEL (default gemini-omni-1.1-flash), VIDEO_DAILY_LIMIT (default 15 clips a day).
import { put, list, get } from "@vercel/blob";
import { blobToken, blobConnected, envPath } from "../lib/blob.js";
import { checkPassword, parseDataUrl, extractJson } from "../lib/util.js";
import { GUIDE } from "../lib/guide.js";
import { VIDEO_BRAND } from "../lib/videobrand.js";

const tok = () => (blobToken() ? { token: blobToken() } : {});
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const VIDEO_MODEL = process.env.VIDEO_MODEL || "gemini-omni-1.1-flash";
const DAILY = Math.max(1, Number(process.env.VIDEO_DAILY_LIMIT) || 15);
const PREFIX = () => envPath("brand/videos/");
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });   // YYYY-MM-DD, Eric's day

const FORMATS = {
  glowup: "The glow-up: an ordinary tree, someone snapping a photo, then the tree transforming into a designer-styled version (a locked-off first-frame to last-frame transformation), then a delighted reaction.",
  order: "Build it in order: close-ups of hands doing each step of the designer's order of work (shape the branches, lights, greenery stems, ribbon, flowers, big ornaments set back toward the trunk, small ornaments, berry stems, the top), ending on the finished tree. Each clip is trimmed to about 2 seconds in the editor.",
  inspo: "Design from inspiration: a hand holds up something they love (a fabric, a print, a mug), then a bare tree transforms into a tree clearly inspired by its motifs and colors, not just its colors.",
  tip: "One designer tip: a single common mistake and the fix, shown on a real-looking tree (before, the fix being done, after).",
  custom: "Whatever the idea below asks for."
};

const PLAN_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["title", "concept", "shots", "caption", "hashtags"],
  properties: {
    title: { type: "string" }, concept: { type: "string" },
    shots: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["name", "mode", "prompt", "on_screen"],
      properties: {
        name: { type: "string" },
        mode: { type: "string", enum: ["text", "start", "frames"] },
        prompt: { type: "string" },
        start_image: { type: "string" }, end_image: { type: "string" },
        on_screen: { type: "string" }
      } } },
    caption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } }
  }
};

function planPrompt(idea, format) {
  return `You are the creative director for TreeStyle's social media. Write a short-form vertical video (a Reel of about 15-20 seconds) as a list of shots for an AI video model. The owner is a professional Christmas tree designer: every tree on screen must look like his work.

${VIDEO_BRAND}

THE DESIGNER'S RULES (so every tree on screen is right):
${GUIDE}

FORMAT: ${FORMATS[format] || FORMATS.custom}
IDEA FROM ERIC: ${String(idea || "(none: choose a strong idea for this format)").slice(0, 1500)}

Write 3-6 shots. For each shot:
- name: a few words.
- mode: "text" (made from the prompt alone), "start" (animates a starting photo), or "frames" (moves from a start photo to an end photo; use this for every before-to-after transformation, with a locked-off camera).
- prompt: 50-120 words for the video model, following SHOT CRAFT. Begin with "Vertical 9:16." Describe the tree in designer terms whenever one is visible.
- start_image / end_image (for start and frames shots): one sentence describing the still photo to use, so Eric can make it in the Studio (e.g. "the ordinary 'before' tree", "the styled 'after' of the same tree, same room and angle").
- on_screen: the text Eric adds in the editor over this shot (short, or empty).
Then a caption (2-4 short lines, in the brand voice, ending with the comment TREE call to action and "AI preview") and 5-8 hashtags.`;
}

async function claude(text) {
  const go = async schema => {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 6000, ...(schema ? { output_config: { format: { type: "json_schema", schema } } } : {}),
        messages: [{ role: "user", content: [{ type: "text", text: schema ? text : text + "\n\nReply with ONLY the JSON." }] }] })
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(body?.error?.message || `Claude error ${r.status}`); e.status = r.status; throw e; }
    return extractJson((body.content || []).filter(b => b.type === "text").map(b => b.text).join(""));
  };
  try { return await go(PLAN_SCHEMA); } catch (e) { if (e.status === 400) return await go(null); throw e; }
}

// Finds the video in the Interactions API reply, wherever it sits.
function findVideo(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 8) return null;
  const mt = node.mime_type || node.mimeType || "";
  if ((node.type === "video" || /^video\//.test(mt)) && (node.data || node.uri)) return { data: node.data, uri: node.uri, mime: mt || "video/mp4" };
  for (const v of Array.isArray(node) ? node : Object.values(node)) { const f = findVideo(v, depth + 1); if (f) return f; }
  return null;
}

async function makeClip({ prompt, first, last, resolution }) {
  const a = parseDataUrl(first), b = parseDataUrl(last), input = [];
  if (a) input.push({ type: "image", data: a.data, mime_type: a.mediaType });
  if (a && b) input.push({ type: "image", data: b.data, mime_type: b.mediaType });
  const lead = a && b ? "The first image is the first frame and the second image is the last frame of this video; move smoothly from one to the other. "
    : a ? "Animate this image; it is the first frame of the video. " : "";
  input.push({ type: "text", text: lead + String(prompt).slice(0, 3000) + "\nNo on-screen text, captions, logos or watermarks." });
  const body = {
    model: VIDEO_MODEL, input,
    response_format: { type: "video", aspect_ratio: "9:16", resolution: ["360p", "720p", "1080p"].includes(resolution) ? resolution : "720p" },
    store: false
  };
  if (a && !b) body.generation_config = { video_config: { task: "image_to_video" } };
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST", headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" }, body: JSON.stringify(body)
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out?.error?.message || `Video service error ${r.status}`);
  const v = findVideo(out);
  if (!v) throw new Error("No video came back. Try rewording the shot (the model may have declined it).");
  if (v.data) return Buffer.from(v.data, "base64");
  const d = await fetch(v.uri, { headers: { "x-goog-api-key": process.env.GEMINI_API_KEY } });
  if (!d.ok) throw new Error(`Couldn't download the clip (${d.status})`);
  return Buffer.from(await d.arrayBuffer());
}

async function saved() {
  const all = []; let cursor;
  do { const p = await list({ ...tok(), prefix: PREFIX(), cursor, limit: 1000 }); all.push(...p.blobs); cursor = p.hasMore ? p.cursor : null; } while (cursor);
  return all;
}
const serve = b => /\.public\.blob\.vercel-storage\.com/.test(b.url) ? b.url : `/api/video?file=${encodeURIComponent(b.pathname)}`;

export default async function handler(req, res) {
  if (req.method === "GET") {
    const p = String(req.query?.file || "");
    if (!p.startsWith(PREFIX()) || !/\.mp4$/.test(p)) return res.status(404).end();
    const r = await get(p, { ...tok(), access: "private" }).catch(() => null);
    if (!r || !r.stream) return res.status(404).end();
    res.setHeader("content-type", "video/mp4"); res.setHeader("cache-control", "private, max-age=3600");
    return res.status(200).send(Buffer.from(await new Response(r.stream).arrayBuffer()));
  }
  if (req.method !== "POST") return res.status(405).end();
  if (!checkPassword(req)) return res.status(401).json({ error: "Wrong password" });
  const { action } = req.body || {};

  try {
    if (action === "plan") {
      if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set in Vercel" });
      const { idea, format } = req.body;
      return res.status(200).json(await claude(planPrompt(idea, format)));
    }

    if (action === "list") {
      if (!blobConnected()) return res.status(200).json({ clips: [], today: 0, limit: DAILY });
      const blobs = await saved(), day = PREFIX() + today() + "/";
      const metas = Object.fromEntries(await Promise.all(blobs.filter(b => b.pathname.endsWith(".json")).slice(-60).map(async b => {
        try { const r = await get(b.pathname, { ...tok(), access: "private" }).catch(() => null); const txt = r && r.stream ? await new Response(r.stream).text() : await (await fetch(b.url)).text(); return [b.pathname.replace(/\.json$/, ""), JSON.parse(txt)]; }
        catch { return [b.pathname.replace(/\.json$/, ""), {}]; }
      })));
      const clips = blobs.filter(b => b.pathname.endsWith(".mp4")).sort((x, y) => String(y.uploadedAt).localeCompare(String(x.uploadedAt))).slice(0, 40)
        .map(b => ({ url: serve(b), at: b.uploadedAt, ...(metas[b.pathname.replace(/\.mp4$/, "")] || {}) }));
      return res.status(200).json({ clips, today: blobs.filter(b => b.pathname.startsWith(day) && b.pathname.endsWith(".mp4")).length, limit: DAILY });
    }

    if (action === "make") {
      if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY is not set in Vercel" });
      if (!blobConnected()) return res.status(400).json({ error: "Storage isn't connected, so clips can't be saved." });
      const { prompt, first, last, label, resolution } = req.body;
      if (!prompt) return res.status(400).json({ error: "Missing shot prompt" });
      const day = PREFIX() + today() + "/";
      const made = (await list({ ...tok(), prefix: day, limit: 1000 })).blobs.filter(b => b.pathname.endsWith(".mp4")).length;
      if (made >= DAILY) return res.status(429).json({ error: `That's today's limit of ${DAILY} clips (a spending guard). It resets at midnight, or raise VIDEO_DAILY_LIMIT in Vercel.` });
      const started = Date.now();
      const buf = await makeClip({ prompt, first, last, resolution });
      const base = day + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      const meta = { label: String(label || "").slice(0, 120), prompt: String(prompt).slice(0, 3000), frames: first && last ? "frames" : first ? "start" : "text", resolution: resolution || "720p", seconds: Math.round((Date.now() - started) / 1000), model: VIDEO_MODEL };
      let b;
      try { b = await put(base + ".mp4", buf, { ...tok(), access: "public", contentType: "video/mp4" }); }
      catch { b = await put(base + ".mp4", buf, { ...tok(), access: "private", contentType: "video/mp4" }); }
      await put(base + ".json", JSON.stringify(meta), { ...tok(), access: /\.public\./.test(b.url) ? "public" : "private", contentType: "application/json" }).catch(() => {});
      return res.status(200).json({ url: serve(b), clip: meta, today: made + 1, limit: DAILY });
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
