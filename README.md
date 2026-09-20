# Pilot

A free hub of practical tools for communication, business writing, resumes, and message analysis.

Live site: [get-pilot-app.netlify.app](https://get-pilot-app.netlify.app/)

## Tools

- [Reply](https://get-pilot-app.netlify.app/tools/reply) — customer-response drafts
- [Business Writer](https://get-pilot-app.netlify.app/tools/business-writer) — everyday business writing
- [Resume Helper](https://get-pilot-app.netlify.app/tools/resume-helper) — resume bullets and cover letters
- [Message Check](https://get-pilot-app.netlify.app/tools/message-check) — local suspicious-message checklist

All four run in the browser. No account, no API keys, no App Store or Play Store listing.

## Deploy

Publish the repo root on Netlify. `netlify.toml` pretty-URL redirects are included. The build command runs `node tests/composers.test.js`.

If this GitHub repo is not already connected to [get-pilot-app.netlify.app](https://get-pilot-app.netlify.app/), point that site at this repo and redeploy. Re-enable the `pilot-feedback` Netlify form if this is a new site connection.

## Local check

```bash
node tests/composers.test.js
```

Built by Dinesh Gopi Sunkara — Automation Engineer; Master’s degree in Computer Science, Pace University.
