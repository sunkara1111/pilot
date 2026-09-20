#!/usr/bin/env node
"use strict";

/**
 * Stamp SITE_URL into canonicals, sitemap, robots, and js/site-config.js.
 * HTML/canonicals stay path-relative until a custom (non-*.netlify.app) SITE_URL
 * is set. Sitemap and robots always use absolute https locs — Google requires that.
 */
var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var PUBLIC_ORIGIN = "https://get-pilot-app.netlify.app";
var raw = String(process.env.SITE_URL || "").trim().replace(/\/$/, "");

function isNetlifyApp(url) {
  try {
    var host = new URL(url).hostname.toLowerCase();
    return host === "netlify.app" || host.endsWith(".netlify.app");
  } catch (e) {
    return /netlify\.app/i.test(url);
  }
}

if (raw && !/^https:\/\//i.test(raw)) {
  console.error("SITE_URL must be an https URL with no trailing slash, e.g. https://example.com");
  process.exit(1);
}
if (raw && isNetlifyApp(raw)) {
  console.warn("Refusing to stamp SITE_URL on a *.netlify.app host. HTML stays path-relative.");
  raw = "";
}

var SITE_URL = raw;
var SITEMAP_ORIGIN = SITE_URL || PUBLIC_ORIGIN;

function walk(dir, acc) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "scripts") return;
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  });
  return acc;
}

function prefixHtml(html) {
  if (!SITE_URL) return html;
  return html
    .replace(/(<link rel="canonical" href=")(\/[^"]*)"/g, "$1" + SITE_URL + "$2\"")
    .replace(/(<meta property="og:url" content=")(\/[^"]*)"/g, "$1" + SITE_URL + "$2\"")
    .replace(/(<meta property="og:image" content=")(\/[^"]*)"/g, "$1" + SITE_URL + "$2\"")
    .replace(/(<meta name="twitter:image" content=")(\/[^"]*)"/g, "$1" + SITE_URL + "$2\"")
    .replace(/"url": "(\/[^"]*)"/g, '"url": "' + SITE_URL + '$1"')
    .replace(/"@id": "(\/#[^"]*)"/g, '"@id": "' + SITE_URL + '$1"');
}

var files = walk(ROOT, []).filter(function (f) {
  return /\.(html|js|xml|txt|webmanifest)$/.test(f);
});

var changed = 0;
if (SITE_URL) {
  files.forEach(function (file) {
    var before = fs.readFileSync(file, "utf8");
    var after = before.replace(/__SITE_URL__/g, SITE_URL);
    after = after.replace(/https:\/\/get-pilot-app\.netlify\.app/g, SITE_URL);
    if (file.endsWith(".html")) after = prefixHtml(after);
    if (after !== before) {
      fs.writeFileSync(file, after);
      changed += 1;
    }
  });
}

var sitemapPaths = [
  ["/", "weekly", "1.0"],
  ["/tools/", "weekly", "0.9"],
  ["/tools/reply", "weekly", "0.9"],
  ["/tools/business-writer", "weekly", "0.9"],
  ["/tools/resume-helper", "weekly", "0.9"],
  ["/tools/message-check", "weekly", "0.9"],
  ["/about", "monthly", "0.7"],
  ["/brand", "monthly", "0.5"],
  ["/ip", "monthly", "0.4"],
  ["/terms", "monthly", "0.4"],
  ["/privacy", "monthly", "0.4"],
  ["/copyright", "monthly", "0.4"]
];

var locs = sitemapPaths.map(function (row) {
  return "  <url><loc>" + SITEMAP_ORIGIN + row[0] + "</loc><changefreq>" + row[1] + "</changefreq><priority>" + row[2] + "</priority></url>";
}).join("\n");

var sitemap = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
  "<!-- Canonical sitemap. Locs are absolute https URLs (pretty paths that 200). -->\n" +
  "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n" +
  locs + "\n" +
  "</urlset>\n";
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap);

var robots = "# Pilot — free web app (static)\n" +
  "User-agent: *\n" +
  "Allow: /\n\n" +
  "Sitemap: " + SITEMAP_ORIGIN + "/sitemap.xml\n";
fs.writeFileSync(path.join(ROOT, "robots.txt"), robots);

console.log("Stamped SITE_URL=" + (SITE_URL || "(relative)") + " sitemap origin=" + SITEMAP_ORIGIN + " in " + changed + " source file(s).");
