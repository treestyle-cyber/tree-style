export function checkPassword(req) {
  const want = process.env.TEST_PASSWORD;
  if (!want) return true; // no password set = open
  return (req.headers["x-test-password"] || "") === want;
}

export function parseDataUrl(s) {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(s || "");
  if (!m) return null;
  return { mediaType: m[1].toLowerCase(), data: m[2] };
}

export function extractJson(text) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("No JSON in reply");
  const raw = text.slice(a, b + 1);
  try { return JSON.parse(raw); } catch {}
  // Repair the usual small slips: comments, trailing commas, missing commas between items.
  const fixed = raw
    .replace(/\/\/[^\n"]*$/gm, "")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/([}\]"0-9]|true|false|null)\s*\n(\s*[{\["])/g, "$1,\n$2")
    .replace(/}\s*{/g, "},{");
  return JSON.parse(fixed);
}
