(function (global) {
  "use strict";
  var limiter = (global.PilotToolLimit || require("./pilot-tool-limit.js")).make("pilot_message_check_usage_v1", 30);
  var rules = [
    { id: "urgent", re: /\b(urgent|immediately|act now|verify now|within \d+ hours?|in \d+ hours?|account will be (closed|suspended|locked))\b/i, label: "Pressure / urgency language", weight: 2 },
    { id: "credential", re: /\b(password|otp|one[- ]time code|ssn|social security|bank (login|details)|wire transfer|gift card)\b/i, label: "Asks for credentials or money movement", weight: 3 },
    { id: "link", re: /https?:\/\/[^\s]+|\bbit\.ly\/|\btinyurl\.com\/|\blogin[- ]?here\b/i, label: "Contains a link or login prompt", weight: 1 },
    { id: "grammar", re: /\b(dear customer|kindly do the needful|your account has been compromised)\b/i, label: "Common scam phrasing", weight: 2 },
    { id: "prize", re: /\b(you (have )?won|lottery|claim your (prize|refund)|selected winner)\b/i, label: "Prize / unexpected reward claim", weight: 3 },
    { id: "threat", re: /\b(legal action|arrest|lawsuit|fine|police)\b/i, label: "Threat language", weight: 2 }
  ];
  function inspect(text) {
    text = String(text || "");
    var hits = [];
    var score = 0;
    rules.forEach(function (r) {
      if (r.re.test(text)) { hits.push({ id: r.id, label: r.label, weight: r.weight }); score += r.weight; }
    });
    var level = score >= 5 ? "high" : score >= 2 ? "caution" : "ordinary";
    var headline = score >= 5 ? "High risk — do not click links or share codes" : score >= 2 ? "Caution — verify the sender another way" : "Looks relatively ordinary — still verify unexpected requests";
    var lines = ["Risk level: " + headline, "Score: " + score + " / 12", ""];
    if (hits.length) {
      lines.push("Flags:");
      hits.forEach(function (h) { lines.push("• " + h.label); });
    } else {
      lines.push("No strong scam patterns found in this text.");
    }
    lines.push("", "Tip: open the real site yourself (do not use message links) and contact support from a known number.");
    return { score: score, level: level, headline: headline, hits: hits, report: lines.join("\n") };
  }
  function analyze(text) {
    return inspect(text).report;
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
    var notes = ($("notes") && $("notes").value) || "";
    var out = $("output"); if (out) { out.value = analyze(notes); out.focus(); }
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
  var api = { inspect: inspect, analyze: analyze, rules: rules, remaining: function () { return limiter.remaining(); }, limit: limiter.limit };
  global.PilotMessageCheck = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
