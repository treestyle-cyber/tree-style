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
    if (hex(c.midnight)) vars.push("--paper:" + mix(c.midnight, "#ffffff", .05), "--paper-2:" + mix(c.midnight, "#ffffff", .1));
    if (hex(c.gold)) vars.push("--line:" + rgba(c.gold, .26), "--green-2:" + mix(c.gold, "#ffffff", .2), "--brass:" + mix(c.gold, "#ffffff", .12));

    var f = kit.fonts || {}, faces = "", google = [];
    [["heading", "--serif", "Georgia, serif"], ["body", "--sans", "system-ui, -apple-system, sans-serif"]].forEach(function (x) {
      var o = f[x[0]]; if (!o || !o.family) return;
      var name = famName(o.family);
      if (o.url) faces += "@font-face{font-family:\"" + name + "\";src:url(\"" + o.url + "\");font-weight:100 900;font-display:swap}";
      else if (o.google) google.push(name.replace(/ /g, "+") + ":wght@300;400;500;600;700");
      vars.push(x[1] + ":\"" + name + "\"," + x[2]);
    });
    var gl = document.getElementById("kit-gfonts");
    if (google.length) {
      var href = "https://fonts.googleapis.com/css2?family=" + google.join("&family=") + "&display=swap";
      if (!gl) { gl = document.createElement("link"); gl.id = "kit-gfonts"; gl.rel = "stylesheet"; (document.head || root).appendChild(gl); }
      if (gl.href !== href) gl.href = href;
    } else if (gl) gl.remove();

    var b = kit.buttons || {};
    if (SHAPES[b.shape]) vars.push("--btn-radius:" + SHAPES[b.shape]);
    if (b.case === "none") vars.push("--btn-case:none");

    style("kit-vars", (faces || "") + (vars.length ? ":root{" + vars.join(";") + "}" : ""));

    // Page background (the light editorial screens keep their own)
    var bg = kit.background || {}, base = hex(c.midnight) ? c.midnight : "#141C2C", css = "";
    if (bg.kind) {
      var shade = typeof bg.shade === "number" ? Math.max(0, Math.min(1, bg.shade)) : .9;
      var tex = bg.kind === "berry" ? "url(/brand/velvet-berry.jpg)" : bg.kind === "image" && bg.image ? "url(\"" + bg.image + "\")" : bg.kind === "velvet" ? "var(--photo-velvet, url(/brand/velvet-midnight.jpg))" : "";
      var col = bg.kind === "color" && hex(bg.color) ? bg.color : base;
      css = "html body{background:" + (tex ? "linear-gradient(" + rgba(col, shade) + "," + rgba(col, Math.min(1, shade + .06)) + ")," + tex + " center top/cover fixed," : "") + col + "}";
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
  window.TSKit = { apply: apply, clean: clean };

  try { var cached = localStorage.getItem(KEY); if (cached) apply(JSON.parse(cached)); } catch (e) {}
  var draft = false;
  fetch("/api/brand?kit=1").then(function (r) { return r.json(); }).then(function (d) {
    if (draft) return;
    var kit = d && d.kit || {};
    try { localStorage.setItem(KEY, JSON.stringify(kit)); } catch (e) {}
    apply(kit);
  }).catch(function () {});
  // A draft from the Studio's Brand kit page (only when this page is inside its preview frame)
  addEventListener("message", function (e) {
    if (e.origin !== location.origin || !e.data || e.data.type !== "ts-kit-draft" || window.parent === window) return;
    draft = true; apply(e.data.kit || {});
  });
})();
