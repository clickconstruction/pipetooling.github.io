---
name: "The estimate text's link: short, and on a Click Plumbing address"
number: 281
group: waiting
status: asked 2026-11-07 · PR 1 merged the same day as v2.6657 (#7252: the share link in the text, 107 → 75 characters) · the owner's three calls made 2026-11-07/08 · PR 2 (v2.6677, #7282: the ten-letter code and the guess guard, its migration pushed and the three functions deployed 2026-11-08) and PR 3 (v2.6678: the link on my.clickplumbing.com/e/<code>, the Worker edit live 2026-11-08 and answering 301) built 2026-11-08, both merged that day (#7282, #7287) · walked 2026-11-08 in the owner's Chrome on a ZZ Test estimate: the ten-letter link on my.clickplumbing.com/e/, the accept page, an approval and a resend all as planned; the one slip, the What went card's text line, fixed 2026-11-08 as v2.6725 (PR 4, #7352, merged the same day); call 3 stays *not yet*
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
next: Nothing to build. The walk of 2026-11-08 proved the link, the page, the approval and the resend, and PR 4 (v2.6725) fixed the one slip it found: the What went card names the text that went on the short link, and the job tie moves it onto the job. Call 3 stays *not yet* (the email's link is long until the owner reads the plain-text link and wants it short). PR 4 landed 2026-11-08 (#7352), so the card can retire. A sibling slip, not on this card: the Messages thread's text door (`estimateDoorIo.ts`) does not open an estimate from a text carrying the short link.
size: S (PR 1) + S (PR 2, a migration) + XS (PR 3, the Worker edit) + S (PR 4, the What went card's text line), all shipped and walked
blocker: none
ver: v2.6657 (PR 1) · v2.6677 (PR 2) · v2.6678 (PR 3) · v2.6725 (PR 4)
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

Answered 2026-11-07 (calls 2 and 3, the owner's word) and 2026-11-08 (call 1, from the curl, as the owner asked):

1. **`my.clickplumbing.com/e/…`.** The curl of 2026-11-08: the apex and `www` answer `server: GitHub.com` through Fastly with no `cf-ray`, and `dig` reads GitHub Pages' 185.199.x.x addresses and a CNAME to `click-plumbing.github.io`, so the website's DNS is not proxied through Cloudflare and no redirect rule can fire on it; `my.` answers `server: cloudflare` from the Worker. The Worker edit is live (version `0649f1d4`) and `curl -sI https://my.clickplumbing.com/e/abc2def3gh` answers `HTTP/2 301` with `location: https://clicktooling.com/e/abc2def3gh`. Mirrored in `scripts/cloudflare/portal-link-shell.worker.js`.
2. **10 characters**, with the guard (PR 2, v2.6677).
3. **The email's link stays long** for now (the lean); one more PR if the owner reads the plain-text link and wants it.

The three as they were put:

1. **The host: `clickplumbing.com/e/…` or `my.clickplumbing.com/e/…`.** The apex is 3 characters shorter and reads as the company; it needs the website's DNS proxied through Cloudflare and no `/e/` page on the site. `my.` is already proxied and worker-fronted (the portal links ride it), one worker edit and nothing on the website. **Lean:** `clickplumbing.com/e/…` if the apex is already proxied, else `my.`; the first curl above says which it is.
2. **The code's length against guessing: 10 or 12 characters.** With 31 letters, 10 characters is about 8 × 10¹⁴ codes; against a thousand live codes a guesser at a thousand tries a second expects one hit in about 25,000 years, and the guard answers 429 after 20 misses in an hour anyway. 12 characters is a thousand times that. **Lean:** 10, with the guard; the text then reads `clickplumbing.com/e/` and ten letters.
3. **Should the email's button link go short too?** The button hides the length; the plain-text part of the email shows the URL. Going short there means the email's own token changes shape in `send-estimate-to-customer`, the remail's `findEstimateAcceptUrl` reads the new shape, and the resend's `storeEstimateAcceptUrl` and Copy link show it. **Lean:** not yet; after PR 2 is live, one more PR if the owner reads the plain-text link and wants it.

## Where it stands

- 2026-11-08, PR 4 (v2.6725, `claude/281-what-went-short-link-65a9de`): the slip below fixed. `acceptLinkTie.ts` reads the short link's code off `https://<host>/e/<code>` (lower-cased, a host required) beside the accept link's token, and `textsCarryingLink` takes the estimate's share hashes from `estimate_share_links.token_hash` (`shareLinkHashesIo.ts`, a read the office already has) beside `public_token_hash`; What went's body filter admits `/e/` and reads the hashes; the job tie takes `estimateId` and moves the short-link texts onto the job too. Kernel tests for both shapes and a fake-client test on the read. Walked on the dev server (signed in as the dev through `/dev-login`, reads only) against the owner's rows of the same day: #189 and #190 both draw *Texted the link to <their number> · Open the thread* with the send's time under the email's row (#190 also its *Emailed again, a fresh link* row from the Resend link press), where the owner's walk had read *No text went with the link. Send one from their thread.*; the texts are that walk's `/e/fj4nt3ud5n` and `/e/pmsk4zrr5u`. Not in PR 4: the Messages thread's text door (`estimateDoorIo.ts`) still opens an estimate from an accept link alone.
- 2026-11-08, the walk (in the owner's Chrome, signed in as him, on a ZZ Test customer whose phone and email are his own; the rows stay for him to look at and delete: the customer, estimates #189 and #190, two emails and two texts to his own address and number): **Send both** on #189 texted `https://my.clickplumbing.com/e/fj4nt3ud5n`, ten letters from the alphabet, 41 characters of link; the receipt and the `messages` row carry the same. The link answered 301 onto `clicktooling.com/e/<code>` and drew the accept page with its two options; **Approve "Option 1"** signed and the estimate read Accepted. The card's step 4 as written is not reachable: a sent estimate's page has no **Send to customer** press (the sheet's *Send the link again* band only follows an *already went* answer from the draft editor), so the resend is **Resend link** under Customer activity, which emails a fresh link and shows Copy link but texts nothing; on #190 it went, and the first text's link `…/e/pmsk4zrr5u` still opened the accept page after it. One slip: after both sends the **What went** card read *No text went with the link. Send one from their thread.* under a text that went — `textsCarryingLink` in `src/lib/estimates/acceptLinkTie.ts` matches only `/estimate/accept?t=` and hashes against `estimates.public_token_hash`, while the text's code is a share link whose hash sits in `estimate_share_links` (since PR 1, v2.6657, so every text since then has read as none). Not walked: the guard's 21 wrong codes (it would lock this connection for an hour). Screenshots in the session's report.
- 2026-11-08: PR 2 built as v2.6677 (#7282): migration `20261108053000_estimate_short_codes.sql` re-states `share_estimate_link` for the ten-letter code and adds `estimate_link_misses` + `estimate_link_miss` with the 429 in the three functions through `_shared/estimateLinkMisses.ts`; the SQL bed extended. PR 3 built as v2.6678 on `claude/281-estimate-short-host`: the Worker's `/e/` lines deployed in the dashboard and mirrored, the `/e/:code` route, `ESTIMATE_SHORT_ORIGIN`, the guide's example. Call 1 settled from the curl (above). Left: the push and the three deploys after PR 2 merges, the `chore(types)` regeneration, and the owner's walk, which closes the card.
- 2026-11-07: asked; PR 1 built as v2.6657 on `claude/short-estimate-link` (the kernel and its tests, the io method, the sheet, the Estimates page's `estimateId`, the smoke, the band's words, the guide); PR 2 and PR 3 planned above with the owner's Cloudflare steps. Waiting on: the merge and the walk, then the three calls.
