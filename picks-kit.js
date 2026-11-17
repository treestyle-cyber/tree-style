// The Shopping Picks page follows the Brand kit (Studio -> Brand kit): its colors, its headline and body
// fonts and its logo. Only what was saved in the kit changes; everything else keeps the look in style.css.
// The app-only settings (the Ivory editorial look, the bottom bar) don't apply here.
// The kit is remembered on the device so the page doesn't flash the old look on the next visit.
(function () {
  var KEY = "ts_picks_kit", root = document.documentElement;
  var COLORS = ["midnight", "winterberry", "evergreen", "walnut", "oat", "ivory", "gold", "espresso", "champagne", "cream", "warmivory"];
  function hex(h) { var m = /^#?([0-9a-f]{6})$/i.exec(h || ""); return m ? [0, 2, 4].map(function (i) { return parseInt(m[1].substr(i, 2), 16); }) : null; }
  function rgba(h, a) { return "rgba(" + hex(h).join(",") + "," + a + ")"; }
  function mix(h, to, k) { var a = hex(h), b = hex(to); return "#" + a.map(function (v, i) { return Math.round(v + (b[i] - v) * k).toString(16).padStart(2, "0"); }).join(""); }
  function name(f) { return String(f || "").replace(/[^\w \-]/g, ""); }
  function css(id, text) {
    var el = document.getElementById(id);
    if (!text) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("style"); el.id = id; (document.head || root).appendChild(el); }
    el.textContent = text;
  }
  function apply(kit) {
    kit = kit || {};
    var v = [], c = kit.colors || {}, faces = "", google = [];
    COLORS.forEach(function (k) { if (hex(c[k])) v.push("--" + k + ":" + c[k]); });
    if (hex(c.gold)) v.push("--line:" + rgba(c.gold, .26), "--green-2:" + mix(c.gold, "#ffffff", .2), "--brass:" + mix(c.gold, "#ffffff", .12));
    if (hex(c.midnight)) v.push("--paper:" + mix(c.midnight, "#ffffff", .05), "--paper-2:" + mix(c.midnight, "#ffffff", .1));
    var f = kit.fonts || {}, roles = { headline: f.headline || f.heading, body: f.body };
    Object.keys(roles).forEach(function (r) {
      var o = roles[r]; if (!o || !o.family) return;
      var n = name(o.family), stack = "\"" + n + "\"," + (r === "headline" ? "Georgia, serif" : "system-ui, -apple-system, sans-serif");
      if (o.url) faces += "@font-face{font-family:\"" + n + "\";src:url(\"" + o.url + "\");font-weight:100 900;font-display:swap}";
      else if (o.google) google.push(n);
      v.push((r === "headline" ? "--serif:" : "--sans:") + stack);
    });
    var gl = document.getElementById("kit-gfonts");
    if (google.length) {
      if (!gl) { gl = document.createElement("link"); gl.id = "kit-gfonts"; gl.rel = "stylesheet"; (document.head || root).appendChild(gl); }
      gl.href = "https://fonts.googleapis.com/css2?" + google.map(function (n) { return "family=" + n.replace(/ /g, "+") + ":ital,wght@0,400;0,500;0,600;0,700;1,500"; }).join("&") + "&display=swap";
    } else if (gl) gl.remove();
    var bg = hex(c.midnight) ? "html:root body{background:linear-gradient(" + rgba(c.midnight, .9) + "," + rgba(c.midnight, .96) + "),url(/brand/velvet-midnight.jpg) center top/cover fixed," + c.midnight + "}" : "";
    css("kit-vars", faces + (v.length ? ":root:root:root{" + v.join(";") + "}" : "") + bg);
    var logo = (kit.logos || {}).horizontal;
    function logos() { Array.prototype.forEach.call(document.querySelectorAll("img[src*='/brand/logo-horizontal']"), function (im) { if (!im.dataset.kitSrc) im.dataset.kitSrc = im.getAttribute("src"); im.src = logo || im.dataset.kitSrc; }); }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", logos); else logos();
  }
  try { var saved = localStorage.getItem(KEY); if (saved) apply(JSON.parse(saved)); } catch (e) {}
  fetch("/api/brand?kit=1").then(function (r) { return r.json(); }).then(function (d) {
    var kit = (d && d.kit) || {};
    try { localStorage.setItem(KEY, JSON.stringify(kit)); } catch (e) {}
    apply(kit);
  }).catch(function () {});
})();
