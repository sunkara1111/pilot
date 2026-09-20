/**
 * Pilot shared tool helpers — in-browser drafts, localStorage daily limit.
 */
(function (global) {
  "use strict";
  function makeLimiter(storageKey, dailyLimit) {
    dailyLimit = dailyLimit || 20;
    var memory = { date: "", count: 0 };
    function todayKey() {
      var d = new Date();
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    function read() {
      var today = todayKey();
      try {
        var raw = global.localStorage.getItem(storageKey);
        if (!raw) return { date: today, count: 0 };
        var data = JSON.parse(raw);
        if (!data || data.date !== today) return { date: today, count: 0 };
        var count = Math.min(dailyLimit, Math.max(0, Math.floor(Number(data.count) || 0)));
        return { date: today, count: count };
      } catch (e) {
        if (memory.date !== today) memory = { date: today, count: 0 };
        return { date: today, count: memory.count };
      }
    }
    function write(count) {
      var today = todayKey();
      var safe = Math.min(dailyLimit, Math.max(0, Math.floor(Number(count) || 0)));
      memory = { date: today, count: safe };
      try { global.localStorage.setItem(storageKey, JSON.stringify({ date: today, count: safe })); } catch (e) {}
    }
    return {
      remaining: function () { return Math.max(0, dailyLimit - read().count); },
      consume: function () {
        var u = read();
        if (u.count >= dailyLimit) return false;
        write(u.count + 1);
        return true;
      },
      limit: dailyLimit
    };
  }
  var api = { make: makeLimiter };
  global.PilotToolLimit = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
