# Production deploy — get-pilot-app.netlify.app

PR #1 is merged on `main`. The three tools are in this repo. The live hostname is still serving an older drag-and-drop (or other-repo) publish: homepage cards say Coming soon, and `/tools/business-writer` 404s.

GitHub has no deployments, no Actions history, and no Netlify build hook for this repository. An empty commit cannot retrigger production until the Netlify site is linked here.

Existing Netlify site id (from the live HTML): `fa560eb3-53e4-4ae8-9818-395a29e7ac2a`

## Fix (Netlify UI — do this now)

1. Open [app.netlify.com](https://app.netlify.com) → the **get-pilot-app** site (Project ID `fa560eb3-53e4-4ae8-9818-395a29e7ac2a`).
2. **Project configuration → Build & deploy → Continuous deployment**.
3. **Link repository** (or Change repository) → GitHub → `sunkara1111/pilot`.
4. Set:
   - Production branch: `main`
   - Base directory: *(empty)*
   - Publish directory: `.`
   - Build command: `node tests/composers.test.js && node tests/branding.test.js && node scripts/stamp-site-url.js` (already in `netlify.toml`)
5. **Deploys → Trigger deploy → Deploy site** (production).
6. Confirm:
   - `https://get-pilot-app.netlify.app/` shows **Live** on Business Writer, Resume Helper, and Message Check
   - `https://get-pilot-app.netlify.app/tools/business-writer` → 200
   - `https://get-pilot-app.netlify.app/tools/resume-helper` → 200
   - `https://get-pilot-app.netlify.app/tools/message-check` → 200

If the site is still attached to some other folder or an old Drop upload, disconnect that source first, then link `sunkara1111/pilot` as above. Do not create a second Netlify site.

## Optional: GitHub Action deploy

`.github/workflows/deploy-netlify.yml` deploys `main` when these repository secrets exist:

| Secret | Value |
| --- | --- |
| `NETLIFY_AUTH_TOKEN` | A Netlify personal access token with deploy rights |
| `NETLIFY_SITE_ID` | `fa560eb3-53e4-4ae8-9818-395a29e7ac2a` |

Then **Actions → Deploy production to Netlify → Run workflow**.

No custom domain is required for this cutover. Leave `SITE_URL` unset until a domain you already own is attached (see `DOMAIN.md`).
