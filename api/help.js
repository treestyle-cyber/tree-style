// "Need help?" personal stylist (Kylie's idea; switched on in the Studio's Brand kit once Eric approves).
// POST /api/help { messages: [{ role: "user"|"assistant", text }], tree?: { mode, style, plan:[...], shopping:[...] } }
// POST /api/help { write: { idea }, tree? } -> { request }   "Help me write it" in Change something
//   -> { reply }
// Answers decorating questions in TreeStyle's voice, using the designer's rules (GUIDE) and the person's own plan
// when there is one. It gives advice only: it never changes their design or preview (Change something does that).
import { GUIDE } from "../lib/guide.js";
import { checkPassword } from "../lib/util.js";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

const VOICE = `You are TreeStyle's personal stylist: a warm, expert Christmas tree designer helping one person in a chat.
Answer their question simply and kindly, in two to five short sentences (a short list only when they ask for steps).
Voice: simple yet elevated. Say "shape the branches" (never "fluff"), "ornaments" (never "balls"),
"set back toward the trunk" (never "push deep inside"), "sheer wired ribbon" (never "gauze"), "bolts" of ribbon.
Never mention packs, boxes or how long something takes. Speak as "we" for TreeStyle.
Use the designer's thinking below; when their own plan is given, answer for their tree (its style, pieces and sizes).
You give advice only. If they want their design or preview changed, tell them to tap "Change something" on their results.
If a question isn't about decorating, styling or using TreeStyle, say kindly that you can only help with their tree.
Never invent prices, stores' stock, or product details you were not given.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!checkPassword(req)) return res.status(401).json({ error: "Wrong password" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set in Vercel" });
  const { messages, tree, write } = req.body || {};
  // "Help me write it" in Change something (Kylie): turn a rough idea into one clear change request for their preview
  if (write) return writeRequest(req, res, String(write.idea || "").slice(0, 600), tree);
  const msgs = (Array.isArray(messages) ? messages : []).slice(-12)
    .map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.text || "").slice(0, 1500) }))
    .filter(m => m.content);
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return res.status(400).json({ error: "Ask a question first." });
  let ctx = "";
  if (tree && Array.isArray(tree.plan) && tree.plan.length) {
    ctx = `\n\nTHEIR TREE (from TreeStyle): ${tree.mode === "design" ? "a design" : "a checked tree"}` + (tree.style ? `, style ${tree.style}` : "") + (tree.height ? `, about ${tree.height} ft` : "") + ".\nTheir plan:\n"
      + tree.plan.slice(0, 20).map(p => `- ${String(p.title || "").slice(0, 120)}${p.shop ? ` (shop: ${String(p.shop).slice(0, 160)})` : ""}`).join("\n")
      + (Array.isArray(tree.shopping) && tree.shopping.length ? `\nShopping list: ${tree.shopping.slice(0, 40).map(s => String(s).slice(0, 80)).join("; ")}` : "");
  }
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 600, system: `${VOICE}\n\n${GUIDE}${ctx}`, messages: msgs })
    });
    const body = await r.json();
    if (!r.ok) return res.status(502).json({ error: body?.error?.message || `Claude error ${r.status}` });
    const reply = (body.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    return res.status(200).json({ reply: reply || "Sorry, we couldn't answer that just now. Please try again." });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}

const WRITE = `You help a person write one clear request to change the AI preview of their decorated Christmas tree in TreeStyle.
They give a rough idea (it may be a few words, or empty). Write the request they would type, in the first person, ready to send:
one to three short sentences, specific about what to add, change or remove, the colors, finishes, sizes and roughly where on the
tree (top, middle, lower, spread throughout), and what to keep as it is. Build on their tree and plan when given. If the idea is
empty, suggest one change that would most lift this tree. Keep it shoppable (real pieces sold for Christmas trees), and follow the
designer's thinking below. Voice: simple yet elevated; "ornaments" (never "balls"), "shape the branches" (never "fluff"),
"set back toward the trunk". No greeting, no explanation, no quotation marks: reply with the request only.`;
async function writeRequest(req, res, idea, tree) {
  let ctx = "";
  if (tree && Array.isArray(tree.plan) && tree.plan.length) ctx = `\n\nTHEIR TREE: style ${tree.style || "their own"}; plan:\n` + tree.plan.slice(0, 20).map(p => `- ${String(p.title || "").slice(0, 120)}`).join("\n");
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 300, system: `${WRITE}\n\n${GUIDE}${ctx}`, messages: [{ role: "user", content: idea ? `My rough idea: ${idea}` : "I'm not sure what to change. Suggest one request." }] })
    });
    const body = await r.json();
    if (!r.ok) return res.status(502).json({ error: body?.error?.message || `Claude error ${r.status}` });
    const text = (body.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim().replace(/^["“]|["”]$/g, "");
    return res.status(200).json({ request: text });
  } catch (e) { return res.status(502).json({ error: String(e.message || e) }); }
}
