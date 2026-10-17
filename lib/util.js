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
  return JSON.parse(text.slice(a, b + 1));
}
