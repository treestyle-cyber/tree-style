// Which copy of the site is this? The preview copy says so (tab title, plum background) and every
// working page has a small switch to its live or preview counterpart. Testers on the live app never see it.
(function () {
  var LIVE = "tree-style.vercel.app";
  var PREVIEW = "tree-style-git-ux-review-tree-style.vercel.app";   // the preview copy being reviewed now
  var h = location.hostname, isLive = h === LIVE, isPrev = /-git-/.test(h) && /\.vercel\.app$/.test(h);
  if (!isLive && !isPrev) return;
  var tools = /^\/(studio|lab|review)(\/|$)/.test(location.pathname);
  if (isLive && !tools) return;
  if (isPrev) {
    document.title = "PREVIEW · " + document.title;
    var st = document.createElement("style");
    st.textContent = ":root{--bg:#2A1730 !important;--paper:#3A2442 !important;--paper-2:#45304D !important}body{background:radial-gradient(120% 80% at 50% 0%,#4A2A50,#2A1730 70%) fixed !important}.foot{padding-bottom:max(40px,env(safe-area-inset-bottom)) !important}";
    document.head.appendChild(st);
  }
  addEventListener("DOMContentLoaded", function () {
    var a = document.createElement("a");
    a.href = "https://" + (isLive ? PREVIEW : LIVE) + location.pathname;
    a.textContent = isLive ? "Live · open the preview ↗" : "Preview copy · open live ↗";
    a.style.cssText = "position:fixed;left:6px;bottom:6px;z-index:99;font:600 11px Inter,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;padding:6px 11px;border-radius:99px;opacity:.95;box-shadow:0 4px 14px rgba(0,0,0,.35);"
      + (isLive ? "background:#B89C6B;color:#141C2C" : "background:#D0857C;color:#141C2C");
    document.body.appendChild(a);
  });
})();
