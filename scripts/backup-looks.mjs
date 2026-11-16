const S = process.argv[2], C = process.env.COOKIE, H = { "content-type": "application/json", "x-test-password": "preview", cookie: C };
const brand = await (await fetch(S + "/api/brand", { headers: H })).json();
for (const id of process.argv.slice(3)) {
  const u = brand.photos["look_" + id]; if (!u) { console.log("no photo", id); continue; }
  const b = Buffer.from(await (await fetch(S + u, { headers: H })).arrayBuffer());
  const r = await fetch(S + "/api/brand", { method: "POST", headers: H, body: JSON.stringify({ action: "use", slot: "look_" + id + "old", image: "data:image/jpeg;base64," + b.toString("base64") }) });
  console.log("backup look_" + id + "old", r.status);
}
