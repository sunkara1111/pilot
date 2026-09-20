/**
 * ReplyPilot composer v2 — in-browser drafts (not a live LLM API).
 * Structure: acknowledge → concrete answer → clear next step → close.
 * Daily limit: localStorage pilot_reply_usage_v2 (20/browser/day).
 */
(function (global) {
  "use strict";

  var DAILY_LIMIT = 20;
  var MAX_MESSAGE_LENGTH = 12000;
  var STORAGE_KEY = "pilot_reply_usage_v2";
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

  function extractOrderId(text) {
    var m = text.match(/\b(?:order|ord|invoice|ticket|ref(?:erence)?|#)\s*[#:]?\s*([A-Z0-9-]{4,24})\b/i)
      || text.match(/#([A-Z0-9-]{4,24})\b/);
    return m ? m[1].toUpperCase() : null;
  }

  function extractAmount(text) {
    var m = text.match(/(?:USD|EUR|GBP|\$|€|£)\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s?(?:USD|EUR|GBP)\b/i);
    return m ? m[0].trim() : null;
  }

  function extractDateHint(text) {
    var m = text.match(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,?\s*\d{4})?\b/i)
      || text.match(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/)
      || text.match(/\b(?:yesterday|today|last week|two weeks ago|a week ago|monday|tuesday|wednesday|thursday|friday)\b/i);
    return m ? m[0] : null;
  }

  function extractEmail(text) {
    var m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return m ? m[0] : null;
  }

  function detectIntent(text) {
    var t = text.toLowerCase();
    if (/refund|chargeback|money back|return my money|want my money/.test(t)) return "refund";
    if (/return (the|my|this)|send (it|the item) back|exchange/.test(t)) return "return";
    if (/cancel|cancellation|unsubscribe|stop (my|the)|close my account/.test(t)) return "cancel";
    if (/ship|shipping|delivery|tracking|arrived|hasn'?t arrived|hasnt arrived|delay|late|where is my/.test(t)) return "shipping";
    if (/broken|defect|damaged|wrong item|missing|not working|bug|error|glitch|issue|problem|faulty/.test(t)) return "issue";
    if (/price|pricing|quote|cost|discount|how much|fee|rate/.test(t)) return "pricing";
    if (/reschedul|appoint|book(ing)?|slot|meeting time/.test(t)) return "scheduling";
    if (/login|password|access|account locked|can'?t sign|cannot sign|2fa|otp/.test(t)) return "access";
    if (/thank|thanks|appreciate|great job|awesome|wonderful|love (it|this|your)/.test(t)) return "thanks";
    if (/angry|furious|unacceptable|scam|lawsuit|lawyer|terrible|worst|disgusted|complaint/.test(t)) return "escalation";
    if (/\?/.test(t) || /can you|could you|please|how do|when will|where is|what is|would you/.test(t)) return "question";
    return "general";
  }

  function firstNameGuess(text) {
    var sign = text.match(/(?:^|\n)\s*(?:regards|thanks|thank you|cheers|best|sincerely)[,!]?\s*\n+\s*([A-Z][a-z]{1,20})(?:\s+[A-Z][a-z]+)?\s*$/i);
    if (sign) return sign[1];
    var dash = text.match(/[—–-]\s*([A-Z][a-z]{1,20})\s*$/);
    if (dash) return dash[1];
    var from = text.match(/(?:^|\n)\s*(?:from|name)\s*[:\-]\s*([A-Z][a-z]{1,20})\b/i);
    return from ? from[1] : null;
  }

  function bizLabel(context) {
    var c = String(context || "").trim();
    if (!c) return "";
    return clip(c.split(/[·|\n]/)[0].trim(), 48);
  }

  function focusSnippet(message) {
    var lines = String(message || "").split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
    var ask = lines.filter(function (l) {
      return /\?|please|need|want|can you|could you|when|where|why|how|refund|cancel|ship|broken|wrong/i.test(l);
    })[0] || lines[lines.length - 1] || message;
    return clip(String(ask).replace(/[.!?]+$/, "").trim(), 110);
  }

  /* Tone packs — full voice, not just greeting/close */
  var VOICE = {
    professional: {
      greeting: function (name) { return name ? "Dear " + name + "," : "Hello,"; },
      close: function (biz) { return biz ? "Kind regards,\n" + biz : "Kind regards"; },
      ackLead: "Thank you for writing in",
      soften: "",
      firmness: "",
      apology: ""
    },
    friendly: {
      greeting: function (name) { return name ? "Hi " + name + "," : "Hi there,"; },
      close: function (biz) { return biz ? "Warm regards,\n" + biz : "Warm regards"; },
      ackLead: "Thanks so much for reaching out",
      soften: "Happy to help sort this out. ",
      firmness: "",
      apology: ""
    },
    firm: {
      greeting: function (name) { return name ? "Hello " + name + "," : "Hello,"; },
      close: function (biz) { return biz ? "Regards,\n" + biz : "Regards"; },
      ackLead: "I’ve received your message",
      soften: "",
      firmness: "To keep this moving without further delay, please reply with exactly what’s requested below. ",
      apology: ""
    },
    apologetic: {
      greeting: function (name) { return name ? "Dear " + name + "," : "Hello,"; },
      close: function (biz) { return biz ? "Sincerely,\n" + biz : "Sincerely"; },
      ackLead: "Thank you for telling us about this — I’m sorry for the trouble",
      soften: "",
      firmness: "",
      apology: "I’m sorry for the inconvenience this caused. We want to make this right within what our process allows. "
    }
  };

  function orderBit(order) {
    return order ? " (ref #" + order + ")" : "";
  }

  function buildAck(intent, tone, facts) {
    var v = VOICE[tone];
    var o = orderBit(facts.order);
    var dateBit = facts.date ? " regarding " + facts.date : "";
    var map = {
      shipping: v.ackLead + " about your delivery" + o + dateBit + ".",
      refund: v.ackLead + " about a refund request" + o + ".",
      return: v.ackLead + " about a return" + o + ".",
      cancel: v.ackLead + " about cancellation" + o + ".",
      issue: v.ackLead + " about the problem you described" + o + ".",
      pricing: v.ackLead + " with your pricing question.",
      scheduling: v.ackLead + " about scheduling.",
      access: v.ackLead + " about account access.",
      thanks: "Thank you for the kind note — we appreciate it.",
      escalation: v.ackLead + ". I take your concerns seriously.",
      question: v.ackLead + ". Here’s a clear answer to what you asked.",
      general: v.ackLead + ". I’ve read your message carefully."
    };
    var line = map[intent] || map.general;
    if (tone === "apologetic" && intent !== "thanks" && intent !== "escalation") {
      if (line.indexOf("sorry") === -1) line = line.replace(/\.$/, "") + " — I’m sorry this has been frustrating.";
    }
    return line;
  }

  function buildAnswer(intent, tone, facts, context) {
    var v = VOICE[tone];
    var o = orderBit(facts.order);
    var amountBit = facts.amount ? " involving " + facts.amount : "";
    var ctx = context ? ' With your notes (“' + clip(context, 100) + '”) in mind. ' : ' ';
    var focus = facts.focus ? " You mentioned: “" + facts.focus + ".”" : "";

    var core = {
      shipping:
        "I’ve reviewed what you shared about shipping" + o + "." + focus + ctx +
        " The responsible next move is to verify tracking and current status on our side before confirming a revised timeline — I won’t guess an ETA without that check.",
      refund:
        "I’ve reviewed your refund request" + o + amountBit + "." + focus + ctx +
        " We can evaluate this against our usual policy and confirm the outcome in writing once the reference details are complete.",
      return:
        "I’ve noted your return request" + o + "." + focus + ctx +
        " We’ll confirm whether the item is eligible, what to ship back (if anything), and how replacement or credit is handled.",
      cancel:
        "I’ve noted your wish to cancel" + o + "." + focus + ctx +
        " We should confirm whether the order or service is still reversible and what happens to any pending charges before we close it out.",
      issue:
        "I’ve noted the issue you described" + o + "." + focus + ctx +
        " From your description, we need the exact symptom or item details so we can propose a fix, replacement, or workable workaround — not a vague “we’re looking into it.”",
      pricing:
        "On pricing:" + focus + ctx +
        " The clear answer depends on the exact product, plan, or volume you need. Once that’s confirmed, I can outline concrete options rather than a vague range.",
      scheduling:
        "On scheduling:" + focus + ctx +
        " I can hold or propose times once we confirm your preferred window and timezone.",
      access:
        "On access:" + focus + ctx +
        " For security I won’t ask you to share passwords here. We can walk through a safe reset or unlock path and confirm when access is restored.",
      thanks:
        "We’re glad it helped." + (context ? " Notes like yours help us keep improving." : " Thanks again for taking the time to write."),
      escalation:
        "I understand the impact this has had." + focus + ctx +
        " We should document the facts, confirm what went wrong, and propose a concrete remedy — without making promises we can’t keep.",
      question:
        "Regarding your question:" + focus + ctx +
        " The practical answer is to confirm the key detail you need and respond with one clear next action rather than a vague update.",
      general:
        "I’ve reviewed the points you raised" + o + "." + focus + ctx +
        " I want to address the core request accurately before we close the loop."
    };

    var body = core[intent] || core.general;
    var prefix = (v.soften || "") + (v.apology || "");
    return (prefix + body).trim();
  }

  function buildNext(intent, tone, facts) {
    var v = VOICE[tone];
    var askOrder = facts.order ? "" : " Include your order or reference ID if you have one.";
    var map = {
      shipping: "Next step: reply with your preferred contact method" + (facts.order ? "" : " and tracking or order number") + ". I’ll check status and follow up with a concrete update.",
      refund: "Next step: reply with the order/reference ID (if any), the refund reason, and the amount you expected" + (facts.amount ? " (you noted " + facts.amount + ")" : "") + ". I’ll confirm eligibility and the expected processing window.",
      return: "Next step: confirm the item condition and whether you want a replacement or credit." + askOrder + " I’ll send return instructions if needed.",
      cancel: "Next step: confirm the account or order ID and whether you want an immediate cancel or a pause. I’ll process what is possible and confirm in writing.",
      issue: "Next step: send a short note on what you expected vs. what happened (a photo or screenshot helps if relevant)." + askOrder + " I’ll propose a clear fix path.",
      pricing: "Next step: tell me which product/plan or volume you need, and I’ll share a clear option list.",
      scheduling: "Next step: share 2–3 time windows that work (with timezone). I’ll confirm a slot in writing.",
      access: "Next step: reply from the email on the account (don’t include passwords). I’ll outline the safe reset steps and confirm when you’re back in.",
      thanks: "No action needed on your side — if there’s anything else we can help with, just reply to this message.",
      escalation: "Next step: I’ll escalate this for a documented review. Please keep this thread for reference; I’ll reply with findings and options.",
      question: "Next step: if anything above is still unclear, reply with the one detail you still need and I’ll tighten the answer.",
      general: "Next step: reply with any missing detail (order ID, dates, or preferred outcome) and I’ll follow through with a clear update."
    };
    var line = map[intent] || map.general;
    if (tone === "firm") line = line + " " + v.firmness.trim();
    return line.trim();
  }

  /* Non-English: structured usable drafts (general path) */
  var I18N = {
    es: {
      greeting: { professional: "Hola,", friendly: "¡Hola!", firm: "Hola,", apologetic: "Hola," },
      close: { professional: "Atentamente", friendly: "Un saludo", firm: "Saludos", apologetic: "Disculpe las molestias" },
      ack: "Gracias por escribirnos{order}. He leído su mensaje con atención.",
      answer: "He revisado lo que indica{order}.{focus} Quiero abordar su solicitud de forma clara{ctx}.",
      next: "Siguiente paso: responda con cualquier detalle que falte (número de pedido, fechas o resultado deseado) y le confirmaré la actualización.",
      firmExtra: "Para avanzar, responda con el detalle solicitado.",
      apologyExtra: "Lamento las molestias. Queremos resolverlo dentro de lo que permite nuestro proceso."
    },
    fr: {
      greeting: { professional: "Bonjour,", friendly: "Salut,", firm: "Bonjour,", apologetic: "Bonjour," },
      close: { professional: "Cordialement", friendly: "Bien à vous", firm: "Cordialement", apologetic: "Avec nos excuses" },
      ack: "Merci pour votre message{order}. Je l’ai lu avec attention.",
      answer: "J’ai examiné les points soulevés{order}.{focus} Je souhaite traiter votre demande avec précision{ctx}.",
      next: "Prochaine étape : répondez avec tout détail manquant (n° de commande, dates ou résultat souhaité) et je confirmerai la suite.",
      firmExtra: "Pour avancer, merci de fournir le détail demandé.",
      apologyExtra: "Je suis désolé(e) pour la gêne occasionnée. Nous souhaitons corriger cela dans le cadre de notre processus."
    },
    de: {
      greeting: { professional: "Guten Tag,", friendly: "Hallo,", firm: "Guten Tag,", apologetic: "Guten Tag," },
      close: { professional: "Mit freundlichen Grüßen", friendly: "Viele Grüße", firm: "Mit freundlichen Grüßen", apologetic: "Mit Entschuldigung" },
      ack: "Vielen Dank für Ihre Nachricht{order}. Ich habe sie sorgfältig gelesen.",
      answer: "Ich habe Ihre Punkte geprüft{order}.{focus} Ich möchte Ihr Anliegen klar beantworten{ctx}.",
      next: "Nächster Schritt: Antworten Sie bitte mit fehlenden Details (Bestellnummer, Daten oder gewünschtes Ergebnis), dann bestätige ich das weitere Vorgehen.",
      firmExtra: "Damit wir fortfahren können, senden Sie bitte die angeforderten Angaben.",
      apologyExtra: "Es tut mir leid für die Unannehmlichkeiten. Wir möchten das im Rahmen unseres Prozesses richtigstellen."
    },
    hi: {
      greeting: { professional: "नमस्ते,", friendly: "नमस्ते!", firm: "नमस्ते,", apologetic: "नमस्ते," },
      close: { professional: "सादर", friendly: "शुभकामनाएँ", firm: "सादर", apologetic: "क्षमाप्रार्थी" },
      ack: "आपके संदेश के लिए धन्यवाद{order}। मैंने इसे ध्यान से पढ़ा है।",
      answer: "आपके बिंदुओं की समीक्षा की है{order}.{focus} मैं आपके अनुरोध को स्पष्टता से संबोधित करना चाहता/चाहती हूँ{ctx}।",
      next: "अगला कदम: कोई भी छूटा विवरण (ऑर्डर आईडी, तारीखें या अपेक्षित परिणाम) भेजें — फिर मैं स्पष्ट अपडेट दूँगा/दूँगी।",
      firmExtra: "आगे बढ़ने के लिए कृपया माँगा गया विवरण भेजें।",
      apologyExtra: "असुविधा के लिए क्षमा करें। हम अपनी प्रक्रिया के भीतर इसे ठीक करना चाहते हैं।"
    },
    pt: {
      greeting: { professional: "Olá,", friendly: "Oi,", firm: "Olá,", apologetic: "Olá," },
      close: { professional: "Atenciosamente", friendly: "Abraços", firm: "Atenciosamente", apologetic: "Com nossas desculpas" },
      ack: "Obrigado pela sua mensagem{order}. Li com atenção.",
      answer: "Revisei os pontos que levantou{order}.{focus} Quero tratar o pedido de forma clara{ctx}.",
      next: "Próximo passo: responda com qualquer detalhe em falta (ID do pedido, datas ou resultado desejado) e confirmarei a atualização.",
      firmExtra: "Para avançarmos, envie o detalhe solicitado.",
      apologyExtra: "Peço desculpa pelo inconveniente. Queremos corrigir isto dentro do nosso processo."
    }
  };

  function generateI18n(lang, tone, message, context, facts) {
    var pack = I18N[lang];
    var o = facts.order ? " (#" + facts.order + ")" : "";
    var focus = facts.focus ? " Você mencionou / You noted: “" + facts.focus + ".”" : "";
    if (lang === "es") focus = facts.focus ? " Usted mencionó: “" + facts.focus + ".”" : "";
    if (lang === "fr") focus = facts.focus ? " Vous avez indiqué : « " + facts.focus + " »." : "";
    if (lang === "de") focus = facts.focus ? " Sie schrieben: „" + facts.focus + "“." : "";
    if (lang === "hi") focus = facts.focus ? " आपने लिखा: “" + facts.focus + "।”" : "";
    if (lang === "pt") focus = facts.focus ? " Você mencionou: “" + facts.focus + ".”" : "";
    var ctx = context ? ' (“' + clip(context, 80) + '”)' : "";
    var extra = "";
    if (tone === "firm") extra = "\n\n" + pack.firmExtra;
    if (tone === "apologetic") extra = "\n\n" + pack.apologyExtra;
    var biz = bizLabel(context);
    var close = pack.close[tone] || pack.close.professional;
    if (biz) close = close + ",\n" + biz;
    return (
      (pack.greeting[tone] || pack.greeting.professional) + "\n\n" +
      pack.ack.replace("{order}", o) + "\n\n" +
      pack.answer.replace("{order}", o).replace("{focus}", focus).replace("{ctx}", ctx) +
      extra + "\n\n" +
      pack.next + "\n\n" +
      close
    );
  }

  function generate(input) {
    var message = String(input.message || "").trim().slice(0, MAX_MESSAGE_LENGTH);
    var context = String(input.context || "").trim();
    var tone = VOICE[input.tone] ? input.tone : "professional";
    var lang = input.language || "en";
    if (!message) return "";

    var facts = {
      order: extractOrderId(message),
      amount: extractAmount(message),
      date: extractDateHint(message),
      email: extractEmail(message),
      focus: focusSnippet(message),
      name: firstNameGuess(message)
    };
    var intent = detectIntent(message);
    var biz = bizLabel(context);

    if (lang !== "en" && I18N[lang]) {
      return generateI18n(lang, tone, message, context, facts);
    }

    var v = VOICE[tone];
    var draft =
      v.greeting(facts.name) + "\n\n" +
      buildAck(intent, tone, facts) + "\n\n" +
      buildAnswer(intent, tone, facts, context) + "\n\n" +
      buildNext(intent, tone, facts) + "\n\n" +
      v.close(biz);

    return draft.replace(/ +/g, " ").replace(/ *\n */g, "\n").trim();
  }

  var ReplyPilotComposer = {
    version: "local-v2",
    dailyLimit: DAILY_LIMIT,
    storageKey: STORAGE_KEY,
    maxMessageLength: MAX_MESSAGE_LENGTH,
    remaining: remaining,
    consumeOne: consumeOne,
    readUsage: readUsage,
    detectIntent: detectIntent,
    generate: generate
  };

  global.ReplyPilotComposer = ReplyPilotComposer;
})(typeof window !== "undefined" ? window : globalThis);
