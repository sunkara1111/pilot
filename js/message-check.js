/**
 * Message Check — in-browser heuristic scan (not a live LLM API, not a guarantee).
 * Daily limit: localStorage pilot_check_usage_v1 (20/browser/day).
 */
(function (global) {
  "use strict";

  var DAILY_LIMIT = 20;
  var MAX_MESSAGE_LENGTH = 12000;
  var STORAGE_KEY = "pilot_check_usage_v1";
  var memoryUsage = { date: "", count: 0 };

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

  var RULES = [
    {
      id: "urgency",
      severity: "high",
      weight: 22,
      title: "Pressure to act immediately",
      test: function (t) {
        return /immediately|urgent|act now|right now|within \d+ (hour|min)|account will be (locked|closed|suspended)|final notice|limited time|expires? (today|tonight|soon)/i.test(t);
      },
      detail: "Scams often invent a short deadline so you skip the usual check."
    },
    {
      id: "credentials",
      severity: "critical",
      weight: 34,
      title: "Asks for a password, code, or account secret",
      test: function (t) {
        return /password|passcode|one[- ]time (code|password)|otp\b|2fa|verification code|social security|ssn\b|pin\b|cvv|card number|login (details|info)|send (your )?(password|credentials)/i.test(t);
      },
      detail: "Legitimate teams do not ask you to send passwords, OTPs, or card numbers in a message."
    },
    {
      id: "money",
      severity: "high",
      weight: 26,
      title: "Asks for money, gift cards, or crypto",
      test: function (t) {
        return /gift card|wire transfer|western union|bitcoin|crypto|usdt|wallet address|send (money|payment|\$)|pay (now|immediately)|itunes card|steam card/i.test(t);
      },
      detail: "Requests for gift cards, wires, or crypto are a common fraud pattern."
    },
    {
      id: "short-link",
      severity: "medium",
      weight: 14,
      title: "Uses a shortened or hard-to-read link",
      test: function (t) {
        return /https?:\/\/(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|cutt\.ly|rb\.gy)\//i.test(t)
          || /https?:\/\/\d{1,3}(?:\.\d{1,3}){3}/.test(t)
          || /https?:\/\/[^/\s]+\.xn--/i.test(t);
      },
      detail: "Short links and raw IP addresses hide the real destination. Open nothing until you verify the sender another way."
    },
    {
      id: "verify-link",
      severity: "high",
      weight: 20,
      title: "Pushes a “verify” or “login here” link",
      test: function (t) {
        return /(click|tap|visit).{0,40}(here|link|below).{0,40}(verify|login|log in|confirm|unlock|update)/i.test(t)
          || /(verify|confirm|unlock|update).{0,30}(account|identity|payment).{0,40}https?:\/\//i.test(t);
      },
      detail: "Phishing pages copy real brands. Use a bookmark or type the official site yourself."
    },
    {
      id: "impersonation",
      severity: "high",
      weight: 22,
      title: "May be impersonating a known brand or authority",
      test: function (t) {
        return /\b(microsoft|apple|google|amazon|paypal|netflix|irs|social security|bank of|wellsfargo|chase|whatsapp|facebook|instagram|support team|it department|help desk)\b/i.test(t)
          && /(account|login|locked|suspended|invoice|refund|security|verify)/i.test(t);
      },
      detail: "Anyone can type a brand name. Confirm using a phone number or app you already trust — not a number or link in this message."
    },
    {
      id: "prize",
      severity: "medium",
      weight: 16,
      title: "Prize, refund, or unexpected windfall",
      test: function (t) {
        return /you (have )?won|lottery|sweepstakes|free iphone|claim your|unexpected refund|inheritance|selected (as )?a winner|congratulations.{0,20}(won|prize|selected)/i.test(t);
      },
      detail: "Unexpected prizes and refunds are used to get you to click or pay a “fee.”"
    },
    {
      id: "secrecy",
      severity: "high",
      weight: 18,
      title: "Asks you to keep this secret",
      test: function (t) {
        return /don'?t tell|do not tell|keep (this )?confidential|between us|don'?t (talk|mention) (to )?(anyone|hr|your bank)/i.test(t);
      },
      detail: "Real colleagues and banks do not ask you to hide a payment or login request."
    },
    {
      id: "ceo-fraud",
      severity: "high",
      weight: 24,
      title: "Urgent ask that sounds like a boss or vendor exception",
      test: function (t) {
        return /(ceo|cfo|founder|your boss|i'?m in a meeting|handle this quietly|need you to (buy|send|pay)|wire it today|change (the )?bank (account|details)|new account details)/i.test(t);
      },
      detail: "Vendor-payment and “CEO asked me” scams rely on speed and fear of looking unhelpful."
    },
    {
      id: "remote-access",
      severity: "critical",
      weight: 30,
      title: "Wants remote access or software installed",
      test: function (t) {
        return /anydesk|teamviewer|remote (access|desktop)|install (this )?app|download (this )?(tool|software)|allow screen (share|control)/i.test(t);
      },
      detail: "Unsolicited remote-access requests are a takeover attempt. Do not install anything from the message."
    },
    {
      id: "attachment",
      severity: "medium",
      weight: 12,
      title: "Pushes an attachment, QR code, or download",
      test: function (t) {
        return /attached (invoice|document|file)|see (the )?attachment|\.exe\b|qr code|scan (the )?code|open the (pdf|doc)/i.test(t);
      },
      detail: "Malware and fake invoices often arrive as attachments or QR codes. Open only files you expected, from people you already work with."
    },
    {
      id: "channel-mismatch",
      severity: "medium",
      weight: 10,
      title: "Sensitive request on a casual channel",
      test: function (t, channel) {
        return (channel === "sms" || channel === "dm") && /(password|invoice|wire|gift card|ssn|verify your account|login)/i.test(t);
      },
      detail: "Banks and workplaces rarely start password resets or payment changes in a text or social DM."
    }
  ];

  function analyze(input) {
    var message = String(input.message || "").trim().slice(0, MAX_MESSAGE_LENGTH);
    var channel = /^(email|sms|dm|other)$/.test(input.channel) ? input.channel : "other";
    var findings = [];
    var score = 0;

    if (!message) {
      return {
        level: "low",
        score: 0,
        title: "Nothing to check",
        summary: "Paste a message first.",
        findings: [],
        actions: [],
        report: ""
      };
    }

    RULES.forEach(function (rule) {
      if (rule.test(message, channel)) {
        findings.push({
          id: rule.id,
          severity: rule.severity,
          title: rule.title,
          detail: rule.detail
        });
        score += rule.weight;
      }
    });

    var urls = message.match(/https?:\/\/[^\s)]+/gi) || [];
    if (urls.length >= 2) {
      findings.push({
        id: "many-links",
        severity: "medium",
        title: "Contains multiple links",
        detail: "Several links make it easier to hide a lookalike page. Hover is not enough on a phone — do not tap them."
      });
      score += 8;
    }

    score = Math.min(100, score);
    var level = "low";
    if (score >= 70 || findings.some(function (f) { return f.severity === "critical"; })) level = "critical";
    else if (score >= 40) level = "high";
    else if (score >= 18) level = "medium";

    var titles = {
      low: "No strong red flags in this local check",
      medium: "Some caution signs — verify before you act",
      high: "This looks risky — pause before clicking or paying",
      critical: "Treat this as hostile until proven otherwise"
    };

    var summaries = {
      low: "The local checklist did not find a strong scam pattern. That is not a green light — still confirm unexpected requests through a channel you already use.",
      medium: "A few patterns commonly used in scams are present. Do not click links or send money until you confirm the sender independently.",
      high: "Several high-risk patterns are present. Do not click, install, or pay based on this message.",
      critical: "This message asks for something a real organization should never request this way, or stacks multiple scam tactics. Stop. Do not reply with secrets."
    };

    var actions;
    if (level === "low") {
      actions = [
        "If anything is unexpected, confirm via a phone number or app you already have — not a contact in the message.",
        "Do not paste passwords or payment details into Pilot or into a page you reached from this message."
      ];
    } else {
      actions = [
        "Do not click links, scan QR codes, or open attachments from this message.",
        "Do not send passwords, codes, gift cards, or money.",
        "If it claims to be a company you use, open their official app or type their site yourself.",
        "If it claims to be a colleague, call them on a number you already have."
      ];
      if (level === "critical") {
        actions.push("Consider reporting the message to your email/SMS provider and, if money moved, your bank immediately.");
      }
    }

    return {
      level: level,
      score: score,
      title: titles[level],
      summary: summaries[level],
      findings: findings,
      actions: actions,
      channel: channel,
      excerpt: clip(message, 140)
    };
  }

  function formatReport(result) {
    if (!result || !result.title) return "";
    var lines = [];
    lines.push("Pilot Message Check — local review (not a guarantee)");
    lines.push("Risk: " + result.level.toUpperCase() + " (" + result.score + "/100)");
    lines.push(result.title + ".");
    lines.push("");
    lines.push(result.summary);
    if (result.findings && result.findings.length) {
      lines.push("");
      lines.push("Signals");
      result.findings.forEach(function (f) {
        lines.push("- [" + f.severity + "] " + f.title + " — " + f.detail);
      });
    } else {
      lines.push("");
      lines.push("Signals: none of the built-in red-flag rules matched.");
    }
    lines.push("");
    lines.push("What to do");
    (result.actions || []).forEach(function (a) {
      lines.push("- " + a);
    });
    lines.push("");
    lines.push("This ran in your browser. Pilot did not send the message to a server.");
    return lines.join("\n");
  }

  function generate(input) {
    var message = String((input && input.message) || "").trim();
    if (!message) return "";
    return formatReport(analyze(input));
  }

  global.MessageCheckComposer = {
    version: "local-v1",
    dailyLimit: DAILY_LIMIT,
    storageKey: STORAGE_KEY,
    maxMessageLength: MAX_MESSAGE_LENGTH,
    remaining: remaining,
    consumeOne: consumeOne,
    readUsage: readUsage,
    analyze: analyze,
    formatReport: formatReport,
    generate: generate
  };
})(typeof window !== "undefined" ? window : globalThis);
