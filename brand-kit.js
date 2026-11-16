// Brand kit: applies the colors, fonts, buttons, background, icons and logos chosen in the Studio
// (Studio → Brand kit) to every page. Only what was changed is applied; everything else keeps the
// look in style.css. The kit is remembered on the device so pages don't flash the old look.
// The Studio's Brand kit page can also send an unsaved draft here (inside its preview frame).
(function () {
  var root = document.documentElement, KEY = "ts_kit";
  var LOGOS = { "logo-stacked.png": "stacked", "logo-stacked-open.png": "open", "logo-horizontal.png": "horizontal", "logo-icon.png": "icon" };
  var TABS = { home: "s-home", trees: "s-trees", shop: "s-bag", profile: "s-profile" };
  var SHAPES = { pill: "999px", rounded: "12px", square: "3px" };
  var COLOR_KEYS = ["midnight", "winterberry", "evergreen", "walnut", "oat", "ivory", "gold", "espresso", "champagne", "cream", "warmivory"];
  var applied = "";
  var LOOK_LINK = lookPreview();   // read ?look= now: the app tidies its address bar as it starts
  // Which styles belong to each font role (worked out from the app's and website's styles; body copy is everything else)
  var ROLES = ["headline", "subheadline", "body", "label", "button"];
  var SEL = {"headline":["#loading h2","#s-reveal::before","#splash h1",".appbar .title",".choice.tile b",".detline",".hero .hl h1",".lockup b",".sheetbox h3",".stephead h2",".steptabs button.on","h1","h2","h3"],"subheadline":["#bigReveal p","#loading .tipcard p","#s-reveal #summary",".act b",".buyrow strong",".esshead b",".fb .thanks",".fix b",".navlist b",".planitem h4",".potline",".progress b",".ptips b",".rating .rword b",".resline",".resume b",".rword b",".scard b",".scorestrip b",".sheetmore button",".shophead b",".src b",".steps .n",".stylegrid b",".tipcard p",".welcome .wl","details.buy .bt b","label.drop strong"],"label":["#s-details .q .lbl",".ba div span",".bafield",".brand b",".brand small",".buyh",".buyrow em",".choice.tile em",".compare .tag",".esscard em",".esschip em",".esshead small",".eyebrow",".hero .eyebrow",".hubk",".kicker",".lockup small",".msg .vtag",".ptipk",".rlbl",".rmhint",".scorestrip .chev",".sheetk",".stepcard .k",".stephead .k",".tag",".tipk","details.buy .bt small","header.top a.join","section.get .eyebrow"],"button":[".btn",".btn.ghost",".finish .btn",".foot .btn",".hero .btn",".qarow .btn",".resumebtns .btn",".shophead .btn",".stepnav .btn",".tellcard .btn",".tools .btn"]};
  // Cards and boxes: the home choices, style cards, results tiles, plan steps, shopping list sections, pop-up panels
  var CARDS = ".card,.tile,.scard,.src,.fix,.act:not(.main),details.buy,.planitem,.sheetbox,.tipsbox,.tipcard,.guidebox,.esscard,.stepcard,.stylegrid2 button";
  var BODY_SEL = "body,p,li,td,label,input,textarea,small";
  // Kits saved before the roles existed had "heading" and "body" fonts only
  function fontsOf(kit) { var f = kit.fonts || {}; if (f.heading && !f.headline) { f = JSON.parse(JSON.stringify(f)); f.headline = f.heading; delete f.heading; } return f; }

  function hex(h) { var m = /^#?([0-9a-f]{6})$/i.exec(h || ""); return m ? [0, 2, 4].map(function (i) { return parseInt(m[1].substr(i, 2), 16); }) : null; }
  function mix(h, toward, k) { var a = hex(h), b = hex(toward); return "#" + a.map(function (v, i) { return Math.round(v + (b[i] - v) * k).toString(16).padStart(2, "0"); }).join(""); }
  function rgba(h, a) { var c = hex(h); return "rgba(" + c.join(",") + "," + a + ")"; }
  function famName(f) { return String(f || "").replace(/[^\w \-]/g, ""); }
  function style(id, css) {
    var el = document.getElementById(id);
    if (!css) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("style"); el.id = id; (document.head || root).appendChild(el); }
    el.textContent = css;
  }

  function apply(kit) {
    kit = kit || {};
    var sig = JSON.stringify(kit);
    if (sig === applied) return;
    applied = sig;
    var vars = [], c = kit.colors || {};
    COLOR_KEYS.forEach(function (k) { if (hex(c[k])) vars.push("--" + k + ":" + c[k]); });
    // Shades that are worked out from the main colors
    if (hex(c.midnight) && kit.look !== "ivory") vars.push("--paper:" + mix(c.midnight, "#ffffff", .05), "--paper-2:" + mix(c.midnight, "#ffffff", .1));
    if (hex(c.gold)) vars.push("--line:" + rgba(c.gold, .26), "--green-2:" + mix(c.gold, "#ffffff", .2), "--brass:" + mix(c.gold, "#ffffff", .12));
    // Cards: their own background, inner panels and border (these win over the shades worked out above)
    var cd = kit.cards || {};
    if (hex(cd.bg)) vars.push("--paper:" + cd.bg);
    if (hex(cd.panel)) vars.push("--paper-2:" + cd.panel);
    if (hex(cd.border) || typeof cd.strength === "number") vars.push("--line:" + rgba(hex(cd.border) ? cd.border : (hex(c.gold) ? c.gold : "#B89C6B"), typeof cd.strength === "number" ? Math.max(0, Math.min(1, cd.strength)) : .26));

    // Fonts by role: headline, subheadline, body copy, labels, buttons. Each can set its font, weight,
    // size (a percentage of the designed size), letter spacing and capitals; anything left unset keeps the design.
    var f = fontsOf(kit), faces = "", google = [], rules = [];
    ROLES.forEach(function (role) {
      var o = f[role]; if (!o) return;
      var sel = role === "body" ? BODY_SEL : SEL[role].join(","), fallback = /^(headline|subheadline)$/.test(role) ? "Georgia, serif" : "system-ui, -apple-system, sans-serif";
      if (o.family) {
        var name = famName(o.family), stack = "\"" + name + "\"," + fallback;
        if (o.url) faces += "@font-face{font-family:\"" + name + "\";src:url(\"" + o.url + "\");font-weight:100 900;font-display:swap}";
        else if (o.google && google.indexOf(name) < 0) google.push(name);
        // Headline sets the serif and body copy the sans, so the roles that follow them change too
        if (role === "headline") vars.push("--serif:" + stack);
        else if (role === "body") vars.push("--sans:" + stack);
        else rules.push(sel + "{font-family:" + stack + " !important}");
      }
      if (/^[1-9]00$/.test(o.weight)) rules.push(sel + "{font-weight:" + o.weight + " !important}");
      if (typeof o.size === "number" && o.size > 0) vars.push("--s-" + role + ":" + Math.max(.5, Math.min(2, o.size / 100)));
      if (typeof o.spacing === "number") rules.push(sel + "{letter-spacing:" + o.spacing + "em !important}");
      if (hex(o.color)) rules.push(sel + "{color:" + o.color + " !important}");
      // The same kind of text inside cards and boxes can have its own color (light text on dark cards, dark on a light page)
      if (hex(o.cardColor)) rules.push(":is(" + CARDS + ") :is(" + sel + "),:is(" + CARDS + "):is(" + sel + "){color:" + o.cardColor + " !important}");
      if (o.italic === "italic" || o.italic === "normal") rules.push(sel + "{font-style:" + o.italic + " !important}");
      if (/^(left|center|right)$/.test(o.align)) rules.push(sel + "{text-align:" + o.align + " !important}");
      if (o.caps === "upper" || o.caps === "none") rules.push(sel + "{text-transform:" + (o.caps === "upper" ? "uppercase" : "none") + " !important}");
    });
    var gl = document.getElementById("kit-gfonts");
    if (google.length) {
      var href = "https://fonts.googleapis.com/css2?" + google.map(function (n) { return "family=" + n.replace(/ /g, "+") + ":wght@300;400;500;600;700"; }).join("&") + "&display=swap";
      if (!gl) { gl = document.createElement("link"); gl.id = "kit-gfonts"; gl.rel = "stylesheet"; (document.head || root).appendChild(gl); }
      if (gl.href !== href) gl.href = href;
    } else if (gl) gl.remove();

    var b = kit.buttons || {};
    if (SHAPES[b.shape]) vars.push("--btn-radius:" + SHAPES[b.shape]);
    if (b.case === "none") vars.push("--btn-case:none");

    // The bottom navigation bar and Shop the Look are off until switched on here (Eric approves first)
    if (!/[?&]nav=1\b/.test(location.search)) root.classList.toggle("has-nav", !!(kit.nav && kit.nav.bar) || lookPreview() === "ivory");
    // The overall Look: the dark velvet (as designed) or Ivory editorial (Kylie's mockup)
    root.classList.toggle("theme-ivory", kit.look === "ivory" || lookPreview() === "ivory");
    style("kit-vars", (faces || "") + (vars.length ? ":root:root:root{" + vars.join(";") + "}" : "") + rules.join(""));

    // Page background (the light editorial screens keep their own)
    var bg = kit.background || {}, base = hex(c.midnight) ? c.midnight : "#141C2C", css = "";
    // A changed Midnight also tints the velvet behind every page (the original velvet keeps its texture)
    if (!bg.kind && hex(c.midnight) && kit.look !== "ivory") bg = { kind: "velvet" };
    if (bg.kind) {
      var shade = typeof bg.shade === "number" ? Math.max(0, Math.min(1, bg.shade)) : .9;
      var tex = bg.kind === "berry" ? "url(/brand/velvet-berry.jpg)" : bg.kind === "image" && bg.image ? "url(\"" + bg.image + "\")" : bg.kind === "velvet" ? "var(--photo-velvet, url(/brand/velvet-midnight.jpg))" : "";
      var col = bg.kind === "color" && hex(bg.color) ? bg.color : base;
      css = "html:root:root body{background:" + (tex ? "linear-gradient(" + rgba(col, shade) + "," + rgba(col, Math.min(1, shade + .06)) + ")," + tex + " center top/cover fixed," : "") + col + "}";
    }
    style("kit-bg", css);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { dom(kit); }); else dom(kit);
  }

  // Icons and logos live in the page itself
  function dom(kit) {
    var L = kit.logos || {};
    Array.prototype.forEach.call(document.querySelectorAll("img"), function (im) {
      var orig = im.getAttribute("data-kit-src") || im.getAttribute("src") || "", file = orig.split("?")[0].split("/").pop(), k = LOGOS[file];
      if (!k || orig.indexOf("/brand/") < 0) return;
      if (!im.hasAttribute("data-kit-src")) im.setAttribute("data-kit-src", orig);
      var want = L[k] || orig; if (im.getAttribute("src") !== want) im.setAttribute("src", want);
    });
    Array.prototype.forEach.call(document.querySelectorAll("link[rel~=icon],link[rel=apple-touch-icon]"), function (ln) {
      if (!ln.hasAttribute("data-kit-href")) ln.setAttribute("data-kit-href", ln.getAttribute("href"));
      ln.setAttribute("href", L.favicon || ln.getAttribute("data-kit-href"));
    });
    var I = kit.icons || {};
    Object.keys(TABS).forEach(function (k) {
      var svg = document.querySelector("#tabbar button[data-tab=" + TABS[k] + "] svg");
      if (!svg) return;
      if (!svg.hasAttribute("data-kit-orig")) { svg.setAttribute("data-kit-orig", svg.innerHTML); svg.setAttribute("data-kit-vb", svg.getAttribute("viewBox") || ""); svg.setAttribute("data-kit-sw", svg.style.strokeWidth || ""); }
      var ic = I[k];
      if (ic && ic.body) { svg.innerHTML = clean(ic.body); svg.setAttribute("viewBox", ic.viewBox || "0 0 24 24"); svg.style.strokeWidth = ic.weight || ""; }
      else { svg.innerHTML = svg.getAttribute("data-kit-orig"); svg.setAttribute("viewBox", svg.getAttribute("data-kit-vb")); svg.style.strokeWidth = svg.getAttribute("data-kit-sw"); }
    });
  }
  // Only plain drawing shapes, no scripts or links
  function clean(body) {
    var doc = new DOMParser().parseFromString("<svg xmlns=\"http://www.w3.org/2000/svg\">" + body + "</svg>", "image/svg+xml"), out = [];
    var OK = /^(path|circle|ellipse|line|polyline|polygon|rect|g)$/, ATTR = /^(d|cx|cy|r|rx|ry|x|y|x1|y1|x2|y2|width|height|points|transform|fill|stroke|stroke-width|stroke-linecap|stroke-linejoin|fill-rule|clip-rule|opacity)$/;
    (function walk(n, depth) {
      Array.prototype.forEach.call(n.children, function (e) {
        if (!OK.test(e.tagName)) return;
        var a = Array.prototype.filter.call(e.attributes, function (x) { return ATTR.test(x.name) && !/url\(|javascript:/i.test(x.value); }).map(function (x) { return x.name + "=\"" + x.value.replace(/"/g, "") + "\""; });
        if (e.tagName === "g") { out.push("<g " + a.join(" ") + ">"); walk(e, depth + 1); out.push("</g>"); }
        else out.push("<" + e.tagName + " " + a.join(" ") + "/>");
      });
    })(doc.documentElement, 0);
    return out.join("");
  }
  // A link can preview a Look without saving it: ?look=ivory (kept for this tab until ?look=dark)
  function lookPreview() {
    var m = /[?&]look=(ivory|dark)\b/.exec(location.search);
    try { if (m) sessionStorage.setItem("ts_look", m[1]); return sessionStorage.getItem("ts_look") || ""; } catch (e) { return m ? m[1] : ""; }
  }
  window.TSKit = { apply: apply, clean: clean, fontsOf: fontsOf };

  try { var cached = localStorage.getItem(KEY); if (cached) apply(JSON.parse(cached)); } catch (e) {}
  var draft = false;
  fetch("/api/brand?kit=1").then(function (r) { return r.json(); }).then(function (d) {
    if (draft) return;
    var kit = d && d.kit || {};
    try { localStorage.setItem(KEY, JSON.stringify(kit)); } catch (e) {}
    apply(kit);
  }).catch(function () {});
  // Studio → Screens: unsaved Brand kit changes (kept on this device by the Brand kit page) show on every screen
  if (/[?&]screen-preview\b/.test(location.search)) {
    var useDraft = function () { try { var dk = localStorage.getItem("ts_kit_draft"); if (dk) { draft = true; apply(JSON.parse(dk)); return true; } } catch (e) {} return false; };
    useDraft();
    addEventListener("storage", function (e) { if (e.key === "ts_kit_draft" || e.key === KEY) { if (!useDraft()) { draft = false; try { apply(JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (x) {} } } });
  }
  // A draft from the Studio's Brand kit page (only when this page is inside its preview frame)
  addEventListener("message", function (e) {
    if (e.origin !== location.origin || !e.data || e.data.type !== "ts-kit-draft" || window.parent === window) return;
    draft = true; apply(e.data.kit || {});
  });
})();
