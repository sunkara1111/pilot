# Pilot

A free hub of practical tools for communication, business writing, resumes, and message analysis.

Built by Dinesh Gopi Sunkara — Automation Engineer; Master’s degree in Computer Science, Pace University.

## Live tools

All four tools run in the browser. Nothing you paste is sent to a server unless you submit the feedback form.

| Tool | Path | What it does |
| --- | --- | --- |
| Reply | `/tools/reply` | Customer-response drafts |
| Business Writer | `/tools/business-writer` | Everyday business writing drafts |
| Resume Helper | `/tools/resume-helper` | Resume bullets, summaries, cover letters |
| Message Check | `/tools/message-check` | Local checklist for suspicious messages |

## Local preview

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

## Tests

```bash
node tests/composers.test.js
node tests/branding.test.js
```

## Deploy

See [DEPLOY.md](DEPLOY.md) if `https://get-pilot-app.netlify.app/` is still on the old Coming soon publish. Link this GitHub repo (`main`, publish `.`) to that existing Netlify site and trigger a production deploy.

Static site. Publish the repo root. `netlify.toml` pretty-URL redirects and `data-netlify` feedback forms stay for hosting — they are not visitor-facing badges.

Public pages use path-relative links. Canonicals, Open Graph URLs, sitemap, and `js/site-config.js` read a `SITE_URL` env/config constant. Leave it unset until a custom domain is attached. Do not set `SITE_URL` to a `*.netlify.app` host; the stamp script will refuse that.

### After merge (Netlify UI)

See [DOMAIN.md](DOMAIN.md) for the custom-domain DNS/CNAME checklist (placeholder names only — do not invent a public hostname).

1. Disable Netlify Drawer / branded preview badges / “powered by” chrome so the public site is not a Netlify demo.
2. Attach a domain you already own and enable HTTPS.
3. Set the `SITE_URL` environment variable to that https origin (no trailing slash), then redeploy so canonicals and the sitemap become absolute.
4. Re-enable the `pilot-feedback` form if this is a new site connection.

No API keys are required. No SunkaraOps branding.
