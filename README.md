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
```

## Deploy

This is a static site. After merge, publish the repo root on Netlify (pretty URLs + `netlify.toml` redirects). Enable the existing `pilot-feedback` Netlify form if this project is a new site connection. No API keys are required.
