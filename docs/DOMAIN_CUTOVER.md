# Domain cutover: pipetooling.com → clicktooling.com

---
file: DOMAIN_CUTOVER.md
type: Runbook
purpose: The exact steps to make clicktooling.com this app's main URL, with pipetooling.com kept forever as a path-preserving redirect so no link in the wild breaks
audience: Owner + AI agents
last_updated: 2026-08-28
key_sections:
  - name: "Decision & prep already done"
  - name: "Prerequisites (before cutover day)"
  - name: "Cutover day"
  - name: "After cutover"
  - name: "Deliberately unchanged"
---

## Decision & prep already done (v2.2440)

Owner decision 2026-08-28: this app moves to **clicktooling.com**; **pipetooling.com is
kept on this app forever** as a 301 redirect (never given to another app), so every
portal link, GC statement email, job-share link, and bookmark in the wild keeps working.
The app previously at clicktooling.com moves to plumbingtooling.com (separate effort).

Prep merged in v2.2440 — all zero-behavior-change:
- **Client flip point**: `src/lib/appOrigin.ts` (`APP_ORIGIN` / `APP_HOSTNAME` /
  `appUrl()`); the three client call sites that named the domain use it now.
- **Server flip point**: every link-building edge function reads the **`APP_ORIGIN`
  function secret** with a pipetooling.com fallback (gc-statement-email-dispatch,
  invite-user, send-sign-in-email, billed-report-email, payment-forecast-email-dispatch,
  job-share, send-scheduled-reminders, twin-mcp). Setting the secret flips ALL email
  links at once — no redeploys (picked up on cold start).
- **Auth allowlist**: `https://clicktooling.com/**` added to `additional_redirect_urls`
  in `supabase/config.toml` (needs `supabase config push` to reach prod — harmless
  before cutover).

## Prerequisites (before cutover day)

1. **DNS**: put clicktooling.com behind the same DNS host as pipetooling.com
   (Cloudflare recommended — the redirect layer needs it). Create the GitHub Pages
   records for clicktooling.com (apex A records 185.199.108–111.153 + `www` CNAME →
   `clickconstruction.github.io`), but do NOT change the repo CNAME yet.
2. **Verify the domain on GitHub** (org settings → Pages → verified domains) for both
   clicktooling.com and pipetooling.com — prevents domain-takeover between DNS and CNAME
   steps.
3. **Evacuate the old clicktooling.com app** to plumbingtooling.com first — cutover here
   must not race it.
4. `supabase config push` the auth allowlist (if not already applied) so magic links may
   redirect to the new domain.

## Cutover day (about an hour, in this order)

1. **Repo `CNAME`** → `clicktooling.com`; merge. GitHub Pages starts serving the app
   there (TLS cert issues automatically; can take ~15 min).
2. **Client origin**: `src/lib/appOrigin.ts` → `'https://clicktooling.com'`; same PR.
3. **Edge functions**: `supabase secrets set APP_ORIGIN=https://clicktooling.com` — all
   email links flip on next cold start (no redeploys needed).
4. **Auth**: `site_url = "https://clicktooling.com"` in config.toml + `supabase config
   push` (keep pipetooling.com in the allowlist during transition).
5. **Cloudflare on the pipetooling.com zone**:
   - Redirect rule: `pipetooling.com/*` → 301 `https://clicktooling.com/$1`
     (path-preserving, permanent — this rule is forever).
   - Portal short links on the clickplumbing.com zone: **DONE (v2.2495)** —
     since v2.2033 this is the `portal-link-shell` Worker (not a redirect
     rule); its TARGET/CARD/ICON constants now point at clicktooling.com
     (reference copy `scripts/cloudflare/portal-link-shell.worker.js`, kept in
     sync with the dashboard).
   - `share.pipetooling.com` (job-share front) keeps working via the wildcard redirect?
     NO — it's its own subdomain worker/rule. **DONE (v2.2494)**:
     `share.clicktooling.com` added as a second custom domain on the
     `job-share-preview` Worker (the Worker rewrites to the request's own
     origin, so both domains just work) and `JOB_SHARE_PREVIEW_BASE_URL` in
     `src/lib/jobShare.ts` now mints clicktooling links.
     `share.pipetooling.com` stays on the Worker forever for links already
     texted.
6. **Smoke**: sign in at clicktooling.com; dev-login; send a test email (Settings →
   Email templates & testing) and click its links; open a portal link; mint a twin
   session (twin-login default redirect follows APP_ORIGIN).

## After cutover

- **Announce to the crew**: everyone re-installs the PWA from clicktooling.com and
  re-enables push notifications (both are origin-bound; the old install keeps opening
  but lands on the redirect). Expect a few days of both origins in `usage` data.
- **Text sweep** (cosmetic, own PR): help guides (**done v2.2495** — the fix-cache
  guide was the only URL mention; team@noreply sender mentions stay), twin docs
  (`docs/twins/*` — then `node scripts/build-twin-mcp-briefs.mjs` + redeploy
  twin-mcp), UA string in check-estimate-attachment-url, `twin-mcp` tool
  descriptions.
- **Resend sender migration: DONE (v2.2496, completed 2026-08-29)** — email
  sends from `PipeTooling <team@noreply.clicktooling.com>`.
  1. Flip point (v2.2496): every sender reads the `EMAIL_FROM` function secret
     via `supabase/functions/_shared/emailFrom.ts` (fallback = the pipetooling
     sender); all 29 email functions redeployed.
  2. `noreply.clicktooling.com` verified in Resend (us-east-1); DKIM/SPF/MX
     records live in the clicktooling.com Cloudflare zone (mirrors the
     pipetooling record set exactly).
  3. `EMAIL_FROM` secret set. Header-verified on a real receive
     (Outlook): `spf=pass` (send.noreply.clicktooling.com), `dkim=pass`
     (`header.d=noreply.clicktooling.com`), `dmarc=bestguesspass`.
  4. Keep the pipetooling domain verified in Resend forever (fallback + old
     reputation). To roll back: `supabase secrets unset EMAIL_FROM`.
  5. DMARC + rua reporting (2026-08-29): **Cloudflare DMARC Management is
     enabled on BOTH zones** (dashboard → Email → DMARC Management). It owns
     one root record per zone — `_dmarc.<zone>` TXT
     `v=DMARC1; p=none; rua=mailto:<token>@dmarc-reports.cloudflare.net` —
     and renders the who-sends-as-us dashboards there (first reports ~24h
     after receivers see mail). The earlier `_dmarc.noreply.<zone>` records
     were DELETED on purpose: DMARC's org-domain fallback routes the noreply
     subdomains to the monitored root records (Cloudflare's tool doesn't
     support subdomain records), and the roots now also cover spoofing of the
     bare domains. Don't re-add subdomain `_dmarc` records — they'd shadow
     the root and silently drop reporting. Tightening to `p=quarantine` is a
     separate future decision, made in that dashboard after reading reports.
     Deliberately NOT surfaced in the app's dev settings — infrastructure
     monitoring, checked rarely, already rendered by Cloudflare.
  - **Open follow-up**: day-zero domain reputation — the first sends can land
    in Junk until the domain warms up (normal; volume fixes it).
- Keep the pipetooling.com registration + redirect rule FOREVER — old GC statement and
  portal emails link to it.

## Deliberately unchanged

- `team@noreply.pipetooling.com` — sending domain, independent of the app domain.
- `@twins.pipetooling.local` fleet emails — internal identifiers, not URLs.
- `my.clickplumbing.com` — the customer-facing short domain (rule target changes only).
- Supabase project URLs (`yewfzhbofbbyvkvtaatw.supabase.co`) — endpoints don't move.
