# GC portal: their customers' open bills — and the owner never sees the builder's

Status: not started · planned 2026-09-13, revised the same day to **case by case** (see the Revision section — it supersedes the rule-based train below) · mock-ups: [`mockup-2-case-by-case.html`](./mockup-2-case-by-case.html) (current: the Bill Customer tick, the doors, the defaults, both portals) and [`mockup.html`](./mockup.html) (revision 1, the automatic rule, kept for the reading and the data facts)

## The ask, in the owner's words

> now that jobs can be paid by the customer or the GC I would like for GCs (not customers) to see jobs their customers need to pay us. at the same time if a bill is assigned to a customer and they look at their portal, they should not see bills their GCs need to pay

## The reading — what the portal does today

- v2.3346 made the statement **count** only what the viewer owes (`viewerOwesBill`, `_shared/portalBillMembership.ts`). Everything else on the viewer's jobs lands in one shared strip, *On your jobs, billed to someone else* (`CustomerPortal.tsx`, `data-portal-billed-elsewhere`): address · billed to · date · amount, no Pay button.
- The strip is **symmetric** — the builder sees the owner's bills there and the owner sees the builder's — and one code path (`billedToFor` in `_shared/portalMergedBills.ts`) produces both, so the two directions cannot be changed independently without a viewer-role signal.
- The other party's invoices **ride in the payload** regardless of what renders: `customer-portal/index.ts` fetches billed invoices for every non-paid job in the viewer's union (`openBillJobIds`) with no payer filter. Hiding the strip in the page alone would not remove the data.
- The signal already exists per row: the viewer is the GC on a job when `job.gc_customer_id === viewer && job.customer_id !== viewer` (the same test `jobIsAsGc` uses for the AS GC tag).

## The decision

One rule per bill, decided on the server, from two facts: who the viewer is on that job and who pays that bill (`effectiveInvoiceParty`, unchanged).

| Viewer on the job | The bill goes to | Shows as |
|---|---|---|
| customer or GC | the viewer | the ledger, the balance, Pay (unchanged) |
| GC, owner is someone else | the job's customer | **Your customers' open bills** — a card under the ledger, no Pay, never in the balance |
| customer | the GC | **nothing** — dropped on the server, never in the payload |
| either | a typed "someone else" | nothing |
| GC entered as the customer (72 jobs) | the GC | the ledger (they owe it; unchanged) |
| split by line | per invoice | each carve follows the rows above on its own |

- Link audiences stay: `all`, `gc`, `customer`. The card appears wherever the viewer is the GC on a row, so on `all` and `gc` links, never on a `customer` link.
- The card shows facts about the bill only — owner name, address, job, billed date, age (the ledger's 30-day tint), received so far, open amount, a total — not the owner's promise, not collections, not the owner's contact details.
- Open bills only. No paid fold.
- **Rejected**: a separate `/gc/:slug` page and function (duplicates letterhead, link machinery, view counting and request forms for one card; GCs already hold the merged link); hiding the strip client-side (leaves the data in the payload); a Pay button on the GC's card (a GC paying the owner's Stripe invoice muddles who paid — the office flips the bill with *Bill to ▾* instead, PR 3 asks for that).

## Data facts (prod, 2026-09-13, read-only through a dev session)

| Fact | Value |
|---|---|
| Jobs naming a GC | 326 (72 with the GC as the customer row · 254 distinct GC) |
| Distinct-GC jobs, GC pays | 200 (196 paid · 1 billed · 2 working · 1 waiting) — the Done Right pretests |
| Distinct-GC jobs, owner pays | 54 (53 paid · 1 working · **0 billed**) — the Done Right repairs |
| GC customers with an open owner-paid bill today | 1 |
| `customer_portal_links` rows | 18 (slugs resolve only `all`) |
| Invoices with their own `bill_to_party` · typed `bill_to_email` · `split` jobs | 0 · 0 · 0 |
| `customers.gc_pays_by_default` · `billing_email` set | 1 · 1 |

The card starts nearly empty and fills as Done Right repairs are billed. The 72 GC-as-customer jobs carry no owner (v2.3350), so they contribute nothing until the office records the site owner as the customer — which the who-pays rule now survives.

## Where it plugs in

Exists (reuse):
- `supabase/functions/_shared/billToParty.ts` — `effectiveInvoiceParty`, `payerCustomerId` (unchanged).
- `supabase/functions/_shared/portalBillMembership.ts` — `viewerOwesBill`, `owedJobIdsForViewer` (stay; the promise scope is already owed-only).
- `supabase/functions/_shared/portalMergedBills.ts` — `buildPortalBills`, `jobIsAsGc`, `jobLabel`, `jobTradeTag`, the shell-remainder rule.
- `supabase/functions/customer-portal/index.ts` — the reads (jobs union, invoices, payments, owner/party names) and the telemetry line `portal_statement_rendered`.
- `src/pages/CustomerPortal.tsx` — `PortalStatement`, `PortalJobGroupSection`, the print skeleton (`data-print-page`), `src/lib/portal/portalTheme.ts`.
- `src/lib/portal/portalPayload.ts` — `parsePortalPayload`; `src/lib/portal/portalStatementJobLinks.ts` — the globe modal's "Jobs on this statement" mirror.
- Guides: `src/content/help/share-a-customer-their-portal.md`, `choose-who-gets-the-bill.md`; `docs/GLOSSARY.md` → Bills go to.

New:
- `portalBillRole(job, invoice, viewer)` → `owed | customers | hidden` in `portalBillMembership.ts` (+ tests in `src/lib/portal/portalBillMembership.test.ts`).
- `buildPortalCustomerBills` in `portalMergedBills.ts` (+ tests): the GC-side rows with `ownerName`, `jobLabel`, `jobNumber`, `jobAddress`, `billedOn`, `amount` (open), `billedAmount`, `totalPaid`; oldest first; summary (owners, open total, oldest age).
- Payload field `customersBills` (parser tolerates absence); telemetry `customers_bill_count`.
- `src/components/portal/PortalCustomersBillsCard.tsx` (+ render test); guide `see-what-your-customers-owe-as-a-gc.md` or a section in the share guide.
- No migration. Edge function `customer-portal` changes (deploy first).

## The plan — PR train

1. **PR 1 — close the leak; the owner stops seeing the builder's bills.** `portalBillRole` + tests; `buildPortalBills` returns owed rows only (`billedTo` gone); the function filters before the payload and emits `customersBills`; `parsePortalPayload` tolerates the new field. The page still renders from `bills`, so the old strip empties by itself; the tests that never named `billedTo` (agent finding) get the assertions they lacked. Deploy `customer-portal` first, then merge — the old client on the new function shows nothing extra; the new client on the old function shows the old strip until the deploy.
2. **PR 2 — Your customers' open bills.** `PortalCustomersBillsCard` under the ledger (summary line · owner rows · total · the why line), prints as its own closing page; `portalStatementJobLinks` mirrors it with Edit ↗; guides and glossary; `gcPortalLink.ts` stale comment ("can never show them anything but the bills they owe") corrected. Render tests: present on a GC row, absent for an owner, absent on a `customer` link.
3. **PR 3 — optional, after the card is seen live: Ask the office.** Two request kinds through `submit-portal-request` (*bill this to us instead* · *remind the owner*) landing as dispatch-inbox requests (the Customer Waiting machinery, v2.3246–v2.3249); the office acts with *Bill to ▾* or the Followup tools. Never emails the owner directly from the GC's click.
4. **PR 4 — decision: the same rule for the non-money cards.** Agreements (contract amounts), test reports, `requestableJobs` and the visit picker run over the whole customer-or-GC union today. Apply the viewer-role rule there too, or keep them as the shared job record.

Each PR: `npm run claim`, release note + `docs/recent-features/` fragment, guide with the feature, `gh pr merge --auto`.

## Owner decisions still open (recommendation first)

- **Scoped `gc` links** were minted as "GC bills only" for AP inboxes. Recommend the card shows there too (the ask is for GCs to see it; the copy says it is not theirs to pay).
- **How much of the owner's status the GC sees.** Recommend bill facts only (above). Alternative: add the owner's promised date.
- **Paid repairs on the card.** Recommend no.
- **PR 3** — build it now, or wait for the first GC to ask.
- **PR 4** — yes or no.

## Adjacent, not in this train

- Payment-promise **writers** still snapshot the payer as `COALESCE(gc_customer_id, customer_id)` (`add_job_payment_promise`, the `job_promised_pay_dates` trigger, the backfill — `20260911051414`), while every client reader follows the who-pays rule. On an owner-paid repair under Done Right the homeowner's promise files under Done Right. Its own task.
- `get_customers_list_bundle` (v2.3365) reads jobs by `customer_id` only; a GC's card on Customers does not count GC-paid jobs.

## How to verify

- Dev: `npx vite --port 5199 --strictPort` from the worktree, `http://localhost:5199/dev-login?as=1&to=/customers`. Open Done Right Foundation's globe → *Preview as customer* — the GC exhibit; open a Done Right pretest homeowner's globe → the owner exhibit (their pretest, billed to Done Right, must not appear anywhere on the page or in the `customer-portal` response body).
- Kernel: a `split` job with one carve per party — the owner's portal shows only their carve; the GC's shows theirs in the ledger and the owner's under the card. A GC-as-customer job shows in the ledger, never on the card. A typed `bill_to_email` bill shows on neither.
- Payload: `curl "$VITE_SUPABASE_URL/functions/v1/customer-portal?token=<owner token>"` — no invoice the owner does not owe in `bills`, and no `customersBills`.
- Phone (430 px): the card's rows stack owner / address / meta with the amount right-aligned; no sideways scroll.
- Print all: the card is the last page before the closing total; Pay buttons still do not print.

## Revision (2026-09-13, same day) — case by case, from the bill

> Owner: "Looking at this holistically, I think that maybe we should be able to set it on a case-by-case basis … what could that look like in the job bill modal?"

**The decision.** The office decides per bill whether the non-paying party sees it on their statement, in Bill Customer's *Send to* block, on a line directly under *Copy <the other party>*: **Show it on <other party>'s statement** (sub-line: *their portal lists this bill as billed to <payer> — no Pay button, not in their balance*). Copy is the email, once; Show is the statement, standing; they are independent ticks. The tick is offered in both directions, so an owner can be shown a builder's bill when there is a reason. Nothing is shared unless ticked. The v2.3346 symmetric strip goes away.

**Three layers, one switch** (the shape *Bills go to* / *Bills also go to* already use):
1. `customers.sees_customer_bills` (optional PR 3, "Sees their customers' bills by default" on Edit customer, like *Pays as GC by default*; `shouldDefaultShowOtherParty` judged once per GC pick) →
2. `jobs_ledger.show_bills_to_other_party` (Edit Job → Edit tab, a new fact row under *Bills also go to*: "Show Done Right the bills they don't pay · on new bills"; the Bill Customer tick writes it back — recommended, mirrors Bill to ▾) →
3. `jobs_ledger_invoices.shown_to_party` `NULL | customer | gc` — **the only thing the portal reads**; stamped at send on both channels, changed afterwards from Edit Job → Bill via an eye chip beside the payer chip (*👁 shown to Done Right*) with a two-item menu. Shell remainders (billed job, no invoice row) follow the job layer.

**The rule the portal runs**: viewer pays it → ledger (unchanged); someone else pays it and `shown_to_party` resolves to the viewer (`payerCustomerId(job, shown_to_party) === viewer`) → the shared card (GC wording *Your customers' open bills*, owner wording *On your job, billed to your builder*; no Pay, not in the balance); otherwise dropped on the server. Existing bills start `NULL`, so day one shows nothing new; a dry-run script can stamp `gc` on open owner-paid bills under GCs whose card is ticked.

**Revised train**: PR 1 migration (two columns) + kernel `billVisibility.ts` (shared with edge like `billToParty.ts`) + `customer-portal` filters and emits `sharedBills` + the Bill Customer tick stamping on both channels (functions deploy first). PR 2 the Bill-tab eye chip + menu, the Edit-tab fact row, the shared card in both wordings, the globe-modal mirror, guides (*share a customer their portal*, *choose who gets the bill*, *send a bill to more than one person*), glossary. PR 3 the GC card default + the stamp script (recommend shipping with PR 2 — without it Done Right's ~200 jobs/yr are 200 ticks). PR 4 optional "Ask the office" from the card.

**Costs, stated**: one more line in a busy modal (rendered only when there is an other party, like Copy); Copy and Show can disagree (allowed on purpose; the guide says so); the office must remember unless PR 3 ships. Versus revision 1: two columns, a tick, a chip and a fact row buy the ability to say no on one bill and a portal that never shows a number the office did not choose.

**Open decisions**: tick wording (*Show it on Done Right Foundation's statement*, recommended); whether the tick writes the job memory back (recommended yes); stamp Done Right's existing open repairs or roll forward; PR 3 in the first train (recommended).
