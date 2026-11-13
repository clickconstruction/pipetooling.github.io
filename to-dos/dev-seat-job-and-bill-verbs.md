---
name: "The dev seat sets up a job, updates it and sends the bill: the first step of MCP doing everything a user can"
number: 293
group: close
status: SHIPPED and LIVE — PR 1 v2.6790 #7463 (0.49.0), PR 2 v2.6793 #7464 (0.53.0), PR 3 v2.6794 #7467 (0.55.0), PR 4 v2.6795 #7470 (0.56.0) merged 2026-11-09/10, each renumbered behind the seat trains that landed first (accounts, submittals, mail pieces, the note verb); dev-mcp deployed from main after each, prod compared first · walked on prod 2026-11-09 late: a ZZ TEST job made, moved to Ready to Bill, billed in test mode and texted · the walk's one gap was fixed by #7520 (plan_bill refuses a job with no number to bill under), merged 2026-11-10 as v2.6826 and in every deploy of the seat since · left: the owner's look
summary: >
  The dev seat read everything and wrote fifty-one named things, but no verb made a job or sent a
  bill, so the short bill link's walk (#290) had to be driven through the app in Chrome. Three
  plan → apply pairs, no migration: a job as New Job makes it, a job changed as Edit Job and the
  Pipeline change it, and a bill made and handed to the customer as Bill Customer and the share
  row do. Every write goes through what the app itself calls, so a verb can do nothing the
  signed-in dev could not do on the screen. The card also carries the road: what a user can do
  against what the seat can do, pair by pair.
next: the owner's look at the ZZ TEST job (the Pipeline, its Bills tab, the text in the test contact's thread); then retire the card. The road's next pairs are in The road below.
size: M as a train of four (S · S · M · S) and one fix (XS)
blocker: none; the owner's test contact and customer exist
opinion: build in the card's order — each pair stands alone, and the bill needs the status move
mockup: not required — the verbs have no screen; the plan replies are the design, and the design note holds them in words
---

# The dev seat sets up a job, updates it and sends the bill (#293)

## The ask, in the owner's words

2026-11-09, after the #290 walk: *"I would like to add verbs for devs to setup and update jobs and send bills."* And the road: *"I want MCP to do everything a user can."*

## The decision

Three verb pairs in the seat's own grammar (`plan_<x>` shows exactly what would land under a `plan_hash`; `apply_<x>` re-reads and writes only when the hash still matches; one apply per plan), each routed through what the app itself calls. No new RPC, no migration, no table the app does not write, so a verb can do nothing the signed-in dev could not do on the screen.

1. **`plan_job` → `apply_job`** — the row New Job makes (`JobFormModal.createJob`): one `jobs_ledger` insert under RLS as the dev, then the kind. The dry run is the server's read of the customer (its email and phone fill the job's when left out), the service type, the development, the project, the bid, the owner rule's settings and the live jobs on the customer already wearing the name (refused unless `allow_duplicate_name`). The plan shows the row as it will land, who it belongs to and why, what a bill will still need and what the verb does not do (child rows, the award baseline, the Drive folder). The job starts at Working, the table's default since `20260722264000` (the first walk read it there).
2. **`plan_job_update` → `apply_job_update`** — the Edit Job form's own columns, shown before → after, plus the status. Status moves go through the Pipeline's own `update_job_status`, one step at a time in the RPC's order, stopping where the database refuses. The plan commits to the touched columns' before values, the status and `updated_at`, so a change since refuses the apply.
3. **`plan_bill` → `apply_bill`** — Bill Customer's steps in order: `ensure_single_ready_to_bill_invoice_for_job` (refused when its amount is not the plan's remainder, the modal's own rule), `create-stripe-invoice` as the dev with an explicit `stripe_mode`, the ten-letter `pay_code` read back (`bill_pay_code` asked once when missing), the job to Billed when fully invoiced, then the text through `quo-send` with the Billed line's words and the short link last, and the email through `messages-email` with the share row's draft. A refused send leaves the bill standing and names the reason; `action: send` on an existing bill retries or texts a bill made in the app. The whole remainder, as Bill Customer bills it; partial and split bills are a later verb.

4. **`plan_collections_flag` → `apply_collections_flag`** and **`plan_contract_ended` → `apply_contract_ended`** (PR 4, the owner's ask relayed the same day by the punch-list session: move a job the way JP891 was moved). The flag goes through the Job window's own `set_job_collections_flag` (Billed only; the note on the job and in its activity; the clear lifts an Uncollectible mark too). The contract's end is the Lien contract row's own save as one PATCH under RLS: the day, how (complete | terminated | abandoned), the retainage held, the payment bond, the moment and the caller stamped; `clear: true` takes it off. The first job it is for has rough billed and paid, top-out and trim unbilled and no termination sent, so `abandoned` is the likely how; its final bill is `plan_bill`'s remainder once the job is at Ready to Bill.

The owner's four calls, 2026-11-09: yes to the three pairs in that order; a job made by the seat requires a customer (the form allows none); the bill verb bills the whole remainder; `stripe_mode` is required with no default, since the server defaults to live when it is left out.

Rejected: a `dev_job_write` definer wrapper (a migration for rows the app already writes under RLS; the plan-set verbs set the precedent); a single verb that makes the job and bills it (three acts, three plans, each refusable on its own).

## Where it plugs in

- `supabase/functions/_shared/devMcpJobs.ts` (PR 1; PR 2 adds the update), `_shared/devMcpBill.ts` (PR 3), `_shared/devMcpWrites.ts` (`WRITE_VERBS`, `rpc: null`), `supabase/functions/dev-mcp/index.ts` (the cases, the tools, `SERVER_VERSION`).
- The app's own paths the verbs call: `jobs_ledger` under RLS (the New Job insert, the Edit Job identity slice), `update_job_status`, `ensure_single_ready_to_bill_invoice_for_job`, `create-stripe-invoice`, `bill_pay_code`, `contact_for_customer`, `quo-send`, `messages-email`.
- The kernels mirrored into the edge copy (`scripts/edge-kernels.mjs`): `lib/addressTitleCase.ts` (PR 1); PR 3 adds the Billed line's words (`lib/tellCustomer/tellCustomer.ts`), the share copy (`lib/stripeInvoiceShareCopy.ts`) and `lib/billing/billTextLink.ts`, or lifts the pieces that cannot mirror into a words file first.
- Tests: `src/lib/devMcp/devMcpJobs.test.ts`, later `devMcpBill.test.ts`; the older seat tests pin the version and the verb count.
- Docs: `docs/EDGE_FUNCTIONS.md` → dev-mcp, `docs/dev-mcp/README.md`, `to-dos/mcp-servers.md`'s verb table. The design in words with the roadmap table: the owner's notes folder, `dev-mcp-job-and-bill-verbs-design.md`.

## The plan

| PR | Verbs | Server | What it touches |
|---|---|---|---|
| 1 | `plan_job` / `apply_job` | 0.49.0 | `devMcpJobs.ts`, `devMcpWrites.ts`, `index.ts`, the address kernel into the copy, the docs, this card |
| 2 | `plan_job_update` / `apply_job_update` | 0.53.0 | `devMcpJobs.ts` (the update's dry run, the status chain), `index.ts` |
| 3 | `plan_bill` / `apply_bill` | 0.55.0 | `devMcpBill.ts`, the Billed line lifted into `lib/tellCustomer/billedLine.ts` and five kernels into the copy, `index.ts` |
| 4 | `plan_collections_flag` / `apply_collections_flag` · `plan_contract_ended` / `apply_contract_ended` | 0.56.0 | `devMcpJobMarks.ts`, `index.ts` |

Each merges alone (`gh pr merge N --auto`); after each merge, `supabase functions download dev-mcp --use-api` into a scratch folder and hash-compare to main before `supabase functions deploy dev-mcp`. No migration, so no push and no calls-ahead hold.

## How to verify

From an MCP client as the dev (the key in `PT_DEV_MCP_TOKEN`):

1. `find_customer` the owner's test customer; `read_rows` on `service_types` for Plumbing's id.
2. `plan_job { job: { job_name: 'ZZ TEST seat walk', job_address, customer_id, service_type_id, revenue: 1, kind: 'service' } }` → read the row, the owner, the readiness → `apply_job` with the plan_hash → the job on the Pipeline at Working (a new job's default); `get_job` reads it.
3. `plan_job_update { update: { job_id, status: 'ready_to_bill' } }` → the two steps → `apply_job_update` → Ready to Bill.
4. The job needs an HCP or Click number with digits, since a Stripe bill is numbered from it: `plan_job_update { update: { job_id, set: { click_number } } }` → apply (once #7520 lands, `plan_bill` refuses without one and says so).
5. `plan_bill { bill: { job_id, stripe_mode: 'test', send: { text: true } } }` → the amount, the number, the text's words → `apply_bill` → a one-dollar test-mode bill, its 43-character link in the test contact's thread, the link opening Stripe's test page.
6. A second `apply_job` with the same plan is refused as already applied; a `plan_job` of the same name is refused without `allow_duplicate_name`.

The ZZ rows stay for the owner to look at. No customer's name, number or dollar figure goes in the repo.

## The walk (2026-11-09, late evening, on prod from the seat)

Every step over `https://mcp.clicktooling.com/dev` with the dev's key, each server deployed from main after a download-and-hash compare of the live bundle (one compare found prod running a working tree, every difference main being ahead).

1. **Make** (0.50.0): `plan_job` showed the row as New Job writes it: the owner's test customer, Plumbing, revenue 1, kind service, the company owner account as master, the address Title-Cased, the customer's email and phone filled in. `apply_job` made it. The job landed at **Working**, the table's default since `20260722264000`; the plan's words said Waiting, fixed on PR 2's branch and by #7492. A second apply of the plan and a second plan of the name were both refused.
2. **Move** (0.53.0): `plan_job_update { status: 'ready_to_bill' }` named one step, Working → Ready to Bill; `apply_job_update` made it through `update_job_status`. A second apply was refused as already reading that way.
3. **Bill** (0.55.0): the first `apply_bill` stopped at `create-stripe-invoice`: *Job must have an HCP or Click number (digits)*. The Ready to Bill row stood, as in the app. `plan_job_update { set: { click_number } }` gave the job a number (it reads JP9293 since), a fresh `plan_bill` showed the row, the amount, the number and the Billed line's words, and `apply_bill` made the test-mode Stripe bill with its ten-letter code, moved the job to Billed and texted the link from the company number. The text's row sits in the test contact's thread, tied to the job, reading the app's own Billed line ending in the 43-character short link; the link answers 301 to the pay page. A repeat apply was refused. The plan's missing check is fix PR #7520.
4. **Marks** (0.56.0): `plan_collections_flag` and `plan_contract_ended` planned on the Billed ZZ job (before → after, the activity line, the clocks' footing). Not applied, so the office's Collections column does not carry a test job.

The ZZ rows stay for the owner: the job, its billed test-mode bill and the text.

Two findings beside the fix: the first `plan_bill` after a fresh deploy failed once on the session mint (*Email link is invalid or has expired*) and passed on retry; and every seat PR that landed during the train dropped the next one from the queue, since the server version, the verb count and their test pins are not claimed (the merge recipes are in the session notes and the dev-mcp version-race memory).

## The road: what a user can do against what the seat can do

Read: the seat reads it (`read_rows`, the composites). Write: a plan → apply pair exists. —: nothing yet.

| What a user does in the app | Seat reads | Seat writes |
|---|---|---|
| Make a job, edit it, move it along the Pipeline | `find_job`, `get_job` | **#293** (PR 1 make; PR 2 update and status) |
| Flag a Billed job for Collections; record the contract's end on the Lien desk | `get_job` | **#293** (PR 4) |
| Bill a customer with Stripe, text or email the link | `get_job` | **#293** (PR 3) |
| Record an outside or physical bill; split or partial bill; void; write down; apply or move a payment | read | `plan_job_payment` (a payment removed, recorded or tied to its bank row, v2.6940); the rest — |
| Make a customer; edit contacts, addresses, bill-to, portal | `find_customer`, `get_customer` | — |
| Text, email, call-log, note a customer | read | mail tags; a bill's text and email (#293); a free text or email — |
| Make a bid; file its plans; price, send, decide | `find_bid`, `get_bid` | `plan_bid`, `plan_file_plans`; since the bid train (#317) `plan_bid_update` (the sent date of a plain bid, the outcome), `plan_bid_counts`, `plan_bid_takeoff`, `plan_bid_labor`, `plan_bid_pricing`; per-GC sends and the letter — |
| Plan sets and papers on a job's plan part | read | `plan_plan_set`, `plan_paper` |
| Materials on site | `read_on_site` | four pairs |
| Job cost moves | read | `plan_cost_batch` (+ revert) |
| Clock sessions | read | `plan_clock_sessions` |
| HR: entries, evidence, documents, licenses, reports | `get_person_file`, `get_case_brief`, `search_case` | eight pairs |
| Legal matters | read | seven pairs |
| Development history | `get_history` | `plan_history_entry` |
| Hours statements | `get_hours_statement` | `plan_hours_statement` |
| Schedule a visit; move it; tell the customer | read | — |
| Stages, checklists, inspections, reports on a job | read | — |
| Photos and documents on a job | read, `read_file_index_status` | `plan_mail_file`; an upload — |
| Dispatch requests; follow-ups; calls | read | — |
| Estimates | read | — |
| Payroll, pay reports, deductions | read | — |
| Settings | read | — |

Next after this train, in the order the call log asks: a free text or email to a customer's thread, the customer pair, a visit scheduled, an estimate (a payment recorded shipped as `plan_job_payment`, v2.6940). Each is a pair over the screen's own RPC or rows, the way this train is.

## Where it stands

- 2026-11-09 morning: the design agreed; PR 1 built and tested (`devMcpJobs.test.ts`, the seat's tests green, `check:edge-bundles` OK); #7463 armed.
- 2026-11-09, later: PR 2 built on PR 1's branch (v2.6793): the update's shape held to the form's payload, the status walk to the RPC's neighbours, the read-back after the PATCH; #7464.
- 2026-11-09, afternoon: PR 3 built on PR 2's branch (v2.6794): the remainder as the RPC sizes it, the sheet's words and the share row's draft through the kernel copy, the modal's doors in order with each outcome named; #7467.
- 2026-11-09, afternoon: PR 4 built on PR 3's branch (v2.6795) after the punch-list session relayed the owner's ask: the Collections flag through the Job window's RPC, the contract's end as the Lien row saves it.
- 2026-11-09/10: PR 1 to PR 4 merged one at a time, each renumbered behind the seat trains that landed first; dev-mcp deployed from main after each; the walk above passed; fix PR #7520 armed for the gap it found.
