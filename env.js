// Which copy is this? (Eric, Nov 14: one practice app for him and Kylie, one real app for customers.)
// The practice app shows a banner across the top of every page; the real app's Studio, Lab and Review pages
// show one too, so it is always clear which one is being changed. Customers on the real app never see it.
(function () {
  var LIVE = "tree-style.vercel.app";
  var PREVIEW = "tree-style-git-practice-tree-style.vercel.app";   // the one practice app
  var h = location.hostname, isLive = h === LIVE, isPrev = h !== LIVE && /^tree-style-.+-tree-style\.vercel\.app$/.test(h);   // branch links and one-build links alike
  // Preview copies need no password (the server lets them through), so skip the password screen there
  if (isPrev && !/-git-main-/.test(h)) try { if (!sessionStorage.getItem("ts_pw")) sessionStorage.setItem("ts_pw", "preview"); } catch (e) {}
  if (!isLive && !isPrev) return;
  var tools = /^\/(studio|lab|review)(\/|$)/.test(location.pathname);
  if (isLive && !tools) return;
  if (isPrev) {
    document.title = "PRACTICE · " + document.title;
    // No plum tint: previews show the colors and background set in the Studio's Brand kit
    var st = document.createElement("style");
    st.textContent = ".foot{padding-bottom:max(40px,env(safe-area-inset-bottom)) !important}";
    document.head.appendChild(st);
  }
  addEventListener("DOMContentLoaded", function () {
    if (window.top !== window) return;   // the Studio's Screens phones: the banner is on the Studio page itself
    var bar = document.createElement("div"), H = 30;
    bar.innerHTML = (isLive
      ? "<b>REAL APP</b> · changes here reach customers"
      : "<b>PRACTICE APP</b> · customers don't see this")
      + " · <a href='https://" + (isLive ? PREVIEW : LIVE) + location.pathname + "' style='color:inherit;text-decoration:underline'>" + (isLive ? "open practice" : "open the real app") + "</a>";
    bar.style.cssText = "position:fixed;left:0;right:0;top:0;height:" + H + "px;z-index:9999;display:flex;align-items:center;justify-content:center;gap:4px;font:500 12px Inter,system-ui,sans-serif;letter-spacing:.04em;white-space:nowrap;overflow:hidden;"
      + (isLive ? "background:#7A1F2B;color:#fff" : "background:#D9B44A;color:#141C2C");
    document.body.appendChild(bar);
    var st = document.createElement("style");
    st.textContent = "body{padding-top:" + H + "px !important}.appbar,.tools{top:" + H + "px !important}#splash{top:" + H + "px !important}#s-home .choice.tile .tpic{height:clamp(72px,calc(50dvh - 250px),280px) !important}";
    document.head.appendChild(st);
  });
})();
