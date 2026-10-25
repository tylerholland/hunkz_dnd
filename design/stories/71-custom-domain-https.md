# Story 71: A Friendly Domain, over HTTPS

**Status**: Parked (2026-10-24) — waiting on Tyler to have time for DNS records.
**Source**: Tyler, after the homepage redesign: "what's the cheapest and easiest way to add a friendly domain?"

## The problem

The app is served straight from the S3 bucket's website address (`http://<bucket>.s3-website-us-west-1.amazonaws.com`, printed by `deploy.sh`). That address is:

- **Unfriendly:** long and impossible to remember or type at the table.
- **HTTP only:** S3 website endpoints can't serve HTTPS. Browsers mark the page "Not secure", and some browser features need a secure page. Passwords already go to the API over HTTPS (API Gateway); only the page itself is on plain HTTP.

Pointing a custom domain straight at the bucket would still be HTTP only, so HTTPS is part of this story, not an extra.

## Plan (cheapest and easiest)

1. **Domain:** start with a **subdomain of Tyler's personal-name domain** (free), e.g. `dnd.<yourname>.com` or `hunkz.<yourname>.com`. A dedicated domain can be added later as one more alias, with no rework (see *Domain options* below).
2. **CloudFront in front of the S3 bucket.** It serves the same files over HTTPS. At our traffic it stays within the always-free allowance (1 TB and 10M requests a month), so it costs $0.
   - Keep the SPA fallback (unknown paths → `index.html`), as `deploy.sh` sets up on the bucket today.
   - `index.html` short cache; hashed assets long cache.
   - `deploy.sh` invalidates `/index.html` (or `/*`) after each sync, so the stale-client reload (Story 36b) still picks up new builds.
3. **Certificate: AWS Certificate Manager (ACM), free.** It **must be requested in us-east-1** for CloudFront, even though the app lives in us-west-1. Validate it by DNS.
4. **DNS records (Tyler, at his current DNS provider):**
   - the **CNAME that ACM gives for validation** (proves ownership; leave it in place so the certificate auto-renews);
   - a **CNAME from the subdomain to the CloudFront domain** (`dxxxx.cloudfront.net`).
   - Moving DNS to Route 53 isn't needed (it would be $0.50/month per zone).
5. **Wire-up:**
   - Add the subdomain to the API's CORS allowed origins (the API Gateway `CorsConfiguration` in `backend/template.yaml`).
   - Check the WebSocket connection still works from the new origin.
   - Update the frontend URL `deploy.sh` prints.
   - Keep the old S3 address working until everyone has moved over.

**Split of work:**
- **Claude:** steps 2, 3 (requesting the certificate) and 5, in `backend/template.yaml` / `deploy.sh`. Also lists the exact records to add.
- **Tyler:** adds the two DNS records, then runs `./deploy.sh`.

## Domain options (if a dedicated domain is wanted later)

Prices are rough and change; **compare renewal prices, not first-year promos**. Buy at cost from **Cloudflare Registrar** (no markup) or Porkbun.

| Option | Rough cost/yr | Notes |
|---|---|---|
| Subdomain of Tyler's domain | $0 | The plan above |
| `.com` (e.g. `hunkzadventures.com`) | ~$10–12 | Cheap to keep; renewals stay flat |
| `.us` | ~$7–10 | Cheap and stable |
| `.xyz` | ~$1–3 first year, ~$13+ renewal | Cheap to start, not to keep |
| `.quest` / `.party` / `.fun` / `.lol` | promos of a few $, renewals vary widely | On-theme; check renewal |
| `.games` / `.gg` | ~$20–70+ | Pricey |

Adding a dedicated domain later: request (or extend) the ACM certificate to cover it, add it as a CloudFront alternate domain name, add one CNAME, and add it to CORS.

## Done when

- `https://<subdomain>` loads the app with a valid certificate, and deep links like `/chronicle/<id>` work.
- Sign-in, polling, the WebSocket nudge and the stale-client reload all work from the new address.
- `./deploy.sh` updates the site, and invalidates the cache, without manual steps.
