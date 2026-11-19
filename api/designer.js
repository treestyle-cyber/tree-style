// The designer chat (Eric, Nov 19): testers on "Design my tree" didn't know what to say or do, so a designer
// interviews them, one question at a time, the way Eric would in a consultation, then hands the app a brief.
// POST { turns: [{ role: "designer"|"me", text }], start: "idea"|"style", known?: { idea, style, hasTree } }
//   -> { say, choices: [..], ready, brief }
// Text only, short replies (the app can read them aloud), no photos.
import { GUIDE } from "../lib/guide.js";
import { checkPassword, extractJson } from "../lib/util.js";

const MODEL = process.env.CHAT_MODEL || process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

const O = props => ({ type: "object", properties: props, required: Object.keys(props), additionalProperties: false });
const SCHEMA = O({ say: { type: "string" }, choices: { type: "array", items: { type: "string" } }, ready: { type: "boolean" }, brief: { type: "string" } });

const SYSTEM = `You are TreeStyle's Christmas tree designer, holding a short design consultation with someone who loves Christmas but isn't a designer. Many people freeze when asked to describe their dream tree, so your job is to draw it out of them the way a gracious, experienced designer would with a client: warm, curious, confident, never salesy, and easy to answer.

HOW THE CONVERSATION GOES
- Ask ONE question at a time. Keep each turn to 1-2 short sentences, because your words may be read aloud. No lists, no markdown, no emoji.
- Start each turn by briefly reflecting what they just said, sometimes with a small designer insight ("Gold and burgundy is such a rich pairing, it glows at night"), then ask the next question. Don't overdo the praise.
- Cover what a designer needs, adapting to what they've already told you and skipping anything they've answered:
  1. the feeling they want when they walk in (cozy, glamorous, nostalgic, fun, calm...) and the room it's in
  2. colors they love, or the colors of the room
  3. something personal to build around: ornaments or heirlooms they already own, a collection, a hobby, a place, a memory, a fabric or object they love
  4. a style direction that fits all of that (Traditional, Rustic, Modern, Elegant, Playful, or a theme): suggest one and let them confirm, rather than asking them to pick from a menu cold
  5. anything they don't want (no glitter, nothing too busy, no red...)
- Don't ask about the tree's height, whether it's real or artificial, pre-lit, or how full it is: the app asks those next. Don't ask about budget.
- If they're unsure, make a confident suggestion they can say yes to ("Many people love a warm, nostalgic tree in red and gold. Want to start there?").
- If they give a lot at once, ask fewer questions. If they say "just design it", "you choose" or similar, or after about 4-6 of their answers, you're ready. Never go past 8 questions.

CHOICES
Every turn, give 3-5 short tappable answers (2-6 words each) that a real person might give to your question, varied and specific, written in their voice (e.g. "Cozy and nostalgic", "Glam and sparkly", "My grandmother's glass ornaments"). Make the last one "You choose for me" or similar when that fits. When ready, the choices are things they might still want to adjust (e.g. "Add more sparkle", "Less red", "Looks perfect").

WHEN YOU'RE READY
Set ready to true. In "say", sum up the tree you'll design in one or two warm sentences and ask if they're ready to see it. In "brief", write the design brief the app will design from: 2-4 sentences, under 500 characters, in the first person as the homeowner would put it ("I want..."), concrete enough to design from: the feeling, the style direction, the palette with color names, the key motifs or pieces (including anything they own that must be featured), and anything to avoid. Use only what they told you or agreed to; don't invent personal details. Until ready, brief is "".
If they keep talking after you were ready, carry on and set ready again with an updated brief when it makes sense.

STAY ON TOPIC: this is about their Christmas tree. Gently steer anything else back to the tree.

Use the designer's knowledge below to make good suggestions, but speak in everyday words (stems not picks, flowers not florals, never "fluff" or "balls").

${GUIDE}`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!checkPassword(req)) return res.status(401).json({ error: "Wrong password" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set in Vercel" });

  const { turns = [], start = "idea", known = {} } = req.body || {};
  const list = (Array.isArray(turns) ? turns : []).slice(-40)
    .map(t => ({ role: t && t.role === "me" ? "user" : "assistant", text: String((t && t.text) || "").slice(0, 1500).trim() }))
    .filter(t => t.text);

  const context = [
    "(The homeowner just opened the designer chat in the TreeStyle app.",
    start === "style" || known.hasTree ? "Their tree is already up and the app has a photo of it, so the design will be styled onto their own tree." : "They may not have a tree up yet; the app will picture the tree for them.",
    known.idea ? `Before opening the chat they had typed this: "${String(known.idea).slice(0, 600)}". Build on it rather than asking again.` : "",
    known.style && known.style !== "keep" && known.style !== "themed" ? `They had picked the ${known.style === "classic" ? "Traditional" : known.style} style; treat it as a starting point.` : "",
    "Your first question is already on screen.)"
  ].filter(Boolean).join(" ");

  // Claude needs the conversation to start with the homeowner and alternate turns
  const messages = [{ role: "user", content: context }];
  for (const t of list) {
    const last = messages[messages.length - 1];
    if (last.role === t.role) last.content += "\n" + t.text;
    else messages.push({ role: t.role, content: t.text });
  }
  if (messages[messages.length - 1].role !== "user") return res.status(400).json({ error: "Nothing to answer yet" });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL, max_tokens: 1200,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        output_config: { format: { type: "json_schema", schema: SCHEMA } },
        messages
      })
    });
    const body = await r.json();
    if (!r.ok) return res.status(500).json({ error: body?.error?.message || `Claude error ${r.status}` });
    const out = extractJson((body.content || []).filter(b => b.type === "text").map(b => b.text).join(""));
    return res.status(200).json({
      say: String(out.say || "").slice(0, 600),
      choices: (Array.isArray(out.choices) ? out.choices : []).map(c => String(c).slice(0, 60)).filter(Boolean).slice(0, 5),
      ready: !!out.ready && !!String(out.brief || "").trim(),
      brief: String(out.brief || "").slice(0, 700)
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
