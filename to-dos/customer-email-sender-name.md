---
name: Customer emails come from Click Plumbing and Electrical
number: 53
group: ready
status: planned 2026-09-28 · PR 1 shipped v2.4127 (the helper, `COMPANY_EMAIL_FROM`, the bill email and its copies), deployed and run live 2026-09-29 · PRs 2–3 not started
summary: >
  Most emails the app sends a customer, a GC, a supply house or a law firm show "ClickTooling"
  as the sender in the inbox — the name of our software, not of the company the reader hired.
  Customer-facing emails should read "Click Plumbing and Electrical"; staff emails keep
  "ClickTooling" so the team can tell an app notice from a customer thread.
next: PR 2 — the rest of the customer senders + the catalog guard test, and the Bill Customer window's "a copy from ClickTooling" line (a code string) reads the company; the owner glances at the 2026-09-29 test bill in robert@'s inbox for the sender name.
size: S
blocker: None.
opinion: build on — the bill is done (v2.4127); every other customer email still says "ClickTooling" until PR 2
mockup: not required — the change is the sender name in the inbox list; nothing in any email body moves
---

# Customer emails come from Click Plumbing and Electrical

## The ask

> "help me come up with a plan to make the sender name Click Plumbing and Electrical" — owner, 2026-09-28

Raised while shipping the bill email with the statement's QR code (v2.4020, v2.4039): the payer
now gets the bill email from us rather than from Stripe, and the inbox shows it as
**ClickTooling &lt;team@noreply.clicktooling.com&gt;**.

## How the sender is set today

- `supabase/functions/_shared/emailFrom.ts` — `EMAIL_FROM`, from the `EMAIL_FROM` function secret,
  falling back to `ClickTooling <team@noreply.clicktooling.com>`. Every sender uses it.
- Two customer emails already override the **display name only**, keeping the verified address:
  - `send-contract-for-signature` — `Click Plumbing and Electrical <address>` (`CONTRACT_SIGNING_EMAIL_COMPANY`).
  - `send-estimate-to-customer` — `estimateEmailCompanyName(brand)`: *Click Plumbing*, *Click Electrical*
    or *Click Plumbing and Electrical* by the estimate's trade.
  Both parse the address out of `EMAIL_FROM` inline (`/<([^>]+)>/`). This plan makes that one helper.
- `_shared/resendSendEmail.ts` → `sendEmailViaResend` always sends as `EMAIL_FROM`; about half the
  senders call it, the rest `fetch` Resend themselves with `from: EMAIL_FROM`.

## The decision

- **Customer-facing emails** — every row of `src/lib/emailCatalog.ts` with `audience: 'customer'` —
  show **Click Plumbing and Electrical** (`PORTAL_COMPANY.name`, the letterhead the portal and the
  bill email already use).
- **Staff and team emails** (`audience: 'internal'` and `'team'`: digests, notices, sign-in, invitations)
  keep **ClickTooling**. The team reads both kinds in one inbox; the name tells them apart.
- **Only the display name changes.** The address stays `team@noreply.clicktooling.com` (the domain
  verified in Resend), and Reply-To stays the person who sent it, as today. The `EMAIL_FROM` secret
  is not touched.
- **The estimate email keeps its per-trade name** (*Click Plumbing* / *Click Electrical*); it already
  does the right thing for its reader.

### Open questions for the owner

1. **Contract for signature** is catalogued as `team` (it goes to subs) but already shows the company
   name. Keep it as is? (Assumed yes.)
2. **Supply houses and law firms** (`send-rfq-email`, `send-supply-house-job-account`, the legal
   portal emails) are `customer` in the catalog — so they switch too. Right? (Assumed yes: they deal
   with the company, not the software.)
3. **A clickplumbing.com address** (`billing@clickplumbing.com` instead of `noreply.clicktooling.com`)
   is a separate, larger step: the domain has to be verified in Resend (DNS records on the
   clickplumbing.com zone) and replies routed. Not in this plan.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| `_shared/emailFrom.ts` · `_shared/mailboxWithName.ts` | `EMAIL_FROM`; `mailboxWithName(name, mailbox)` and `COMPANY_EMAIL_FROM` (= the company name on `EMAIL_FROM`'s address) — shipped v2.4127 | — |
| `_shared/resendSendEmail.ts` | `sendEmailViaResend(…, options)` with `options.from` (v2.4127) — defaults to `EMAIL_FROM`; the logged `from_email` follows it | — |
| `src/lib/emailCatalog.ts` | `audience` per email | a guard test: every `customer` sender imports `COMPANY_EMAIL_FROM` (a source scan, like `appDirectoryCheck`) |
| `email_send_log.from_email` | written per send | nothing — it records whatever `from` was used |

## The plan (PR train, smallest first)

1. **The helper, and the bill email first — shipped v2.4127.** `mailboxWithName` + `COMPANY_EMAIL_FROM` in `emailFrom.ts`
   (unit tests: a bare address, `Name <addr>`, a name with quotes or commas is quoted per RFC 5322);
   `sendEmailViaResend` takes `options.from`. `send-contract-for-signature` and
   `send-estimate-to-customer` swap their inline regex for the helper (no change in what they send).
   `send-stripe-invoice` sends the bill email and its copies as `COMPANY_EMAIL_FROM`.
   Deploy: `send-stripe-invoice`, `send-contract-for-signature`, `send-estimate-to-customer`.
2. **The rest of the customer senders**, one PR: `send-physical-invoice-email`, `send-test-report` and
   `auto-send-test-reports`, `send-hazmat-notice-email`, `send-gc-statement-email`,
   `gc-statement-email-dispatch`, `send-supply-house-job-account`, `legal-notify-dispatch`,
   `submit-legal-portal`, `send-lien-filing-email`, `send-lien-release-email`, `send-bid-room-link`,
   `send-bid-pricing-package`, `send-rfq-email`. Adds the catalog guard test so a new customer email
   cannot ship as ClickTooling. Deploy each changed function (`bash scripts/deploy-functions.sh …`).
3. **Settings → What customers see** shows the From line above each sample email, so the office can
   see what the inbox shows. Small; can fold into PR 2.

Each PR: release note + `docs/recent-features/` fragment, `docs/EDGE_FUNCTIONS.md` notes for the
changed functions, and the sender line in `docs/BILLING_FLOWS.md` where it names the From.

## How to verify

- Unit: the helper's cases; the catalog guard fails when a `customer` sender uses bare `EMAIL_FROM`.
- Live, PR 1: a **test-mode** bill on the *ZZ TEST Row 4 create-path probe* job (customer
  *ZZ TEST Owner On Notice*, which has a portal and a short address) — Send Email invoice sends it to
  whoever pressed Send; the inbox should read **Click Plumbing and Electrical**. v2.4020's test on
  2026-09-28 is the recipe (dev login signs in as `robert@douglasmining.com`, so that is the inbox).
  **Run 2026-09-29** after the three functions deployed (`check:edge-drift` clean): a fresh $100 draft
  on the job → Stripe bill in Test mode (invoice `#1054-2609291046`, left open on the job) → Send
  Email invoice → *"Test bill: the email came to you (robert@douglasmining.com), not the customer."*
  The session could not open that inbox, so the sender name as the inbox shows it is the owner's one
  glance; the function that sent it is the v2.4127 build. Found on the way: the Bill Customer window's
  Send-to line still says *a copy from ClickTooling* — a code string, PR 2.
- Live, PR 2: `email_send_log.from_email` for the next send of each type reads the company name;
  Resend's dashboard shows delivered, not bounced (a display-name change does not touch SPF/DKIM).
