---
name: "The bill text's link: short, on a Click Plumbing address, and it never expires"
number: 290
group: ready
status: asked 2026-11-08 · design agreed in chat the same evening · PR 1 (v2.6768: the Worker's /pay/ branch, live as version 82fda521, the text and Copy link on my.clickplumbing.com/pay/<bill id>) built and armed 2026-11-08 (#7414) · PR 2 (v2.6769: the ten-letter code, migration `20261109033000`, pay-link by code) built 2026-11-08 on `claude/290-bill-pay-code`, stacked on PR 1
summary: >
  The text the share row sends with a Stripe bill ended in Stripe's own hosted link, about 160
  characters, which Stripe retires 30 days after the bill's due date. The app already had a door
  that never expires, the pay page at /pay/<bill id>, which asks Stripe for the current link each
  time it is opened; the bill email's Pay now has carried it since v2.4020, the text had not. Two
  PRs: the text and Copy link move onto that page through the Worker on my.clickplumbing.com
  (69 characters, never expires), then a ten-letter code on the bill row takes the place of the
  36-character id (43 characters), with the estimate link's guess guard.
next: The Worker's /pay/ line in the Cloudflare dashboard (the owner's sign-in), then PR 1 armed and merged; PR 2 rebased onto main and armed; after its merge the push, `supabase functions deploy pay-link create-stripe-invoice`, the ZZ TEST walk recorded here.
ver: v2.6768 (PR 1) · v2.6769 (PR 2)
size: XS (PR 1, the Worker edit and a kernel) + S (PR 2, one migration and one function)
blocker: None. The Worker edit is a Cloudflare dashboard step (the owner, or the session in his Chrome).
opinion: build — the pay page is already the resolver; PR 1 is one kernel and a Worker line, PR 2 is one column, one RPC and a second lookup in a function that exists
mockup: not required — the change is the link's length and host in a text that already goes; the before and after are the two lines under The ask
---

# The bill text's link: short, on a Click Plumbing address, and it never expires (#290)

## The ask, in the owner's words

2026-11-08, with a screenshot of the text a ZZ TEST bill sent (*Your invoice for ZZ TEST email save walk ($1.00): https://invoice.stripe.com/i/acct_…/test_…?s=ap*) beside an estimate text whose link is `https://my.clickplumbing.com/e/<ten letters>`:

> I don't like the long stripe link users get via sms when their bill is due to be paid. Can you help me turn it into a short click plumbing link? This also helps guarantee the bill won't expire. Please make sure you are familiar with this concept before you make the change.

The link, by characters:

| | The link |
|---|---|
| Before (Stripe's hosted link) | about 160 |
| PR 1, `my.clickplumbing.com/pay/<bill id>` | 69 |
| PR 2, `my.clickplumbing.com/pay/<ten letters>` | 43 |

## What is true about Stripe's link

Stripe's own docs ([hosted invoice page](https://docs.stripe.com/invoicing/hosted-invoice-page), [link expiration](https://support.stripe.com/questions/invoice-link-expiration)): the hosted invoice link expires 30 days after the due date, 30 days after finalizing when there is none, never past 120 days. After that the customer sees *this link has expired, contact the business*. Stripe's email-recovery page appears only for invoices Stripe itself emailed, and `create-stripe-invoice` finalizes without emailing. Reading the invoice back through the API returns a working link, good for at least ten days. `hosted_invoice_url` is null until the invoice is finalized. The `?s=ap` tail is Stripe's undocumented source tag (the docs' example ends `?s=em`), not part of the key.

So "the bill won't expire" can mean: the link in the text works for the life of the bill, through any rotation of Stripe's own link, because each open asks Stripe for the current one. It cannot mean: a voided bill becomes payable (the page says it was cancelled), or a page the customer is already on outlives Stripe's 30 days (opening the short link again gets a fresh one). Texts already sent keep their old long links.

## The decision

- **The text rides the pay page that already exists.** `/pay/<bill id>` (`src/pages/PayLink.tsx`, punch list #35, v2.3754) calls `pay-link`, which retrieves the invoice from Stripe at click time, refreshes the stored link for every other reader, and answers open, paid or void: the page names the bill and what is left, forwards to Stripe after 1.2 s with a Pay now button, says *Paid* and stops on a paid bill, says *cancelled* on a voided one. The bill email's Pay now has carried it since v2.4020. The nightly `refresh-stripe-invoice-links` (v2.3589) and the refresh on read (v2.3590) keep the stored column fresh for everything else. Rejected: a Worker that answers a 302 straight to Stripe (no Stripe key at the edge, and the paid and voided words would be lost); a shortener outside the repo.
- **The host and path: `my.clickplumbing.com/pay/…`.** The apex is GitHub Pages behind DNS-only records (#281's curl), so `my.` is the host; `/pay/` over `/b/` because the word tells the customer what it is for two characters, the Worker forwards the path unchanged, and the app needs no new route. The Worker (`scripts/cloudflare/portal-link-shell.worker.js`) gains a `/pay/` line before the slug check, as `/e/` has.
- **One code per bill, in plain, never expiring** (PR 2). The bill's id is already the capability for `/pay/<id>` and sits in plain on the row, so a code kept in plain beside it is no weaker; one per bill because a bill has one address for its life (the text, Copy link and a resend show the same); no expiry because a bill is owed until paid, and the paid page stops asking. The estimate's per-send hashed codes (#281) fit a link that retires in 14 days; a bill's does not.
- **The guard** (PR 2): the estimate link's hourly miss counter (`estimate_link_miss`, `_shared/estimateLinkMisses.ts`) reused as it is from `pay-link` on a code that opens nothing, 429 past 20 in the hour from one source; `pay-link` keeps its own 60-a-minute limit too.
- **The email stays.** The bill email already carries `/pay/<id>` behind its Pay now button. The share row's own email draft switches with the text (the same `payUrl`). The QR code (`BillQrModal`, `/pay/<id>`) and the portal's Pay button are unchanged; a later PR could put the code in the QR for a smaller code.

## Where it plugs in

- `src/lib/stripeInvoiceShareCopy.ts`: `buildStripeInvoiceSmsText` takes `payUrl` and is unchanged; the share row hands it the short link.
- `src/lib/billing/billTextLink.ts` (PR 1): the short pay page when the bill's id is at hand, else Stripe's own link. `src/lib/portal/portalShortOrigin.ts`: `BILL_SHORT_ORIGIN`, `billShortUrl`.
- `src/components/jobs/StripeInvoiceSharePanel.tsx`: Text's words, Copy link (three layouts and the text door's head), the Email draft; `Customer pay page` keeps Stripe's link. Callers: `JobFormInvoiceList` and `HostedStripeBillPanel` already hand `invoiceId`; `SendRecordInvoiceModal`'s post-bill panel gains it (`ledger_invoice_id` on `stripeResult`). `CollectPaymentModal`'s Copy payment link.
- `supabase/functions/pay-link/index.ts` and `_shared/payLink.ts` (PR 2): `?code=` beside `?id=`; `src/pages/PayLink.tsx` takes either shape.
- `supabase/functions/create-stripe-invoice/index.ts` (PR 2): mints the code after the write, best effort.

## The plan

**PR 1 (XS, v2.6768, built).** The Worker's `/pay/` branch (deployed in the dashboard, mirrored); `BILL_SHORT_ORIGIN`; `billTextLink` with its tests; the share row and Collect payment on the short link; the post-bill panel handing the id; two render tests; the guides *ready-to-bill-pipeline* and *turn a bill into a Stripe bill*; `docs/DOMAIN_CUTOVER.md`. No migration, no function deploy. The Worker edit must be live before the merge, or a texted link lands on the Worker's slug shell.

**PR 2 (S, v2.6769, one migration, built).**

- Migration (numbered from `origin/main`, `SET lock_timeout = '3s'`): `ALTER TABLE jobs_ledger_invoices ADD COLUMN IF NOT EXISTS pay_code text` with a shape check (`^[23456789abcdefghjkmnpqrstuvwxyz]{10}$`) and a unique partial index; `bill_pay_code(p_invoice_id uuid) → text`, SECURITY INVOKER, `UPDATE … SET pay_code = COALESCE(pay_code, <mint>) WHERE id = $1 RETURNING pay_code`, so the table's RLS and the read-only, twin and archived fences do the refusing (a training account gets a refusal and the client falls back to PR 1's link). The minter is the same unbiased loop as `share_estimate_link`'s, in a helper `mint_pay_code()`. No CREATE TABLE, so no fence appliers. `docs/migrations/<stamp>_bill_pay_codes.md`.
- `pay-link`: `GET ?code=<ten letters>` reads the row by `pay_code` and runs the same flow; a code that opens nothing counts a miss and answers 429 past the limit; `_shared/payLink.ts` gains `isPayCode`. `create-stripe-invoice` calls the RPC after the write, best effort, so new bills carry a code from birth. `docs/EDGE_FUNCTIONS.md` for both.
- `PayLink.tsx`: the route `/pay/:id` takes a UUID or a ten-letter code and asks the function by the right name.
- The client: the share row asks `bill_pay_code` once when it draws (the row keeps it, so one call per bill ever) and builds `my.clickplumbing.com/pay/<code>`; a refusal or a missing RPC falls back to PR 1's `/pay/<id>` link, never Stripe's. `check:calls-ahead` labels the PR *push right after the merge*; the fallback makes either order safe.
- Release order: merge, `supabase db push`, `supabase functions deploy pay-link create-stripe-invoice`, then `chore(types)`.

## How to verify

PR 1, on a ZZ TEST job with a sent Stripe bill (test mode) and a ZZ TEST customer whose number is a tester's phone:

1. `curl -sI https://my.clickplumbing.com/pay/abc` answers `HTTP/2 301` with `location: https://clicktooling.com/pay/abc`.
2. Job window → Bills tab → **Text** on the bill: the orange box reads *Your invoice for … ($1.00): https://my.clickplumbing.com/pay/* and the bill's id, 69 characters of link. Send it; the phone receives the same.
3. Open the link on the phone: the pay page names the bill and the amount, then Stripe's live payment page opens. **Copy link** copies the same address. View bill's Copy link and Collect payment's Copy payment link copy it too.
4. Pay the test bill on Stripe's page with a test card; open the link again: the page reads *Paid* and stops.

PR 2: the same walk with the link ending in ten letters (43 characters); a bill made before the push gets its code on the first draw of the share row; 21 wrong codes from one phone in an hour and the 21st answers the guard's class.

## Where it stands

- 2026-11-08, 21:25 CT: the Worker's `/pay/` line deployed in the dashboard as version `82fda521` (the owner signed in, the session typed the two lines under the `/e/` line and pressed Deploy); `curl -sI https://my.clickplumbing.com/pay/abc2def3gh` answers `HTTP/2 301` with `location: https://clicktooling.com/pay/abc2def3gh`, a capitalised bill id comes back lower-cased, `/e/` and a portal slug answer as before. PR 1 (#7414) armed and queued. PR 2 (#7415) opened on PR 1's branch; its SQL bed failed twice in CI (a customer with no master; a training account that read an existing code back, which is right) and was fixed; it is rebased onto main and armed once PR 1 lands.
- 2026-11-08, later: PR 2 built as v2.6769 on `claude/290-bill-pay-code` (stacked on PR 1's branch): migration `20261109033000_bill_pay_codes.sql`, `pay-link` by code with the miss guard, the page's second shape, `billPayCodeIo` with the share row's and Collect payment's mint, the SQL bed `scripts/pgtest-bill-pay-codes.sh`. The Cloudflare dashboard asked for a sign-in the session cannot do, so the Worker's `/pay/` line is the owner's step (the exact line is in the mirror file); PR 1 is not armed until it is live.
- 2026-11-08: asked, designed (the design's trade-offs above), the owner's yes the same evening. PR 1 built as v2.6768 on `claude/charming-golick-9e4bfc` (#7414). Left on PR 1: the Worker edit in the dashboard, the merge, the walk.
