// Tree Style step-guide painter. Draws each step of the plan on the person's own photo.
// Ported from the prototype. Exposes window.TreeGuide.
(function(){
  const clamp = (v,a,b) => Math.min(b, Math.max(a, Number(v) || 0));
  const hex = (c, d) => (typeof c === "string" && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c.trim())) ? c.trim() : d;
  const pt = (p, d) => Array.isArray(p) && p.length >= 2 ? [clamp(p[0],0,1), clamp(p[1],0,1)] : d;
  const obj = o => o && typeof o === "object" && !Array.isArray(o) ? o : {};
  const arr = a => Array.isArray(a) ? a : [];
  const str = (s, n) => String(s == null ? "" : s).slice(0, n || 400);
  const oneOf = (v, list, d) => list.includes(String(v || "").toLowerCase()) ? String(v).toLowerCase() : d;
  const RIBBON_TEX = ["satin","velvet","metallic","sheer","plaid","stripe","print","burlap"];
  const PLAN_EL = ["fluff","lights","primary_picks","ribbon","florals","statement","medium","small","small_picks","crown","base"];
  function planEl(p){
    const e = String(p.element || "").toLowerCase().replace(/[\s-]/g, "_");
    if (PLAN_EL.includes(e)) return e;
    const t = (str(p.title) + " " + str(p.how)).toLowerCase();
    if (/fluff|bend|shap/.test(t)) return "fluff";
    if (/light|bulb|strand/.test(t)) return "lights";
    if (/ribbon|bow|loop/.test(t)) return "ribbon";
    if (/topper|crown|star|angel/.test(t)) return "crown";
    if (/berr|spray|small pick/.test(t)) return "small_picks";
    if (/poinsettia|rose|flower|floral|magnolia|orchid|hydrangea/.test(t)) return "florals";
    if (/pick|greenery|pine|cedar|eucalyptus/.test(t)) return "primary_picks";
    if (/skirt|collar|base|basket/.test(t)) return "base";
    if (/large|statement|big|heirloom/.test(t)) return "statement";
    if (/small|fill/.test(t)) return "small";
    return "medium";
  }
  const TAU = Math.PI*2;
  function rng(seed){ return function(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function rgbOf(h){
    const sv = String(h), mm = sv.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (mm) return [+mm[1], +mm[2], +mm[3]];
    let c = sv.replace("#",""); if (c.length < 6) c = c.slice(0,3).split("").map(x => x+x).join(""); const n = parseInt(c.slice(0,6),16) || 0; return [n>>16, n>>8&255, n&255];
  }
  function shade(h, amt){
    const [r,g,b] = rgbOf(h), f = v => Math.round(amt >= 0 ? v + (255-v)*amt : v*(1+amt));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  const sshade = (h, a) => shade(h, clamp(a, -.92, .88));
  function rgba(h, a){ const [r,g,b] = rgbOf(h); return `rgba(${r},${g},${b},${a})`; }
  function layer(W, H){ const c = document.createElement("canvas"); c.width = W; c.height = H; return c; }
  const smooth = (e0, e1, x) => { const t = clamp((x-e0)/(e1-e0), 0, 1); return t*t*(3-2*t); };
  function photoSampler(src, W, H){
    let d = null;
    try { const c = layer(W, H), x = c.getContext("2d", {willReadFrequently: true}); x.drawImage(src, 0, 0, W, H); d = x.getImageData(0, 0, W, H).data; } catch(e){}
    return (x, y) => {
      if (!d) return [34, 64, 44];
      const i = (clamp(Math.round(y), 0, H-1)*W + clamp(Math.round(x), 0, W-1))*4;
      return [d[i], d[i+1], d[i+2]];
    };
  }
  function makeGeo(A, L, R, W, H){
    const treeH = Math.max(40, ((L[1]+R[1])/2) - A[1]), unit = Math.max(W,H)/100;
    const centerAt = y => { const t = clamp((y-A[1])/treeH, 0, 1); return A[0] + t*(((L[0]+R[0])/2) - A[0]); };
    const halfWidthAt = y => { const t = clamp((y-A[1])/treeH, 0, 1); return t*(R[0]-L[0])/2; };
    const inCone = (rand, k) => {
      k = k || .9; let u = rand(), v = rand(); if (u+v > 1){ u = 1-u; v = 1-v; }
      const x = A[0] + u*(L[0]-A[0]) + v*(R[0]-A[0]), y = A[1] + u*(L[1]-A[1]) + v*(R[1]-A[1]);
      const cx = (A[0]+L[0]+R[0])/3, cy = (A[1]+L[1]+R[1])/3;
      return [cx + (x-cx)*k, cy + (y-cy)*(k+.02)];
    };
    const at = (t, k) => { const y = A[1] + t*treeH; return [centerAt(y) + halfWidthAt(y)*k, y]; };
    const into = (x, y, k) => { const yy = clamp(y, A[1] + treeH*.04, A[1] + treeH*.97), hw = halfWidthAt(yy)*(k || .88), c = centerAt(yy); return [clamp(x, c - hw, c + hw), yy]; };
    return {A, L, R, W, H, treeH, unit, centerAt, halfWidthAt, inCone, at, into};
  }
  // Everything the finished picture and the step guide share: positions are
  // worked out once so both views match exactly.
  function buildScene(G, d, sampler){
    const rand = rng(77), hft = d.tree.height_ft || 7;
    const pxIn = G.treeH / (hft*12*.92);
    const S = {pxIn, sample: sampler || (() => [34, 64, 44])};
    const base = d.ribbons.find(r => r.role === "base") || d.ribbons[0] || null;
    const overlay = d.ribbons.find(r => r.role === "overlay" && r !== base) || null;
    const accent = d.ribbons.find(r => r.role === "accent" && r !== base && r !== overlay) || null;
    S.rb = {base, overlay, accent};
    const rw = rb => rb ? Math.max(4, rb.width_in*pxIn) : 0;
    S.rw = {base: rw(base), overlay: rw(overlay), accent: rw(accent)};

    // hidden-vine moments: from the AI when given, otherwise grown here
    let moms = d.moments.map(o => { const [x,y] = G.into(o.x*G.W, o.y*G.H, .86); return {x, y, size: o.size, floral: o.floral}; });
    if (moms.length < 4 && (d.picks.primary.kind !== "none" || base)){
      const n = Math.round(clamp(hft*1.2, 6, 14)); let tries = 0;
      const minD = G.treeH*.11;
      while (moms.length < n && tries++ < 500){
        const t = .26 + .7*Math.pow(rand(), .55), k = (rand()*2-1)*.8, [x,y] = G.at(t, k);
        if (moms.some(o => Math.hypot(o.x-x, o.y-y) < minD)) continue;
        moms.push({x, y, size: t > .7 ? (rand() < .55 ? 3 : 2) : t > .45 ? 2 : 1, floral: rand() < .55});
      }
    }
    // the crown: more gathers toward the top, by style
    const nCrown = {light: 1, medium: 2, full: 4}[d.crown] || 2;
    const crown = [];
    for (let i = 0; i < nCrown; i++){
      const t = .09 + .16*(i/(Math.max(1, nCrown-1))) + rand()*.03, k = nCrown === 1 ? 0 : (i % 2 ? .45 : -.45)*(.6 + rand()*.4);
      const [x,y] = G.at(t, k); crown.push({x, y, size: 1, floral: i % 2 === 0 && !(i === 0 && d.topper.style === "floral"), crown: true});
    }
    S.moments = moms; S.crown = crown;
    const all = moms.concat(crown);
    S.side = o => Math.sign(o.x - G.centerAt(o.y)) || (rand() < .5 ? -1 : 1);

    // ribbon paths
    S.runsMain = []; S.runsAccent = []; S.loops = []; S.accentLoops = [];
    if (base){
      if (d.technique === "cascade"){
        S.runsMain = cascadeRuns(G, rng(11), hft >= 8 ? 3 : 2);
        if (accent) S.runsAccent = cascadeRuns(G, rng(29), 2, true);
      }
      // loops burst out at every moment on dense trees, and pair with the florals on open ones
      all.forEach((o, i) => {
        if (d.technique === "cascade" && !o.floral && !o.crown) return;
        if (o.crown && d.topper.style === "floral") return;
        const side = S.side(o), n = o.crown ? 1 : o.size, Lr = S.rw.base*(o.size >= 3 ? 2.5 : o.size === 2 ? 2.2 : 1.9);
        const out = side > 0 ? .2 : Math.PI - .2, up = -Math.PI/2;
        const angs = [out + side*(rand()-.5)*.3, (out + up)/2 + (rand()-.5)*.3, out + side*.85];
        for (let j = 0; j < n; j++){
          S.loops.push({x: o.x, y: o.y, ang: o.crown ? up + (rand()-.5)*1.4 : angs[j], len: Lr*(.9 + rand()*.2), wid: S.rw.base*(.72 + rand()*.12)});
        }
        if (!o.crown && o.size >= 3) S.loops.push({x: o.x, y: o.y, ang: Math.PI/2 + side*.35, len: S.rw.base*2.4, wid: 0, tail: true});
      });
      if (accent && d.technique === "loops"){
        // the accent ribbon is its own vine: small loops in the spaces between moments
        let tries = 0;
        while (S.accentLoops.length < Math.round(hft*.6)*2 && tries++ < 300){
          const [x,y] = G.inCone(rand, .78);
          if (all.some(o => Math.hypot(o.x-x, o.y-y) < G.treeH*.08)) continue;
          if (S.accentLoops.some(o => Math.hypot(o.x-x, o.y-y) < G.treeH*.13)) continue;
          const side = Math.sign(x - G.centerAt(y)) || 1, Lr = Math.max(S.rw.accent*2.6, S.pxIn*4);
          S.accentLoops.push({x, y, ang: (side > 0 ? .1 : Math.PI - .1) + (rand()-.5)*.8, len: Lr*1.2, wid: S.rw.accent*.8}, {x, y, ang: -Math.PI/2 + side*.6 + (rand()-.5)*.5, len: Lr, wid: S.rw.accent*.75});
        }
      }
    }
    // small picks: generous, everywhere, and tucked beside each floral
    S.berries = [];
    if (d.picks.small.kind !== "none"){
      const n = Math.round(clamp(hft*5, 18, 70));
      for (let i = 0; i < n; i++){ const [x,y] = G.inCone(rand, .9); S.berries.push({x, y, n: 4 + Math.floor(rand()*5)}); }
      all.forEach(o => { if (o.floral){ const s = S.side(o); S.berries.push({x: o.x + s*S.pxIn*5, y: o.y + S.pxIn*3, n: 7}); } });
    }
    S.all = all;
    return S;
  }

  // Waterfall cascades for open trees: down 2-3 branches, cut, restart lower,
  // stepping diagonally, never straight down or straight across.
  function cascadeRuns(G, rand, chains, accent){
    const runs = [];
    for (let c = 0; c < chains; c++){
      let t = (accent ? .2 : .1) + c*.05 + rand()*.05;
      let side = (c % 2 ? 1 : -1) * (accent ? -1 : 1), k = side*(.15 + rand()*.25);
      const drift = (c % 2 ? -1 : 1) * (accent ? -1 : 1);
      while (t < .9){
        const len = .14 + rand()*.08, dk = drift*(.22 + rand()*.18);
        const run = [];
        for (let s = 0; s <= 40; s++){
          const u = s/40, tt = t + u*len;
          const [x, y] = G.at(Math.min(.97, tt), clamp(k + dk*u, -.85, .85));
          run.push([x + Math.sin(u*5 + c)*G.unit*.3, y, .85, side]);
        }
        runs.push(run);
        t += len + .05 + rand()*.06;
        k = k + dk*1.15 + (rand()-.5)*.1;
        if (Math.abs(k) > .75){ k = Math.sign(k)*.75 - Math.sign(k)*(.3 + rand()*.3); }
        side = -side;
      }
    }
    return runs;
  }

  // ---------- ribbon ----------
  function segmentsFromRun(run, Lp, rand){
    const cum = [0];
    for (let i = 1; i < run.length; i++) cum.push(cum[i-1] + Math.hypot(run[i][0]-run[i-1][0], run[i][1]-run[i-1][1]));
    const total = cum[cum.length-1], segs = [], tucks = [];
    if (total < 6) return {segs, tucks};
    let p = 0;
    const at = s => {
      while (p < cum.length-2 && cum[p+1] < s) p++;
      while (p > 0 && cum[p] > s) p--;
      const a = run[p], b = run[p+1], k = clamp((s - cum[p]) / Math.max(1e-6, cum[p+1]-cum[p]), 0, 1);
      return [a[0]+(b[0]-a[0])*k, a[1]+(b[1]-a[1])*k, a[2]+(b[2]-a[2])*k, a[3]];
    };
    const n = Math.max(1, Math.round(total / Lp)), seg = total / n;
    for (let k = 0; k < n; k++){
      const s0 = k*seg, m = Math.max(12, Math.ceil(seg / 2)), lift = seg*(.13 + rand()*.06);
      const C = [];
      for (let j = 0; j <= m; j++){
        const t = j/m, s = s0 + t*seg, a = at(Math.max(0, s-1)), b = at(Math.min(total, s+1)), q = at(s);
        let tx = b[0]-a[0], ty = b[1]-a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        let nx = -ty, ny = tx;
        if (q[3]){ if (Math.sign(nx || 1) !== q[3]*(k % 2 ? -1 : 1)){ nx = -nx; ny = -ny; } }
        else if (ny > 0){ nx = -nx; ny = -ny; }
        const bulge = lift*Math.sin(Math.PI*t);
        C.push({x: q[0] + nx*bulge, y: q[1] + ny*bulge, f: q[2], t, nx, ny});
      }
      segs.push({C, twistAt: rand() < .3 ? .35 + rand()*.35 : -1, sheenAt: .22 + rand()*.16, k});
      if (k === 0) tucks.push([C[0].x, C[0].y]);
      tucks.push([C[m].x, C[m].y]);
    }
    return {segs, tucks};
  }
  function loopC(L){
    const C = [], m = 44, ux = Math.cos(L.ang), uy = Math.sin(L.ang), vx = -uy, vy = ux;
    for (let j = 0; j <= m; j++){
      const t = j/m;
      if (L.tail){
        const u = L.len*t, v = Math.sin(t*Math.PI*1.3)*L.len*.12;
        C.push({x: L.x + ux*u + vx*v, y: L.y + uy*u + vy*v, f: .8, t: .5 + t*.5, nx: vx, ny: vy});
      } else {
        const a = t*TAU, u = L.len*(1 - Math.cos(a))/2, v = L.wid*Math.sin(a)/2;
        C.push({x: L.x + ux*u + vx*v, y: L.y + uy*u + vy*v, f: .95, t, nx: ux, ny: uy});
      }
    }
    return C;
  }

  // One band of wired ribbon along a centreline, shaded by fabric.
  function band(g, C, Wr, rb, rand, opt){
    opt = opt || {};
    const m = C.length - 1, col = rb.color, tex = rb.texture, twistAt = opt.twistAt == null ? -1 : opt.twistAt, sheenAt = opt.sheenAt == null ? .3 : opt.sheenAt;
    const dark = sshade(col, -.58), cream = "#F1E6CC", accent = rb.accent || (rgbOf(col)[0] > rgbOf(col)[1] ? "#1F4A33" : "#7A1E2C");
    const E1 = [], E2 = [], P = [];
    for (let j = 0; j <= m; j++){
      const c = C[j], a = C[Math.max(0, j-1)], b = C[Math.min(m, j+1)];
      let tx = b.x-a.x, ty = b.y-a.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      let nx = -ty, ny = tx; if (ny > 0 || (ny === 0 && nx > 0)){ nx = -nx; ny = -ny; }
      const t = c.t, pinch = opt.tail ? .9 : .34 + .66*Math.pow(Math.sin(Math.PI*t), .55);
      const tw = twistAt < 0 ? 1 : Math.cos(Math.PI*smooth(twistAt-.09, twistAt+.09, t));
      const hw = Wr/2 * pinch * (.75 + .25*clamp(c.f, 0, 1)) * Math.max(.07, Math.abs(tw));
      const ld = -(.6*c.nx + .8*c.ny);
      const occ = opt.tail ? smooth(0, .15, 1-t) + .4 : smooth(0, .17, Math.min(t, 1-t));
      const lit = (.58 + .2*Math.cos(Math.PI*t)*ld + .14*(clamp(c.f, 0, 1) - .6) - (tw < 0 ? .16 : 0)) * (.45 + .55*Math.min(1, occ));
      const spec = (Math.exp(-Math.pow((t - sheenAt)/.075, 2)) + .35*Math.exp(-Math.pow((t - sheenAt - .42)/.05, 2))) * clamp(.4 + .6*ld, 0, 1) * Math.min(1, occ) * (tw < 0 ? .3 : 1);
      E1.push([c.x + nx*hw, c.y + ny*hw]); E2.push([c.x - nx*hw, c.y - ny*hw]);
      P.push({lit, spec});
    }
    let length = 0; for (let j = 1; j <= m; j++) length += Math.hypot(C[j].x-C[j-1].x, C[j].y-C[j-1].y);
    const outline = () => { g.beginPath(); E1.forEach(([x,y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); for (let i = m; i >= 0; i--) g.lineTo(E2[i][0], E2[i][1]); g.closePath(); };
    const quad = j => { g.beginPath(); g.moveTo(E1[j][0], E1[j][1]); g.lineTo(E1[j+1][0], E1[j+1][1]); g.lineTo(E2[j+1][0], E2[j+1][1]); g.lineTo(E2[j][0], E2[j][1]); g.closePath(); };
    const sheer = tex === "sheer";
    g.save();
    if (opt.shadow !== false){
      g.save(); g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = Wr*.7; g.shadowOffsetX = Wr*.12; g.shadowOffsetY = Wr*.35;
      g.globalAlpha = sheer ? .35 : 1; outline(); g.fillStyle = sshade(col, -.5); g.fill(); g.restore();
    }
    if (sheer) g.globalAlpha = .62;
    const L = v => sshade(col, (v - .55)*1.25);
    for (let j = 0; j < m; j++){
      const l = P[j].lit, sp = P[j].spec;
      const gr = g.createLinearGradient(E1[j][0], E1[j][1], E2[j][0], E2[j][1]);
      if (tex === "velvet") [[0,l+.08],[.1,l-.12],[.5,l-.18+.12*sp],[.9,l-.14],[1,l+.02]].forEach(([o,v]) => gr.addColorStop(o, L(v)));
      else if (tex === "metallic"){ const cr = .14*Math.sin(j*1.7 + (opt.k || 0)); [[0,l-.25],[.12,l+cr+.7*sp],[.5,l-cr+.9*sp],[.88,l+cr*.5+.5*sp],[1,l-.3]].forEach(([o,v]) => gr.addColorStop(o, L(v))); }
      else if (tex === "satin" || sheer) [[0,l-.16],[.1,l+.02+.3*sp],[.45,l+.06+.62*sp],[.85,l-.02+.3*sp],[1,l-.24]].forEach(([o,v]) => gr.addColorStop(o, L(v)));
      else [[0,l-.14],[.5,l+.03+.12*sp],[1,l-.2]].forEach(([o,v]) => gr.addColorStop(o, L(v)));
      g.fillStyle = gr; g.strokeStyle = gr; g.lineWidth = .9; g.lineJoin = "round";
      quad(j); g.fill(); if (!sheer) g.stroke();
    }
    const across = (j, a) => [E1[j][0] + (E2[j][0]-E1[j][0])*a, E1[j][1] + (E2[j][1]-E1[j][1])*a];
    const strip = (a0, a1, fill, alpha, op) => {
      g.save(); g.globalAlpha = alpha*(sheer ? .62 : 1); g.globalCompositeOperation = op || "source-over"; g.fillStyle = fill; g.beginPath();
      for (let j = 0; j <= m; j++){ const [x,y] = across(j, a0); j ? g.lineTo(x, y) : g.moveTo(x, y); }
      for (let j = m; j >= 0; j--){ const [x,y] = across(j, a1); g.lineTo(x, y); }
      g.closePath(); g.fill(); g.restore();
    };
    if (tex === "plaid"){
      g.save(); outline(); g.clip();
      strip(.14, .34, dark, .55, "multiply"); strip(.66, .86, dark, .55, "multiply");
      strip(.47, .53, cream, .7); strip(.04, .07, accent, .75); strip(.93, .96, accent, .75);
      let acc = 0;
      for (let j = 1; j <= m; j++){
        acc += Math.hypot(C[j].x-C[j-1].x, C[j].y-C[j-1].y);
        const cyc = (acc % (Wr*1.15)) / (Wr*1.15);
        if (cyc < .24){ g.globalCompositeOperation = "multiply"; g.globalAlpha = .5; g.fillStyle = dark; }
        else if (cyc > .55 && cyc < .59){ g.globalCompositeOperation = "source-over"; g.globalAlpha = .55; g.fillStyle = cream; }
        else continue;
        quad(j-1); g.fill();
      }
      g.restore();
    }
    if (tex === "stripe"){
      g.save(); outline(); g.clip();
      strip(.18, .28, rb.accent || cream, .85); strip(.45, .55, rb.accent || cream, .85); strip(.72, .82, rb.accent || cream, .85);
      g.restore();
    }
    if (tex === "print"){
      // a printed motif: soft scattered marks in the accent color
      g.save(); outline(); g.clip();
      const marks = Math.min(400, Math.round(length/(Wr*.35)));
      for (let i = 0; i < marks; i++){
        const j = Math.floor(rand()*m), [x,y] = across(j, .15 + rand()*.7);
        g.globalAlpha = .7; g.fillStyle = rand() < .6 ? (rb.accent || sshade(col, -.5)) : cream;
        g.beginPath(); g.ellipse(x, y, Wr*(.08 + rand()*.06), Wr*(.03 + rand()*.03), rand()*Math.PI, 0, Math.PI*2); g.fill();
      }
      g.restore();
    }
    if (tex === "burlap"){
      g.save(); outline(); g.clip();
      const dots = Math.min(2500, Math.round(length*Wr*.35));
      for (let i = 0; i < dots; i++){
        const j = Math.floor(rand()*m), [x,y] = across(j, rand());
        g.fillStyle = rand() < .5 ? sshade(col, -.35) : sshade(col, .25); g.globalAlpha = .35 + rand()*.3;
        const len = Wr*.09; rand() < .5 ? g.fillRect(x, y, len, Wr*.025) : g.fillRect(x, y, Wr*.025, len);
      }
      g.restore();
    }
    if (tex === "plaid" || tex === "stripe"){
      g.save(); outline(); g.clip(); g.globalCompositeOperation = "soft-light";
      for (let j = 0; j < m; j++){ g.globalAlpha = clamp(P[j].lit, 0, 1)*.5; g.fillStyle = "#fff"; quad(j); g.fill(); }
      g.restore();
    }
    // wired edges
    if (tex !== "burlap"){
      const edge = (E, c, w, a, inset) => { g.beginPath(); for (let j = 0; j <= m; j++){ const o = E === E1 ? across(j, inset) : across(j, 1-inset); j ? g.lineTo(o[0], o[1]) : g.moveTo(o[0], o[1]); } g.strokeStyle = c; g.lineWidth = w; g.globalAlpha = a*(sheer ? .7 : 1); g.stroke(); };
      g.lineCap = "round"; g.lineJoin = "round";
      edge(E1, sshade(col, sheer ? -.2 : -.55), Math.max(.8, Wr*.05), .7, 0); edge(E2, sshade(col, sheer ? -.25 : -.6), Math.max(.8, Wr*.06), .8, 0);
      if (tex !== "velvet") edge(E1, sshade(col, tex === "metallic" ? .8 : .6), Math.max(.6, Wr*.025), .55, .1);
      g.globalAlpha = 1;
    }
    if (tex === "metallic" && opt.sparkles) for (let i = 0; i < length/(Wr*.5); i++){
      const j = Math.floor(rand()*m); if (P[j].spec < .35) continue;
      const [x,y] = across(j, .15 + rand()*.25); opt.sparkles.push([x, y, Wr*(.04 + rand()*.05)]);
    }
    if (opt.creases !== false){
      [0, m].forEach(j => { const [x1,y1] = E1[j], [x2,y2] = E2[j]; g.strokeStyle = "rgba(0,0,0,.3)"; g.lineWidth = Wr*.1; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); });
    }
    g.restore();
  }

  // Branch tips pulled over a point so whatever is there sits IN the tree.
  function tipsOver(g, pts, size, S, rand, count){
    pts.forEach(([x, y]) => {
      const oc = g.createRadialGradient(x, y, 0, x, y, size);
      oc.addColorStop(0, "rgba(0,0,0,.4)"); oc.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = oc; g.beginPath(); g.arc(x, y, size, 0, TAU); g.fill();
      let [r0, g0, b0] = S.sample(x + (rand()-.5)*size*2, y - size*1.6);
      if (!(g0 >= r0*.85 && (r0+g0+b0) < 420)){ r0 = r0*.25 + 26; g0 = g0*.25 + 52; b0 = b0*.25 + 36; }
      g.lineCap = "round";
      for (let i = 0; i < (count || 7); i++){
        const bx = x + (rand()-.5)*size*1.3, by = y - size*(.1 + rand()*.55);
        const ang = Math.PI/2 + (rand()-.5)*1.9, len = size*(.4 + rand()*.45), dx = Math.cos(ang), dy = Math.sin(ang);
        const jj = .6 + rand()*.35, tone = (v, k) => Math.round(clamp(v*jj*k, 0, 255));
        g.strokeStyle = `rgb(${tone(r0,.75)},${tone(g0,.75)},${tone(b0,.75)})`; g.lineWidth = Math.max(.6, size*.05);
        g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + dx*len, by + dy*len); g.stroke();
        g.lineWidth = Math.max(.5, size*.035);
        for (let s = .15; s <= 1; s += .12){
          const px = bx + dx*len*s, py = by + dy*len*s, nl = size*.15*(1.1 - s*.5), lt = .75 + rand()*.45;
          g.strokeStyle = `rgb(${tone(r0,lt)},${tone(g0,lt)},${tone(b0,lt)})`;
          [-1, 1].forEach(sd => { const a = ang + sd*(.5 + rand()*.6); g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a)*nl, py + Math.sin(a)*nl); g.stroke(); });
        }
      }
    });
  }

  function drawRibbons(g, gl, G, S){
    const rand = rng(7), sparkles = [], tucks = [];
    const {base, overlay, accent} = S.rb;
    if (!base) return {tucks};
    // waterfall cascades (open trees): wide base with the narrower ribbon laid over it
    S.runsMain.forEach(run => {
      const r = segmentsFromRun(run, clamp(G.treeH*.15, S.rw.base*3.2, S.rw.base*5), rand);
      r.segs.forEach(s => {
        band(g, s.C, S.rw.base, base, rand, {twistAt: s.twistAt, sheenAt: s.sheenAt, k: s.k, sparkles});
        if (overlay) band(g, s.C, S.rw.overlay, overlay, rand, {twistAt: s.twistAt, sheenAt: s.sheenAt + .08, k: s.k, sparkles, shadow: true, creases: false});
      });
      tucks.push(...r.tucks);
    });
    // loops bursting out at the moments (dense trees) and beside each floral
    const loopsSorted = S.loops.slice().sort((a, b) => (a.tail ? -1 : 0) - (b.tail ? -1 : 0) || a.y - b.y);
    const inside = (C, rb) => {
      g.save(); g.beginPath(); C.forEach((c, i) => i ? g.lineTo(c.x, c.y) : g.moveTo(c.x, c.y)); g.closePath();
      const cx = C[Math.floor(C.length/2)].x, cy = C[Math.floor(C.length/2)].y, gr = g.createRadialGradient(cx, cy, 0, C[0].x, C[0].y, Math.hypot(cx - C[0].x, cy - C[0].y) || 1);
      gr.addColorStop(0, sshade(rb.color, -.35)); gr.addColorStop(1, sshade(rb.color, -.72));
      g.fillStyle = gr; g.fill(); g.restore();
    };
    loopsSorted.forEach(L => {
      const C = loopC(L), o = {tail: L.tail, sheenAt: .3 + rand()*.1, sparkles, creases: !L.tail};
      if (!L.tail) inside(C, base);
      band(g, C, L.tail ? S.rw.base*.92 : S.rw.base, base, rand, o);
      if (overlay) band(g, C, (L.tail ? .9 : 1)*S.rw.overlay, overlay, rand, Object.assign({}, o, {sheenAt: o.sheenAt + .08, creases: false}));
    });
    const centers = []; S.all.forEach(o => { if (S.loops.some(L => L.x === o.x && L.y === o.y)) centers.push([o.x, o.y]); });
    // the accent ribbon: its own vine
    if (accent){
      S.runsAccent.forEach(run => {
        const r = segmentsFromRun(run, clamp(G.treeH*.11, S.rw.accent*4, S.rw.accent*9), rand);
        r.segs.forEach(s => band(g, s.C, S.rw.accent, accent, rand, {twistAt: s.twistAt, sheenAt: s.sheenAt, k: s.k, sparkles}));
        tucks.push(...r.tucks);
      });
      S.accentLoops.forEach(L => { const C = loopC(L); inside(C, accent); band(g, C, S.rw.accent, accent, rand, {sheenAt: .3, sparkles}); });
    }
    sparkles.forEach(([x,y,r]) => [g, gl].forEach(k => { if (!k) return; k.fillStyle = "rgba(255,252,240,.95)"; k.beginPath(); k.arc(x, y, r, 0, TAU); k.fill(); }));
    tipsOver(g, tucks, S.rw.base*1.05, S, rand);
    // a knot of ribbon where each set of loops meets
    centers.forEach(([x, y]) => {
      const r = S.rw.base*.42, kg = g.createRadialGradient(x - r*.3, y - r*.3, 0, x, y, r);
      kg.addColorStop(0, sshade(base.color, .35)); kg.addColorStop(1, sshade(base.color, -.45));
      g.fillStyle = kg; g.beginPath(); g.ellipse(x, y, r, r*.8, 0, 0, TAU); g.fill();
    });
    return {tucks: tucks.concat(centers)};
  }

  // ---------- greenery picks ----------
  const PICK_COL = {pine: "#3B7550", cedar: "#5E8C45", eucalyptus: "#8FA89C", magnolia: "#2E4A2C"};
  function pickColor(d){
    const f = d.picks.primary.finish;
    if (f === "gold") return "#C9A048"; if (f === "silver") return "#C4C9CE";
    return PICK_COL[d.picks.primary.kind] || PICK_COL.pine;
  }
  function sprig(g, x, y, ang, len, kind, col, frost, rand){
    const dx = Math.cos(ang), dy = Math.sin(ang);
    g.lineCap = "round";
    g.strokeStyle = sshade(col, -.45); g.lineWidth = Math.max(.8, len*.035);
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + dx*len*.5 - dy*len*.08, y + dy*len*.5 + dx*len*.08, x + dx*len, y + dy*len); g.stroke();
    const P = s => [x + dx*len*s - dy*len*.08*Math.sin(Math.PI*s), y + dy*len*s + dx*len*.08*Math.sin(Math.PI*s)];
    if (kind === "eucalyptus"){
      for (let s = .12; s <= 1; s += .14){
        const [px, py] = P(s), r = len*.075*(1.15 - s*.4);
        [-1, 1].forEach((sd, i) => {
          if ((s*7|0) % 2 === i) return;
          const lx = px - dy*sd*r*1.1, ly = py + dx*sd*r*1.1, gr = g.createRadialGradient(lx - r*.3, ly - r*.3, 0, lx, ly, r);
          gr.addColorStop(0, sshade(col, .3)); gr.addColorStop(1, sshade(col, -.25));
          g.fillStyle = gr; g.beginPath(); g.ellipse(lx, ly, r, r*.85, ang, 0, TAU); g.fill();
        });
      }
      return;
    }
    if (kind === "magnolia"){
      for (let i = 0; i < 4; i++){
        const s = .3 + i*.18, [px, py] = P(s), sd = i % 2 ? 1 : -1, a = ang + sd*(.55 + rand()*.25), ll = len*.42, lw = ll*.32;
        const flip = rand() < .35, cx = px + Math.cos(a)*ll*.5, cy = py + Math.sin(a)*ll*.5;
        g.save(); g.translate(cx, cy); g.rotate(a);
        const gr = g.createLinearGradient(0, -lw, 0, lw);
        if (flip){ gr.addColorStop(0, "#9A6A3F"); gr.addColorStop(1, "#5E3E22"); } else { gr.addColorStop(0, sshade(col, .25)); gr.addColorStop(.5, col); gr.addColorStop(1, sshade(col, -.4)); }
        g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, ll/2, lw/2, 0, 0, TAU); g.fill();
        g.strokeStyle = flip ? "rgba(255,230,200,.35)" : "rgba(255,255,255,.25)"; g.lineWidth = Math.max(.5, lw*.06);
        g.beginPath(); g.moveTo(-ll*.45, 0); g.lineTo(ll*.45, 0); g.stroke();
        if (!flip){ g.fillStyle = "rgba(255,255,255,.18)"; g.beginPath(); g.ellipse(-ll*.1, -lw*.18, ll*.25, lw*.12, 0, 0, TAU); g.fill(); }
        g.restore();
      }
      return;
    }
    const step = kind === "cedar" ? .05 : .065, nl0 = kind === "cedar" ? .1 : .17, spread = kind === "cedar" ? 1.15 : .75;
    for (let s = .08; s <= 1; s += step){
      const [px, py] = P(s), nl = len*nl0*(1.1 - s*.45), lt = .9 + rand()*.45;
      g.lineWidth = Math.max(.7, len*.024);
      [-1, 1].forEach(sd => {
        const a = ang + sd*(spread + (rand()-.5)*.25);
        g.strokeStyle = sshade(col, (lt-1)*.9 + (sd < 0 ? .06 : -.06));
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a)*nl, py + Math.sin(a)*nl); g.stroke();
        if (frost && s > .35 && rand() < .7){ g.strokeStyle = "rgba(250,250,248,.9)"; g.beginPath(); g.moveTo(px + Math.cos(a)*nl*.45, py + Math.sin(a)*nl*.45); g.lineTo(px + Math.cos(a)*nl, py + Math.sin(a)*nl); g.stroke(); }
      });
    }
  }
  function sprays(g, G, S, d, o, rand){
    const kind = d.picks.primary.kind === "none" ? "pine" : d.picks.primary.kind, col = pickColor(d), metal = /gold|silver/.test(d.picks.primary.finish);
    const frost = d.picks.primary.finish === "frosted" || (d.tree.flocked && d.picks.primary.finish === "natural");
    const side = S.side(o), n = o.crown ? 6 : 3 + o.size*2, edge = clamp(Math.abs(o.x - G.centerAt(o.y)) / Math.max(1, G.halfWidthAt(o.y)), 0, 1);
    const len0 = S.pxIn*(o.crown ? 11 : 8 + o.size*2.5)*(1 - edge*.45);
    const outA = o.crown ? -Math.PI/2 : side > 0 ? .3 : Math.PI - .3;
    g.save(); g.shadowColor = "rgba(0,0,0,.3)"; g.shadowBlur = len0*.08; g.shadowOffsetY = len0*.04;
    for (let i = 0; i < n; i++){
      const a = outA + (rand()-.5)*(o.crown ? 2.2 : 2.6) + (o.crown ? 0 : side*(i % 3 === 0 ? -.4 : 0));
      const len = len0*(.7 + rand()*.5);
      sprig(g, o.x + (rand()-.5)*len0*.15, o.y + (rand()-.5)*len0*.15, a, len, kind, metal ? (rand() < .5 ? col : sshade(col, .25)) : sshade(col, (rand()-.5)*.2), frost, rand);
    }
    g.restore();
    if (metal){   // a few glints on metallic picks
      for (let i = 0; i < 6; i++){ const a = outA + (rand()-.5)*2.4, r = len0*(.3 + rand()*.6); g.fillStyle = "rgba(255,250,230,.85)"; g.beginPath(); g.arc(o.x + Math.cos(a)*r, o.y + Math.sin(a)*r, Math.max(.8, len0*.02), 0, TAU); g.fill(); }
    }
  }

  // ---------- florals ----------
  function petal(g, x, y, a, len, w, col, tipShade){
    g.save(); g.translate(x, y); g.rotate(a);
    const gr = g.createLinearGradient(0, 0, len, 0);
    gr.addColorStop(0, sshade(col, -.4)); gr.addColorStop(.45, col); gr.addColorStop(1, sshade(col, tipShade == null ? .12 : tipShade));
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len*.45, -w, len, 0); g.quadraticCurveTo(len*.45, w, 0, 0); g.fill();
    g.strokeStyle = "rgba(0,0,0,.16)"; g.lineWidth = Math.max(.5, w*.06); g.beginPath(); g.moveTo(len*.12, 0); g.lineTo(len*.85, 0); g.stroke();
    g.restore();
  }
  function flower(g, kind, x, y, D, col, rand){
    const R = D/2;
    g.save(); g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = R*.35; g.shadowOffsetY = R*.15;
    if (kind === "poinsettia"){
      g.fillStyle = sshade(col, -.5); g.beginPath(); g.arc(x, y, R*.5, 0, TAU); g.fill();
      g.shadowColor = "transparent";
      [0, 1].forEach(L => {
        const n = 7, rot = rand()*TAU + L*Math.PI/7, len = R*(L ? .66 : 1), w = len*.34;
        for (let i = 0; i < n; i++) petal(g, x, y, rot + i*TAU/n + (rand()-.5)*.18, len*(.9 + rand()*.15), w, L ? sshade(col, .06) : col);
      });
      for (let i = 0; i < 7; i++){ const a = rand()*TAU, r = rand()*R*.13; g.fillStyle = i % 2 ? "#C7C43A" : "#6E8A2A"; g.beginPath(); g.arc(x + Math.cos(a)*r, y + Math.sin(a)*r, R*.045, 0, TAU); g.fill(); g.strokeStyle = "rgba(160,20,20,.7)"; g.lineWidth = R*.015; g.stroke(); }
    } else if (kind === "rose"){
      for (let i = 0; i < 6; i++){ const a = i*TAU/6 + rand()*.4; const gr = g.createRadialGradient(x, y, R*.2, x, y, R); gr.addColorStop(0, sshade(col, -.3)); gr.addColorStop(1, sshade(col, .1));
        g.fillStyle = gr; g.beginPath(); g.ellipse(x + Math.cos(a)*R*.42, y + Math.sin(a)*R*.42, R*.55, R*.45, a, 0, TAU); g.fill(); }
      g.shadowColor = "transparent";
      for (let i = 0; i < 16; i++){
        const a = i*.95, rr = R*(.62 - i*.036);
        g.strokeStyle = sshade(col, -.35 + (i % 3)*.12); g.lineWidth = R*.1;
        g.beginPath(); g.arc(x + Math.cos(a)*R*.03, y + Math.sin(a)*R*.03, Math.max(.5, rr), a, a + 2.4); g.stroke();
        g.strokeStyle = rgba("#ffffff", .18); g.lineWidth = R*.03; g.beginPath(); g.arc(x, y, Math.max(.5, rr), a + .2, a + 1.2); g.stroke();
      }
    } else if (kind === "magnolia"){
      const pc = col || "#F1E8D6";
      for (let i = 0; i < 6; i++){
        const a = i*TAU/6 + rand()*.3 - Math.PI/2;
        g.save(); g.translate(x, y); g.rotate(a);
        const gr = g.createLinearGradient(0, 0, R, 0); gr.addColorStop(0, sshade(pc, -.3)); gr.addColorStop(.6, pc); gr.addColorStop(1, sshade(pc, .3));
        g.fillStyle = gr; g.beginPath(); g.ellipse(R*.48, 0, R*.5, R*.36, 0, 0, TAU); g.fill();
        g.fillStyle = "rgba(190,120,110,.18)"; g.beginPath(); g.ellipse(R*.25, 0, R*.25, R*.18, 0, 0, TAU); g.fill();
        g.restore();
      }
      g.shadowColor = "transparent";
      const cg = g.createRadialGradient(x - R*.05, y - R*.05, 0, x, y, R*.2); cg.addColorStop(0, "#D9D07A"); cg.addColorStop(1, "#7E7A2E");
      g.fillStyle = cg; g.beginPath(); g.ellipse(x, y, R*.16, R*.2, 0, 0, TAU); g.fill();
    } else if (kind === "hydrangea"){
      for (let i = 0; i < 70; i++){
        const a = rand()*TAU, rr = Math.sqrt(rand())*R*.9, fx = x + Math.cos(a)*rr, fy = y + Math.sin(a)*rr, fr = R*.13;
        const lit = -(fx-x)*.5 - (fy-y)*.8; const c = sshade(col, clamp(lit/R*.5, -.4, .35) - rr/R*.15);
        g.fillStyle = c;
        for (let k = 0; k < 4; k++){ const pa = k*TAU/4 + i; g.beginPath(); g.arc(fx + Math.cos(pa)*fr*.5, fy + Math.sin(pa)*fr*.5, fr*.45, 0, TAU); g.fill(); }
        if (i === 0) g.shadowColor = "transparent";
      }
    } else if (kind === "orchid"){
      [[0,0],[R*.7,R*.55],[-R*.6,R*.65]].forEach(([ox, oy], k) => {
        const cx = x + ox, cy = y + oy, r = R*(.55 - k*.08);
        for (let i = 0; i < 5; i++){ const a = -Math.PI/2 + i*TAU/5; g.fillStyle = sshade(col, .15 - (i % 2)*.1); g.beginPath(); g.ellipse(cx + Math.cos(a)*r*.5, cy + Math.sin(a)*r*.5, r*.5, r*.28, a, 0, TAU); g.fill(); }
        g.fillStyle = sshade(col, -.35); g.beginPath(); g.ellipse(cx, cy + r*.25, r*.22, r*.18, 0, 0, TAU); g.fill();
        g.fillStyle = "#F5E27A"; g.beginPath(); g.arc(cx, cy, r*.08, 0, TAU); g.fill();
      });
    }
    g.restore();
  }
  const FLOWER_IN = {poinsettia: 9, rose: 5.5, magnolia: 8, hydrangea: 7, orchid: 4.5};

  // ---------- berries and small picks ----------
  function berryCluster(g, x, y, br, col, n, rand){
    g.strokeStyle = "rgba(70,45,30,.85)"; g.lineWidth = Math.max(.5, br*.18); g.lineCap = "round";
    const pts = [];
    for (let i = 0; i < n; i++){ const a = rand()*TAU, r = br*(.6 + rand()*1.6); pts.push([x + Math.cos(a)*r, y + Math.sin(a)*r*.8]); }
    pts.forEach(([px, py]) => { g.beginPath(); g.moveTo(x, y + br*1.5); g.quadraticCurveTo((x+px)/2 + br*.4, (y+py)/2 + br, px, py); g.stroke(); });
    pts.forEach(([px, py]) => {
      const gr = g.createRadialGradient(px - br*.3, py - br*.35, 0, px, py, br);
      gr.addColorStop(0, sshade(col, .45)); gr.addColorStop(.5, col); gr.addColorStop(1, sshade(col, -.5));
      g.fillStyle = gr; g.beginPath(); g.arc(px, py, br, 0, TAU); g.fill();
      g.fillStyle = "rgba(255,255,255,.75)"; g.beginPath(); g.arc(px - br*.35, py - br*.35, br*.22, 0, TAU); g.fill();
    });
  }
  function spraySmall(g, x, y, len, col, rand){
    g.strokeStyle = "rgba(90,80,60,.7)"; g.lineWidth = Math.max(.4, len*.012);
    for (let i = 0; i < 7; i++){
      const a = -Math.PI/2 + (rand()-.5)*2.2, l = len*(.5 + rand()*.5), ex = x + Math.cos(a)*l, ey = y + Math.sin(a)*l;
      g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
      for (let k = 0; k < 5; k++){ g.fillStyle = sshade(col, (rand()-.5)*.3); g.beginPath(); g.arc(ex + (rand()-.5)*len*.12, ey + (rand()-.5)*len*.12, Math.max(.6, len*.03), 0, TAU); g.fill(); }
    }
  }

  // ---------- ornaments ----------
  const ORN_IN = d => ({xl: Math.round(clamp((d.tree.height_ft || 7) + 2, 6, 14)), l: 5, m: 3, s: 2});
  function ornPath(g, shape, x, y, r){
    g.beginPath();
    if (shape === "drop"){
      g.moveTo(x, y + r*1.75);
      g.bezierCurveTo(x + r*.35, y + r*1.2, x + r*1.05, y + r*.55, x + r, y);
      g.arc(x, y, r, 0, Math.PI, true);
      g.bezierCurveTo(x - r*1.05, y + r*.55, x - r*.35, y + r*1.2, x, y + r*1.75);
    } else if (shape === "finial"){
      g.moveTo(x, y + r*2.7);
      g.bezierCurveTo(x + r*.12, y + r*1.7, x + r*.95, y + r*.8, x + r*.9, y);
      g.arc(x, y, r*.9, 0, Math.PI, true);
      g.bezierCurveTo(x - r*.95, y + r*.8, x - r*.12, y + r*1.7, x, y + r*2.7);
    } else if (shape === "geometric"){
      [[0,-1.05],[.9,-.35],[.75,.55],[0,1.35],[-.75,.55],[-.9,-.35]].forEach(([a,b], i) => i ? g.lineTo(x + a*r, y + b*r) : g.moveTo(x + a*r, y + b*r));
    } else g.arc(x, y, r, 0, TAU);
    g.closePath();
  }
  function drawOrnament(g, gl, o, x, y, r, lc, rand){
    const col = o.color, shape = o.shape, finish = o.finish;
    if (shape === "candy"){
      const w = r*.42, top = y - r*1.1, bot = y + r*1.9, hr = r*.55;
      const path = () => { g.beginPath(); g.moveTo(x, bot); g.lineTo(x, top); g.arc(x - hr, top, hr, 0, Math.PI, true); };
      g.save(); g.lineCap = "round"; g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = w; g.shadowOffsetY = w*.4;
      path(); g.strokeStyle = "#F4F1EA"; g.lineWidth = w; g.stroke(); g.restore();
      g.save(); g.lineCap = "butt"; path(); g.setLineDash([w*.75, w*.75]); g.strokeStyle = col; g.lineWidth = w; g.stroke(); g.restore();
      g.save(); g.lineCap = "round"; g.beginPath(); g.moveTo(x - w*.22, bot - w*.3); g.lineTo(x - w*.22, top); g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = w*.18; g.stroke(); g.restore();
      return;
    }
    const sh = g.createRadialGradient(x+r*.25, y+r*.55, r*.1, x+r*.25, y+r*.55, r*1.6);
    sh.addColorStop(0, "rgba(0,0,0,.5)"); sh.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = sh; g.beginPath(); g.arc(x+r*.25, y+r*.55, r*1.6, 0, TAU); g.fill();
    g.strokeStyle = "rgba(200,180,130,.85)"; g.lineWidth = Math.max(1, r*.05);
    g.beginPath(); g.moveTo(x, y-r*1.15); g.quadraticCurveTo(x+r*.25, y-r*1.55, x+r*.08, y-r*1.95); g.stroke();
    if (shape === "geometric"){
      const P = [[0,-1.05],[.9,-.35],[.75,.55],[0,1.35],[-.75,.55],[-.9,-.35]].map(([a,b]) => [x + a*r, y + b*r]);
      for (let i = 0; i < 6; i++){
        const p = P[i], q = P[(i+1)%6], mx = (p[0]+q[0])/2 - x, my = (p[1]+q[1])/2 - y, ml = Math.hypot(mx, my) || 1;
        const lit = (-.6*mx - .8*my)/ml;
        g.fillStyle = sshade(col, finish === "matte" ? lit*.3 : lit*.55);
        g.beginPath(); g.moveTo(x, y + r*.1); g.lineTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.closePath(); g.fill();
      }
      g.strokeStyle = finish === "matte" ? "rgba(0,0,0,.15)" : "rgba(255,255,255,.35)"; g.lineWidth = Math.max(.5, r*.03);
      ornPath(g, shape, x, y, r); g.stroke();
      if (finish !== "matte"){ gl.fillStyle = "rgba(255,255,255,.7)"; gl.beginPath(); gl.arc(x - r*.4, y - r*.5, r*.1, 0, TAU); gl.fill(); }
    } else {
      const b = g.createRadialGradient(x-r*.32, y-r*.38, r*.05, x, y + (shape === "ball" ? 0 : r*.4), r*(shape === "ball" ? 1 : 1.6));
      if (finish === "matte"){ b.addColorStop(0, shade(col,.28)); b.addColorStop(.55, col); b.addColorStop(1, shade(col,-.6)); }
      else { b.addColorStop(0, shade(col,.42)); b.addColorStop(.3, col); b.addColorStop(.82, shade(col,-.55)); b.addColorStop(1, shade(col,-.22)); }
      g.fillStyle = b; ornPath(g, shape, x, y, r); g.fill();
      g.save(); ornPath(g, shape, x, y, r); g.clip();
      const bo = g.createRadialGradient(x+r*.2, y+r*1.1, 0, x+r*.2, y+r*1.1, r*.9);
      bo.addColorStop(0, rgba(lc,.35)); bo.addColorStop(1, rgba(lc,0));
      g.fillStyle = bo; g.fillRect(x-r, y-r, r*2, r*3);
      if (finish === "glitter"){
        const dots = Math.min(700, Math.round(r*r*1.1)), d0 = Math.max(1, r*.07);
        for (let i = 0; i < dots; i++){
          const a = rand()*TAU, dd = Math.sqrt(rand())*r*1.3, px = x + Math.cos(a)*dd, py = y + Math.sin(a)*dd + r*.2;
          const lit = -(px-x)*.6 - (py-y)*.7 > 0;
          g.fillStyle = rand() < .22 ? "rgba(255,255,240,.95)" : (lit ? shade(col,.55) : shade(col,-.3));
          g.fillRect(px, py, d0, d0);
        }
      }
      if (shape !== "ball"){ g.strokeStyle = finish === "matte" ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.3)"; g.lineWidth = r*.08; g.beginPath(); g.moveTo(x - r*.45, y - r*.2); g.quadraticCurveTo(x - r*.5, y + r*.9, x - r*.08, y + r*(shape === "finial" ? 2.3 : 1.5)); g.stroke(); }
      if (finish !== "matte"){
        g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.ellipse(x, y+r*.55, r*1.1, r*.5, 0, 0, TAU); g.fill();
        g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.ellipse(x-r*.38, y-r*.42, r*.26, r*.16, -.7, 0, TAU); g.fill();
        g.fillStyle = "rgba(255,255,255,.95)"; g.beginPath(); g.arc(x-r*.42, y-r*.46, r*.07, 0, TAU); g.fill();
        for (let i = 0; i < 4; i++){ const a = -2.4 + rand()*1.6, dd = r*(.55 + rand()*.3); g.fillStyle = rgba(lc,.9); g.beginPath(); g.arc(x + Math.cos(a)*dd, y + Math.sin(a)*dd, Math.max(.8, r*.035), 0, TAU); g.fill(); }
        gl.fillStyle = "rgba(255,255,255,.8)"; gl.beginPath(); gl.arc(x-r*.42, y-r*.46, r*.12, 0, TAU); gl.fill();
      } else {
        g.fillStyle = "rgba(255,255,255,.12)"; g.beginPath(); g.ellipse(x-r*.3, y-r*.35, r*.45, r*.32, -.7, 0, TAU); g.fill();
      }
      g.restore();
    }
    const cw = r*.5, ch = r*.32, ct = y - r*(shape === "geometric" ? 1.25 : 1.16);
    const mg = g.createLinearGradient(x-cw/2, 0, x+cw/2, 0);
    mg.addColorStop(0, "#6E5626"); mg.addColorStop(.35, "#F3DDA0"); mg.addColorStop(.6, "#B8913F"); mg.addColorStop(1, "#5A4520");
    g.fillStyle = mg; g.fillRect(x-cw/2, ct, cw, ch);
    g.fillStyle = "rgba(0,0,0,.25)"; for (let i = 1; i < 4; i++) g.fillRect(x - cw/2 + cw*i/4, ct, Math.max(.6, r*.025), ch);
    g.fillStyle = mg; g.beginPath(); g.ellipse(x, ct, cw/2, ch*.22, 0, 0, TAU); g.fill();
  }

  // ---------- topper ----------
  function drawTopper(g, gl, G, S, d, rand){
    // When the tree reaches the top of the photo, there's no room above it: lower the topper (and keep it
    // a touch smaller) so the whole thing stays in the picture instead of being cut off.
    const tp = d.topper, x = G.A[0], col = tp.color, room = G.A[1];
    const reach = tp.style === "finial" ? 1.8 : tp.style === "star" ? 1.15 : .55;   // how far above y it draws, in s
    let s = Math.max(G.unit*3.6, G.treeH*.075);
    if (room < s*(.55 + reach) + 6) s = Math.max(G.unit*2.8, Math.min(s, G.treeH*.06));
    const dy = Math.max(0, s*(.55 + reach) + s*.12 - room);
    const y = G.A[1] - s*.55 + dy;
    if (tp.style === "none") return;
    if (tp.style === "floral"){
      const o = {x, y: G.A[1] + s*.2, size: 3, crown: true, floral: true};
      sprays(g, G, S, d, Object.assign({}, o, {y: o.y - s*.2}), rand);
      if (S.rb.base){ [-1, 0, 1].forEach(k => band(g, loopC({x: o.x, y: o.y, ang: -Math.PI/2 + k*.9, len: S.rw.base*2.2, wid: S.rw.base*.75}), S.rw.base, S.rb.base, rand, {sheenAt: .3})); }
      const kind = d.picks.floral.kind === "none" ? "rose" : d.picks.floral.kind, D = FLOWER_IN[kind]*S.pxIn*1.2;
      flower(g, kind, o.x - D*.45, o.y + D*.1, D, col, rand); flower(g, kind, o.x + D*.45, o.y + D*.05, D*.9, col, rand); flower(g, kind, o.x, o.y - D*.35, D*1.05, col, rand);
      if (d.picks.small.kind !== "none") berryCluster(g, o.x + D*.9, o.y + D*.5, S.pxIn*.4, d.picks.small.color, 8, rand);
      return;
    }
    const halo = g.createRadialGradient(x, y, 0, x, y, s*2.4);
    halo.addColorStop(0, rgba(col,.4)); halo.addColorStop(1, rgba(col,0));
    g.save(); g.globalCompositeOperation = "screen"; g.fillStyle = halo; g.beginPath(); g.arc(x, y, s*2.4, 0, TAU); g.fill(); g.restore();
    if (tp.style === "finial"){
      const h = s*2.6, b0 = G.A[1] + s*.3 + dy;
      g.save(); g.shadowColor = "rgba(0,0,0,.4)"; g.shadowBlur = s*.2;
      g.beginPath(); g.moveTo(x, b0 - h); g.bezierCurveTo(x + s*.12, b0 - h*.55, x + s*.55, b0 - h*.35, x + s*.42, b0 - h*.2);
      g.bezierCurveTo(x + s*.3, b0 - h*.05, x + s*.12, b0, x, b0); g.bezierCurveTo(x - s*.12, b0, x - s*.3, b0 - h*.05, x - s*.42, b0 - h*.2);
      g.bezierCurveTo(x - s*.55, b0 - h*.35, x - s*.12, b0 - h*.55, x, b0 - h); g.closePath();
      const fg = g.createLinearGradient(x - s*.5, 0, x + s*.5, 0); fg.addColorStop(0, sshade(col, -.5)); fg.addColorStop(.35, sshade(col, .5)); fg.addColorStop(.6, col); fg.addColorStop(1, sshade(col, -.55));
      g.fillStyle = fg; g.fill(); g.restore();
      gl.fillStyle = "rgba(255,255,255,.8)"; gl.beginPath(); gl.arc(x - s*.15, b0 - h*.3, s*.08, 0, TAU); gl.fill();
      return;
    }
    if (tp.style === "bow"){
      g.save(); g.shadowColor = "rgba(0,0,0,.4)"; g.shadowBlur = s*.2; g.shadowOffsetY = s*.08;
      [-1, 1].forEach(dd => {
        const tg = g.createLinearGradient(x, y, x + dd*s*.6, y + s*1.5);
        tg.addColorStop(0, shade(col,-.1)); tg.addColorStop(1, shade(col,-.45)); g.fillStyle = tg;
        g.beginPath(); g.moveTo(x - dd*s*.05, y); g.quadraticCurveTo(x + dd*s*.5, y + s*.6, x + dd*s*.45, y + s*1.5);
        g.lineTo(x + dd*s*.62, y + s*1.32); g.lineTo(x + dd*s*.78, y + s*1.45);
        g.quadraticCurveTo(x + dd*s*.72, y + s*.6, x + dd*s*.18, y); g.closePath(); g.fill();
      });
      [-1, 1].forEach(dd => {
        const lx = x + dd*s*.62, lg = g.createRadialGradient(lx - dd*s*.15, y - s*.18, s*.05, lx, y, s*.7);
        lg.addColorStop(0, shade(col,.45)); lg.addColorStop(.5, col); lg.addColorStop(1, shade(col,-.5));
        g.fillStyle = lg; g.beginPath(); g.ellipse(lx, y, s*.66, s*.4, dd*.3, 0, TAU); g.fill();
        g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(x + dd*s*.42, y + s*.02, s*.22, s*.12, dd*.3, 0, TAU); g.fill();
      });
      g.restore();
      const kg = g.createRadialGradient(x - s*.06, y - s*.08, 0, x, y, s*.24);
      kg.addColorStop(0, shade(col,.4)); kg.addColorStop(1, shade(col,-.4));
      g.fillStyle = kg; g.beginPath(); g.ellipse(x, y, s*.2, s*.24, 0, 0, TAU); g.fill();
      return;
    }
    const pts = [];
    for (let i = 0; i < 10; i++){ const a = -Math.PI/2 + i*Math.PI/5, rr = i % 2 ? s*.42 : s; pts.push([x + Math.cos(a)*rr, y + Math.sin(a)*rr]); }
    g.save(); g.shadowColor = "rgba(0,0,0,.4)"; g.shadowBlur = s*.25; g.shadowOffsetY = s*.08;
    g.fillStyle = shade(col,-.2); g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill(); g.restore();
    for (let i = 0; i < 10; i++){
      const p = pts[i], q = pts[(i+1)%10], O = i % 2 ? q : p, I = i % 2 ? p : q;
      const rx = O[0]-x, ry = O[1]-y, rl = Math.hypot(rx, ry), ux = rx/rl, uy = ry/rl;
      const ix = I[0]-x, iy = I[1]-y, dot = ix*ux + iy*uy;
      let nx = ix - dot*ux, ny = iy - dot*uy; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const lit = nx*-.6 + ny*-.8;
      g.fillStyle = shade(col, lit > 0 ? lit*.55 : lit*.45);
      g.beginPath(); g.moveTo(x, y); g.lineTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.closePath(); g.fill();
    }
    [g, gl].forEach(k => {
      k.save(); k.globalCompositeOperation = "screen"; k.translate(x - s*.2, y - s*.25);
      [0, Math.PI/2].forEach(a => {
        k.rotate(a);
        const f = k.createLinearGradient(-s*1.4, 0, s*1.4, 0);
        f.addColorStop(0, "rgba(255,240,200,0)"); f.addColorStop(.5, "rgba(255,250,235,.9)"); f.addColorStop(1, "rgba(255,240,200,0)");
        k.fillStyle = f; k.fillRect(-s*1.4, -s*.03, s*2.8, s*.06);
      });
      k.restore();
    });
  }

  // ---------- drawing groups, in the designer's order ----------
  const MULTI = ["#FF4A3D","#3FB653","#3C78FF","#FFB21F","#E447C8","#FFE8B0"];
  function drawGroup(name, g, gl, G, S, d, forPlan){
    const W = G.W, H = G.H, u = G.unit;
    if (name === "lights"){
      if (!d.lights.add) return false;
      const rand = rng(31), n = {light:110, medium:180, heavy:260}[d.lights.density] || 180;
      const cols = d.lights.kind === "multicolor" ? MULTI : [d.lights.kind === "solid" ? d.lights.color : (d.lights.color || "#FFD28A")];
      g.save(); g.globalCompositeOperation = forPlan ? "lighter" : "screen";
      for (let i = 0; i < n; i++){
        const [x,y] = G.inCone(rand, .93), lc = cols[Math.floor(rand()*cols.length)], r = u*.16*(.65 + rand()*.5);
        const targets = forPlan ? [[g, 4, .7]] : [[g, 2.8, .75], [gl, 4, .5]];
        targets.forEach(([k, spread, a]) => {
          const h = k.createRadialGradient(x, y, 0, x, y, r*spread);
          h.addColorStop(0, "rgba(255,250,235,.95)"); h.addColorStop(.25, rgba(lc, a)); h.addColorStop(1, rgba(lc, 0));
          k.fillStyle = h; k.beginPath(); k.arc(x, y, r*spread, 0, TAU); k.fill();
        });
      }
      g.restore();
      return true;
    }
    const lc = d.lights.kind === "warm" ? d.lights.color : "#FFD28A";
    const sizes = ORN_IN(d), R = o => Math.max(3, sizes[o.size]*S.pxIn/2);
    const ornGroup = sz => {
      const list = d.ornaments.filter(o => sz.includes(o.size)).sort((a, b) => a.y - b.y);
      if (!list.length) return false;
      const rand = rng(40 + sz.length);
      list.forEach(o => {
        const x = o.x*W, y = o.y*H, r = R(o);
        drawOrnament(g, gl, o, x, y, r, lc, rand);
        if (o.size === "xl") tipsOver(g, [[x - r*.85, y + r*.2], [x + r*.9, y - r*.1]], r*.75, S, rand, 5);   // pushed deep into the branches
      });
      return true;
    };
    if (name === "statement") return ornGroup(["xl", "l"]);
    if (name === "medium") return ornGroup(["m"]);
    if (name === "small") return ornGroup(["s"]);
    if (name === "primary_picks"){
      if (d.picks.primary.kind === "none" || !S.all.length) return false;
      const rand = rng(51); S.all.slice().sort((a, b) => a.y - b.y).forEach(o => sprays(g, G, S, d, o, rand));
      return true;
    }
    if (name === "ribbon"){
      if (!S.rb.base) return false;
      S.ribbonOut = drawRibbons(g, gl, G, S); return true;
    }
    if (name === "florals"){
      const kind = d.picks.floral.kind; if (kind === "none") return false;
      const rand = rng(61), list = S.all.filter(o => o.floral);
      if (!list.length) return false;
      list.sort((a, b) => a.y - b.y).forEach(o => {
        const side = S.side(o), D = FLOWER_IN[kind]*S.pxIn*(o.size >= 3 ? 1.1 : o.size === 1 ? .8 : 1);
        flower(g, kind, o.x + side*D*.15, o.y - D*.1, D, d.picks.floral.color, rand);
        if (o.size >= 3) flower(g, kind, o.x - side*D*.55, o.y + D*.35, D*.8, d.picks.floral.color, rand);
      });
      return true;
    }
    if (name === "small_picks"){
      if (!S.berries.length) return false;
      const rand = rng(71), br = Math.max(1.2, S.pxIn*.35);
      S.berries.forEach(b => d.picks.small.kind === "spray" ? spraySmall(g, b.x, b.y, S.pxIn*4, d.picks.small.color, rand) : berryCluster(g, b.x, b.y, br, d.picks.small.color, b.n, rand));
      return true;
    }
    if (name === "crown"){
      if (d.topper.style === "none") return false;
      drawTopper(g, gl, G, S, d, rng(81)); return true;
    }
    return false;
  }
  const DRAW_ORDER = ["lights","statement","primary_picks","ribbon","florals","medium","small","small_picks","crown"];
  window.__TG_INTERNAL = { clamp, hex, pt, obj, arr, str, oneOf, RIBBON_TEX, planEl, TAU, rng, rgbOf, shade, rgba, layer, photoSampler, makeGeo, buildScene, drawGroup, DRAW_ORDER, ORN_IN, FLOWER_IN, pickColor };
})();
