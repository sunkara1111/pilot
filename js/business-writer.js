/**
 * Business Writer — in-browser drafts (not a live LLM API).
 * Structure: subject → greeting → purpose → user points → ask → close.
 * Daily limit: localStorage pilot_writer_usage_v1 (20/browser/day).
 */
(function (global) {
  "use strict";

  var DAILY_LIMIT = 20;
  var MAX_NOTES_LENGTH = 12000;
  var STORAGE_KEY = "pilot_writer_usage_v1";
  var memoryUsage = { date: "", count: 0 };

  var KINDS = {
    email: "email",
    followup: "followup",
    recap: "recap",
    status: "status",
    announcement: "announcement",
    proposal: "proposal",
    apology: "apology",
    intro: "intro",
    memo: "memo"
  };

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function readUsage() {
    var today = todayKey();
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { date: today, count: 0 };
      var data = JSON.parse(raw);
      if (!data || data.date !== today) return { date: today, count: 0 };
      var count = Number(data.count);
      if (!isFinite(count)) count = 0;
      return { date: today, count: Math.min(DAILY_LIMIT, Math.max(0, Math.floor(count))) };
    } catch (e) {
      if (memoryUsage.date !== today) memoryUsage = { date: today, count: 0 };
      return { date: today, count: memoryUsage.count };
    }
  }

  function writeUsage(count) {
    var today = todayKey();
    var safeCount = Math.min(DAILY_LIMIT, Math.max(0, Math.floor(Number(count) || 0)));
    memoryUsage = { date: today, count: safeCount };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count: safeCount }));
    } catch (e) {}
  }

  function remaining() {
    return Math.max(0, DAILY_LIMIT - readUsage().count);
  }

  function consumeOne() {
    var u = readUsage();
    if (u.count >= DAILY_LIMIT) return false;
    writeUsage(u.count + 1);
    return true;
  }

  function clip(s, n) {
    s = String(s || "").replace(/\s+/g, " ").trim();
    if (s.length <= n) return s;
    return s.slice(0, n - 1).replace(/\s+\S*$/, "").trim() + "…";
  }

  function noteLines(notes) {
    return String(notes || "")
      .split(/\n+/)
      .map(function (l) { return l.replace(/^[-*•\d.)\]]+\s*/, "").trim(); })
      .filter(Boolean);
  }

  function extractDateHint(text) {
    var m = text.match(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,?\s*\d{4})?\b/i)
      || text.match(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/)
      || text.match(/\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|next week)\b/i);
    return m ? m[0] : null;
  }

  function extractAmount(text) {
    var m = text.match(/(?:USD|EUR|GBP|\$|€|£)\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s?(?:USD|EUR|GBP)\b/i);
    return m ? m[0].trim() : null;
  }

  function bizLabel(context) {
    var c = String(context || "").trim();
    if (!c) return "";
    return clip(c.split(/[·|\n]/)[0].trim(), 48);
  }

  function audienceLabel(audience) {
    var a = clip(audience, 80);
    return a || "the team";
  }

  function greeting(tone, audience) {
    var who = audienceLabel(audience);
    if (/^the /i.test(who) || /team|group|everyone|all/i.test(who)) {
      if (tone === "friendly") return "Hi " + who + ",";
      if (tone === "concise") return "Hello " + who + " —";
      return "Hello " + who + ",";
    }
    if (tone === "friendly") return "Hi " + who + ",";
    if (tone === "concise") return "Hello " + who + " —";
    return "Hello " + who + ",";
  }

  function close(tone, biz) {
    var sign = {
      professional: "Kind regards",
      friendly: "Thanks,",
      firm: "Regards",
      concise: "Thanks"
    }[tone] || "Kind regards";
    return biz ? sign + ",\n" + biz : sign;
  }

  function subjectFor(kind, notes, audience, facts) {
    var focus = clip(noteLines(notes)[0] || notes, 72);
    var dateBit = facts.date ? " — " + facts.date : "";
    var map = {
      email: focus || "Quick update",
      followup: "Following up" + (focus ? " — " + clip(focus, 50) : ""),
      recap: "Recap" + dateBit + (focus ? ": " + clip(focus, 48) : ""),
      status: "Status update" + dateBit,
      announcement: focus || "Update",
      proposal: "Proposal" + (focus ? ": " + clip(focus, 52) : ""),
      apology: "Apology and next step",
      intro: "Introduction" + (facts.biz ? " — " + facts.biz : ""),
      memo: "Memo" + (focus ? ": " + clip(focus, 56) : "")
    };
    return (map[kind] || focus || "Update").replace(/\s+/g, " ").trim();
  }

  function numberedPoints(lines) {
    if (!lines.length) return "";
    if (lines.length === 1) return lines[0].replace(/[.!?]?$/, ".");
    return lines.map(function (l, i) {
      return (i + 1) + ". " + l.replace(/[.!?]?$/, ".");
    }).join("\n");
  }

  function askLine(kind, tone) {
    var firm = tone === "firm" ? " Please reply with a clear yes/no or the missing detail so we can close this." : "";
    var map = {
      email: "If anything above is off, reply on this thread and I’ll adjust." + firm,
      followup: "When you have a moment, a short reply with status or a decision would help us move." + firm,
      recap: "Reply if I missed a decision or owner — I’ll correct the record.",
      status: "Tell me if a blocker needs a different owner or date." + firm,
      announcement: "Questions welcome on this thread. No action needed unless noted above.",
      proposal: "If this approach works, reply with a yes and any constraints. I’ll then outline next steps.",
      apology: "If this remedy is not enough, tell me what would make it right within what we can do.",
      intro: "If a short conversation would help, reply with two times that work.",
      memo: "Please confirm you have what you need, or name the decision still open."
    };
    return map[kind] || map.email;
  }

  function purpose(kind, tone, audience, facts) {
    var who = audienceLabel(audience);
    var dateBit = facts.date ? " (" + facts.date + ")" : "";
    var amountBit = facts.amount ? " The amount noted is " + facts.amount + "." : "";
    if (kind === "followup") {
      return "I’m following up so this doesn’t sit idle. A concise status from " + who + " is enough.";
    }
    if (kind === "recap") {
      return "Here’s a written recap" + dateBit + " so we share the same record.";
    }
    if (kind === "status") {
      return "Status update" + dateBit + " — progress, blockers, and what’s next.";
    }
    if (kind === "announcement") {
      return "Sharing a change that affects " + who + ". Please read the details below before acting.";
    }
    if (kind === "proposal") {
      return "A proposed path, not a commitment. I want a clear yes, no, or revise from " + who + ".";
    }
    if (kind === "apology") {
      return (tone === "friendly" ? "I’m sorry for the trouble this caused. " : "I want to own the miss and make the next step concrete. ") + "Below is what happened and what we will do.";
    }
    if (kind === "intro") {
      return "A short introduction" + (facts.biz ? " from " + facts.biz : "") + " and why I’m reaching out.";
    }
    if (kind === "memo") {
      return "Internal note for " + who + dateBit + ". Recommendation and next step are at the end.";
    }
    return "I’m writing with a clear ask and the details you need." + amountBit;
  }

  function generate(input) {
    var notes = String(input.notes || "").trim().slice(0, MAX_NOTES_LENGTH);
    var audience = String(input.audience || "").trim();
    var context = String(input.context || "").trim();
    var kind = KINDS[input.kind] ? input.kind : "email";
    var tone = /^(professional|friendly|firm|concise)$/.test(input.tone) ? input.tone : "professional";
    if (!notes) return "";

    var lines = noteLines(notes);
    var facts = {
      date: extractDateHint(notes),
      amount: extractAmount(notes),
      biz: bizLabel(context)
    };
    var subject = subjectFor(kind, notes, audience, facts);
    var points = numberedPoints(lines);
    var lead = purpose(kind, tone, audience, facts);
    if (tone === "concise") {
      lead = lead.replace(/I’m writing with a clear ask and the details you need\./, "Details below.");
    }

    var body =
      greeting(tone, audience) + "\n\n" +
      lead + "\n\n" +
      points + "\n\n" +
      askLine(kind, tone) + "\n\n" +
      close(tone, facts.biz);

    if (kind === "memo") {
      body =
        "To: " + audienceLabel(audience) + "\n" +
        (facts.biz ? "From: " + facts.biz + "\n" : "") +
        (facts.date ? "Date: " + facts.date + "\n" : "") +
        "Re: " + subject + "\n\n" +
        lead + "\n\n" +
        points + "\n\n" +
        "Recommendation: proceed with the points above unless " + audienceLabel(audience) + " flags a blocker.\n\n" +
        askLine(kind, tone);
    }

    return ("Subject: " + subject + "\n\n" + body)
      .replace(/ +/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  global.BusinessWriterComposer = {
    version: "local-v1",
    dailyLimit: DAILY_LIMIT,
    storageKey: STORAGE_KEY,
    maxNotesLength: MAX_NOTES_LENGTH,
    remaining: remaining,
    consumeOne: consumeOne,
    readUsage: readUsage,
    generate: generate
  };
})(typeof window !== "undefined" ? window : globalThis);
