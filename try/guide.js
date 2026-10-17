// Step-by-step diagrams: each step of the plan painted on the person's own photo.
// Uses the drawing engine in engine.js (ported from the prototype).
(function () {
  const E = window.__TG_INTERNAL;
  const { clamp, hex, pt, obj, arr, str, oneOf, RIBBON_TEX, planEl, TAU, rgbOf, layer, photoSampler, makeGeo, buildScene, drawGroup, DRAW_ORDER, ORN_IN, FLOWER_IN, pickColor } = E;

  // Clean up whatever the AI sent so the painter never trips on it.
  function normalize(r, mode) {
    r = obj(r); const m = obj(r.mockup), tree = obj(r.tree), cone = obj(r.cone), picks = obj(m.picks), lights = obj(m.lights), top = obj(m.topper);
    const density = oneOf(tree.density, ["open", "dense"], "dense");
    const out = {
      mode,
      tree: { kind: oneOf(tree.kind, ["artificial", "natural"], "artificial"), density, flocked: !!tree.flocked, height_ft: clamp(tree.height_ft || 7, 3, 16) },
      quick: arr(r.quick_fixes).slice(0, 5).map(q => ({ title: str(obj(q).title, 70), how: str(obj(q).how, 200), x: q && q.x != null ? clamp(q.x, 0, 1) : null, y: q && q.y != null ? clamp(q.y, 0, 1) : null })).filter(q => q.title),
      plan: arr(r.plan).slice(0, 14).map(p => (p = obj(p), { element: planEl(p), step: str(p.step, 40), title: str(p.title, 70), how: str(p.how, 320), effort: str(p.effort, 30), shop: str(p.shop, 80) })).filter(p => p.title),
      cone: { apex: pt(cone.apex, [.5, .1]), left: pt(cone.left, [.22, .85]), right: pt(cone.right, [.78, .85]) },
      lights: { add: lights.add !== false && Object.keys(lights).length > 0, kind: oneOf(lights.kind, ["warm", "multicolor", "solid"], "warm"), color: hex(lights.color, "#FFD28A"), density: oneOf(lights.density, ["light", "medium", "heavy"], "medium") },
      technique: oneOf(m.ribbon_technique, ["cascade", "loops"], density === "open" ? "cascade" : "loops"),
      ribbons: arr(m.ribbons).slice(0, 3).map((rb, i) => (rb = obj(rb), {
        role: oneOf(rb.role, ["base", "overlay", "accent"], ["base", "overlay", "accent"][i]),
        width_in: clamp(rb.width_in || [6, 4, 2][i], 1, 8), color: hex(rb.color, ["#8E2236", "#C9A048", "#1F4A33"][i]),
        texture: oneOf(rb.texture, RIBBON_TEX, "satin"), accent: hex(rb.accent, null)
      })),
      picks: {
        primary: { kind: oneOf(obj(picks.primary).kind, ["pine", "cedar", "eucalyptus", "magnolia", "none"], "pine"), finish: oneOf(obj(picks.primary).finish, ["natural", "frosted", "gold", "silver"], "natural") },
        floral: { kind: oneOf(obj(picks.floral).kind, ["poinsettia", "rose", "magnolia", "hydrangea", "orchid", "none"], "none"), color: hex(obj(picks.floral).color, "#B0242F") },
        small: { kind: oneOf(obj(picks.small).kind, ["berries", "spray", "none"], "none"), color: hex(obj(picks.small).color, "#A3151F") }
      },
      moments: arr(m.moments).slice(0, 14).map(o => (o = obj(o), { x: clamp(o.x, 0, 1), y: clamp(o.y, 0, 1), size: Math.round(clamp(o.size || 2, 1, 3)), floral: !!o.floral })),
      ornaments: arr(m.ornaments).slice(0, 30).map(o => (o = obj(o), { x: clamp(o.x, 0, 1), y: clamp(o.y, 0, 1), color: hex(o.color, "#8E2236"),
        size: oneOf(o.size, ["xl", "l", "m", "s"], "m"), shape: oneOf(o.shape, ["ball", "drop", "finial", "geometric", "candy"], "ball"), finish: oneOf(o.finish, ["shiny", "matte", "glitter"], "shiny") })),
      crown: oneOf(m.crown, ["light", "medium", "full"], "medium"),
      topper: { style: oneOf(top.style, ["star", "bow", "floral", "finial", "none"], "none"), color: hex(top.color, "#E2B65A"), delicate: !!top.delicate }
    };
    if (out.picks.primary.kind === "none" && !arr(m.moments).length) out.moments = [];
    return out;
  }

  const STEP_ORDER = ["fluff", "lights", "primary_picks", "ribbon", "florals", "statement", "medium", "small", "small_picks", "crown", "base"];
  const STEP_TITLE = { fluff: "Fluff", lights: "Lights", primary_picks: "Greenery stems", ribbon: "Ribbon", florals: "Flowers", statement: "Big ornaments",
    medium: "Medium ornaments", small: "Small ornaments", small_picks: "Berry stems", crown: "Top of the tree", base: "Base", all: "All together" };

  const colorName = h => {
    const [r, g, b] = rgbOf(h), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510;
    if (mx - mn < 28) return l > .8 ? "white" : l > .55 ? "silver" : l > .25 ? "grey" : "black";
    let hue = 0; const dd = mx - mn;
    if (mx === r) hue = ((g - b) / dd) % 6; else if (mx === g) hue = (b - r) / dd + 2; else hue = (r - g) / dd + 4;
    hue = (hue * 60 + 360) % 360;
    const base = hue < 15 || hue >= 340 ? "red" : hue < 40 ? (l < .45 ? "copper" : "orange") : hue < 65 ? (l > .8 ? "champagne" : "gold") : hue < 160 ? "green" : hue < 200 ? "teal" : hue < 255 ? "blue" : hue < 290 ? "purple" : "pink";
    return (l < .3 && base !== "black" ? "deep " : "") + base;
  };

  function create(img, cv, raw, mode) {
    const data = normalize(raw, mode);
    const max = 1400, s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    cv.width = Math.round(img.naturalWidth * s); cv.height = Math.round(img.naturalHeight * s);
    const W = cv.width, H = cv.height, ctx = cv.getContext("2d");
    const geo = () => makeGeo([data.cone.apex[0] * W, data.cone.apex[1] * H], [data.cone.left[0] * W, data.cone.left[1] * H], [data.cone.right[0] * W, data.cone.right[1] * H], W, H);
    const G = geo();
    const scene = buildScene(G, data, photoSampler(img, W, H));

    // Layers: a dimmed photo, then one transparent layer per element.
    const planL = { G };
    const dim = layer(W, H), dg = dim.getContext("2d");
    dg.drawImage(img, 0, 0, W, H);
    try {
      const id = dg.getImageData(0, 0, W, H), dd = id.data;
      for (let i = 0; i < dd.length; i += 4) { const y = .3 * dd[i] + .59 * dd[i + 1] + .11 * dd[i + 2]; dd[i] = (dd[i] * .35 + y * .65) * .52; dd[i + 1] = (dd[i + 1] * .35 + y * .65) * .52; dd[i + 2] = (dd[i + 2] * .35 + y * .65) * .52; }
      dg.putImageData(id, 0, 0);
    } catch (e) { dg.fillStyle = "rgba(0,0,0,.45)"; dg.fillRect(0, 0, W, H); }
    planL.dim = dim;
    const junk = layer(W, H).getContext("2d");
    DRAW_ORDER.forEach(n => { const c = layer(W, H); if (drawGroup(n, c.getContext("2d"), junk, G, scene, data, true)) planL[n] = c; });

    // ---- Ribbon, drawn as an instruction (flat, numbered) instead of 3D loops ----
    const RB = scene.rb || {}, RW = scene.rw || {};
    const ribbonPlan = { layer: null, marks: [], kind: null, loopsPerSpot: 0 };
    if (RB.base) {
      const c = layer(W, H), g = c.getContext("2d"), u = G.unit;
      const outline = Math.max(1.5, u * .22);
      const flatLoop = (x, y, ang, len, wid, rb, over) => {
        g.save(); g.translate(x, y); g.rotate(ang);
        g.beginPath(); g.ellipse(len / 2, 0, len / 2, wid / 2, 0, 0, TAU);
        g.fillStyle = rb.color; g.globalAlpha = .92; g.fill(); g.globalAlpha = 1;
        g.lineWidth = outline; g.strokeStyle = "rgba(255,255,255,.95)"; g.stroke();
        if (over) { g.beginPath(); g.ellipse(len / 2, 0, len / 2 * .86, wid / 2 * .42, 0, 0, TAU); g.fillStyle = over.color; g.fill(); }
        g.restore();
      };
      if (scene.runsMain && scene.runsMain.length) {
        // OPEN trees: each piece of ribbon is a band with an arrow showing the drape
        const band = (run, w, rb, over) => {
          const path = () => { g.beginPath(); run.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); };
          g.lineCap = "round"; g.lineJoin = "round";
          path(); g.lineWidth = w + outline * 2; g.strokeStyle = "rgba(255,255,255,.95)"; g.stroke();
          path(); g.lineWidth = w; g.strokeStyle = rb.color; g.stroke();
          if (over) { path(); g.lineWidth = w * .45; g.strokeStyle = over.color; g.stroke(); }
          const [x1, y1] = run[run.length - 1], [x0, y0] = run[run.length - 6] || run[0], a = Math.atan2(y1 - y0, x1 - x0), ah = Math.max(6, w * .7);
          g.beginPath(); g.moveTo(x1 + Math.cos(a) * ah, y1 + Math.sin(a) * ah); g.lineTo(x1 + Math.cos(a + 2.4) * ah, y1 + Math.sin(a + 2.4) * ah); g.lineTo(x1 + Math.cos(a - 2.4) * ah, y1 + Math.sin(a - 2.4) * ah); g.closePath();
          g.fillStyle = "#fff"; g.fill();
        };
        if (RB.accent) (scene.runsAccent || []).forEach(run => band(run, Math.max(3, RW.accent), RB.accent, null));
        const runs = scene.runsMain.slice().sort((a, b) => a[0][1] - b[0][1]);
        runs.forEach(run => band(run, Math.max(5, RW.base), RB.base, RB.overlay));
        ribbonPlan.marks = runs.map(r => [r[0][0], r[0][1]]);
        ribbonPlan.kind = "cascade";
      }
      // Loop spots (dense trees, and beside flowers on open trees)
      const spots = [];
      (scene.loops || []).filter(L => !L.tail).forEach(L => {
        let sp = spots.find(p => p.x === L.x && p.y === L.y);
        if (!sp) spots.push(sp = { x: L.x, y: L.y, loops: [] });
        sp.loops.push(L);
      });
      if (RB.accent) (scene.accentLoops || []).forEach(L => flatLoop(L.x, L.y, L.ang, L.len, L.wid, RB.accent, null));
      if (ribbonPlan.kind === "cascade") {
        // Open trees: the bands are the instruction; flower-side loops are mentioned in the text only.
        ribbonPlan.flowerLoops = spots.length;
      } else {
        spots.forEach(sp => {
          sp.loops.forEach(L => flatLoop(sp.x, sp.y, L.ang, L.len, Math.max(L.wid, RW.base * .7), RB.base, RB.overlay));
          g.beginPath(); g.arc(sp.x, sp.y, Math.max(3, RW.base * .38), 0, TAU); g.fillStyle = "#fff"; g.fill();
        });
        // One number per cluster, so nearby spots don't get overlapping numbers
        const D = G.treeH * .075, groups = [];
        spots.slice().sort((a, b) => a.y - b.y).forEach(sp => {
          const gp = groups.find(q => Math.hypot(q.x - sp.x, q.y - sp.y) < D);
          if (gp) { gp.pts.push(sp); gp.x = gp.pts.reduce((a, p) => a + p.x, 0) / gp.pts.length; gp.y = gp.pts.reduce((a, p) => a + p.y, 0) / gp.pts.length; gp.n += sp.loops.length; }
          else groups.push({ x: sp.x, y: sp.y, pts: [sp], n: sp.loops.length });
        });
        groups.sort((a, b) => a.y - b.y);
        ribbonPlan.kind = "loops";
        ribbonPlan.marks = groups.map(q => [q.x, q.y]);
        ribbonPlan.loopsPerSpot = groups.length ? Math.round(groups.reduce((a, q) => a + q.n, 0) / groups.length) : 0;
      }
      ribbonPlan.layer = c;
    }
    const layerFor = k => k === "ribbon" ? (ribbonPlan.layer || planL.ribbon) : planL[k];
    let afterImg = null;

    // Which steps this tree needs
    const has = {};
    STEP_ORDER.forEach(k => { has[k] = !!planL[k]; });
    data.plan.forEach(p => { has[p.element] = true; });
    if (mode === "design" && data.tree.kind === "artificial") has.fluff = true;
    const steps = STEP_ORDER.filter(k => has[k]); steps.push("all");

    let placed = [];
    const viewScale = () => clamp(W / Math.max(200, cv.clientWidth || 360), 1, 6);
    function pill(o, x, y, text, opts) {
      opts = opts || {};
      const fs = Math.round(15 * viewScale()), pad = fs * .55;
      o.save(); o.font = `600 ${fs}px Inter, system-ui, sans-serif`;
      const w = o.measureText(text).width + pad * 2, h = fs + pad * 1.2, gap = opts.gap || 0;
      let px = opts.align === "left" ? x + gap : opts.align === "right" ? x - gap - w : x - w / 2;
      if (opts.align === "left" && px + w > W - 4) px = x - gap - w;
      if (opts.align === "right" && px < 4) px = x + gap;
      px = clamp(px, 4, W - w - 4);
      let py = clamp(y - h / 2, 4, H - h - 4);
      for (let tries = 0; tries < 8 && placed.some(r => px < r[0] + r[2] + 4 && px + w + 4 > r[0] && py < r[1] + r[3] + 4 && py + h + 4 > r[1]); tries++)
        py = clamp(py + (tries % 2 ? -1 : 1) * (h + 6) * Math.ceil((tries + 1) / 2), 4, H - h - 4);
      placed.push([px, py, w, h]);
      if (opts.leaderFrom) {
        const [ax, ay] = opts.leaderFrom, nx = clamp(ax, px, px + w), ny = clamp(ay, py, py + h);
        if (Math.hypot(nx - ax, ny - ay) > gap * 1.6) { o.strokeStyle = "rgba(255,255,255,.85)"; o.lineWidth = Math.max(1.5, fs * .1); o.beginPath(); o.moveTo(ax, ay); o.lineTo(nx, ny); o.stroke(); }
      }
      o.fillStyle = "rgba(16,26,20,.9)"; o.strokeStyle = "rgba(255,255,255,.85)"; o.lineWidth = Math.max(1.5, fs * .1);
      o.beginPath(); o.roundRect ? o.roundRect(px, py, w, h, h / 2) : o.rect(px, py, w, h); o.fill(); o.stroke();
      o.fillStyle = "#fff"; o.textBaseline = "middle"; o.textAlign = "left"; o.fillText(text, px + pad, py + h / 2 + fs * .04);
      o.restore();
    }
    function ring(o, x, y, r, col) {
      o.save(); o.lineWidth = Math.max(2, r * .2); o.strokeStyle = "rgba(0,0,0,.55)"; o.beginPath(); o.arc(x, y, r, 0, TAU); o.stroke();
      o.lineWidth = Math.max(1.5, r * .12); o.strokeStyle = col || "#fff"; o.stroke(); o.restore();
    }
    const lightCount = () => { const h = data.tree.height_ft || 7; return [Math.round(h * 100 / 50) * 50, Math.round(h * 200 / 50) * 50]; };

    function draw(key, peek) {
      const o = ctx, u = G.unit, vs = viewScale(), S = scene, sizes = ORN_IN(data);
      placed = [];
      if (peek) { o.drawImage(img, 0, 0, W, H); return; }
      if (key === "all" && afterImg) {
        const k2 = Math.max(W / afterImg.naturalWidth, H / afterImg.naturalHeight), aw = afterImg.naturalWidth * k2, ah = afterImg.naturalHeight * k2;
        o.drawImage(afterImg, (W - aw) / 2, (H - ah) / 2, aw, ah);
        drawPins(o, vs, u);
        return;
      }
      o.globalAlpha = 1; o.drawImage(planL.dim, 0, 0);
      if (key === "all") { o.globalAlpha = .55; o.drawImage(img, 0, 0, W, H); o.globalAlpha = 1; }
      const curPos = steps.indexOf(key);
      DRAW_ORDER.forEach(k => {
        const lay = layerFor(k); if (!lay) return;
        const pos = steps.indexOf(k);
        if (key === "all") { o.drawImage(lay, 0, 0); return; }
        if (pos < curPos) { o.globalAlpha = .38; o.drawImage(lay, 0, 0); o.globalAlpha = 1; }
        else if (pos === curPos) {
          if (k !== "lights") { o.save(); o.shadowColor = "rgba(255,255,255,1)"; o.shadowBlur = Math.max(4, u * .6); o.drawImage(lay, 0, 0); o.restore(); }
          o.drawImage(lay, 0, 0);
        }
      });
      if (key === "fluff") {
        pill(o, (G.L[0] + G.R[0]) / 2, G.A[1] + G.treeH * .45, data.tree.kind === "artificial" ? "Unfold every branch, then fluff each tip" : "Shake out the branches");
        const gaps = S.moments.filter(m => m.size >= 2).slice(0, 3);
        gaps.forEach(m => ring(o, m.x, m.y, u * 2.2, "#FFE7A3"));
        if (gaps[0]) pill(o, gaps[0].x, gaps[0].y, data.tree.kind === "artificial" ? "Bend branches back to make room here" : "Natural gap: save it for a big piece", { align: gaps[0].x > W * .55 ? "right" : "left", gap: u * 2.6, leaderFrom: [gaps[0].x, gaps[0].y] });
      }
      if (key === "lights") {
        const [lo, hi] = lightCount(), names = ["Top", "Middle", "Bottom"], share = [1, 3, 5];
        [0, 1, 2].forEach(z => {
          const y0 = G.A[1] + G.treeH * z / 3, y1 = G.A[1] + G.treeH * (z + 1) / 3;
          if (z) { o.save(); o.setLineDash([u * .8, u * .6]); o.lineWidth = Math.max(1.5, u * .18); o.strokeStyle = "rgba(255,255,255,.75)"; o.beginPath(); o.moveTo(G.centerAt(y0) - G.halfWidthAt(y0) - u * 2, y0); o.lineTo(G.centerAt(y0) + G.halfWidthAt(y0) + u * 2, y0); o.stroke(); o.restore(); }
          const n = Math.round((lo + hi) / 2 * share[z] / 9 / 50) * 50;
          pill(o, G.centerAt((y0 + y1) / 2), (y0 + y1) / 2 + (z === 0 ? G.treeH * .06 : 0), `${names[z]}: about ${n} lights`);
        });
      }
      if (key === "primary_picks" && S.all.length) {
        const path = S.moments.slice().sort((a, b) => b.y - a.y);
        o.save(); o.setLineDash([u * .9, u * .7]); o.lineWidth = Math.max(2, u * .25); o.strokeStyle = "rgba(255,231,163,.85)"; o.lineCap = "round";
        o.beginPath(); path.forEach((m, i) => i ? o.lineTo(m.x, m.y) : o.moveTo(m.x, m.y)); o.stroke(); o.restore();
        S.all.forEach(m => ring(o, m.x, m.y, u * (m.size * .7 + 1), "#fff"));
        if (path[0]) pill(o, path[0].x, path[0].y, "Start low and full", { align: path[0].x > W * .55 ? "right" : "left", gap: u * 3, leaderFrom: [path[0].x, path[0].y] });
        const hi = path[path.length - 1]; if (hi && path.length > 2) pill(o, hi.x, hi.y, "Thinner as it climbs", { align: hi.x > W * .55 ? "right" : "left", gap: u * 2.4, leaderFrom: [hi.x, hi.y] });
      }
      if (key === "ribbon" && ribbonPlan.marks.length) {
        const r = Math.max(12 * vs, u * 1.3);
        const [fx, fy] = ribbonPlan.marks[0];
        pill(o, fx, fy, ribbonPlan.kind === "cascade" ? "Start here" : "Start at the top", { align: fx > W * .55 ? "right" : "left", gap: r * 2.2, leaderFrom: [fx, fy] });
        ribbonPlan.marks.forEach(([x, y], i) => badge(o, x, y, r, i + 1, "#1f3a2e"));
      }
      if (key === "florals") S.all.filter(m => m.floral).forEach(m => ring(o, m.x, m.y, FLOWER_IN[data.picks.floral.kind || "rose"] * S.pxIn * .6 + u * .4));
      if (["statement", "medium", "small"].includes(key)) {
        const sz = key === "statement" ? ["xl", "l"] : key === "medium" ? ["m"] : ["s"];
        const list = data.ornaments.filter(b => sz.includes(b.size));
        list.forEach(b => ring(o, b.x * W, b.y * H, Math.max(3, sizes[b.size] * S.pxIn / 2) + u * .5));
        const xl = list.find(b => b.size === "xl");
        if (xl) pill(o, xl.x * W, xl.y * H, "Push it in, toward the trunk", { align: xl.x > .55 ? "right" : "left", gap: sizes.xl * S.pxIn / 2 + u * 1.2, leaderFrom: [xl.x * W, xl.y * H] });
      }
      if (key === "small_picks") pill(o, (G.L[0] + G.R[0]) / 2, G.A[1] + G.treeH * .55, "Tuck these in everywhere");
      if (key === "crown") {
        (S.crown || []).forEach(m => ring(o, m.x, m.y, u * 2, "#FFE7A3"));
        pill(o, G.A[0], G.A[1] + G.treeH * .12, data.topper.delicate ? "Add extra up here, topper goes on last" : "Wire the topper on, then add around it", { gap: 0 });
      }
      if (key === "base") pill(o, (G.L[0] + G.R[0]) / 2, Math.min(H - 20 * vs, G.L[1] + G.treeH * .06), "Keep the base in proportion");
      if (key === "all") drawPins(o, vs, u);
    }
    function badge(o, x, y, r, n, col) {
      o.save(); o.fillStyle = col; o.beginPath(); o.arc(x, y, r, 0, TAU); o.fill(); o.lineWidth = Math.max(2, r * .16); o.strokeStyle = "#fff"; o.stroke();
      o.fillStyle = "#fff"; o.font = `700 ${Math.round(r * 1.05)}px Inter, system-ui, sans-serif`; o.textAlign = "center"; o.textBaseline = "middle"; o.fillText(String(n), x, y + r * .05); o.restore();
    }
    function drawPins(o, vs, u) {
      if (mode !== "check") return;
      data.quick.forEach((q, i) => { if (q.x != null && q.y != null) badge(o, q.x * W, q.y * H, Math.max(13 * vs, u * 1.4), i + 1, "#A9844C"); });
    }

    function ribbonLead() {
      const b = RB.base, ov = RB.overlay, ac = RB.accent; if (!b) return "";
      const wide = `${b.width_in}" ${colorName(b.color)}`, loopIn = Math.round(b.width_in * 2), n = ribbonPlan.marks.length;
      const overTxt = ov ? ` Lay the ${ov.width_in}" ${colorName(ov.color)} ribbon on top as you go, so each piece is two layers.` : "";
      const acTxt = ac ? ` The thin ${ac.width_in}" ${colorName(ac.color)} ribbon is its own trail: small pieces tucked into the gaps between the numbered spots (the small ${colorName(ac.color)} shapes).` : "";
      if (ribbonPlan.kind === "cascade")
        return `Each numbered band is one piece of the ${wide} ribbon (${n} pieces). Starting at 1, tuck the top end deep into the tree, let it drape over two or three branches in the direction of the arrow, then tuck the bottom end in and cut. Each new piece starts a little lower and off to the side, never straight down or straight across.` + overTxt + acTxt + (ribbonPlan.flowerLoops ? ` Save some ribbon for a loop or two beside each flower in the flowers step.` : "");
      return `Work through the ${n} numbered spots from the top down. At each one, make ${ribbonPlan.loopsPerSpot >= 4 ? "three or four" : ribbonPlan.loopsPerSpot >= 3 ? "two or three" : "one or two"} loops of the ${wide} ribbon about ${loopIn}" long, pinch them together, and push the pinched end deep into the branches so the loops pop out. The shapes on the picture show the size and direction.` + overTxt + acTxt;
    }
    function lead(key) {
      const t = data.tree, open = t.density === "open", art = t.kind === "artificial", [lo, hi] = lightCount(), xl = ORN_IN(data).xl;
      return {
        fluff: art ? "Unfold every branch from its shipping fold, then spread each tip up and out. Bend a few larger branches back to open pockets for big pieces. It's the boring step, and the one that matters most."
                   : "Shake out the branches and look for natural gaps. They aren't flaws: they're the perfect spots for your biggest pieces and for ornaments that need room to hang straight.",
        lights: `Plan on ${lo.toLocaleString()} to ${hi.toLocaleString()} lights for a ${t.height_ft} ft tree. ` + (art ? "If it's pre-lit, check for dark sections first. If you add lights, add them there and in two other spots so they don't look patched." : "Spiral up the tree, and on each major branch go deep toward the trunk and back out to the tip.") + " Match the cord color to the tree.",
        primary_picks: "Tuck greenery stems in at the marked spots, wrapping each wire stem around a branch so it holds. Picture a vine growing up from inside the tree and peeking out here and there: more and bigger near the bottom, fewer and smaller as you go up.",
        ribbon: ribbonLead(),
        florals: "Tuck the flower stems into the greenery spots, each with a ribbon loop and a few berries beside it. Put a few extra near the top.",
        statement: `Biggest first: about ${xl}" ornaments for this tree, pushed deep toward the trunk so they fill the background. Then give your most special ornaments the best spots, with a little room around them.`,
        medium: "Medium ornaments go around the big ones, in the spots marked. Mix shiny and matte.",
        small: "Fill in around everything with the small ones. Use them for the accent color or a contrasting finish.",
        small_picks: "Berry stems are inexpensive, so use plenty. Tuck them in all over to add texture and break up any plain patches.",
        crown: data.topper.delicate ? "The top is where everyone looks first. Gather extra greenery, ribbon and flowers here, then add the topper last so nothing knocks it." : "The top is where everyone looks first. Wire the topper on first, then gather extra greenery, ribbon and flowers around it.",
        base: "Choose a skirt or collar in proportion to the tree. A big base, or one that repeats a color already on the tree, pulls the eye down.",
        all: (afterImg ? "Your finished tree. " : "Everything in place. ") + (mode === "check" ? "The numbered pins are your quick fixes." : "Tap any step to look again.")
      }[key];
    }

    // [{color, text}] swatches for the current step
    function legend(key) {
      const S = scene, sizes = ORN_IN(data), out = [];
      if (["statement", "medium", "small"].includes(key)) {
        const sz = key === "statement" ? ["xl", "l"] : key === "medium" ? ["m"] : ["s"], groups = {};
        data.ornaments.filter(b => sz.includes(b.size)).forEach(b => { const k = [b.color.toUpperCase(), b.size, b.shape, b.finish].join("|"); groups[k] = groups[k] || Object.assign({ n: 0 }, b); groups[k].n++; });
        Object.values(groups).sort((a, b) => "xllms".indexOf(a.size) - "xllms".indexOf(b.size)).forEach(gp => {
          const shape = { ball: "", drop: "teardrop ", finial: "long drop ", geometric: "geometric ", candy: "candy cane " }[gp.shape];
          out.push({ color: gp.color, text: `${gp.n} × ${Math.round(sizes[gp.size])}" ${gp.finish !== "shiny" ? gp.finish + " " : ""}${colorName(gp.color)} ${shape || "ball"}`.trim() });
        });
      }
      if (key === "ribbon") [S.rb.base, S.rb.overlay, S.rb.accent].filter(Boolean).forEach(rb => out.push({ color: rb.color, text: `${rb.width_in}" ${colorName(rb.color)} ${rb.texture}${rb.role === "accent" ? " (accent)" : ""}` }));
      if (key === "lights") { const [lo, hi] = lightCount(); out.push({ color: data.lights.kind === "multicolor" ? "conic-gradient(#FF4A3D,#FFB21F,#3FB653,#3C78FF,#E447C8,#FF4A3D)" : data.lights.color, text: `${lo}–${hi} ${data.lights.kind === "multicolor" ? "multicolor" : data.lights.kind === "solid" ? colorName(data.lights.color) : "warm white"} lights` }); }
      if (key === "primary_picks") out.push({ color: pickColor(data), text: `${S.all.length} ${data.picks.primary.finish !== "natural" ? data.picks.primary.finish + " " : ""}${data.picks.primary.kind} stems` });
      if (key === "florals" && data.picks.floral.kind !== "none") out.push({ color: data.picks.floral.color, text: `${S.all.filter(m => m.floral).length + S.all.filter(m => m.floral && m.size >= 3).length} ${colorName(data.picks.floral.color)} ${data.picks.floral.kind}s` });
      if (key === "small_picks") out.push({ color: data.picks.small.color, text: `About ${Math.max(12, Math.round(S.berries.length * .6))} ${colorName(data.picks.small.color)} ${data.picks.small.kind === "spray" ? "small sprigs" : "berry stems"}` });
      if (key === "crown" && data.topper.style !== "none") out.push({ color: data.topper.color, text: `${colorName(data.topper.color)} ${data.topper.style === "floral" ? "flower topper" : data.topper.style === "finial" ? "spire topper" : data.topper.style}` });
      return out;
    }

    const itemsFor = key => key === "all" ? [] : data.plan.filter(p => p.element === key);
    return { steps, title: k => STEP_TITLE[k], draw, lead, legend, itemsFor, data, setAfter: im => { afterImg = im; } };
  }

  window.TreeGuide = { create, normalize };
})();
