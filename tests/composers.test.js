"use strict";

var limit = require("../js/pilot-tool-limit.js");
var writer = require("../js/business-writer.js");
var resume = require("../js/resume-helper.js");
var check = require("../js/message-check.js");
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

var email = writer.draft("email", "Launch delayed to Oct 3 because of QA.\nFreeze new requests until then.", "professional");
assert(/Hi there,/.test(email), "Business Writer professional greeting");
assert(/Oct 3|QA|Freeze/.test(email), "Business Writer keeps the pasted notes");
assert(/\[Your name\]/.test(email), "Business Writer includes a sign-off placeholder");

var casual = writer.draft("followup", "Still waiting on the invoice.", "casual");
assert(/^Hi,/.test(casual), "Business Writer casual greeting");
assert(/follow-up/i.test(casual), "Business Writer follow-up uses the follow-up goal");

var empty = writer.draft("email", "   ", "formal");
assert(/more context/.test(empty), "Business Writer asks for context when notes are empty");
assert(/Best regards/.test(empty), "Business Writer formal close");

var bullets = resume.bulletize("Reduced regression time from 6 hours to 45 minutes with a Playwright suite.\nMentored 3 junior testers.", "Automation Engineer");
assert(/45 minutes/.test(bullets), "Resume Helper keeps the metric");
assert(/Mentored 3/.test(bullets), "Resume Helper keeps mentoring fact");
assert(/•/.test(bullets), "Resume Helper emits bullets");
assert(/Automation Engineer/.test(bullets), "Resume Helper can mention the target role");

var cover = resume.cover("Maya Chen", "Automation Engineer", "Built a Playwright suite that cut regression time from 6 hours to 45 minutes.");
assert(/Maya Chen/.test(cover) && /Automation Engineer/.test(cover), "Cover letter names the person and role");
assert(/Hiring Manager/i.test(cover), "Cover letter has a greeting");
assert(/Playwright/.test(cover), "Cover letter keeps the notes");

var phish = check.inspect("Your Microsoft account will be locked in 1 hour. Verify now: http://bit.ly/ms-login and send your password.");
assert(phish.level === "high", "Phishing sample is high risk");
assert(phish.hits.some(function (f) { return f.id === "credential"; }), "Flags credential request");
assert(phish.hits.some(function (f) { return f.id === "urgent"; }), "Flags urgency");
assert(phish.hits.some(function (f) { return f.id === "link"; }), "Flags a link or short link");
assert(/Risk level:/i.test(phish.report) && /password|credential/i.test(phish.report), "Report is copyable and specific");

var calm = check.inspect("Hi Maya — lunch Thursday at 12:30 in the usual place? I’ll book the table.");
assert(calm.level === "ordinary", "Ordinary lunch note is ordinary risk");
assert(/No strong scam patterns/.test(calm.report), "Calm note has no strong flags");

var reply = global.ReplyPilotComposer;
assert(reply && typeof reply.generate === "function", "Existing Reply composer is still exported");
var replyDraft = reply.generate({
  message: "Where is order #A1234? It still has not arrived.",
  tone: "professional",
  language: "en",
  context: "Northwind"
});
assert(/A1234/.test(replyDraft), "Existing Reply composer still includes the order id");

var limiter = limit.make("pilot_test_limit_v1", 2);
assert(limiter.remaining() === 2, "Fresh limiter starts full");
assert(limiter.consume() === true && limiter.remaining() === 1, "Limiter consumes one use");
assert(limiter.consume() === true && limiter.remaining() === 0, "Limiter reaches zero");
assert(limiter.consume() === false, "Limiter blocks after the daily cap");

assert(writer.remaining() === 20, "Business Writer daily limit starts at 20");
assert(resume.remaining() === 20, "Resume Helper daily limit starts at 20");
assert(check.remaining() === 30, "Message Check daily limit starts at 30");
assert(reply.remaining() === 20, "Reply daily limit starts at 20");

if (failed) {
  console.error("\n" + failed + " test(s) failed");
  process.exit(1);
}
console.log("\nAll composer tests passed.");
