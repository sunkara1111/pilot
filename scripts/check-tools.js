#!/usr/bin/env node
/**
 * Smoke-check in-browser tool scripts without a paid LLM API.
 * Uses a tiny DOM/localStorage stub so generate/copy/limit paths stay wired.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function makeDom() {
  const els = {};
  function el(id, extra) {
    els[id] = Object.assign({
      id,
      value: "",
      disabled: false,
      classList: {
        _hidden: false,
        toggle: function (name, force) {
          if (name === "hidden") this._hidden = force === undefined ? !this._hidden : !!force;
        },
        contains: function (name) { return name === "hidden" ? this._hidden : false; }
      },
      addEventListener: function (type, fn) {
        this._listeners = this._listeners || {};
        (this._listeners[type] = this._listeners[type] || []).push(fn);
      },
      click: function () {
        (this._listeners && this._listeners.click || []).forEach(function (fn) { fn(); });
      },
      focus: function () {}
    }, extra || {});
    return els[id];
  }
  el("usage-left");
  el("generate");
  el("copy");
  el("limit-banner", { classList: { _hidden: true, toggle: function (n, f) { if (n === "hidden") this._hidden = !!f; } } });
  el("output");
  el("notes");
  el("kind", { value: "email" });
  el("tone", { value: "professional" });
  el("mode", { value: "bullets" });
  el("role", { value: "Operations analyst" });
  el("name", { value: "Ada" });
  return {
    getElementById: function (id) { return els[id] || null; },
    addEventListener: function (type, fn) {
      if (type === "DOMContentLoaded") fn();
    },
    _els: els
  };
}

function makeStorage() {
  const store = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    _store: store
  };
}

function runTool(scriptName, setup) {
  const document = makeDom();
  const localStorage = makeStorage();
  const clipboard = { last: "", writeText: function (t) { this.last = t; return Promise.resolve(); } };
  const ctx = {
    window: {},
    document,
    localStorage,
    navigator: { clipboard },
    console
  };
  ctx.window = ctx;
  ctx.global = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "pilot-tool-limit.js"), "utf8"), ctx);
  setup(document._els);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", scriptName), "utf8"), ctx);
  return { document, localStorage, clipboard, ctx };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const biz = runTool("business-writer.js", function (els) {
  els.notes.value = "Need Tuesday slot for the onboarding call.";
  els.kind.value = "followup";
  els.tone.value = "formal";
});
assert(biz.document._els["usage-left"].textContent === "20 / 20 today", "business writer meter");
biz.document._els.generate.click();
assert(/Need Tuesday slot/.test(biz.document._els.output.value), "business writer draft");
assert(/Best regards/.test(biz.document._els.output.value), "business writer formal close");
assert(biz.document._els["usage-left"].textContent === "19 / 20 today", "business writer consume");

const resume = runTool("resume-helper.js", function (els) {
  els.mode.value = "cover";
  els.role.value = "Operations analyst";
  els.name.value = "Ada";
  els.notes.value = "I automated weekly reporting.";
});
resume.document._els.generate.click();
assert(/Operations analyst/.test(resume.document._els.output.value), "resume cover role");
assert(/Ada/.test(resume.document._els.output.value), "resume cover name");

const check = runTool("message-check.js", function (els) {
  els.notes.value = "Urgent: your account will be suspended. Send the one-time code now. https://bit.ly/login-here";
});
check.document._els.generate.click();
assert(/High risk/.test(check.document._els.output.value), "message check high risk");
assert(/Pressure/.test(check.document._els.output.value), "message check urgency flag");

const html = [
  "index.html",
  "tools/index.html",
  "tools/business-writer.html",
  "tools/resume-helper.html",
  "tools/message-check.html",
  "sitemap.xml"
].map(function (f) { return fs.readFileSync(path.join(__dirname, "..", f), "utf8"); }).join("\n");
["/tools/business-writer", "/tools/resume-helper", "/tools/message-check"].forEach(function (url) {
  assert(html.includes(url), "listing/sitemap includes " + url);
});
assert(!html.includes("Coming soon"), "no Coming soon leftover in listing files");

console.log("ok — tool scripts, limits, and Live URLs check out");
