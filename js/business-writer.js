(function () {
  "use strict";
  var limiter = PilotToolLimit.make("pilot_biz_writer_usage_v1", 20);
  var kinds = {
    email: "Write a clear professional email.",
    followup: "Write a polite follow-up.",
    proposal: "Write a short proposal blurb.",
    apology: "Write a sincere apology note.",
    announcement: "Write a short team or customer announcement."
  };
  function draft(kind, notes, tone) {
    var goal = kinds[kind] || kinds.email;
    var open = tone === "casual" ? "Hi," : tone === "direct" ? "Hello," : "Hi there,";
    var body = (notes || "").trim() || "Please share a bit more context so I can tailor this.";
    var close = tone === "formal" ? "Best regards," : "Thanks,";
    return open + "\n\n" + goal.replace(/\.$/, "") + " based on this:\n\n" + body + "\n\n" + close + "\n[Your name]";
  }
  function $(id) { return document.getElementById(id); }
  function refresh() {
    var left = limiter.remaining();
    var el = $("usage-left");
    if (el) el.textContent = left + " / " + limiter.limit + " today";
    var btn = $("generate");
    if (btn) btn.disabled = left <= 0;
    var ban = $("limit-banner");
    if (ban) ban.classList.toggle("hidden", left > 0);
  }
  function run() {
    if (!limiter.consume()) { refresh(); return; }
    var kind = ($("kind") && $("kind").value) || "email";
    var tone = ($("tone") && $("tone").value) || "professional";
    var notes = ($("notes") && $("notes").value) || "";
    var out = $("output");
    if (out) { out.value = draft(kind, notes, tone); out.focus(); }
    refresh();
  }
  document.addEventListener("DOMContentLoaded", function () {
    refresh();
    var g = $("generate"); if (g) g.addEventListener("click", run);
    var c = $("copy"); if (c) c.addEventListener("click", function () {
      var out = $("output"); if (!out || !out.value) return;
      navigator.clipboard.writeText(out.value).catch(function () {});
    });
  });
})();
