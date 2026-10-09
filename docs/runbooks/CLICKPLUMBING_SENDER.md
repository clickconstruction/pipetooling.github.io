# Runbook: customer email from billing@clickplumbing.com

---
file: CLICKPLUMBING_SENDER.md
type: Runbook
purpose: Send customer email from billing@clickplumbing.com with replies routed to office@clickplumbing.com
audience: The owner, devs
last_updated: 2026-10-09
---

**The owner's call (2026-10-09):** customer email goes out from `billing@clickplumbing.com`, and replies to it land in `office@clickplumbing.com`.

**Why:** today customer email goes out from `team@noreply.clicktooling.com`. That name has no MX, A or AAAA record. A customer who replies to an email with no Reply-To of its own gets a bounce.

**The order:** first the DNS records and the reply route, below. The code changes only after the owner says the domain is verified in Resend: one flip PR, then the 57 functions that bundle the sender redeploy. Nothing in the app changes before that PR. Shipping the change before then would redeploy 57 functions twice for nothing.

## What is there today (read 2026-10-09)

| Name | Type | Value | What it means |
|---|---|---|---|
| `clickplumbing.com` | NS | `clay.ns.cloudflare.com`, `nelci.ns.cloudflare.com` | The zone is on Cloudflare. Records are added there. |
| `clickplumbing.com` | MX | `1 smtp.google.com` | Google Workspace receives all `@clickplumbing.com` mail. Nothing here changes it. |
| `clickplumbing.com` | TXT | `google-site-verification=…` only | No SPF at the root. Resend does not need one there; see below. |
| `google._domainkey.clickplumbing.com` | TXT | `v=DKIM1; k=rsa; p=…` | Google Workspace signs its own mail, so office@'s mail passes DMARC through DKIM. |
| `_dmarc.clickplumbing.com` | TXT | none | No DMARC yet. |
| `send.clickplumbing.com`, `resend._domainkey.clickplumbing.com` | — | none | The domain is not in Resend yet. |

The live sender's records, for comparison (`noreply.clicktooling.com`, verified in Resend us-east-1, `docs/DOMAIN_CUTOVER.md` → Resend sender migration):

| Name | Type | Value |
|---|---|---|
| `send.noreply.clicktooling.com` | MX | `10 feedback-smtp.us-east-1.amazonses.com` |
| `send.noreply.clicktooling.com` | TXT | `v=spf1 include:amazonses.com ~all` |
| `resend._domainkey.noreply.clicktooling.com` | TXT | `p=…` (Resend's key for that domain) |
| `_dmarc.clicktooling.com` | TXT | `v=DMARC1; p=none; rua=mailto:<token>@dmarc-reports.cloudflare.net` (Cloudflare DMARC Management) |

## The records to add

Add them in Cloudflare → `clickplumbing.com` → DNS → Records. This is Resend's set for a domain added at its root in us-east-1 (North Virginia), the same region as the live sender:

| Type | Name | Content | Priority |
|---|---|---|---|
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |
| TXT | `resend._domainkey` | `p=<the key Resend shows for clickplumbing.com>` | — |

- **Resend's domain page is the source of truth.** The DKIM key exists only after the domain is added in Resend, and it is unique to the domain. If Resend's page shows a different value for any record, use Resend's. A region other than us-east-1 changes the MX host.
- **Nothing here touches the root.** The root MX and TXT stay as they are, so Google keeps receiving all `@clickplumbing.com` mail. The `send` MX only takes Resend's bounces and complaints (the Return-Path). It never receives a reply.
- **Resend's SPF lives on `send`, not the root.** Do not add Resend's SPF at the root. A root SPF for Google (`v=spf1 include:_spf.google.com ~all`) would be a separate decision, and a name can hold only one SPF record.
- **MX and TXT records have no proxy.** Leave TTL on Auto.
- **DMARC comes from Cloudflare.** Enable Cloudflare DMARC Management on the `clickplumbing.com` zone (dashboard → Email → DMARC Management), as on clicktooling.com. It creates the root `_dmarc` record at `p=none` and shows who sends as the domain. Add no `_dmarc` record under `send`. Moving past `p=none` is a later decision, made after reading the reports.

## The reply route: billing@ → office@

Replies to `billing@clickplumbing.com` reach Google Workspace through the root MX. Resend never sees them. Give office@ the alias in the Google Admin console (admin.google.com):

1. Search the console for `billing`. If billing@ already exists as a user, a group or an alias, stop and ask the owner.
2. **If office@ is a user:** Directory → Users → office@ → User information → Alternate email addresses (email alias). Add `billing` and save.
3. **If office@ is a group:** Directory → Groups → office@ → Group information → Group aliases. Add `billing`. Then check that the group takes mail from outside the organization (Who can post includes External). If it does not, a customer's reply is rejected.
4. An alias usually works within minutes. Google allows up to 24 hours.
5. Optional: staff who want to answer *as* billing@ add it in Gmail → Settings → Accounts → Send mail as.

### Reply-To: whose inbox gets the reply after the flip

The flip changes the From line only. A sender that sets its own Reply-To keeps it, so the reply goes to that person and not to office@.

**The example:** a GC statement's reply goes to the person who sent it, or to the account man the sender named (punch list #49, `_shared/gcStatementReplyTo.ts`). A scheduled statement's reply goes to whoever scheduled it (`gc-statement-email-dispatch`).

As of 2026-10-09, the 21 customer senders split this way:

- **No Reply-To, so the reply lands in office@ (9):**
  - bills: `send-physical-invoice-email`
  - test reports: `send-test-report`, `auto-send-test-reports`
  - the hazmat notice: `send-hazmat-notice-email`
  - lien filing and release: `send-lien-filing-email`, `send-lien-release-email`
  - the legal portal's mail: `submit-legal-portal`, `legal-notify-dispatch`
  - the bid pricing package: `send-bid-pricing-package`
- **Their own Reply-To (12):** a reply goes to the staff member behind the send, when that person has an email on file. Otherwise it lands in office@.
  - the GC statement senders: `send-gc-statement-email`, `gc-statement-email-dispatch`
  - the estimate and the contract for signature: `send-estimate-to-customer`, `send-contract-for-signature`
  - the Stripe bill, to the caller: `send-stripe-invoice`
  - `send-rfq-email`
  - the bid room and submittal room links: `send-bid-room-link`, `send-submittal-room-link`
  - `send-supply-house-job-account`
  - the GC trade and GC customer emails, to the PM or the caller: `gc-trade-email`, `gc-customer-email`
  - the firm link: `legal-send-firm-link`

Copying office@ on those is a separate change if the owner wants it.

## Order of operations

1. **Google Workspace:** add billing@ as office@'s alias (above). Run check (a).
2. **Resend** (resend.com → Domains → Add domain): add `clickplumbing.com` in North Virginia (us-east-1). Leave the custom return path at its default, `send`. Copy the DKIM value. If Resend refuses for the plan's domain limit, stop: that is the owner's call.
3. **Cloudflare:** add the three Resend records. Run check (b).
4. **Resend:** press Verify and wait for Verified on DKIM and SPF. Run check (c). If Resend marks a record failed, fix the one it names and press Verify again.
5. **Cloudflare:** enable DMARC Management for `clickplumbing.com`. Run check (d).
6. **Resend → API Keys:** find the key the functions use, the one in the `RESEND_API_KEY` function secret. Its Last used time is recent.
   - The key must be Full access, or Sending access with the domain set to All domains.
   - A key limited to `noreply.clicktooling.com` gets a 403 on every send from billing@.
   - If it is limited, swapping it is its own step. Make a sending key for all domains and run `supabase secrets set RESEND_API_KEY=…` from your own shell. Never paste the key into a chat, a file or a commit. Then check that a staff email (a sign-in link) still arrives.
   - Supabase Auth's SMTP key (`pipetooling-supabase-smtp`) is a separate key and is not touched.
7. **Loop test, before any code:** run checks (e) and (f).
8. **The owner says the domain is verified.** Open the flip PR (below), merge it, deploy the 57 functions, and run check (g).
9. **After the flip:** run check (h).

## Checks

**(a) The alias.** From a mailbox outside the company, write to `billing@clickplumbing.com`. It lands in office@'s inbox.

**(b) The records.** Each command should print the line under it.

```bash
dig +short MX send.clickplumbing.com
```

`10 feedback-smtp.us-east-1.amazonses.com.`

```bash
dig +short TXT send.clickplumbing.com
```

`"v=spf1 include:amazonses.com ~all"`

```bash
dig +short TXT resend._domainkey.clickplumbing.com
```

`"p=…"`, the same value as Resend's domain page.

```bash
dig +short MX clickplumbing.com
```

`1 smtp.google.com.`: nothing moved Google's MX.

**(c) Resend.** The domain page reads Verified.

**(d) DMARC.**

```bash
dig +short TXT _dmarc.clickplumbing.com
```

`"v=DMARC1; p=none; rua=mailto:<token>@dmarc-reports.cloudflare.net"`

**(e) A real send from billing@.** Make a short-lived Sending access key for `clickplumbing.com` in Resend → API Keys. Export it as `RESEND_TEST_KEY` in your own shell, and put a mailbox you own outside the company in the `to` field:

```bash
curl -sS https://api.resend.com/emails -H "Authorization: Bearer $RESEND_TEST_KEY" -H 'Content-Type: application/json' -d '{"from":"Click Plumbing and Electrical <billing@clickplumbing.com>","to":["you@example.com"],"subject":"clickplumbing.com sender check","text":"Reply to this email to check the billing@ route."}'
```

- curl prints `{"id":"…"}`, and Resend's Emails log shows Delivered.
- In the received message's headers (Show original in Gmail), Authentication-Results reads:
  - `spf=pass`, with `smtp.mailfrom` an address at `send.clickplumbing.com`
  - `dkim=pass` for `clickplumbing.com` (`header.i=@clickplumbing.com` or `header.d=clickplumbing.com`)
  - `dmarc=pass`
- Delete the short-lived key once (f) passes.

**(f) The reply route.** Reply to (e)'s email from the outside mailbox. The reply lands in office@.

**(g) Drift.** After the flip's deploy, `npm run check:edge-drift` reads every function current.

**(h) After the flip.** From the app, send yourself one customer email that it offers to send to you, such as the Stripe bill's test copy.
- Its From reads `Click Plumbing and Electrical <billing@clickplumbing.com>`, and its headers pass as in (e).
- A staff email, such as a sign-in link, still comes from `team@noreply.clicktooling.com`.

## The flip PR (after the owner's word)

**The code: one constant and the lines that read it.**

1. `supabase/functions/_shared/emailFromAddress.ts`: add `export const CUSTOMER_EMAIL_FROM_ADDRESS = 'billing@clickplumbing.com'`.
2. `supabase/functions/_shared/emailFrom.ts`: `COMPANY_EMAIL_FROM` becomes `mailboxWithName(PORTAL_COMPANY.name, CUSTOMER_EMAIL_FROM_ADDRESS)`. Seventeen senders send as it.
3. Four senders build their own customer From on `EMAIL_FROM`. Each swaps `EMAIL_FROM` for `CUSTOMER_EMAIL_FROM_ADDRESS`:
   - `send-estimate-to-customer`: `mailboxWithName(estimateEmailCompanyName(brand), EMAIL_FROM)`
   - `send-contract-for-signature`: `mailboxWithName(mail.fromName, EMAIL_FROM)`
   - `gc-customer-email`: `mailboxWithName(GC_CUSTOMER_EMAIL_FROM_NAME, EMAIL_FROM)`
   - `gc-trade-email`: `mailboxWithName(GC_TRADE_EMAIL_FROM_NAME, EMAIL_FROM)`
4. `src/lib/customerEmailFrom.ts`: `CUSTOMER_EMAIL_FROM_ADDRESS` reads the new constant instead of `EMAIL_FROM_FALLBACK_ADDRESS`, so the app's From lines match what is sent.

**Unchanged:** `EMAIL_FROM` and its secret. Staff and team mail stays on `team@noreply.clicktooling.com`, and so does Supabase Auth's SMTP sender. `noreply.clicktooling.com` stays verified in Resend.

**In the same PR:**
- Grep `src/` for `noreply.clicktooling.com` and change only the customer lines: `customerEmailFrom.test.ts`, `customerSampleEmails.test.ts` and the guide `see-what-customers-see.md`.
- The team lines stay: `teamEmails.ts`, the examples in `mailboxWithName.test.ts`, and the report email's line in `track-a-general-contractor-on-a-job.md`. That email is internal and keeps `team@noreply.clicktooling.com`.
- Add the release note and the fragment.

**The check:** every `audience: 'customer'` sender in `src/lib/emailCatalog.ts` is one of these 21 as of 2026-10-09. A customer sender added before the flip must send as `COMPANY_EMAIL_FROM` to be covered.

### Deploy after the merge

Deploy from the main checkout at origin/main. The 57 functions below bundle `_shared/emailFromAddress.ts` as of 2026-10-09. On flip day, `npm run check:edge-drift` after the merge names the exact set.

```bash
bash scripts/deploy-functions.sh accept-estimate ar-returned-checks auto-send-test-reports billed-report-email crew-day-email-dispatch ct-roster-audit gc-customer-email gc-plan-question-email gc-statement-email-dispatch gc-trade-email gc-word-ask invite-user legal-notify-dispatch legal-send-firm-link mercury-webhook money-waiting-email-dispatch notify-lien-approval paid-job-email payment-forecast-email-dispatch recurring-job-report-dispatch recurring-job-report-preview recurring-job-report-test-send remind-job-contracts schedule-day-email-dispatch schedule-share-dispatch send-bid-pricing-package send-bid-room-link send-contract-for-signature send-estimate-to-customer send-gc-statement-email send-hazmat-notice-email send-job-contract send-lien-desk-summary send-lien-filing-email send-lien-release-email send-physical-invoice-email send-report-email send-rfq-email send-scheduled-reminders send-sign-in-email send-stripe-invoice send-submittal-reply-email send-submittal-room-link send-supply-house-job-account send-test-report send-workflow-notification share-job-contract sign-bid-room sign-job-contract statement-round-email-dispatch stripe-webhook submit-legal-portal submit-portal-request submit-sub-portal test-email weekly-money-email-dispatch weekly-movement-email-dispatch
```

- 21 of the 57 change their From: the 17 that send as `COMPANY_EMAIL_FROM` and the four above. The other 36 send staff mail or none, and only stop drifting.
- The client deploys by CI on merge and shows the new From line right away. The functions keep sending from noreply until they redeploy, so deploy all 57 right after the merge.

## Rollback

- Revert the flip PR and deploy the same 57 functions. The DNS records and the alias can stay, since they do nothing on their own.
- If sends fail with a 403 after the flip, roll back first, then go through steps 4 and 6 again.
