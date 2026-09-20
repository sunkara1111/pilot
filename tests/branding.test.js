"use strict";

var fs = require("fs");
var path = require("path");
var assert = require("assert");

var ROOT = path.join(__dirname, "..");
var failed = 0;

function walk(dir, acc) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    if (entry.name === "node_modules" || entry.name === ".git") return;
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  });
  return acc;
}

function check(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

var visitorFiles = walk(ROOT, []).filter(function (f) {
  var rel = path.relative(ROOT, f);
  if (rel.indexOf("scripts/") === 0 || rel.indexOf("tests/") === 0) return false;
  if (rel === "README.md" || rel === "netlify.toml") return false;
  return /\.(html|js|xml|txt|webmanifest|css)$/.test(f);
});

var banned = [
  /get-pilot-app\.netlify\.app/i,
  /netlify\.new/i,
  /\/\.netlify\/scripts\/hud/i,
  /name=["']hosting-provider["']/i,
  /name=["']netlify-deploy["']/i,
  /This site is hosted on Netlify/i,
  /SunkaraOps/i
];

visitorFiles.forEach(function (file) {
  var text = fs.readFileSync(file, "utf8");
  banned.forEach(function (re) {
    check(!re.test(text), path.relative(ROOT, file) + " has no " + re);
  });
});

var html = walk(ROOT, []).filter(function (f) { return f.endsWith(".html"); });
var formCount = 0;
html.forEach(function (file) {
  var text = fs.readFileSync(file, "utf8");
  if (text.indexOf('data-netlify="true"') !== -1) formCount += 1;
});
check(formCount >= 4, "data-netlify form attributes remain for deploy (" + formCount + ")");

check(fs.existsSync(path.join(ROOT, "js/site-config.js")), "SITE_URL config exists");
check(fs.existsSync(path.join(ROOT, "netlify.toml")), "netlify.toml remains");

require("../js/site-config.js");
check(global.PilotSite && global.PilotSite.absolute("/tools/reply") === "/tools/reply", "unset SITE_URL stays path-relative");

if (failed) {
  console.error("\n" + failed + " branding check(s) failed");
  process.exit(1);
}
console.log("\nAll branding checks passed.");
