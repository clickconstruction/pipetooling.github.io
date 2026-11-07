---
name: "The estimate text's link: short, and on a Click Plumbing address"
number: 281
group: ready
status: claude/short-estimate-link · asked 2026-11-07 · PR 1 built as v2.6657 on this branch (the share link in the text, 107 → 75 characters) · PR 2 and PR 3 planned below
summary: >
  The text the Tell the customer sheet sends with an estimate ended in a 107-character link, a
  64-hex token on clicktooling.com, and the owner wants it much shorter and looking like it came
  from Click Plumbing. Three PRs on one card. PR 1 (built): the text carries the share link that
  already exists for the Messages reply box, 32 characters of token to the same accept page with
  the same powers for the same 14 days, falling back to the email's own link when the mint fails;
  the email keeps its button and its long link. PR 2 (a migration): a 10 to 12 character code from
  an alphabet with no look-alikes, with a guard that counts and logs failed lookups by the hour and
  locks a source after N misses. PR 3 (the owner's Cloudflare rule): the text's link on
  clickplumbing.com/e/<code> or my.clickplumbing.com/e/<code>, a 301 to the app, the app emitting
  that host through one constant beside PORTAL_SHORT_ORIGIN once the owner says the rule is live.
next: Merge PR 1 and walk it on a ZZ Test estimate. Then the owner's three calls below; PR 2 on call 2, PR 3 on call 1 once his Cloudflare rule answers a curl.
size: S (PR 1) + S (PR 2, a migration) + XS (PR 3, the owner's Cloudflare rule)
blocker: none for PR 1; PR 3 waits on the owner's host call and his Cloudflare rule
ver: v2.6657 (PR 1)
mockup: not required — the change is the link's length and host in a text that already goes; the before and after are the two lines under The ask
opinion: build — PR 1 is a kernel and one io method on a link that already exists, PR 2 is one function and one guard, PR 3 is a redirect rule the repo already has a model for
---

# The estimate text's link: short, and on a Click Plumbing address (#281)

## The ask, in the owner's words

2026-11-07, on the text the sheet sent during a walk:

> Robert, this is Robert with Click Plumbing. Your estimate for ZZ Test press answers walk is ready, $1.00. Open it to approve the option you want: https://clicktooling.com/estimate/accept?t=<64 hex>

He wants that link much shorter, and he wants it to look like it came from Click Plumbing: "maybe we offer them a URL that goes to a certain place".

The line in the example, by characters (the words before the link are 146):

| | The link | The whole text |
|---|---|---|
| Before (the email's own link, 64 hex) | 107 | 253 |
| PR 1 (the share link, 32 base64url) | 75 | 221 |
| PR 2 + PR 3 on `clickplumbing.com/e/` (12-character code) | 40 | 186 |
| PR 2 + PR 3 on `my.clickplumbing.com/e/` (12-character code) | 43 | 189 |

## The decision

- **The text gets its own link, not the email's.** The email's token is minted by `send-estimate-to-customer`, kept only as a SHA-256 on the estimate row (`estimates.public_token_hash`), and never stored raw, so nothing can look it up later to shorten it; and a remail reads it back out of the stored email body (`findEstimateAcceptUrl`). Shortening *that* token would mean changing the function, the remail path and the row's shape for a link nobody reads in an email anyway. The share link (#127, `estimate_share_links`, `share_estimate_link`) already exists as a second link to the same page with the same powers, so the text takes one of those. Rejected: a lookup table from a short code to the long token (the raw token is never stored), and a URL shortener outside the repo (a third host in the chain, nothing in the repo to test).
- **The email's link is unchanged in PR 1.** Its button hides the length, and the resend and remail paths read the stored body. Call 3 asks whether it should go short too.
- **Each text's link stands on its own.** Send the link again mints a fresh emailed token that retires the old emailed one; a link texted before keeps working for its 14 days, as every share link does. The band's words and the guide say so now.
- **The mint can fail, the text cannot be lost.** `share_estimate_link` refuses a training account, a twin, anyone off the office team and an estimate not yet `sent`; on any refusal or a lost signal the text goes with the email's own link (`estimateTextLink.ts`).
- **PR 3 does not land on `/q/<code>`.** `/q/:token` is the supply house quote page (`src/App.tsx`). The short host forwards to `/estimate/accept?t=<code>` as the rule can write it, or to a new `/e/:code` route that reads the code from the path, whichever makes the Cloudflare expression simplest (see PR 3).

## Where it plugs in

What exists:

- `supabase/functions/send-estimate-to-customer/index.ts`: mints the email's 32-byte hex token (`randomUrlToken`), stores its SHA-256 and a 14-day `public_token_expires_at`, builds `${origin}/estimate/accept?t=…` and answers `accept_url`.
- `supabase/migrations/20261019050000_estimate_share_links.sql`: `estimate_share_links` (estimate, `token_hash` 64 hex, `made_by`, `made_at`, `expires_at`) and `share_estimate_link(p_estimate_id)`, which mints 24 random bytes as 32 base64url characters, stores the hash, 14 days, and returns the token once. `src/lib/messages/estimateLinkIo.ts` builds the URL on `APP_ORIGIN` for the `{estimate}` blank in the Messages reply box.
- `supabase/functions/_shared/estimateTokenLookup.ts`: the three functions that open an estimate from a link (`get-estimate-for-customer`, `accept-estimate`, `log-estimate-option-view`) hash the `t` they are given and ask which estimate the hash is, the row's own hash first, then `estimate_share_links`; a share link stops on its own day. So the share token lands the customer on the same `/estimate/accept` page (`src/pages/EstimateAccept.tsx` reads `t`) with the same powers: open, approve an option, decline. Nothing in the lookup depends on the token's length, which is what makes PR 2 a one-function change.
- `src/components/customers/TellCustomerSheet.tsx` → `go`: the email first through `estimate.sendEmail()`, then `sendText(fillLine(text, { link }))`. `src/lib/tellCustomer/tellCustomer.ts` holds `DEFAULT_LINES.estimate` with its `{link}` blank; `tellCustomerIo.ts` the sheet's io.
- `src/lib/portal/portalShortOrigin.ts`: `PORTAL_SHORT_ORIGIN` (`https://my.clickplumbing.com/`), fronted by the Cloudflare Worker `scripts/cloudflare/portal-link-shell.worker.js` (a reference copy, edited in the dashboard), which serves a link preview and bounces to `clicktooling.com/p/<slug>`. `scripts/cloudflare/prts-co-redirect.md`: a zone-level dynamic 301 (`prts.co/B/<code>` → `clicktooling.com/b/<code>`), the model for PR 3's rule. `src/lib/appOrigin.ts`: `APP_ORIGIN`.

What PR 1 added (v2.6657): `src/lib/tellCustomer/estimateTextLink.ts` (pure: the share link when one came back, else the email's own; the async wrapper that swallows the mint's failure) with its test; `TellCustomerIo.shareEstimateLink` through `estimateLinkIo.ts`; `TellEstimate.estimateId` from `src/pages/Estimates.tsx`; the sheet's smoke for the short link and the fallback; the band's words; the guide.

## The plan

**PR 1 (S, v2.6657, built on this branch).** The text's `{link}` fills with the share link, minted after the send succeeds; the email keeps its button and its long link; a failed mint falls back to `r.acceptUrl`. The long link keeps working; the remail path is unchanged; the two walk tests (`walkRun.test.ts`, `walkDriver.run.test.ts`) are untouched since the template did not change. Not in it: the walk kit's own driver (`src/lib/walk/walkDriver*.ts`) still texts the email's long link, a separate path from the sheet.

**PR 2 (S + one migration): the shorter code.**

- A new migration (numbered from `origin/main`, `SET lock_timeout = '3s'`, registered with `npm run claim -- --migration`) re-states `share_estimate_link` to mint a code of 10 to 12 characters (call 2) from the alphabet `23456789abcdefghjkmnpqrstuvwxyz`, 31 letters with no 0, O, 1, l or I, read aloud over the phone without a mistake; `token_hash` keeps the code's SHA-256, so the `estimate_share_links_token_hash_shape` check, the unique, the 14 days and `estimateTokenLookup.ts` are unchanged, and no edge function redeploys. A 10-character code is about 49.5 bits, a 12-character one about 59.4.
- **The guard on guessing**, in the same migration and the three edge functions: a table `estimate_link_misses` (the hour, a hash of the caller's address, the count) that the three functions bump through one `SECURITY DEFINER` function on a lookup that finds no hash; the function answers the count, and the edge function logs the miss (`console.warn` with the hour's count, which lands in the function logs) and answers 429 with plain words once a source passes N in the hour (N = 20; a customer mistyping a code by hand cannot reach it, a script does on its first minute). The functions do not know which code a miss aimed at, so the lock is on the source, not the code; a code itself is locked by its own `expires_at` and by the count of live codes against 31^10. Nightly, the table drops hours older than a day (a `pg_cron` line, as the other sweeps do). `docs/migrations/<stamp>_estimate_short_codes.md`, `docs/EDGE_FUNCTIONS.md` sections for the three functions, a `pgtest` bed on `scripts/pgtest-estimate-share-links.sh` for the alphabet, the length and the guard's count.
- Release order: merge, `supabase db push`, then `supabase functions deploy` the three functions. The client needs no change: `estimateAcceptUrl` takes whatever token the RPC returns.

**PR 3 (XS + the owner's Cloudflare step): the Click Plumbing address.**

- The app: `ESTIMATE_SHORT_ORIGIN` beside `PORTAL_SHORT_ORIGIN` in `src/lib/portal/portalShortOrigin.ts`, `null` until the owner says the rule is live, then the chosen host; `estimateTextLink.ts` builds `${ESTIMATE_SHORT_ORIGIN}/e/<code>` when it is set, else the accept URL as today; a route `/e/:code` in `src/App.tsx` that draws `EstimateAccept` with the code from the path (the accept page reads `t` from the query today; the route hands it the same value), so the redirect rule can forward the path as it is. `docs/twins/APP_DIRECTORY.md` gains the route; `docs/DOMAIN_CUTOVER.md`'s note on the Cloudflare-fronted hosts gains a line. The link preview the worker serves for portal links is not needed here: an estimate link is a private page, `noindex`, and a text's preview card would show the customer's estimate title to anyone the text is forwarded to.
- The owner's Cloudflare step, modelled on `scripts/cloudflare/prts-co-redirect.md`, mirrored into a new `scripts/cloudflare/clickplumbing-estimate-redirect.md` when done:

  *If call 1 is `clickplumbing.com/e/…`:* in the `clickplumbing.com` zone, DNS → confirm the apex (`@`) and `www` records are **Proxied** (orange cloud); if the website's host needs DNS-only, this host is not available and `my.` is the answer. Then Rules → Overview → Redirect Rules → Create rule: name *Estimate links to the app*; when incoming requests match, custom filter expression `(http.host in {"clickplumbing.com" "www.clickplumbing.com"}) and starts_with(http.request.uri.path, "/e/")`; then URL redirect, type **Dynamic**, expression `concat("https://clicktooling.com", lower(http.request.uri.path))`, status 301, *Preserve query string* on. Save and deploy. Check the website has no page of its own under `/e/`.

  *If call 1 is `my.clickplumbing.com/e/…`:* Workers & Pages → `portal-link-shell` → Edit code: before the slug check, `if (url.pathname.startsWith('/e/')) return Response.redirect('https://clicktooling.com/e/' + url.pathname.slice(3).toLowerCase(), 301)`; deploy; mirror the same lines into `scripts/cloudflare/portal-link-shell.worker.js` in the PR. No DNS or rule change: the route `my.clickplumbing.com/*` already reaches the worker, and a redirect rule on the same host would run before it and is not wanted.

  *Verify, either way:* `curl -sI https://<host>/e/abc2def3gh` answers `HTTP/2 301` with `location: https://clicktooling.com/e/abc2def3gh`; `curl -sIL http://<host>/e/abc2def3gh` ends on the app. Until the `/e/:code` route is on `main` the landing is the app's 404 page; the redirect is what this checks. Then the owner says *live*, and the PR flips the constant.

## How to verify

PR 1, a walk at the office's desk on a ZZ Test customer whose number is a tester's phone:

1. Open a draft estimate for the customer, press **Send to customer**, keep the text as it is, press **Send both to …**.
2. The receipt's text ends in `https://clicktooling.com/estimate/accept?t=` and 32 characters, 75 in all; the phone receives the same. Open it: the accept page draws the estimate with its options; approve one; the office sees the approval as before.
3. Open the email: its button still carries the 64-hex link, and it still opens.
4. On the same estimate press **Send to customer** again: the band says it already went; press **Send the link again**. The new email's link opens; the new text's link opens; the first text's link still opens; the first email's link says it stopped working.
5. The fallback cannot be walked by hand without a refusing account; it is the smoke *a share link that cannot be made falls back to the email's own link*.

Gotcha: `share_estimate_link` requires the estimate to be `sent`, which `send-estimate-to-customer` writes before it answers, so the sheet mints after the send answers, never before.

PR 2: the pgtest bed for the alphabet, the length and the guard; a live walk as above, the link now 10 to 12 characters of code; 21 wrong codes from one phone in an hour and the 21st answers the guard's words. PR 3: the two curls above, then a walk as above with the text ending on the Click Plumbing host.

## The owner's calls

1. **The host: `clickplumbing.com/e/…` or `my.clickplumbing.com/e/…`.** The apex is 3 characters shorter and reads as the company; it needs the website's DNS proxied through Cloudflare and no `/e/` page on the site. `my.` is already proxied and worker-fronted (the portal links ride it), one worker edit and nothing on the website. **Lean:** `clickplumbing.com/e/…` if the apex is already proxied, else `my.`; the first curl above says which it is.
2. **The code's length against guessing: 10 or 12 characters.** With 31 letters, 10 characters is about 8 × 10¹⁴ codes; against a thousand live codes a guesser at a thousand tries a second expects one hit in about 25,000 years, and the guard answers 429 after 20 misses in an hour anyway. 12 characters is a thousand times that. **Lean:** 10, with the guard; the text then reads `clickplumbing.com/e/` and ten letters.
3. **Should the email's button link go short too?** The button hides the length; the plain-text part of the email shows the URL. Going short there means the email's own token changes shape in `send-estimate-to-customer`, the remail's `findEstimateAcceptUrl` reads the new shape, and the resend's `storeEstimateAcceptUrl` and Copy link show it. **Lean:** not yet; after PR 2 is live, one more PR if the owner reads the plain-text link and wants it.

## Where it stands

- 2026-11-07: asked; PR 1 built as v2.6657 on `claude/short-estimate-link` (the kernel and its tests, the io method, the sheet, the Estimates page's `estimateId`, the smoke, the band's words, the guide); PR 2 and PR 3 planned above with the owner's Cloudflare steps. Waiting on: the merge and the walk, then the three calls.
