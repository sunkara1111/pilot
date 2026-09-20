/**
 * Pilot public site URL.
 * SOURCE: leave SITE_URL empty so the UI stays path-relative.
 * BUILD: scripts/stamp-site-url.js replaces __SITE_URL__ from the SITE_URL env var
 * after a custom domain is attached. Never stamp a *.netlify.app host.
 */
(function (global) {
  "use strict";

  var stamped = "__SITE_URL__";
  var SITE_URL = "";
  if (stamped && stamped.indexOf("__") !== 0) {
    SITE_URL = String(stamped).replace(/\/$/, "");
  }

  function absolute(path) {
    var p = String(path || "");
    if (/^https?:\/\//i.test(p)) return p;
    if (p.charAt(0) !== "/") p = "/" + p;
    return SITE_URL ? SITE_URL + p : p;
  }

  global.PilotSite = {
    SITE_URL: SITE_URL,
    absolute: absolute
  };
})(typeof window !== "undefined" ? window : globalThis);
