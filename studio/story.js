// Instagram story slides for a Shop the Look tree (1080 × 1920): the reveal, the details, the pieces, and Shop it.
// Needs picks-draw.js (HEX, DRAW) and the brand fonts loaded on the page. Used by /studio/looks.
(function () {
  const W = 1080, H = 1920, GOLD = "#C9A961", IVORY = "#F4EEE3", MUTED = "rgba(244,238,227,.72)", MID = "#141C2C";
  const SERIF = '"Cormorant Garamond", Georgia, serif', SANS = 'Inter, Helvetica, Arial, sans-serif';
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
    r.addColorStop(0, "rgba(20,28,44,0)"); r.addColorStop(1, "rgba(10,14,22,.65)"); g.fillStyle = r; g.fillRect(0, 0, W, H);
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
  async function logo(g, y, w) { try { const l = await img("/brand/logo-horizontal.png"); const h = w * l.height / l.width; g.drawImage(l, (W - w) / 2, y, w, h); return h; } catch { return 0; } }
  function photoIn(g, p, x, y, w, h, r = 26) {   // cover-fit the photo into a rounded frame with a fine gold edge
    g.save(); rr(g, x, y, w, h, r); g.clip();
    const k = Math.max(w / p.width, h / p.height); g.drawImage(p, x + (w - p.width * k) / 2, y + (h - p.height * k) / 2, p.width * k, p.height * k);
    g.restore(); g.strokeStyle = "rgba(201,169,97,.55)"; g.lineWidth = 2; rr(g, x, y, w, h, r); g.stroke();
  }
  const firstSentence = s => (String(s).match(/^[^.!?]*[.!?]/) || [s])[0];

  // 1 · The reveal: the whole tree, its name and one line
  async function reveal(L, p) {
    const [c, g] = await base();
    const top = 80 + await logo(g, 80, 340) + 36;
    const ph = Math.min(1240, 960 * p.height / p.width), pw = ph * p.width / p.height;
    photoIn(g, p, (W - pw) / 2, top, pw, ph);
    text(g, "AI PREVIEW BY TREESTYLE", W / 2, top + ph - 30, { font: `600 22px ${SANS}`, color: "rgba(244,238,227,.85)", track: 4 });
    let y = top + ph + 116;
    for (const line of wrap(g, L.name, 960, `500 104px ${SERIF}`)) { text(g, line, W / 2, y, { font: `500 104px ${SERIF}` }); y += 100; }
    y += 6;
    const lines = wrap(g, firstSentence(L.blurb), 920, `400 34px ${SANS}`);
    if (lines.length > 3) { lines.length = 3; lines[2] = lines[2].replace(/[,;:]?\s*\S*$/, "") + "…"; }
    for (const line of lines) { text(g, line, W / 2, y, { font: `400 34px ${SANS}`, color: MUTED }); y += 46; }
    return c;
  }

  // 2 · The details: three close crops of the photo, each with a short designer's note
  async function details(L, p, spots) {
    const [c, g] = await base();
    text(g, "THE DETAILS", W / 2, 150, { font: `600 28px ${SANS}`, color: GOLD, track: 8 });
    text(g, L.name, W / 2, 230, { font: `500 64px ${SERIF}` });
    const fw = 960, fh = 500, gap = 40, top = 290;
    spots.slice(0, 3).forEach(([label, fx, fy], i) => {
      const x = (W - fw) / 2, y = top + i * (fh + gap);
      const cw = p.width * .46, ch = cw * fh / fw;   // a close crop around the chosen spot
      const sx = Math.max(0, Math.min(p.width - cw, fx * p.width - cw / 2)), sy = Math.max(0, Math.min(p.height - ch, fy * p.height - ch / 2));
      g.save(); rr(g, x, y, fw, fh, 24); g.clip(); g.drawImage(p, sx, sy, cw, ch, x, y, fw, fh);
      const sh = g.createLinearGradient(0, y + fh - 170, 0, y + fh); sh.addColorStop(0, "rgba(14,20,32,0)"); sh.addColorStop(1, "rgba(14,20,32,.88)");
      g.fillStyle = sh; g.fillRect(x, y + fh - 170, fw, 170); g.restore();
      g.strokeStyle = "rgba(201,169,97,.55)"; g.lineWidth = 2; rr(g, x, y, fw, fh, 24); g.stroke();
      text(g, label, x + 36, y + fh - 40, { font: `500 50px ${SERIF}`, align: "left" });
    });
    return c;
  }

  // 3 · The pieces: the look's key pieces, drawn in their colors
  async function pieces(L) {
    const [c, g] = await base();
    text(g, "THE PIECES", W / 2, 170, { font: `600 28px ${SANS}`, color: GOLD, track: 8 });
    text(g, L.name, W / 2, 260, { font: `500 76px ${SERIF}` });
    const list = L.pieces.filter(p => !/the tree/i.test(p[1])).slice(0, 6);
    const rowH = 220, top = 360;
    for (let i = 0; i < list.length; i++) {
      const [, role, name, cols, kind] = list[i], y = top + i * rowH;
      g.strokeStyle = "rgba(201,169,97,.22)"; g.lineWidth = 2; g.beginPath(); g.moveTo(90, y); g.lineTo(W - 90, y); g.stroke();
      try {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="-40 -34 80 68">${DRAW[kind](cols)}</svg>`;
        const d = await load("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
        g.drawImage(d, 90, y + 22, 240, 180);
      } catch {}
      text(g, role.toUpperCase(), 370, y + 82, { font: `600 24px ${SANS}`, color: GOLD, align: "left", track: 4 });
      let ly = y + 136;
      for (const line of wrap(g, name, 620, `400 40px ${SANS}`).slice(0, 2)) { text(g, line, 370, ly, { font: `400 40px ${SANS}`, align: "left" }); ly += 50; }
    }
    text(g, "Every piece is on the shop list", W / 2, top + list.length * rowH + 90, { font: `italic 500 46px ${SERIF}`, color: MUTED });
    return c;
  }

  // 4 · Shop it: room for Instagram's link sticker, and the disclosure
  async function shop(L, p) {
    const [c, g] = await base();
    const top = 110 + await logo(g, 110, 340) + 50;
    const pw = 540, ph = pw * p.height / p.width;
    photoIn(g, p, (W - pw) / 2, top, pw, ph, 22);
    let y = top + ph + 140;
    text(g, "Tap to shop", W / 2, y, { font: `500 96px ${SERIF}` });
    text(g, "every piece", W / 2, y + 96, { font: `italic 500 96px ${SERIF}`, color: GOLD });
    // the link sticker goes here, added in Instagram (a soft frame shows where)
    const sy = y + 170;
    g.setLineDash([14, 12]); g.strokeStyle = "rgba(201,169,97,.35)"; g.lineWidth = 2; rr(g, (W - 640) / 2, sy, 640, 150, 75); g.stroke(); g.setLineDash([]);
    text(g, "As an Amazon Associate, TreeStyle earns from qualifying purchases.", W / 2, H - 120, { font: `400 26px ${SANS}`, color: "rgba(244,238,227,.6)" });
    return c;
  }

  // Default detail spots and notes for a look (labels from the look's story, spots spread down the tree)
  const DEFAULT_SPOTS = [[.5, .24], [.34, .5], [.64, .74]];
  function spotsFor(L) { return (L.story || ["The ribbon", "The ornaments", "The finishing touches"]).slice(0, 3).map((t, i) => [t, ...DEFAULT_SPOTS[i]]); }

  async function make(L, photoUrl, spots) {
    try { await Promise.all([document.fonts.load(`500 100px "Cormorant Garamond"`), document.fonts.load(`italic 500 50px "Cormorant Garamond"`), document.fonts.load(`600 24px Inter`), document.fonts.load(`400 36px Inter`)]); } catch {}
    const p = await load(photoUrl);
    return [await reveal(L, p), await details(L, p, spots || spotsFor(L)), await pieces(L), await shop(L, p)];
  }
  window.TreeStory = { make, spotsFor };
})();
