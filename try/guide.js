// Step-by-step diagrams: each step of the plan painted on the person's own photo.
// Uses the drawing engine in engine.js (ported from the prototype).
(function () {
  const E = window.__TG_INTERNAL;
  const { clamp, hex, pt, obj, arr, str, oneOf, RIBBON_TEX, planEl, TAU, rgbOf, shade, layer, photoSampler, makeGeo, buildScene, drawGroup, DRAW_ORDER, ORN_IN, FLOWER_IN, pickColor } = E;

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
        texture: oneOf(rb.texture, RIBBON_TEX, "satin"), accent: hex(rb.accent, null), owned: !!rb.owned
      })),
      picks: {
        primary: { kind: oneOf(obj(picks.primary).kind, ["pine", "cedar", "eucalyptus", "magnolia", "none"], "pine"), finish: oneOf(obj(picks.primary).finish, ["natural", "frosted", "gold", "silver"], "natural") },
        floral: { kind: oneOf(obj(picks.floral).kind, ["poinsettia", "rose", "magnolia", "hydrangea", "orchid", "none"], "none"), color: hex(obj(picks.floral).color, "#B0242F") },
        small: { kind: oneOf(obj(picks.small).kind, ["berries", "spray", "none"], "none"), color: hex(obj(picks.small).color, "#A3151F") }
      },
      moments: arr(m.moments).slice(0, 14).map(o => (o = obj(o), { x: clamp(o.x, 0, 1), y: clamp(o.y, 0, 1), size: Math.round(clamp(o.size || 2, 1, 3)), floral: !!o.floral })),
      ornaments: arr(m.ornaments).slice(0, 26).map(o => (o = obj(o), { x: clamp(o.x, 0, 1), y: clamp(o.y, 0, 1), color: hex(o.color, "#8E2236"),
        size: oneOf(o.size, ["xl", "l", "m", "s"], "m"), shape: oneOf(o.shape, ["ball", "drop", "finial", "geometric", "candy"], "ball"), finish: oneOf(o.finish, ["shiny", "matte", "glitter"], "shiny") })),
      clusters: arr(m.clusters).slice(0, 6).map(c => (c = obj(c), { x: clamp(c.x, 0, 1), y: clamp(c.y, 0, 1), color: hex(c.color, "#3E7A4A"),
        size: oneOf(c.size, ["m", "s"], "m"), count: Math.round(clamp(c.count || 4, 3, 5)), finish: oneOf(c.finish, ["shiny", "matte", "glitter"], "shiny") })),
      crown: oneOf(m.crown, ["light", "medium", "full"], "medium"),
      topper: { style: oneOf(top.style, ["star", "bow", "floral", "finial", "none"], "none"), color: hex(top.color, "#E2B65A"), delicate: !!top.delicate }
    };
    if (out.picks.primary.kind === "none" && !arr(m.moments).length) out.moments = [];
    balanceFlowers(out);
    windMoments(out);   // a winding vine is already balanced
    keepInside(out);
    unline(out, ["xl"]); unline(out, ["l"]); unline(out, ["xl", "l"]);
    balanceBig(out);   // after unlining: moving pieces must never leave one side heavier
    unline(out, ["xl", "l"]);   // and balancing must not create a new line (it swings toward the lighter side, so balance holds)
    spreadGroups(out, arr(m.ornament_groups));   // last: needs the final vine spots
    return out;
  }

  // NO LINES: big ornaments must never stack in a column, sit in a row, or run in a diagonal.
  // Look at them top to bottom in threes; if three line up, swing the middle one to the other side.
  function unline(d, sizes) {
    const A = d.cone.apex, L = d.cone.left, R = d.cone.right, baseY = (L[1] + R[1]) / 2;
    const t = y => clamp((y - A[1]) / Math.max(.05, baseY - A[1]), 0, 1);
    const cx = y => A[0] + t(y) * ((L[0] + R[0]) / 2 - A[0]), hw = y => Math.max(.02, t(y) * (R[0] - L[0]) / 2);
    const off = o => (o.x - cx(o.y)) / hw(o.y);
    const os = d.ornaments.filter(o => sizes.includes(o.size) && t(o.y) > .12).sort((a, b) => a.y - b.y);
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (let i = 2; i < os.length; i++) {
        const a = os[i - 2], b = os[i - 1], c = os[i], oa = off(a), ob = off(b), oc = off(c);
        const column = Math.max(oa, ob, oc) - Math.min(oa, ob, oc) < .35;
        const row = Math.max(a.y, b.y, c.y) - Math.min(a.y, b.y, c.y) < .06;
        // a diagonal: the middle one sits (almost) on the straight line between the other two, in the photo
        const ux = c.x - a.x, uy = (c.y - a.y) * 1.3, len2 = ux * ux + uy * uy;
        const dev = Math.abs(ux * (b.y - a.y) * 1.3 - uy * (b.x - a.x)) / Math.max(1e-6, len2);
        const diag = !column && !row && Math.abs(ux) > .08 && dev < .12 && b.y > a.y && b.y < c.y;
        if (!column && !row && !diag) continue;
        if (row) { b.y = clamp(b.y + (i % 2 ? .09 : -.09), A[1] + .05, baseY - .03); }
        else {
          // swing toward whichever side of the tree carries less weight right now
          const w = s => os.filter(o => o !== b && (s < 0 ? off(o) < -.2 : off(o) > .2)).reduce((n, o) => n + (o.size === "xl" ? 3 : 2), 0);
          const side = w(-1) < w(1) ? -1 : w(1) < w(-1) ? 1 : (ob > 0 ? -1 : 1);
          b.x = clamp(cx(b.y) + side * .65 * hw(b.y), 0, 1);
          if (column && Math.abs(off(c)) < .3) c.x = clamp(cx(c.y) - side * .45 * hw(c.y), 0, 1);   // and keep zigzagging
        }
        moved = true;
      }
      if (!moved) break;
      os.sort((a, b) => a.y - b.y);
    }
  }

  // Everything hangs ON the tree: pull ornaments and clusters that sit outside the outline back in.
  function keepInside(d) {
    const A = d.cone.apex, L = d.cone.left, R = d.cone.right, baseY = (L[1] + R[1]) / 2;
    const t = y => clamp((y - A[1]) / Math.max(.05, baseY - A[1]), 0, 1);
    const cx = y => A[0] + t(y) * ((L[0] + R[0]) / 2 - A[0]), hw = y => Math.max(.01, t(y) * (R[0] - L[0]) / 2);
    d.ornaments.concat(d.clusters).forEach(o => {
      o.y = clamp(o.y, A[1] + .06 * (baseY - A[1]), baseY - .03 * (baseY - A[1]));
      const lim = (d.clusters.includes(o) ? .7 : .82) * hw(o.y), dx = o.x - cx(o.y);
      if (Math.abs(dx) > lim) o.x = cx(o.y) + Math.sign(dx) * lim;
    });
  }

  // BALANCE for the big pieces: equal visual weight left and right (not symmetry).
  // xl = 3, l = 2, a cluster = 2. If one side is clearly heavier, move the lightest piece
  // that won't crowd anything across, to a similar height, not a mirror image.
  function balanceBig(d) {
    const A = d.cone.apex, L = d.cone.left, R = d.cone.right, baseY = (L[1] + R[1]) / 2;
    const t = y => clamp((y - A[1]) / Math.max(.05, baseY - A[1]), 0, 1);
    const cx = y => A[0] + t(y) * ((L[0] + R[0]) / 2 - A[0]), hw = y => Math.max(.01, t(y) * (R[0] - L[0]) / 2);
    const off = o => (o.x - cx(o.y)) / hw(o.y);
    const items = d.ornaments.filter(o => o.size === "xl" || o.size === "l").map(o => ({ o, w: o.size === "xl" ? 3 : 2 }))
      .concat(d.clusters.map(c => ({ o: c, w: 2 }))).filter(it => t(it.o.y) > .12);
    const sideW = s => items.filter(it => s < 0 ? off(it.o) < -.2 : off(it.o) > .2).reduce((n, it) => n + it.w, 0);
    for (let i = 0; i < 6; i++) {
      const Lw = sideW(-1), Rw = sideW(1);
      if (Math.abs(Lw - Rw) <= Math.max(3, (Lw + Rw) * .25)) break;   // one big piece of difference is fine (a triangle of 3 is balanced)
      const heavy = Lw > Rw ? -1 : 1;
      const pool = items.filter(it => heavy < 0 ? off(it.o) < -.2 : off(it.o) > .2).sort((a, b) => a.w - b.w || Math.abs(off(b.o)) - Math.abs(off(a.o)));
      // try the lightest pieces first; send each to the open spot on the light side farthest from everything else
      let best = null;
      for (const it of pool.slice(0, 3)) {
        for (const dy of [-.1, -.05, 0, .05, .1]) for (const k of [.45, .65, .8]) {
          const ny = clamp(it.o.y + dy, A[1] + .1 * (baseY - A[1]), baseY - .05 * (baseY - A[1]));
          const nx = cx(ny) - heavy * k * hw(ny);
          const gap = items.filter(q => q !== it).reduce((m, q) => Math.min(m, Math.hypot(q.o.x - nx, (q.o.y - ny) * 1.3)), 1);
          const score = gap - it.w * .01;
          if (!best || score > best.score) best = { it, nx, ny, score };
        }
      }
      if (!best) break;
      best.it.o.x = best.nx; best.it.o.y = best.ny;
    }
  }

  // Medium and small ornaments arrive as groups ("6 matte pink 3-inch balls, middle left").
  // Spread each group's spots over its area of the tree, evenly, and clear of ribbon/flower spots
  // and of the ornaments already placed. Seeded, so the same plan always draws the same way.
  const AREA = {
    top: [.1, .34, -.75, .75], upper_left: [.2, .5, -.9, -.1], upper_right: [.2, .5, .1, .9],
    middle_left: [.42, .7, -.9, -.12], middle_center: [.4, .72, -.45, .45], middle_right: [.42, .7, .12, .9],
    lower_left: [.66, .94, -.9, -.12], lower_center: [.66, .94, -.45, .45], lower_right: [.66, .94, .12, .9], all_over: [.14, .93, -.88, .88]
  };
  function spreadGroups(d, groups) {
    if (!groups.length) return;
    const A = d.cone.apex, L = d.cone.left, R = d.cone.right, baseY = (L[1] + R[1]) / 2;
    const cx = t => A[0] + t * ((L[0] + R[0]) / 2 - A[0]), hw = t => Math.max(.01, t * (R[0] - L[0]) / 2);
    const at = (t, u) => ({ x: clamp(cx(t) + u * hw(t), 0, 1), y: clamp(A[1] + t * (baseY - A[1]), 0, 1) });
    const taken = d.moments.map(m => ({ x: m.x, y: m.y, r: .025 + m.size * .008 })).concat(d.ornaments.map(o => ({ x: o.x, y: o.y, r: .035 })));
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    groups.slice(0, 8).forEach(g => {
      g = obj(g);
      const size = oneOf(g.size, ["m", "s"], "m"), [t0, t1, u0, u1] = AREA[g.area] || AREA.all_over;
      const n = Math.round(clamp(g.spots || 5, 1, 12)), look = { color: hex(g.color, "#C9A048"), size, shape: oneOf(g.shape, ["ball", "drop", "finial", "geometric", "candy"], "ball"), finish: oneOf(g.finish, ["shiny", "matte", "glitter"], "shiny") };
      for (let i = 0; i < n; i++) {
        // best of 40 random candidates: the one farthest from everything already on the tree
        let best = null, bestD = -1;
        for (let k = 0; k < 40; k++) {
          const t = Math.sqrt(t0 * t0 + rnd() * (t1 * t1 - t0 * t0)), u = u0 + (u1 - u0) * rnd();   // more spots where the tree is wider
          const p = at(t, u), dmin = taken.reduce((a, q) => Math.min(a, Math.hypot(p.x - q.x, (p.y - q.y) * 1.3) - q.r), 1);
          if (dmin > bestD) { bestD = dmin; best = p; }
        }
        d.ornaments.push(Object.assign({ x: best.x, y: best.y }, look));
        taken.push({ x: best.x, y: best.y, r: size === "m" ? .03 : .022 });
      }
    });
  }

  // The hidden vine WINDS: ribbon/greenery spots zigzag across the full width of the tree.
  // If three spots in a row (top to bottom) head the same way, they read as one diagonal swath,
  // so alternate their sides, keeping each spot's height and roughly its distance from the center.
  function windMoments(d) {
    const A = d.cone.apex, L = d.cone.left, R = d.cone.right, baseY = (L[1] + R[1]) / 2;
    const t = y => clamp((y - A[1]) / Math.max(.05, baseY - A[1]), 0, 1);
    const cx = y => A[0] + t(y) * ((L[0] + R[0]) / 2 - A[0]), hw = y => Math.max(.01, t(y) * (R[0] - L[0]) / 2);
    const ms = d.moments.filter(m => t(m.y) > .14).sort((a, b) => a.y - b.y);   // leave the top of the tree alone
    if (ms.length < 3) return;
    const off = m => (m.x - cx(m.y)) / hw(m.y);
    const lined = () => { for (let i = 2; i < ms.length; i++) { const a = off(ms[i - 2]), b = off(ms[i - 1]), c = off(ms[i]); if ((Math.sign(a) === Math.sign(b) && Math.sign(b) === Math.sign(c)) || (b - a) * (c - b) > 0 && Math.abs(c - a) > .5) return true; } return false; };
    if (!lined()) return;
    let side = Math.sign(off(ms[0])) || -1;
    ms.forEach((m, i) => {
      const mag = clamp(Math.abs(off(m)), .3, .78) * (i % 3 === 2 ? .7 : 1);   // vary the depth so it doesn't look like a ladder
      m.x = clamp(cx(m.y) + side * mag * hw(m.y), 0, 1);
      side = -side;
    });
  }

  // Flowers should feel balanced (equal visual weight left and right), not symmetric.
  // Only steps in when one side is clearly heavier, or when most flowers stack down the center.
  function balanceFlowers(d) {
    const A = d.cone.apex, L = d.cone.left, R = d.cone.right, baseY = (L[1] + R[1]) / 2;
    const t = y => clamp((y - A[1]) / Math.max(.05, baseY - A[1]), 0, 1);
    const cx = y => A[0] + t(y) * ((L[0] + R[0]) / 2 - A[0]), hw = y => t(y) * (R[0] - L[0]) / 2;
    const fl = d.moments.filter(m => m.floral && t(m.y) > .12).sort((a, b) => a.y - b.y);   // leave the very top alone
    if (fl.length < 2) return;
    const off = m => (m.x - cx(m.y)) / Math.max(.001, hw(m.y));
    const wt = m => m.size;   // visual weight: bigger clusters count more
    const sideW = s => fl.filter(m => s < 0 ? off(m) < -.25 : off(m) > .25).reduce((a, m) => a + wt(m), 0);
    // A stack down the middle: only when more than half the flowers sit on the center line
    const centered = fl.filter(m => Math.abs(off(m)) <= .25);
    if (centered.length > fl.length / 2) {
      centered.forEach((m, i) => { if (i % 2 === 0) return;   // leave every other one where it is
        const s = sideW(-1) <= sideW(1) ? -1 : 1; m.x = clamp(cx(m.y) + s * (.45 + .2 * ((i * 37) % 10) / 10) * hw(m.y), 0, 1); });
    }
    // A clearly heavy side: move one flower across at a time until the weights are close
    for (let i = 0; i < 4; i++) {
      const Lw = sideW(-1), Rw = sideW(1), total = Lw + Rw;
      if (Math.abs(Lw - Rw) <= Math.max(2, total * .35)) break;
      const heavy = Lw > Rw ? -1 : 1, pool = fl.filter(m => heavy < 0 ? off(m) < -.25 : off(m) > .25).sort((a, b) => wt(a) - wt(b));
      const m = pool.find(p => !fl.some(q => q !== p && Math.hypot(q.x - (2 * cx(p.y) - p.x), q.y - p.y) < .06)) || pool[0];
      if (!m) break;
      m.x = clamp(cx(m.y) - (m.x - cx(m.y)) * (.8 + ((i * 53) % 10) / 25), 0, 1);   // across, but not a mirror image
    }
  }

  const STEP_ORDER = ["fluff", "lights", "primary_picks", "ribbon", "florals", "statement", "medium", "small", "small_picks", "crown", "base"];
  const STEP_TITLE = { fluff: "Shape the branches", lights: "Lights", primary_picks: "Greenery stems", ribbon: "Ribbon", florals: "Flowers", statement: "Big ornaments",
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

  // ---------- What to buy, in real quantities ----------
  // Ornaments come in boxes, so quantities are planned per box, with a tight palette.
  const PACK = { xl: 3, l: 6, m: 12, s: 24 };
  const SIZE_WORD = { xl: "big", l: "large", m: "medium", s: "small" };
  const SHAPE_Q = { ball: "ball", drop: "teardrop", finial: "finial drop", geometric: "geometric", candy: "candy cane" };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  // Everything is bought in packs: round up to whole packs, never fewer than 2 of anything but a topper.
  const packs = (want, size) => Math.max(1, Math.ceil(want / size));
  // Ribbon yardage per foot of tree (designer guideline: 7.5 ft ≈ 20-30 yd main + supporting, ~10 yd accent)
  const RIBBON_YD_PER_FT = { base: 2.0, overlay: 1.5, accent: 1.3 };
  const ROLL_YD = 10;
  function ornamentTotals(h, mode) {
    return mode === "design"
      ? { xl: Math.max(3, Math.round(h * .6)), l: Math.round(h * 2), m: Math.round(h * 4), s: Math.round(h * 5) }
      : { xl: Math.max(2, Math.round(h * .4)), l: Math.round(h), m: Math.round(h * 2), s: Math.round(h * 2.5) };
  }
  function ornamentGroups(d, mode, sizes) {
    const inch = ORN_IN(d), tot = ornamentTotals(d.tree.height_ft || 7, mode), out = [];
    sizes.forEach(sz => {
      const list = d.ornaments.filter(o => o.size === sz && o.cl == null);
      // Clusters: one line per color, by the box
      const cg = {};
      (d.clusters || []).filter(c => c.size === sz).forEach(c => { const k = colorName(c.color) + "|" + c.finish; (cg[k] = cg[k] || { c, n: 0, k: 0 }).n += c.count; cg[k].k++; });
      const emitClusters = () => Object.entries(cg).forEach(([key, { c, n, k, merged }]) => {
        if (merged) return;
        const boxes = packs(n, PACK[sz]), ins = Math.round(inch[sz]), cn = colorName(c.color);
        out.push({ color: c.color, label: `${ins}" ${c.finish} ${cn} ornaments, for ${plural(k, "cluster", "clusters")}`, qty: `${plural(boxes, "box", "boxes")} of ${PACK[sz]} (you'll use ${n})`, q: `${ins} inch ${c.finish} ${cn} ball christmas ornaments` });
      });
      if (!list.length) { emitClusters(); return; }
      // Merge look-alikes (same color name, finish, shape) so one-offs become real purchases
      const g = {};
      list.forEach(o => { const k = [colorName(o.color), o.finish, o.shape].join("|"); (g[k] = g[k] || { o, n: 0 }).n++; });
      let groups = Object.values(g).sort((a, b) => b.n - a.n);
      const maxG = sz === "l" ? 3 : 2;   // tight palette: at most 2-3 looks per size
      if (groups.length > maxG) { const extra = groups.slice(maxG).reduce((a, x) => a + x.n, 0); groups = groups.slice(0, maxG); groups[0].n += extra; }
      const sum = groups.reduce((a, x) => a + x.n, 0);
      groups.forEach(x => {
        // Same balls as a cluster? Buy them together.
        const ck = colorName(x.o.color) + "|" + x.o.finish, cl = x.o.shape === "ball" && cg[ck];
        if (cl) cl.merged = true;
        x.extra = cl ? cl.n : 0; x.clusters = cl ? cl.k : 0;
      });
      emitClusters();
      groups.forEach(x => {
        const want = Math.max(PACK[sz], Math.round(tot[sz] * x.n / sum)) + x.extra;
        const boxes = packs(want, PACK[sz]), n = boxes * PACK[sz];
        const ins = Math.round(inch[sz]), o = x.o, cn = colorName(o.color);
        out.push({
          color: o.color,
          label: `${ins}" ${o.finish !== "shiny" ? o.finish + " " : "shiny "}${cn} ${SHAPE_Q[o.shape] === "ball" ? "ornaments" : SHAPE_Q[o.shape] + (o.shape === "candy" ? "s" : " ornaments")}${x.clusters ? `, including ${plural(x.clusters, "cluster", "clusters")}` : ""}`,
          qty: `${plural(boxes, "box", "boxes")} of ${PACK[sz]} (${n})`,
          q: `${ins} inch ${o.finish} ${cn} ${SHAPE_Q[o.shape]} christmas ornaments${sz === "xl" || sz === "l" ? " shatterproof" : ""}`
        });
      });
    });
    return out;
  }
  function buyList(d, mode, key) {
    const h = d.tree.height_ft || 7, out = [];
    const add = (color, label, qty, q) => out.push({ color, label, qty, q });
    if (key === "lights" && d.lights.add) {
      const lo = Math.round(h * 100 / 50) * 50, hi = Math.round(h * 200 / 50) * 50;
      const kind = d.lights.kind === "multicolor" ? "multicolor" : d.lights.kind === "solid" ? colorName(d.lights.color) : "warm white";
      const sw = d.lights.kind === "multicolor" ? "conic-gradient(#FF4A3D,#FFB21F,#3FB653,#3C78FF,#E447C8,#FF4A3D)" : d.lights.color;
      if (mode === "design") add(sw, `${kind} lights, ${d.tree.flocked ? "white" : "green"} cord`, `${Math.ceil(lo / 100)}–${Math.ceil(hi / 100)} strands of 100 (${lo}–${hi} lights)`, `${kind} christmas lights 100 count ${d.tree.flocked ? "white wire" : "green wire"}`);
      else add(sw, `${kind} lights for the dark spots`, `${plural(2, "strand", "strands")} of 100`, `${kind} christmas lights 100 count ${d.tree.flocked ? "white wire" : "green wire"}`);
    }
    if (key === "primary_picks" && d.picks.primary.kind !== "none") {
      // Full designer look: about 2-3 per foot of tree (basic look is 1 per foot)
      const want = mode === "design" ? Math.max(d.moments.length * 2, Math.round(h * 2.5)) : Math.max(6, d.moments.length * 2);
      const k = packs(want, 6), fin = d.picks.primary.finish !== "natural" ? d.picks.primary.finish + " " : "";
      add(PICK_HEX[d.picks.primary.kind] || "#3B7550", `${fin}${d.picks.primary.kind} stems`, `${plural(k, "pack", "packs")} of 6 (${k * 6} stems)`, `${fin}${d.picks.primary.kind} picks christmas tree 6 pack`);
    }
    if (key === "ribbon") {
      const rbs = d.ribbons, loops = d.technique === "loops";
      rbs.forEach(rb => {
        const yards = Math.ceil(h * (RIBBON_YD_PER_FT[rb.role] || 1.5) * (mode === "design" ? 1 : .6));
        // A range, since loop sizes vary: e.g. 9 yd -> 1-2 bolts, 15 yd -> 2-3, 30 yd -> 3-4
        const lo = Math.max(1, Math.ceil(yards / ROLL_YD - .2)), hi = Math.max(lo + 1, Math.ceil(yards * 1.25 / ROLL_YD));
        const rolls = `${lo}–${hi} bolts`, cn = colorName(rb.color);
        const role = rb.role === "accent" ? " (thin accent)" : rb.role === "overlay" ? " (laid on top)" : "";
        // Ribbon they already own stays on the list as a top-up: they may not have enough.
        const qty = rb.owned
          ? `About ${yards} yards needed. You have some; add ${rolls} (${ROLL_YD} yd each) if you're short`
          : `About ${yards} yards · ${rolls} (${ROLL_YD} yd each)`;
        add(rb.color, `${rb.width_in}" ${cn} ${rb.texture}${role}${rb.owned ? " · re-use yours" : ""}`, qty, `${rb.width_in} inch wired ${rb.texture} ribbon ${cn} ${ROLL_YD} yards`);
      });
    }
    if (key === "florals" && d.picks.floral.kind !== "none") {
      const want = Math.max(6, d.moments.filter(m => m.floral).length + d.moments.filter(m => m.floral && m.size >= 3).length + (mode === "design" ? Math.round(h * .6) : 0));
      const k = packs(want, 6), cn = colorName(d.picks.floral.color);
      add(d.picks.floral.color, `${cn} ${d.picks.floral.kind} stems`, `${plural(k, "pack", "packs")} of 6 (${k * 6} stems)`, `${cn} ${d.picks.floral.kind} picks christmas tree 6 pack`);
    }
    if (key === "statement") out.push(...ornamentGroups(d, mode, ["xl", "l"]));
    if (key === "medium") out.push(...ornamentGroups(d, mode, ["m"]));
    if (key === "small") out.push(...ornamentGroups(d, mode, ["s"]));
    if (key === "small_picks" && d.picks.small.kind !== "none") {
      const cn = colorName(d.picks.small.color), spray = d.picks.small.kind === "spray";
      const want = Math.max(12, Math.round(h * 3 * (mode === "design" ? 1 : .6))), k = packs(want, 12);
      add(d.picks.small.color, `${cn} ${spray ? "sprays" : "berry stems"}`, `${plural(k, "pack", "packs")} of 12 (${k * 12} stems)`, `${cn} ${spray ? "glitter spray picks" : "berry picks"} christmas tree 12 pack`);
    }
    if (key === "crown" && d.topper.style !== "none") {
      const cn = colorName(d.topper.color), st = d.topper.style === "floral" ? "floral" : d.topper.style === "finial" ? "finial" : d.topper.style;
      add(d.topper.color, `${cn} ${st} topper`, "1", `${cn} ${st} christmas tree topper`);
    }
    // Anything the plan asks for that isn't covered above
    d.plan.filter(p => p.element === key && p.shop).forEach(p => {
      const q = p.shop.toLowerCase(), words = q.split(/\s+/).filter(w => w.length > 3);
      const covered = out.some(o => words.filter(w => o.q.toLowerCase().includes(w)).length >= Math.min(2, words.length));
      if (!covered) add(null, p.shop.charAt(0).toUpperCase() + p.shop.slice(1), "", p.shop);
    });
    return out;
  }
  const rgbaOf = (h, a) => { const [r, g, b] = rgbOf(h); return `rgba(${r},${g},${b},${a})`; };
  const PICK_HEX = { pine: "#3B7550", cedar: "#5E8C45", eucalyptus: "#8FA89C", magnolia: "#2E4A2C" };
  const BUY_ORDER = ["lights", "primary_picks", "ribbon", "florals", "statement", "medium", "small", "small_picks", "crown", "base"];
  function shoppingList(raw, mode) {
    const d = normalize(raw, mode);
    return BUY_ORDER.map(k => ({ key: k, title: STEP_TITLE[k], items: buyList(d, mode, k) })).filter(s => s.items.length);
  }

  function create(img, cv, raw, mode) {
    const data = normalize(raw, mode);
    const max = 1400, s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    cv.width = Math.round(img.naturalWidth * s); cv.height = Math.round(img.naturalHeight * s);
    const W = cv.width, H = cv.height, ctx = cv.getContext("2d");
    const geo = () => makeGeo([data.cone.apex[0] * W, data.cone.apex[1] * H], [data.cone.left[0] * W, data.cone.left[1] * H], [data.cone.right[0] * W, data.cone.right[1] * H], W, H);
    const G = geo();
    // Expand each cluster into its balls (packed like grapes) so every view draws them the same way
    const pxIn0 = G.treeH / ((data.tree.height_ft || 7) * 12 * .92), inch0 = ORN_IN(data);
    const GRAPES = { 3: [[0, -.6], [-.55, .4], [.6, .35]], 4: [[0, -.75], [-.7, 0], [.7, .05], [0, .72]], 5: [[0, 0], [-.85, -.35], [.82, -.4], [-.45, .8], [.5, .78]] };
    data.clusters.forEach((c, ci) => {
      const r = inch0[c.size] * pxIn0 / 2 * 1.9;
      (GRAPES[c.count] || GRAPES[4]).forEach(([dx, dy]) => data.ornaments.push({ x: (c.x * W + dx * r) / W, y: (c.y * H + dy * r) / H, color: c.color, size: c.size, shape: "ball", finish: c.finish, cl: ci }));
    });
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
      const c = layer(W, H), u = G.unit; let g = c.getContext("2d");
      const outline = Math.max(1.5, u * .22);
      // Ribbon loops drawn as flat ribbon: pinched at the tuck point, opening up to a fold at the far end,
      // the back of the ribbon visible inside the loop, the narrower ribbon laid on top, crisp edges and a white halo.
      const ribbonLoop = (x, y, ang, len, rb, over) => {
        len *= .72;
        const bw = Math.max(4, Math.min(RW.base * .55, len * .26)), hw = Math.max(bw * 1.2, len * .3);
        const N = 28, T = 1.08, pinch = bw * .22;
        const ow = t => Math.max(0, pinch * (1 - t) + hw * Math.sqrt(Math.max(0, 1 - Math.pow((t - .54) / .54, 2))));
        const bandW = t => bw * (.35 + .65 * Math.min(1, t * 1.4));
        const X = t => t / T * len;
        const outer = [], inner = [];
        for (let i = 0; i <= N; i++) { const t = T * i / N; outer.push([X(t), -ow(t)]); }
        for (let i = N; i >= 0; i--) { const t = T * i / N; outer.push([X(t), ow(t)]); }
        for (let i = 2; i <= N - 2; i++) { const t = T * i / N, w = ow(t) - bandW(t); if (w > 0) inner.push([X(t), -w]); }
        const hole = inner.concat(inner.slice().reverse().map(([a, b]) => [a, -b]));
        const poly = pts => { pts.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); g.closePath(); };
        g.save(); g.translate(x, y); g.rotate(ang); g.lineJoin = "round";
        g.beginPath(); poly(outer); g.lineWidth = outline * 3; g.strokeStyle = "#fff"; g.stroke();
        if (hole.length > 4) { g.beginPath(); poly(hole); const gr = g.createLinearGradient(0, -hw, 0, hw); gr.addColorStop(0, shade(rb.color, -.55)); gr.addColorStop(1, shade(rb.color, -.25)); g.fillStyle = gr; g.globalAlpha = .55; g.fill(); g.globalAlpha = 1; }
        g.beginPath(); poly(outer); if (hole.length > 4) poly(hole);
        const gb = g.createLinearGradient(0, -hw, 0, hw); gb.addColorStop(0, shade(rb.color, .12)); gb.addColorStop(.5, rb.color); gb.addColorStop(1, shade(rb.color, -.18));
        g.fillStyle = gb; g.fill("evenodd");
        if (over) [-1, 1].forEach(sg => {
          g.beginPath(); for (let i = 1; i <= N - 1; i++) { const t = T * i / N, px = X(t), py = sg * (ow(t) - bandW(t) / 2); i > 1 ? g.lineTo(px, py) : g.moveTo(px, py); }
          g.lineWidth = bw * .36; g.lineCap = "butt"; g.strokeStyle = over.color; g.stroke();
        });
        g.beginPath(); poly(outer); if (hole.length > 4) poly(hole); g.lineWidth = Math.max(1, outline * .9); g.strokeStyle = shade(rb.color, -.6); g.stroke();
        g.beginPath(); g.moveTo(X(T * .9), -ow(T * .9) * .9); g.quadraticCurveTo(X(T * .99), 0, X(T * .9), ow(T * .9) * .9); g.lineWidth = Math.max(1, outline * .8); g.strokeStyle = shade(rb.color, -.45); g.stroke();
        g.restore();
      };
      const ribbonTail = (x, y, ang, len, rb, over) => {
        len *= .7;
        const bw = Math.max(4, RW.base * .55), w0 = bw * .3, w1 = bw * .9, wav = len * .06;
        const pts = [[0, -w0], [len * .5, -w1 / 2 + wav], [len, -w1 / 2], [len * .86, 0], [len, w1 / 2], [len * .5, w1 / 2 + wav], [0, w0]];
        const path = () => { g.beginPath(); pts.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); g.closePath(); };
        g.save(); g.translate(x, y); g.rotate(ang); g.lineJoin = "round";
        path(); g.lineWidth = outline * 3; g.strokeStyle = "#fff"; g.stroke();
        path(); const gb = g.createLinearGradient(0, -w1, 0, w1); gb.addColorStop(0, shade(rb.color, .1)); gb.addColorStop(1, shade(rb.color, -.2)); g.fillStyle = gb; g.fill();
        if (over) { g.beginPath(); g.moveTo(len * .05, 0); g.lineTo(len * .84, wav * .5); g.lineWidth = bw * .3; g.strokeStyle = over.color; g.stroke(); }
        path(); g.lineWidth = Math.max(1, outline * .9); g.strokeStyle = shade(rb.color, -.6); g.stroke();
        g.restore();
      };
      // small accent loops: same shape, narrower ribbon
      const flatLoop = (x, y, ang, len, wid, rb) => ribbonLoop(x, y, ang, len * .8, rb, null);
      if (scene.runsMain && scene.runsMain.length) {
        // OPEN trees: each piece of ribbon is a band with an arrow showing the drape
        const band = (run, w, rb, over) => {
          const path = () => { g.beginPath(); run.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); };
          g.lineCap = "round"; g.lineJoin = "round";
          path(); g.lineWidth = w + outline * 3.2; g.strokeStyle = "#fff"; g.stroke();
          path(); g.lineWidth = w + outline * 1.2; g.strokeStyle = shade(rb.color, -.55); g.stroke();
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
      if (RB.accent) { const keep = RW.base; RW.base = Math.max(3, RW.accent * 1.1); (scene.accentLoops || []).forEach(L => flatLoop(L.x, L.y, L.ang, L.len, L.wid, RB.accent)); RW.base = keep; }
      if (ribbonPlan.kind === "cascade") {
        // Open trees: the bands are the instruction; flower-side loops are mentioned in the text only.
        ribbonPlan.flowerLoops = spots.length;
      } else {
        spots.forEach(sp => {
          // Each cluster is drawn on its own layer, then faded where it goes into the branches,
          // so it reads as ribbon tucked in and poking out, not a bow sitting on top.
          const main = g, sc = layer(W, H), sg = sc.getContext("2d");
          g = sg;
          (scene.loops || []).filter(L => L.tail && L.x === sp.x && L.y === sp.y).slice(0, 1).forEach(L => ribbonTail(sp.x, sp.y, L.ang, L.len, RB.base, RB.overlay));
          sp.loops.slice(0, 2).forEach(L => ribbonLoop(sp.x, sp.y, L.ang, L.len, RB.base, RB.overlay));
          const fr = Math.max(6, RW.base * .9), fade = sg.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, fr);
          fade.addColorStop(0, "rgba(0,0,0,.85)"); fade.addColorStop(1, "rgba(0,0,0,0)");
          sg.globalCompositeOperation = "destination-out"; sg.fillStyle = fade; sg.beginPath(); sg.arc(sp.x, sp.y, fr, 0, TAU); sg.fill();
          g = main; g.drawImage(sc, 0, 0);
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
      if (key === "ribbon") { o.fillStyle = "rgba(0,0,0,.3)"; o.fillRect(0, 0, W, H); }
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
        pill(o, (G.L[0] + G.R[0]) / 2, G.A[1] + G.treeH * .45, data.tree.kind === "artificial" ? "Unfold every branch, then shape each tip" : "Shake out the branches");
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
        list.filter(b => b.cl == null).forEach(b => ring(o, b.x * W, b.y * H, Math.max(3, sizes[b.size] * S.pxIn / 2) + u * .5));
        data.clusters.filter(c => sz.includes(c.size)).forEach((c, i) => {
          const r = ORN_IN(data)[c.size] * S.pxIn / 2 * 3.4, x = c.x * W, y = c.y * H;
          o.save(); o.setLineDash([u * .7, u * .5]); o.lineWidth = Math.max(2, u * .25); o.strokeStyle = "#FFE7A3"; o.beginPath(); o.arc(x, y, r, 0, TAU); o.stroke(); o.restore();
          if (i === 0) pill(o, x, y, `Group of ${c.count}, packed tight`, { align: c.x > .55 ? "right" : "left", gap: r + u, leaderFrom: [x + (c.x > .55 ? -r : r), y] });
        });
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
      const ownedTxt = [b, ov, ac].filter(r => r && r.owned).length ? `Start by taking your existing ${[b, ov, ac].filter(r => r && r.owned).map(r => colorName(r.color) + " " + r.texture).join(" and ")} ribbon off the tree; you'll re-use it here. ` : "";
      const wide = `${b.width_in}" ${colorName(b.color)}`, loopIn = Math.round(b.width_in * 2), n = ribbonPlan.marks.length;
      const overTxt = ov ? ` Lay the ${ov.width_in}" ${colorName(ov.color)} ribbon on top as you go, so each piece is two layers.` : "";
      const acTxt = ac ? ` The thin ${ac.width_in}" ${colorName(ac.color)} ribbon is its own trail: small pieces tucked into the gaps between the numbered spots (the small ${colorName(ac.color)} shapes).` : "";
      if (ribbonPlan.kind === "cascade")
        return ownedTxt + `Each numbered band is one piece of the ${wide} ribbon (${n} pieces). Starting at 1, tuck the top end deep into the tree, let it drape over two or three branches in the direction of the arrow, then tuck the bottom end in and cut. Each new piece starts a little lower and off to the side, never straight down or straight across.` + overTxt + acTxt + (ribbonPlan.flowerLoops ? ` Save some ribbon for a loop or two beside each flower in the flowers step.` : "");
      return ownedTxt + `Work through the ${n} numbered spots from the top down. At each one, make ${ribbonPlan.loopsPerSpot >= 4 ? "three or four" : ribbonPlan.loopsPerSpot >= 3 ? "two or three" : "one or two"} loops of the ${wide} ribbon about ${loopIn}" long, pinch them together, and push the pinched end deep into the branches so the loops pop out. The shapes on the picture show the size and direction.` + overTxt + acTxt;
    }
    function clusterTip(sz) {
      const cs = data.clusters.filter(c => c.size === sz); if (!cs.length) return "";
      return ` Start with the ${cs.length === 1 ? "cluster" : cs.length + " clusters"} in the dashed circles: wire ${cs[0].count} ${colorName(cs[0].color)} ornaments together like a bunch of grapes (twist their hangers together), then tuck the bunch into the branches.`;
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
        medium: "Medium ornaments go around the big ones, in the spots marked. The circles show where a few of them go; spread the rest of each box evenly around the tree. Mix shiny and matte." + clusterTip("m"),
        small: "Fill in around everything with the small ones, tucked in close to the branches. Use them for the accent color or a contrasting finish. Spread each box all the way around the tree." + clusterTip("s"),
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
          out.push({ color: gp.color, text: `${gp.n} × ${Math.round(sizes[gp.size])}" ${gp.finish !== "shiny" ? gp.finish + " " : ""}${colorName(gp.color)} ${shape}${gp.shape === "candy" ? "" : "ornaments"}`.trim() });
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

    // A plain position map for the image model: the photo with soft colored marks where things go.
    function drawMap(o) {
      o.globalAlpha = 1; o.drawImage(img, 0, 0, W, H);
      o.fillStyle = "rgba(255,255,255,.25)"; o.fillRect(0, 0, W, H);
      const u = G.unit, sizes = ORN_IN(data), S = scene;
      // Soft, feathered blobs only: no outlines or rings the image model could copy into the photo
      const blob = (x, y, rx, ry, col, a) => {
        o.save(); o.translate(x, y); o.scale(1, ry / rx);
        const g2 = o.createRadialGradient(0, 0, 0, 0, 0, rx);
        g2.addColorStop(0, rgbaOf(col, a)); g2.addColorStop(.65, rgbaOf(col, a * .85)); g2.addColorStop(1, rgbaOf(col, 0));
        o.fillStyle = g2; o.beginPath(); o.arc(0, 0, rx, 0, TAU); o.fill(); o.restore();
      };
      if (RB.base) ribbonPlan.marks.forEach(([x, y]) => blob(x, y, RW.base * 1.0, RW.base * .7, RB.base.color, .9));
      if (RB.accent) (S.accentLoops || []).forEach((L, i) => { if (i % 2) return; blob(L.x, L.y, Math.max(4, RW.accent), Math.max(3, RW.accent * .8), RB.accent.color, .9); });
      if (data.picks.floral.kind !== "none") S.all.filter(m => m.floral).forEach(m => {
        const fx = m.x + RW.base * .9, fy = m.y + RW.base * .3, r = FLOWER_IN[data.picks.floral.kind] * S.pxIn * .55;
        blob(fx, fy, r, r, data.picks.floral.color, .9); blob(fx, fy, r * .28, r * .28, "#E8C44A", .95);   // flower = color with a yellow center
      });
      data.ornaments.forEach(b => { const r = Math.max(4, sizes[b.size] * S.pxIn / 2 * 1.15); blob(b.x * W, b.y * H, r, r, b.color, .95); });
    }

    const itemsFor = key => key === "all" ? [] : data.plan.filter(p => p.element === key);
    const buy = key => key === "all" ? [] : buyList(data, mode, key);
    return { steps, title: k => STEP_TITLE[k], draw, drawMap: () => drawMap(ctx), lead, legend, itemsFor, buy, data, setAfter: im => { afterImg = im; } };
  }

  window.TreeGuide = { create, normalize, shoppingList };
})();
