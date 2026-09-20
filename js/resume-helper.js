(function (global) {
  "use strict";
  var limiter = (global.PilotToolLimit || require("./pilot-tool-limit.js")).make("pilot_resume_helper_usage_v1", 20);
  function bulletize(raw, role) {
    var lines = String(raw || "").split(/\n+/).map(function (s) { return s.replace(/^[-*•]\s*/, "").trim(); }).filter(Boolean);
    if (!lines.length) lines = ["Led a project from planning through delivery", "Improved a process that saved time for the team", "Collaborated across teams to ship on schedule"];
    var roleBit = role ? (" as " + role) : "";
    return lines.slice(0, 8).map(function (l) {
      if (/^[A-Z]/.test(l) && /\b(led|built|improved|managed|designed|created|shipped|reduced|increased)\b/i.test(l)) return "• " + l + (roleBit && l.length < 80 ? roleBit : "");
      return "• " + l.charAt(0).toUpperCase() + l.slice(1) + (roleBit && l.length < 80 ? roleBit : "");
    }).join("\n");
  }
  function cover(name, role, notes) {
    name = name || "[Your name]";
    role = role || "the role";
    notes = (notes || "").trim() || "I bring clear communication, ownership, and steady delivery.";
    return "Dear Hiring Manager,\n\nI am writing to apply for " + role + ". " + notes + "\n\nI would welcome a chance to discuss how I can help your team.\n\nSincerely,\n" + name;
  }
  function $(id) { return global.document.getElementById(id); }
  function refresh() {
    var left = limiter.remaining();
    var el = $("usage-left"); if (el) el.textContent = left + " / " + limiter.limit + " today";
    var btn = $("generate"); if (btn) btn.disabled = left <= 0;
    var ban = $("limit-banner"); if (ban) ban.classList.toggle("hidden", left > 0);
  }
  function run() {
    if (!limiter.consume()) { refresh(); return; }
    var mode = ($("mode") && $("mode").value) || "bullets";
    var role = ($("role") && $("role").value) || "";
    var name = ($("name") && $("name").value) || "";
    var notes = ($("notes") && $("notes").value) || "";
    var text = mode === "cover" ? cover(name, role, notes) : bulletize(notes, role);
    var out = $("output"); if (out) { out.value = text; out.focus(); }
    refresh();
  }
  if (typeof global.document !== "undefined") {
    global.document.addEventListener("DOMContentLoaded", function () {
      refresh();
      var g = $("generate"); if (g) g.addEventListener("click", run);
      var c = $("copy"); if (c) c.addEventListener("click", function () {
        var out = $("output"); if (!out || !out.value) return;
        if (global.navigator && global.navigator.clipboard) {
          global.navigator.clipboard.writeText(out.value).catch(function () {});
        }
      });
    });
  }
  var api = { bulletize: bulletize, cover: cover, remaining: function () { return limiter.remaining(); }, limit: limiter.limit };
  global.PilotResumeHelper = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
