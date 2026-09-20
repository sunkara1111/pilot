/**
 * Resume Helper — in-browser drafts (not a live LLM API).
 * Modes: bullets, summary, cover letter, rewrite.
 * Daily limit: localStorage pilot_resume_usage_v1 (20/browser/day).
 */
(function (global) {
  "use strict";

  var DAILY_LIMIT = 20;
  var MAX_NOTES_LENGTH = 12000;
  var STORAGE_KEY = "pilot_resume_usage_v1";
  var memoryUsage = { date: "", count: 0 };

  var ACTION_VERBS = [
    "Led", "Built", "Designed", "Launched", "Automated", "Improved", "Reduced",
    "Increased", "Delivered", "Owned", "Created", "Implemented", "Streamlined",
    "Coordinated", "Analyzed", "Resolved", "Mentored", "Shipped", "Migrated",
    "Documented", "Negotiated", "Supported", "Developed", "Optimized"
  ];

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
      .map(function (l) { return l.replace(/^[-*•]+\s*/, "").trim(); })
      .filter(Boolean);
  }

  function hasMetric(text) {
    return /\d/.test(text) || /%|percent|hours?|days?|weeks?|users?|customers?|tickets?/i.test(text);
  }

  function startsWithVerb(text) {
    var first = (text.match(/^[A-Za-z']+/) || [""])[0];
    var lower = first.toLowerCase();
    return ACTION_VERBS.some(function (v) { return v.toLowerCase() === lower; })
      || /^(led|built|ran|made|helped|wrote|fixed|cut|grew|saved|trained|tested|managed|handled|worked|responsible)$/i.test(first);
  }

  function stripFirstPerson(text) {
    return text
      .replace(/^(i |i'm |i’ve |i've |we |we’re |we're )/i, "")
      .replace(/^(was |were |am |been )/i, "")
      .trim();
  }

  function polishBullet(line, tone) {
    var text = stripFirstPerson(String(line || "").replace(/^[.\s]+/, ""));
    text = text.replace(/[.]+$/, "");
    if (!text) return "";
    if (!startsWithVerb(text)) {
      if (/mentor|coach|train/i.test(text)) text = "Mentored " + text.replace(/^(mentored|coached|trained)\s+/i, "");
      else if (/automat|script|playwright|selenium|ci\b/i.test(text)) text = "Automated " + text.replace(/^(automated|built|created)\s+/i, "");
      else if (/reduc|cut |sav/i.test(text)) text = "Reduced " + text.replace(/^(reduced|cut|saved)\s+/i, "");
      else if (/increas|improv|grew/i.test(text)) text = "Improved " + text.replace(/^(improved|increased|grew)\s+/i, "");
      else text = "Delivered " + text.charAt(0).toLowerCase() + text.slice(1);
    } else {
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }
    if (tone === "formal" && /n't|don't|can't/i.test(text)) {
      text = text.replace(/n't/g, " not");
    }
    if (tone === "concise") {
      text = text.replace(/, which (?:helped|allowed|enabled)[^.]+/i, "");
      text = clip(text, 140);
    } else if (!hasMetric(text) && tone !== "concise") {
      text += " — outcome reviewed against the target role; add a number if you have one";
    }
    if (!/[.]$/.test(text) && tone === "formal") text += ".";
    return "• " + text;
  }

  function bulletsFromNotes(notes, tone) {
    var lines = noteLines(notes);
    if (!lines.length) return "";
    return lines.map(function (l) { return polishBullet(l, tone); }).filter(Boolean).join("\n");
  }

  function summaryFromNotes(role, notes, company, tone) {
    var lines = noteLines(notes);
    var roleLabel = clip(role, 80) || "this role";
    var proof = lines.slice(0, 3).map(function (l) {
      return stripFirstPerson(l).replace(/[.]+$/, "");
    }).filter(Boolean);
    var proofBit = proof.length
      ? " Recent work includes " + proof.join("; ") + "."
      : " I bring practical experience you can verify from the notes below.";
    var companyBit = company ? " I’m interested in " + clip(company, 60) + "." : "";
    var voice = tone === "formal"
      ? "Automation-minded professional targeting " + roleLabel + "."
      : "I help teams ship reliable work as a " + roleLabel + ".";
    if (tone === "concise") {
      return clip(voice + " " + (proof[0] || "Ready to contribute immediately.") + companyBit, 280);
    }
    return voice + proofBit + companyBit + " I write in plain language, own the next step, and prefer evidence over adjectives.";
  }

  function coverLetter(role, notes, company, tone) {
    var roleLabel = clip(role, 80) || "the open role";
    var companyLabel = clip(company, 80) || "your team";
    var lines = noteLines(notes);
    var bullets = lines.slice(0, 4).map(function (l) {
      return polishBullet(l, tone === "concise" ? "concise" : "confident");
    }).filter(Boolean);
    var greeting = "Dear Hiring Manager,";
    var open = tone === "formal"
      ? "I am writing to apply for " + roleLabel + " at " + companyLabel + "."
      : "I’m applying for " + roleLabel + " at " + companyLabel + ".";
    var proof = bullets.length
      ? "A few facts from my recent work:\n" + bullets.join("\n")
      : "I can walk through relevant work in an interview; the notes I have are still high-level.";
    var close = tone === "formal"
      ? "I would welcome a conversation about how this experience maps to your needs.\n\nSincerely,"
      : "Happy to walk through any of this on a call.\n\nThank you,";
    return (
      "Subject: Application — " + roleLabel + "\n\n" +
      greeting + "\n\n" +
      open + " I reviewed what I know about the role and am focusing on evidence, not slogans.\n\n" +
      proof + "\n\n" +
      close
    );
  }

  function rewriteText(notes, tone) {
    var lines = noteLines(notes);
    if (lines.length > 1) return bulletsFromNotes(notes, tone);
    var text = String(notes || "").trim();
    if (!text) return "";
    var sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length <= 1) {
      return polishBullet(text, tone).replace(/^• /, "");
    }
    return sentences.map(function (s) {
      return polishBullet(s, tone);
    }).join("\n");
  }

  function generate(input) {
    var notes = String(input.notes || "").trim().slice(0, MAX_NOTES_LENGTH);
    var role = String(input.role || "").trim();
    var company = String(input.company || "").trim();
    var mode = /^(bullets|summary|cover|rewrite)$/.test(input.mode) ? input.mode : "bullets";
    var tone = /^(confident|concise|formal)$/.test(input.tone) ? input.tone : "confident";
    if (!notes) return "";

    var draft;
    if (mode === "summary") draft = summaryFromNotes(role, notes, company, tone);
    else if (mode === "cover") draft = coverLetter(role, notes, company, tone);
    else if (mode === "rewrite") draft = rewriteText(notes, tone);
    else draft = bulletsFromNotes(notes, tone);

    if (mode === "bullets" || mode === "rewrite") {
      draft += "\n\nReview note: keep only facts you can defend in an interview. Add a metric where you have one — do not invent numbers.";
    }

    return String(draft).replace(/ +/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  global.ResumeHelperComposer = {
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
