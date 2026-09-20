# Custom domain

Public Pilot must not use a `*.netlify.app` hostname. Attach a domain you already own, then set `SITE_URL` to that https origin.

Do not treat any example name in this file as a claimed Pilot domain.

## Netlify UI

1. **Domain management** → Add a domain → enter the hostname you control (apex and/or `www`).
2. Enable **HTTPS** and wait until the certificate is issued.
3. Turn off **Netlify Drawer**, deploy-preview badges, snippets, and any “Powered by Netlify” / sponsored chrome (Site configuration → General / Branding / Snippets).
4. Set the `SITE_URL` environment variable to `https://YOUR-DOMAIN` with no trailing slash. Do not set it to a `*.netlify.app` host — the stamp script will refuse that.
5. Redeploy so canonicals, Open Graph URLs, and `sitemap.xml` stamp to the custom origin. Until then, `sitemap.xml` and `robots.txt` already use absolute `https://get-pilot-app.netlify.app` URLs so Search Console can crawl them.
6. Confirm the `pilot-feedback` form is still enabled if this site connection is new.

## DNS checklist (placeholder)

Copy the exact CNAME / A / ALIAS targets from the Netlify domain screen after you add the hostname. Replace the placeholders; do not invent values.

| Record | Host | Value | Notes |
| --- | --- | --- | --- |
| CNAME | `www` or your subdomain | `YOUR-SITE.netlify.app` | Netlify shows the precise target |
| A / ALIAS / ANAME | `@` (apex) | IPv4 addresses Netlify lists for this site | Prefer ALIAS/ANAME if your DNS host supports it |
| AAAA (optional) | `@` | IPv6 addresses Netlify lists | Only if Netlify shows them |
| CAA (optional) | `@` | allow Let’s Encrypt / Netlify | Only if you already publish CAA |

After DNS and TLS are live:

- [ ] `https://YOUR-DOMAIN` serves Pilot with a valid certificate
- [ ] `http://YOUR-DOMAIN` redirects to HTTPS
- [ ] The public UI has no Netlify badge, drawer, HUD, or `*.netlify.app` copy
- [ ] `SITE_URL` is the https origin and a fresh deploy has stamped canonicals
- [ ] Search Console HTML verification stays at `/google04d4f9506cc11bf7.html` on the live host (and on `YOUR-DOMAIN` after DNS)
