"use strict";

require("../js/business-writer.js");
require("../js/resume-helper.js");
require("../js/message-check.js");
require("../js/reply-composer.js");

var failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

var writer = global.BusinessWriterComposer;
var resume = global.ResumeHelperComposer;
var check = global.MessageCheckComposer;
var reply = global.ReplyPilotComposer;

var emailDraft = writer.generate({
  kind: "email",
  audience: "the design team",
  notes: "Launch delayed to Oct 3 because of QA.\nFreeze new requests until then.",
  tone: "professional",
  context: "Northwind"
});
assert(/Subject:/i.test(emailDraft), "Business Writer includes a subject");
assert(/Oct|October|QA|freeze/i.test(emailDraft), "Business Writer uses the pasted notes");
assert(/design team/i.test(emailDraft), "Business Writer uses the audience");
assert(/Northwind/i.test(emailDraft), "Business Writer uses the sign-off");
assert(emailDraft.length > 120, "Business Writer draft is substantial");
assert(writer.generate({ notes: "" }) === "", "Business Writer rejects empty notes");

var recap = writer.generate({
  kind: "recap",
  audience: "everyone",
  notes: "Decided to ship Friday.\nMaya owns QA.",
  tone: "concise"
});
assert(/Recap|Friday|Maya/i.test(recap), "Business Writer recap keeps decisions");

var bullets = resume.generate({
  mode: "bullets",
  role: "Automation Engineer",
  notes: "Reduced regression time from 6 hours to 45 minutes with a Playwright suite.\nMentored 3 junior testers.",
  tone: "confident"
});
assert(/45/.test(bullets), "Resume Helper keeps the metric");
assert(/Mentored 3/i.test(bullets), "Resume Helper keeps mentoring fact");
assert(/•/.test(bullets), "Resume Helper emits bullets");

var cover = resume.generate({
  mode: "cover",
  role: "Automation Engineer",
  company: "Acme",
  notes: "Built a Playwright suite that cut regression time from 6 hours to 45 minutes.",
  tone: "formal"
});
assert(/Acme/.test(cover) && /Automation Engineer/.test(cover), "Cover letter names role and company");
assert(/Hiring Manager/i.test(cover), "Cover letter has a greeting");

var summary = resume.generate({
  mode: "summary",
  role: "Automation Engineer",
  notes: "Led CI work and cut flake rate.",
  tone: "concise"
});
assert(/Automation Engineer/i.test(summary), "Summary mentions the target role");
assert(resume.generate({ notes: "" }) === "", "Resume Helper rejects empty notes");

var phish = check.analyze({
  message: "Your Microsoft account will be locked in 1 hour. Verify now: http://bit.ly/ms-login and send your password.",
  channel: "email"
});
assert(phish.level === "critical" || phish.level === "high", "Phishing sample is high or critical");
assert(phish.findings.some(function (f) { return f.id === "credentials"; }), "Flags credential request");
assert(phish.findings.some(function (f) { return f.id === "urgency"; }), "Flags urgency");
assert(phish.findings.some(function (f) { return f.id === "short-link"; }), "Flags short link");
var report = check.formatReport(phish);
assert(/Risk:/i.test(report) && /password|credential/i.test(report), "Report is copyable and specific");

var calm = check.analyze({
  message: "Hi Maya — lunch Thursday at 12:30 in the usual place? I’ll book the table.",
  channel: "email"
});
assert(calm.level === "low", "Ordinary lunch note is low risk");
assert(check.generate({ message: "" }) === "", "Message Check rejects empty input");

var replyDraft = reply.generate({
  message: "Where is order #A1234? It still has not arrived.",
  tone: "professional",
  language: "en",
  context: "Northwind"
});
assert(/A1234/.test(replyDraft), "Existing Reply composer still includes the order id");

assert(writer.remaining() === 20 && resume.remaining() === 20 && check.remaining() === 20, "Daily limits start at 20");

if (failed) {
  console.error("\n" + failed + " test(s) failed");
  process.exit(1);
}
console.log("\nAll composer tests passed.");
