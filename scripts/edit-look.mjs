// Edits a look's current photo the way Change something does (keep everything, make one change) and saves it back
// to look_<id>. Optional reference photo of a piece (e.g. a topper). Usage:
//   COOKIE=... node edit-look.mjs <site> <id> "<change>" [reference.jpg]
import fs from "node:fs";
import { loadImage } from "@napi-rs/canvas";
const [SITE, id, change, ref] = process.argv.slice(2);
const H = { "content-type": "application/json", "x-test-password": "preview", cookie: process.env.COOKIE };
const r0 = await fetch(`${SITE}/api/brand?img=look_${id}&t=${Date.now()}`, { headers: H });
if (!r0.ok) throw new Error("photo " + r0.status);
const buf = Buffer.from(await r0.arrayBuffer()), im = await loadImage(buf), k = im.width / im.height;
const ASPECTS = [["1:1", 1], ["2:3", 2 / 3], ["3:4", .75], ["4:5", .8], ["3:2", 1.5], ["4:3", 4 / 3], ["9:16", 9 / 16]];
const aspect = ASPECTS.reduce((a, b) => Math.abs(b[1] - k) < Math.abs(a[1] - k) ? b : a)[0];
const image = "data:" + (r0.headers.get("content-type") || "image/jpeg") + ";base64," + buf.toString("base64");
const body = { image, brief: change, aspect, revision: true };
if (ref) body.pieces = fs.readFileSync(ref, "utf8").trim();
const r = await fetch(SITE + "/api/render", { method: "POST", headers: H, body: JSON.stringify(body) });
const d = await r.json(); if (!r.ok || !d.image) throw new Error("render " + r.status + " " + d.error);
fs.mkdirSync("out", { recursive: true }); fs.writeFileSync(`out/${id}-edit.jpg`, Buffer.from(d.image.split(",")[1], "base64"));
const s = await (await fetch(SITE + "/api/brand", { method: "POST", headers: H, body: JSON.stringify({ action: "use", slot: "look_" + id, image: d.image }) })).json();
console.log("saved", s.url || JSON.stringify(s));
