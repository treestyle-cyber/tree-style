// Instagram story slides for a Shop the Look tree (1080 \u00D7 1920): the hook, the details, steal the look, and Shop it.
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

  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const HAND = '"Caveat", "Segoe Print", "Bradley Hand", cursive';   // the designer's handwriting, for notes only
  // Instagram covers about the top 220 and bottom 250 pixels with its own bars: everything that matters sits between
  const SAFE_T = 230, SAFE_B = H - 260;

  function canvas() { const c = document.createElement("canvas"); c.width = W; c.height = H; return [c, c.getContext("2d")]; }
  // The tree photo filling the whole slide (shift moves the crop up or down, zoom crops in)
  function fullPhoto(g, p, { zoom = 1, fy = .5, blur = 0 } = {}) {
    g.fillStyle = MID; g.fillRect(0, 0, W, H);
    const k = Math.max(W / p.width, H / p.height) * zoom, w = p.width * k, h = p.height * k;
    const y = Math.max(H - h, Math.min(0, H / 2 - fy * h));
    if (blur && "filter" in g) g.filter = `blur(${blur}px)`;
    g.drawImage(p, (W - w) / 2, y, w, h); g.filter = "none";
  }
  function shade(g, y0, y1, a0, a1) { const s = g.createLinearGradient(0, y0, 0, y1); s.addColorStop(0, `rgba(8,11,18,${a0})`); s.addColorStop(1, `rgba(8,11,18,${a1})`); g.fillStyle = s; g.fillRect(0, y0, W, y1 - y0); }
  function fit(g, s, maxW, size, min, fontOf) { let f = size; g.font = fontOf(f); while (f > min && g.measureText(s).width > maxW) { f -= 2; g.font = fontOf(f); } return f; }
  function wrap(g, s, maxW, font) {
    g.font = font; const out = []; let line = "";
    for (const w of String(s).split(/\s+/)) { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
    if (line) out.push(line); return out;
  }
  // Text sitting right on the photo, with a soft shadow so it reads anywhere
  function say(g, s, x, y, font, color = IVORY, align = "center") {
    g.save(); g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = "alphabetic";
    g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = 28; g.shadowOffsetY = 4; g.fillText(s, x, y); g.restore();
  }
  // An Instagram-style text sticker: lines on a rounded label, slightly tilted
  function sticker(g, lines, cx, cy, { font, bg = IVORY, fg = MID, rot = 0, padX = 40, padY = 26, lh = 1.18, size }) {
    g.save(); g.font = font; const w = Math.max(...lines.map(l => g.measureText(l).width)) + padX * 2, h = lines.length * size * lh + padY * 2;
    g.translate(cx, cy); g.rotate(rot * Math.PI / 180);
    g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 30; g.shadowOffsetY = 8; g.fillStyle = bg; rr(g, -w / 2, -h / 2, w, h, Math.min(34, h / 2)); g.fill();
    g.shadowColor = "transparent"; g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
    lines.forEach((l, i) => g.fillText(l, 0, -h / 2 + padY + size * lh * (i + .5) + size * .04));
    g.restore(); return h;
  }
  // A hand-drawn arrow, for pointing at things
  function arrow(g, x0, y0, x1, y1, bend = 120, color = IVORY) {
    g.save(); g.strokeStyle = color; g.lineWidth = 9; g.lineCap = "round"; g.lineJoin = "round";
    g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = 18;
    const mx = (x0 + x1) / 2 + bend, my = (y0 + y1) / 2;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
    const a = Math.atan2(y1 - my, x1 - mx), L = 44;
    g.beginPath(); g.moveTo(x1 - L * Math.cos(a - .5), y1 - L * Math.sin(a - .5)); g.lineTo(x1, y1); g.lineTo(x1 - L * Math.cos(a + .5), y1 - L * Math.sin(a + .5)); g.stroke();
    g.restore();
  }
  async function logo(g, cx, y, w, which = "horizontal") { try { const l = await img(LOGO[which]); const h = w * l.height / l.width; g.save(); g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = 20; g.drawImage(l, cx - w / 2, y, w, h); g.restore(); return h; } catch { return 0; } }
  function aiLabel(g, y) {   // honesty: every slide with the picture says it is an AI preview
    g.save(); g.font = `600 26px ${SANS}`; const s = "AI PREVIEW \u00B7 DESIGNED BY TREESTYLE", w = g.measureText(s).width + 56;
    if ("letterSpacing" in g) { g.letterSpacing = "3px"; }
    g.fillStyle = "rgba(8,11,18,.55)"; rr(g, (W - w - 30) / 2, y - 34, w + 30, 54, 27); g.fill();
    g.fillStyle = rgbaOf(IVORY, .92); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(s, W / 2, y - 7); g.restore();
  }

  // 1 \u00B7 The hook: the whole tree, full screen, in Eric's voice
  async function hook(L, p) {
    const [c, g] = canvas();
    fullPhoto(g, p, { fy: .5 });
    shade(g, 0, 640, .62, 0); shade(g, H - 780, H, 0, .78);
    sticker(g, ["SNEAK PEEK \u{1F440}"], W / 2 - 150, SAFE_T + 30, { font: `800 34px ${SANS}`, size: 34, bg: GOLD, fg: MID, rot: -4, padX: 30, padY: 16 });
    sticker(g, ["I asked my app to design", "a Christmas tree\u2026"], W / 2, SAFE_T + 200, { font: `800 62px ${SANS}`, size: 62, rot: -2 });
    const f = fit(g, "\u2026and it made this \u{1F60D}", 980, 112, 70, n => `700 ${n}px ${HAND}`);
    say(g, "\u2026and it made this \u{1F60D}", W / 2, SAFE_B - 250, `700 ${f}px ${HAND}`);
    const nf = fit(g, L.name, 860, 76, 48, n => `italic 600 ${n}px ${SERIF}`);
    sticker(g, [L.name], W / 2, SAFE_B - 110, { font: `italic 600 ${nf}px ${SERIF}`, size: nf, bg: GOLD, fg: MID, rot: 2, padX: 44, padY: 18 });
    aiLabel(g, SAFE_B + 10);
    return c;
  }

  // 2 \u00B7 The details: three close-ups as tilted snapshots, with the designer's handwritten notes
  async function details(L, p, spots) {
    const [c, g] = canvas();
    fullPhoto(g, p, { zoom: 1.15, blur: 26 }); g.fillStyle = "rgba(8,11,18,.62)"; g.fillRect(0, 0, W, H);
    sticker(g, ["zoom in \u{1F50D}"], W / 2, SAFE_T + 40, { font: `800 58px ${SANS}`, size: 58, rot: -3 });
    const cw = 820, phH = 290, pad = 20, capH = 104, ch = pad + phH + capH;
    const centers = [SAFE_T + 140 + ch / 2, 0, 0]; centers[1] = centers[0] + ch + 14; centers[2] = centers[1] + ch + 14;
    const tilt = [-3, 2.5, -2], dx = [-30, 34, -18];
    spots.slice(0, 3).forEach(([label, fx, fy], i) => {
      g.save(); g.translate(W / 2 + dx[i], centers[i]); g.rotate(tilt[i] * Math.PI / 180);
      g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = 40; g.shadowOffsetY = 12; g.fillStyle = IVORY; g.fillRect(-cw / 2, -ch / 2, cw, ch); g.shadowColor = "transparent";
      const sw = p.width * .5, sh = sw * phH / (cw - pad * 2);   // a close crop around the chosen spot
      const sx = Math.max(0, Math.min(p.width - sw, fx * p.width - sw / 2)), sy = Math.max(0, Math.min(p.height - sh, fy * p.height - sh / 2));
      g.drawImage(p, sx, sy, sw, sh, -cw / 2 + pad, -ch / 2 + pad, cw - pad * 2, phH);
      const f = fit(g, label, cw - 60, 62, 40, n => `700 ${n}px ${HAND}`);
      g.font = `700 ${f}px ${HAND}`; g.fillStyle = MID; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(label, 0, ch / 2 - capH / 2 + 4); g.restore();
    });
    return c;
  }

  // 3 \u00B7 Steal the look: the key pieces as big cards
  async function pieces(L, p) {
    const [c, g] = canvas();
    fullPhoto(g, p, { zoom: 1.15, blur: 26 }); g.fillStyle = "rgba(8,11,18,.66)"; g.fillRect(0, 0, W, H);
    sticker(g, ["steal the look \u{1F6CD}\uFE0F"], W / 2, SAFE_T + 40, { font: `800 58px ${SANS}`, size: 58, rot: -3 });
    say(g, "every piece is shoppable", W / 2, SAFE_T + 176, `700 58px ${HAND}`, GOLD);
    const list = L.pieces.filter(x => !/the tree/i.test(x[1])).slice(0, 6);
    const cw = 460, chh = 384, gx = 30, gy = 28, top = SAFE_T + 226;
    for (let i = 0; i < list.length; i++) {
      const [, role, name, cols, kind] = list[i], col = i % 2, row = Math.floor(i / 2);
      const cx = W / 2 + (col ? 1 : -1) * (cw / 2 + gx / 2), cy = top + row * (chh + gy) + chh / 2;
      g.save(); g.translate(cx, cy); g.rotate(((i % 3) - 1) * 1.6 * Math.PI / 180);
      g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = 30; g.shadowOffsetY = 10; g.fillStyle = IVORY; rr(g, -cw / 2, -chh / 2, cw, chh, 28); g.fill(); g.shadowColor = "transparent";
      try {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="-40 -34 80 68">${DRAW[kind](cols)}</svg>`;
        const d = await load("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
        g.drawImage(d, -120, -chh / 2 + 14, 240, 180);
      } catch {}
      g.textAlign = "center"; g.textBaseline = "alphabetic";
      g.font = `800 26px ${SANS}`; g.fillStyle = GOLD; if ("letterSpacing" in g) g.letterSpacing = "3px"; g.fillText(role.toUpperCase(), 0, -chh / 2 + 228); if ("letterSpacing" in g) g.letterSpacing = "0px";
      const ls = wrap(g, name, cw - 44, `600 33px ${SANS}`); if (ls.length > 3) { ls.length = 3; ls[2] = ls[2].replace(/[,;]?\s*\S*$/, "") + "\u2026"; }
      g.fillStyle = MID; ls.forEach((l, j) => g.fillText(l, 0, -chh / 2 + 274 + j * 40)); g.restore();
    }
    return c;
  }

  // 4 \u00B7 Shop it: one clear ask, with an arrow to where Instagram's link sticker goes
  async function shop(L, p) {
    const [c, g] = canvas();
    fullPhoto(g, p, { fy: .45 }); g.fillStyle = "rgba(8,11,18,.5)"; g.fillRect(0, 0, W, H); shade(g, 0, H, .1, .55);
    sticker(g, ["ok but where do I", "get all of it? \u{1F914}"], W / 2, SAFE_T + 110, { font: `800 58px ${SANS}`, size: 58, rot: -3 });
    say(g, "Shop every piece", W / 2, SAFE_T + 420, `600 132px ${SERIF}`);
    say(g, "right here", W / 2, SAFE_T + 540, `italic 600 116px ${SERIF}`, GOLD);
    const sy = SAFE_T + 760;   // the link sticker goes here, added in Instagram (a soft frame shows where)
    arrow(g, W / 2 + 250, SAFE_T + 520, W / 2 + 120, sy - 30, 140);
    g.save(); g.setLineDash([18, 14]); g.strokeStyle = rgbaOf(IVORY, .7); g.lineWidth = 4; rr(g, (W - 700) / 2, sy, 700, 170, 85); g.stroke(); g.restore();
    say(g, "before the good stuff sells out!", W / 2, sy + 290, `700 72px ${HAND}`, IVORY);
    const lh = await logo(g, W / 2, SAFE_B - 250, 380);
    say(g, "my app, coming soon \u2728", W / 2, SAFE_B - 250 + lh + 74, `700 60px ${HAND}`, GOLD);
    say(g, "As an Amazon Associate, TreeStyle earns from qualifying purchases.", W / 2, SAFE_B + 30, `500 27px ${SANS}`, rgbaOf(IVORY, .85));
    return c;
  }

  // Default detail spots and notes for a look (labels from the look's story, spots spread down the tree)
  const DEFAULT_SPOTS = [[.5, .24], [.34, .5], [.64, .74]];
  function spotsFor(L) { return (L.story || ["The ribbon", "The ornaments", "The finishing touches"]).slice(0, 3).map((t, i) => [t, ...DEFAULT_SPOTS[i]]); }

  async function make(L, photoUrl, spots) {
    await useKit();
    try { await Promise.all([document.fonts.load(`${HW} 100px "Cormorant Garamond"`), document.fonts.load(`italic ${HW} 50px "Cormorant Garamond"`), document.fonts.load(`600 24px Inter`), document.fonts.load(`400 36px Inter`), document.fonts.load(`800 60px Inter`), document.fonts.load(`700 60px Caveat`), document.fonts.load(`italic 600 60px "Cormorant Garamond"`)]); } catch {}
    const p = await load(photoUrl);
    return [await hook(L, p), await details(L, p, spots || spotsFor(L)), await pieces(L, p), await shop(L, p)];
  }
  window.TreeStory = { make, spotsFor };
})();
