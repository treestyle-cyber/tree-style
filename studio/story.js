// Instagram story slides for a Shop the Look tree (1080 \u00D7 1920): the reveal, the details, the pieces, and Shop it.
// Needs picks-draw.js (HEX, DRAW) and the brand fonts loaded on the page. Used by /studio/looks.
(function () {
  // Brand standards from the Studio's Brand kit (studio/kit.html): its colors, its fonts by role and its logos.
  // These are the kit's own defaults; anything saved in the Brand kit (/api/brand?kit=1) replaces them before drawing.
  const W = 1080, H = 1920;
  let MID = "#141C2C", IVORY = "#F3EEE7", GOLD = "#B89C6B", OAT = "#D9CCC0", MUTED = "rgba(243,238,231,.74)";
  let SERIF = '"Cormorant Garamond", Georgia, serif', SANS = 'Inter, Helvetica, Arial, sans-serif', HW = 500;
  let LOGO = { stacked: "/brand/logo-stacked.png", horizontal: "/brand/logo-horizontal.png", icon: "/brand/logo-icon.png" };
  const hexOk = h => /^#[0-9a-f]{6}$/i.test(h || "");
  const rgbaOf = (h, a) => "rgba(" + [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16)).join(",") + "," + a + ")";
  let kitDone = null;
  function useKit() {
    return kitDone || (kitDone = (async () => {
      try {
        const d = await (await fetch("/api/brand?kit=1")).json(), k = d && d.kit; if (!k) return;
        const c = k.colors || {};
        if (hexOk(c.midnight)) MID = c.midnight;
        if (hexOk(c.ivory)) { IVORY = c.ivory; MUTED = rgbaOf(c.ivory, .74); }
        if (hexOk(c.gold)) GOLD = c.gold;
        if (hexOk(c.oat)) OAT = c.oat;
        const f = k.fonts || {}, hl = f.headline || f.heading, bd = f.body;
        const add = async (o, fallback) => { if (!o || !o.family) return null; const n = String(o.family).replace(/[^\w \-]/g, "");
          try { if (o.url) { const ff = new FontFace(n, `url(${o.url})`); await ff.load(); document.fonts.add(ff); }
                else if (o.google) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=" + n.replace(/ /g, "+") + ":ital,wght@0,400;0,500;0,600;1,500&display=swap"; document.head.appendChild(l); await new Promise(r => { l.onload = r; l.onerror = r; }); } } catch {}
          return `"${n}", ${fallback}`; };
        SERIF = (await add(hl, "Georgia, serif")) || SERIF;
        SANS = (await add(bd, "Helvetica, Arial, sans-serif")) || SANS;
        if (hl && /^[1-9]00$/.test(hl.weight)) HW = +hl.weight;
        const L = k.logos || {}; ["stacked", "horizontal", "icon"].forEach(x => { if (L[x]) LOGO[x] = L[x]; });
      } catch {}
    })());
  }
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const cache = {};
  const img = src => cache[src] || (cache[src] = load(src));

  async function base() {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = MID; g.fillRect(0, 0, W, H);
    try {   // the brand's midnight velvet, kept dark so the tree carries the slide
      const v = await img("/brand/velvet-midnight.jpg"), k = Math.max(W / v.width, H / v.height);
      g.globalAlpha = .55; g.drawImage(v, (W - v.width * k) / 2, (H - v.height * k) / 2, v.width * k, v.height * k); g.globalAlpha = 1;
    } catch {}
    const r = g.createRadialGradient(W / 2, H * .45, 100, W / 2, H * .45, H * .8);
    r.addColorStop(0, rgbaOf(MID, 0)); r.addColorStop(1, "rgba(10,14,22,.65)"); g.fillStyle = r; g.fillRect(0, 0, W, H);
    return [c, g];
  }
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  function text(g, s, x, y, { font, color = IVORY, align = "center", track = 0 }) {
    g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = "alphabetic";
    if (track && "letterSpacing" in g) g.letterSpacing = track + "px";
    g.fillText(s, x, y); if ("letterSpacing" in g) g.letterSpacing = "0px";
  }
  function wrap(g, s, maxW, font) {
    g.font = font; const out = []; let line = "";
    for (const w of String(s).split(/\s+/)) { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
    if (line) out.push(line); return out;
  }
  async function logo(g, y, w, which = "horizontal") { try { const l = await img(LOGO[which]); const h = w * l.height / l.width; g.drawImage(l, (W - w) / 2, y, w, h); return h; } catch { return 0; } }
  function photoIn(g, p, x, y, w, h, r = 26) {   // cover-fit the photo into a rounded frame with a fine gold edge
    g.save(); rr(g, x, y, w, h, r); g.clip();
    const k = Math.max(w / p.width, h / p.height); g.drawImage(p, x + (w - p.width * k) / 2, y + (h - p.height * k) / 2, p.width * k, p.height * k);
    g.restore(); g.strokeStyle = rgbaOf(GOLD, .55); g.lineWidth = 2; rr(g, x, y, w, h, r); g.stroke();
  }
  const firstSentence = s => (String(s).match(/^[^.!?]*[.!?]/) || [s])[0];


  // 0 \u00B7 The opening: says what this is before the tree appears (stories have no caption)
  async function opening(L, p) {
    const [c, g] = await base();
    const top = 110 + await logo(g, 110, 300, "stacked") + 70;
    g.fillStyle = GOLD; rr(g, W / 2 - 170, top, 340, 56, 28); g.fill();
    text(g, "SNEAK PEEK", W / 2, top + 38, { font: `600 26px ${SANS}`, color: MID, track: 8 });
    let y = top + 170;
    for (const line of wrap(g, "I\u2019ve been building an app that designs your Christmas tree from a photo.", 900, `${HW} 68px ${SERIF}`)) { text(g, line, W / 2, y, { font: `${HW} 68px ${SERIF}` }); y += 80; }
    y += 40;
    const r = 210, cx = W / 2, cy = y + r;   // a round peek at the tree it designed
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
    const k = (2 * r) / Math.min(p.width, p.height * .62);
    g.drawImage(p, cx - p.width * k / 2, cy - p.height * .42 * k, p.width * k, p.height * k); g.restore();
    g.strokeStyle = GOLD; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    y = cy + r + 100;
    text(g, "Here\u2019s a tree it designed:", W / 2, y, { font: `400 38px ${SANS}`, color: MUTED });
    y += 96;
    for (const line of wrap(g, L.name, 960, `italic ${HW} 92px ${SERIF}`)) { text(g, line, W / 2, y, { font: `italic ${HW} 92px ${SERIF}`, color: GOLD }); y += 92; }
    y += 24;
    for (const line of wrap(g, "Every piece is ready to shop early, before TreeStyle launches.", 860, `400 36px ${SANS}`)) { text(g, line, W / 2, y, { font: `400 36px ${SANS}`, color: MUTED }); y += 50; }
    text(g, "TAP TO SEE IT \u2192", W / 2, H - 130, { font: `600 28px ${SANS}`, color: GOLD, track: 6 });
    return c;
  }

  // 1 \u00B7 The reveal: the whole tree, its name and one line
  async function reveal(L, p) {
    const [c, g] = await base();
    const top = 80 + await logo(g, 80, 340) + 36;
    const ph = Math.min(1240, 960 * p.height / p.width), pw = ph * p.width / p.height;
    photoIn(g, p, (W - pw) / 2, top, pw, ph);
    { let fs = 22; g.font = `600 ${fs}px ${SANS}`; while (fs > 14 && g.measureText("AI PREVIEW \u00B7 DESIGNED WITH THE TREESTYLE APP").width * 1.25 > pw - 60) { fs--; g.font = `600 ${fs}px ${SANS}`; }
      text(g, "AI PREVIEW \u00B7 DESIGNED WITH THE TREESTYLE APP", W / 2, top + ph - 30, { font: `600 ${fs}px ${SANS}`, color: rgbaOf(IVORY, .88), track: 3 }); }
    // the sneak-peek ribbon across the top of the photo
    g.fillStyle = GOLD; rr(g, W / 2 - 190, top - 26, 380, 52, 26); g.fill();
    text(g, "SNEAK PEEK", W / 2, top + 10, { font: `600 26px ${SANS}`, color: MID, track: 8 });
    let y = top + ph + 116;
    for (const line of wrap(g, L.name, 960, `${HW} 104px ${SERIF}`)) { text(g, line, W / 2, y, { font: `${HW} 104px ${SERIF}` }); y += 100; }
    text(g, "Designed by TreeStyle, my app, coming soon", W / 2, y + 4, { font: `italic ${HW} 44px ${SERIF}`, color: GOLD });
    y += 74;
    const lines = wrap(g, firstSentence(L.blurb), 920, `400 34px ${SANS}`);
    if (lines.length > 2) { lines.length = 2; lines[1] = lines[1].replace(/[,;:]?\s*\S*$/, "") + "\u2026"; }
    for (const line of lines) { text(g, line, W / 2, y, { font: `400 34px ${SANS}`, color: MUTED }); y += 46; }
    return c;
  }

  // 2 \u00B7 The details: three close crops of the photo, each with a short designer's note
  async function details(L, p, spots) {
    const [c, g] = await base();
    text(g, "SNEAK PEEK \u00B7 THE DETAILS", W / 2, 150, { font: `600 28px ${SANS}`, color: GOLD, track: 8 });
    text(g, L.name, W / 2, 230, { font: `${HW} 64px ${SERIF}` });
    const fw = 960, fh = 500, gap = 40, top = 290;
    spots.slice(0, 3).forEach(([label, fx, fy], i) => {
      const x = (W - fw) / 2, y = top + i * (fh + gap);
      const cw = p.width * .46, ch = cw * fh / fw;   // a close crop around the chosen spot
      const sx = Math.max(0, Math.min(p.width - cw, fx * p.width - cw / 2)), sy = Math.max(0, Math.min(p.height - ch, fy * p.height - ch / 2));
      g.save(); rr(g, x, y, fw, fh, 24); g.clip(); g.drawImage(p, sx, sy, cw, ch, x, y, fw, fh);
      const sh = g.createLinearGradient(0, y + fh - 170, 0, y + fh); sh.addColorStop(0, rgbaOf(MID, 0)); sh.addColorStop(1, rgbaOf(MID, .9));
      g.fillStyle = sh; g.fillRect(x, y + fh - 170, fw, 170); g.restore();
      g.strokeStyle = rgbaOf(GOLD, .55); g.lineWidth = 2; rr(g, x, y, fw, fh, 24); g.stroke();
      text(g, label, x + 36, y + fh - 40, { font: `${HW} 50px ${SERIF}`, align: "left" });
    });
    return c;
  }

  // 3 \u00B7 The pieces: the look's key pieces, drawn in their colors
  async function pieces(L) {
    const [c, g] = await base();
    text(g, "SHOP IT EARLY", W / 2, 170, { font: `600 28px ${SANS}`, color: GOLD, track: 8 });
    text(g, L.name, W / 2, 260, { font: `${HW} 76px ${SERIF}` });
    const list = L.pieces.filter(p => !/the tree/i.test(p[1])).slice(0, 6);
    const rowH = 220, top = 360;
    for (let i = 0; i < list.length; i++) {
      const [, role, name, cols, kind] = list[i], y = top + i * rowH;
      g.strokeStyle = rgbaOf(GOLD, .22); g.lineWidth = 2; g.beginPath(); g.moveTo(90, y); g.lineTo(W - 90, y); g.stroke();
      try {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="-40 -34 80 68">${DRAW[kind](cols)}</svg>`;
        const d = await load("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
        g.drawImage(d, 90, y + 22, 240, 180);
      } catch {}
      text(g, role.toUpperCase(), 370, y + 82, { font: `600 24px ${SANS}`, color: GOLD, align: "left", track: 4 });
      let ly = y + 136;
      for (const line of wrap(g, name, 620, `400 40px ${SANS}`).slice(0, 2)) { text(g, line, 370, ly, { font: `400 40px ${SANS}`, align: "left" }); ly += 50; }
    }
    text(g, "Every piece, ready to shop now", W / 2, top + list.length * rowH + 90, { font: `italic ${HW} 46px ${SERIF}`, color: MUTED });
    return c;
  }

  // 4 \u00B7 Shop it: room for Instagram's link sticker, and the disclosure
  async function shop(L, p) {
    const [c, g] = await base();
    const top = 110 + await logo(g, 110, 340) + 50;
    const pw = 540, ph = pw * p.height / p.width;
    photoIn(g, p, (W - pw) / 2, top, pw, ph, 22);
    let y = top + ph + 140;
    text(g, "Shop it early", W / 2, y, { font: `${HW} 96px ${SERIF}` });
    text(g, "before the app launches", W / 2, y + 86, { font: `italic ${HW} 64px ${SERIF}`, color: GOLD });
    // the link sticker goes here, added in Instagram (a soft frame shows where)
    const sy = y + 150;
    g.setLineDash([14, 12]); g.strokeStyle = rgbaOf(GOLD, .35); g.lineWidth = 2; rr(g, (W - 640) / 2, sy, 640, 150, 75); g.stroke(); g.setLineDash([]);
    const ly = Math.min(sy + 260, H - 270);
    text(g, "TreeStyle designs your tree from a photo.", W / 2, ly, { font: `400 34px ${SANS}`, color: MUTED });
    text(g, "Coming soon. Early access on our page.", W / 2, ly + 50, { font: `400 34px ${SANS}`, color: MUTED });
    text(g, "As an Amazon Associate, TreeStyle earns from qualifying purchases.", W / 2, H - 120, { font: `400 26px ${SANS}`, color: rgbaOf(IVORY, .6) });
    return c;
  }

  // Default detail spots and notes for a look (labels from the look's story, spots spread down the tree)
  const DEFAULT_SPOTS = [[.5, .24], [.34, .5], [.64, .74]];
  function spotsFor(L) { return (L.story || ["The ribbon", "The ornaments", "The finishing touches"]).slice(0, 3).map((t, i) => [t, ...DEFAULT_SPOTS[i]]); }

  async function make(L, photoUrl, spots) {
    await useKit();
    try { await Promise.all([document.fonts.load(`${HW} 100px "Cormorant Garamond"`), document.fonts.load(`italic ${HW} 50px "Cormorant Garamond"`), document.fonts.load(`600 24px Inter`), document.fonts.load(`400 36px Inter`)]); } catch {}
    const p = await load(photoUrl);
    return [await opening(L, p), await reveal(L, p), await details(L, p, spots || spotsFor(L)), await pieces(L), await shop(L, p)];
  }
  window.TreeStory = { make, spotsFor };
})();
