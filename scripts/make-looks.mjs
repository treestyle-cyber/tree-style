// Runs TreeStyle's own design flow for each Shop the Look entry against the preview copy, the way /studio/looks does,
// and saves each finished preview to the photo spot look_<id>. Usage: node make-looks.mjs <site> [ids...]
import fs from "node:fs";
import vm from "node:vm";
import { createCanvas, loadImage } from "@napi-rs/canvas";
const SITE = process.argv[2], only = process.argv.slice(3);
const repo = "/vercel/tree-style";
globalThis.window = globalThis;
globalThis.document = { createElement: () => createCanvas(1, 1) };
vm.runInThisContext(fs.readFileSync(repo + "/picks-looks.js", "utf8"));
vm.runInThisContext(fs.readFileSync(repo + "/try/engine.js", "utf8"));
vm.runInThisContext(fs.readFileSync(repo + "/try/guide.js", "utf8"));
const api = async (p, body) => {
  for (let i = 0; i < 2; i++) {
    const r = await fetch(SITE + p, { method: "POST", headers: { "content-type": "application/json", "x-test-password": "preview", cookie: process.env.COOKIE }, body: JSON.stringify(body) });
    const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = { error: t.slice(0, 200) }; }
    if (r.ok) return d;
    console.log("  retry after", r.status, d.error); if (i) throw new Error(p + " " + r.status + " " + d.error);
  }
};
const img = async src => { const im = await loadImage(Buffer.from(src.split(",")[1], "base64")); im.naturalWidth ??= im.width; im.naturalHeight ??= im.height; return im; };
const shrink = async (src, max, q = 90) => { const im = await img(src), k = Math.min(1, max / Math.max(im.width, im.height)), c = createCanvas(Math.round(im.width * k), Math.round(im.height * k));
  c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); return "data:image/jpeg;base64," + (await c.encode("jpeg", q)).toString("base64"); };
const ASPECTS = [["1:1", 1], ["2:3", 2 / 3], ["3:4", .75], ["4:5", .8], ["3:2", 1.5], ["4:3", 4 / 3], ["9:16", 9 / 16]];
const FACTS = { kind: "artificial", prelit: "yes", height: 8, density: "", stage: "" };
fs.mkdirSync("out", { recursive: true });
async function one(L) {
  const t0 = Date.now(), log = m => console.log(`[${L.id} ${Math.round((Date.now() - t0) / 1000)}s] ${m}`);
  log("bare tree");
  const base = await api("/api/base", { kind: "idea", idea: L.idea, facts: FACTS });
  const photo = await shrink(base.image, 1536); const im = await img(photo); const r = im.width / im.height;
  const aspect = ASPECTS.reduce((a, b) => Math.abs(b[1] - r) < Math.abs(a[1] - r) ? b : a)[0];
  log("plan (" + L.style + ")");
  const body = { image: photo, mode: "design", style: "themed", theme: L.theme, facts: FACTS };
  const [look, plan] = await Promise.all([api("/api/evaluate", { ...body, part: "look" }), api("/api/evaluate", { ...body, part: "plan" })]);
  const result = Object.assign(look, plan);
  let map;
  try { const cv = createCanvas(1, 1); TreeGuide.create(im, cv, result, "design").drawMap(undefined, { plainFlowers: process.env.VARIANT === "map2" }); map = await shrink("data:image/png;base64," + (await cv.encode("png")).toString("base64"), 1024, 80); log("map drawn"); }
  catch (e) { log("map failed: " + e.message); }
  const shape = (result.plan || []).some(p => p.element === "fluff") || undefined;
  log("painting");
  const out = await api("/api/render", { image: photo, brief: result.render_brief, aspect, map, shape, generic: !!result.branded_theme || undefined, variant: process.env.VARIANT || undefined });
  const fin = await shrink(out.image, 1600, 90);
  fs.writeFileSync(`out/${L.id}.jpg`, Buffer.from(fin.split(",")[1], "base64"));
  fs.writeFileSync(`out/${L.id}.json`, JSON.stringify({ plan: result.plan, brief: result.render_brief }, null, 1));
  const saved = await api("/api/brand", { action: "use", slot: "look_" + L.id, image: fin });
  log("saved " + saved.url);
}
const todo = LOOKS.filter(L => !only.length || only.includes(L.id));
await Promise.all([0, 1].map(async w => { for (let i = w; i < todo.length; i += 2) { try { await one(todo[i]); } catch (e) { console.log(`[${todo[i].id}] FAILED ${e.message}`); } } }));
console.log("all done");
