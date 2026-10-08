---
name: "B6: award, the statement of work and the papers, after a reader audit of the two live tables"
rows: BOARD_REAL_BUILD.md, decisions 5 and 6 and B6 (The PRs, in order, rows 7 and 8); PORTAL_REAL_BUILD.md (the trade's sign verbs, P3's emails); Building (draw lines on gc_sow_lines.id)
branch: the plan on spike/board-b6-plan (from origin/spike/gc-mode at b85b5335f); the PRs from origin/main when the lead says go
status: plan 2026-10-08 by Helper 2 at the lead's ask. Nothing cut or claimed. The reader audit changes both of the plan's defaults, so calls 6 and 5 below come first.
---

# B6: award, the statement of work and the papers

## What it is

- **B6-a, award and the statement of work** (one migration):
  - **Award** a trade to one company's quote, behind the vetting gate.
  - **The statement of work** is drafted from the quote. It goes out to sign through the Portal's emails (P3), and the trade signs in its portal (Helper 3's verb).
  - **The contract step**: B5's three money columns are dropped from `gc_projects`.
- **B6-b, papers and Get started** (one migration):
  - The master agreement from the Contract Book, sent and signed per company. The W-9 and the insurance certificate.
  - **Send a paper**, and **Get started**'s checklist with **Start** and **Start anyway**.

The plan's defaults put the statement of work on `step_commitments` (decision 6) and a company's papers on `person_contract_documents` (decision 5). Both are live tables that the Subs and Contracts screens use every day. The lead asked for a reader review before either changes. It is done (section 1), and it changes both recommendations.

## 1. The reader audit (2026-10-08, origin/main a1137d746)

Every reader and writer of the two tables was read on main: client, SQL functions, triggers, row-level security, edge functions and the MCP catalog. Each was checked for how it behaves when a row has `person_id` null and a new `company_id` set.

### `step_commitments`: 26 readers and writers, and 11 ways a company row goes wrong

`person_id` is **NOT NULL** today (`20260801150000:20`), and nearly every reader keys on it or on `display_name`:

- **R5, a hard failure.** `create_sheet_for_work_order` (`20260907120000:168-170`) inserts `people_labor_job_assignees(labor_job_id, person_id)`, and that column is NOT NULL.
  - A company order makes it raise an error.
  - `settle_step_commitment`'s job path fails with it.
  - `submit-sub-portal` logs the error and makes no sheet.
  - The Work view has already flipped the order to accepted before the call fails.
- **R7, the wrong money on other people's sheets.** The Subs Work and Pay boards merge every job-anchored order into **every** sub sheet on that job (`workOrderBoardRows.ts:131-139`, `JobsSubLaborTab.tsx:203-208`).
  - A company's statement of work would mark a person's sheet "Signed" and lend it the company's amount.
  - The job strip (`useJobWorkOrderCoverage.ts`) and the sheet story do the same.
- **R3, a name fallback.** `sc_select` grants a read when `users.name = display_name` (`20260905050035:104-107`). The sub dashboard's "Your money" (`DashboardSubMoneySection.tsx`) reads with no filter, so a same-named user would see a company's order with Accept and Decline.
- **R8, lanes collapse.** Lanes keyed by `person_id` (Projects → Forecast → Subs, the Schedule dispatch hub) fold every company into one null lane and flag false overlaps.
- **R11, totals.** Totals and counts would include company rows: the project's *committed* money, the step chip, Needs You's unpriced drafts, the crew-day email, and the shared WO-NN numbering. The GC portal's stage card keeps the last row per window, so a company row could replace a person's.
- **R1, R2, R4, R6, R9, R10** (types, the lost uniqueness, the answer RPC, name-linked sheets, nudges and editors) need further edits.

Fitting a company onto `step_commitments` means relaxing a NOT NULL that is a quarter of the app's subcontract code's footing, and then guarding about twenty readers, three SQL functions and two edge functions. Each one is a place to forget.

### `person_contract_documents`: signing that matches by name

`person_id` is already nullable, but **`person_name` is NOT NULL** and part of the unique key (`person_name, contract_lineage_id, lineage_version`). Many readers match on it:

- **P3, security.** `submit-sub-portal`'s `sign_link` (`:293-297`) lets a sub whose name equals a row's `person_name`, on a row with `person_id` null, **mint a signing link for it and sign it**. `sub-portal` (`:312-316`) lists such a row in that sub's paperwork.
- **P2, a silent re-file.** The insert trigger `contract_docs_set_person_id` fills a null `person_id` by resolving `person_name`. A company document named like a person becomes that person's.
- **P3, the rest.** Compliance badges, People → Contracts, the contract book's rename and version cascade, the dashboard signing prompt, and the sent copy's filing in `send-contract-for-signature` all match by name.
- **P4, what works unchanged.** The signing path itself works for any row by its token: `send-contract-for-signature`, `get-contract-for-signer`, `accept-contract`, the PDF and the `esign_consents` ledger. That is the reason to reuse this table.

## 2. Call 6 revisited: the statement of work stands alone (recommended)

**`gc_sows` holds the whole statement of work, with its own lifecycle. `step_commitments` is not touched.** This is the plan's own alternative, and the audit makes it the better choice:

- **Nothing the Subs tab, the sub portal, People, Projects, the dashboard or the schedule read changes.** B6-a's check, *the Subs tab shows nothing new*, becomes true by construction rather than by twenty guards.
- **Building's agreed key holds.** Draw lines point at `gc_sow_lines.id` as agreed.
- **The cost.** About a dozen lifecycle and signer columns copy `step_commitments`' shape, and the trade's sign verb writes `gc_sows`, not the commitment. The sub signing code is not shared. The portal's sign verb is Helper 3's, written fresh either way.

```sql
CREATE TABLE IF NOT EXISTS public.gc_sows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL UNIQUE REFERENCES public.gc_trade_packages(id) ON DELETE CASCADE,
  invite_id uuid NOT NULL,                 -- the quote awarded; with company_id, an ask of that company
  company_id uuid NOT NULL REFERENCES public.gc_companies(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'cancelled')),
  price numeric NOT NULL CHECK (price >= 0),
  retainage_pct numeric NOT NULL DEFAULT 10 CHECK (retainage_pct >= 0 AND retainage_pct <= 100),
  based_on_rev integer NOT NULL DEFAULT 0,
  their_sov jsonb CHECK (their_sov IS NULL OR jsonb_typeof(their_sov) = 'array'),
  excluded jsonb CHECK (excluded IS NULL OR jsonb_typeof(excluded) = 'array'),
  sent_on date,
  signed_on date,
  signer_printed_name text, signer_signature_storage_path text, signer_consented_at timestamptz,
  signer_ip text, signer_user_agent text,  -- the ESIGN fields, as step_commitments' offer signing has them
  accepted_on date,                        -- closeout: the day we accepted the work (Sow.acceptedOn)
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_sows_awarded_ask FOREIGN KEY (invite_id, company_id) REFERENCES public.gc_invites (id, company_id)
);
CREATE TABLE IF NOT EXISTS public.gc_sow_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_id uuid NOT NULL REFERENCES public.gc_sows(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  scope_item_id uuid REFERENCES public.gc_scope_items(id) ON DELETE RESTRICT,
  change_order_id uuid REFERENCES public.gc_change_orders(id) ON DELETE RESTRICT,
  CONSTRAINT gc_sow_lines_one_source CHECK ((scope_item_id IS NULL) <> (change_order_id IS NULL)),
  CONSTRAINT gc_sow_lines_scope_once UNIQUE (sow_id, scope_item_id)
);
```

- **Notes on the shape:**
  - The kernels' `SovLine.id` is `scope_item_id`, except on a change order's line, as agreed with Building.
  - Draws (Building), back charges and sent-backs (Portal) point at `gc_sows.id` and `gc_sow_lines.id` in their own PRs.
  - The dates are `public.app_today()` stamps, written by the functions.
  - The signature goes to the existing `contract-signer-signatures` bucket.
  - `esign_consents.record_type` gains `'gc_sow'`. That one CHECK on a live table is widened, with nothing else changed, the same way `20261006040000` widened it.
- **The mapper.** `boardProjectFromView` (the one project mapper) fills `TradePackage.sow` from `gc_sows` and its lines. Its signature is unchanged, and I'll tell the lead and Helpers 4 and 5 before that PR, per the mapper rule.

## 3. Call 5 revisited: papers on `person_contract_documents`, with a name no person can have (recommended)

**Reuse the table and its signing path, but give a company row a `person_name` that no person can match.** A new table would mean writing a second ESIGN path (send, token, accept, PDF, consent) for three papers.

- **`company_id uuid REFERENCES gc_companies(id) ON DELETE RESTRICT`**, nullable, the one new column on the live table.
- **A company row's `person_name` is `'gc-company:' || company_id`**, held by a CHECK:

  ```sql
  CHECK (company_id IS NULL OR (person_id IS NULL AND person_name = 'gc-company:' || company_id::text))
  ```

  - No user or roster name has that shape, so every name-matching reader in P3 matches nothing. That covers the sub portal's `sign_link` and its paperwork list, compliance badges, People → Contracts, the book cascade, the dashboard prompt and the sent copy's filing.
  - The unique key still works, one lineage per company and paper.
- **The insert trigger skips company rows.** `contract_docs_set_person_id` returns early when `company_id` is set. The sentinel would resolve to nothing anyway, but the guard says so in the one place that writes `person_id`.
- **Two small edge-function changes**, both in B6-b:
  - `send-contract-for-signature` skips its people-by-name lookup for a company row, and emails the company's own *contracts* recipients (`mailRecipients(partner, 'contracts')`).
  - `ContractAccept.tsx`'s hard-coded consent `audience: 'sub'` stays right for a trade company. It is a sub to us.
- **A test that proves it.** A SQL check in the migration doc, run on PGlite and on prod after the push, shows that no `users.name` or `people.name` starts with `gc-company:`. A unit test pins the prefix in the one client helper that builds the name.

**The alternative** is a separate `gc_company_papers` table with its own signing. It is cleaner on paper. But it means a second copy of the token, accept, PDF and consent code, which is the code most worth keeping single. I recommend the sentinel.

## 4. Award (B6-a)

- **On `gc_trade_packages`:** `awarded_invite_id` (a composite FK to an ask on this trade, as B5's carry does, with `ON DELETE SET NULL (awarded_invite_id)`), `awarded_by` (a user) and `awarded_on` (`public.app_today()`).
- **`gc_award(p_invite_id uuid, p_estimator uuid)`**, SECURITY INVOKER. In one transaction it:
  1. **Re-checks the gate in SQL** against the company's vetting: new or declined is refused, and an approved company with a limit is refused above it. The price is the **leveled total**, recomputed in SQL as `leveledTotal` does: the newest quote's amount, plus the ask's plugs on lines it leaves out, its taken alternates and its exclusion covers. A parity test runs the SQL and the kernel on the test rows, as `bid_pricing_history` does today.
  2. **Writes the award.**
  3. **Drafts the statement of work** as `sowFromBid` does: the price, retainage 10, the plan set, one line per scope item (the price split evenly, with the remainder on the last line), their own schedule of values and their exclusions from the quote.
  - The refusals are the gate's own words (`canAward`): *"…is not vetted yet. Approve them on Trade partners first."*, *"…is approved up to $50,000. This award is $61,200."*
  - Refused too: a trade already awarded, a lost project, and our own trade.
- **The screen:** **Award** on a quote in Compare quotes (B5-b), with **Estimator** (who decided). Then the trade's card shows the statement of work: its lines, *What they will not do*, and **Send to sign**, which calls P3's `gc-trade-email` kind `sow`.
  - Once signed in the portal (Helper 3's `gc_trade_sign_sow`, which writes `gc_sows`' signer fields and the consent and keeps the `sow` promise through `gc_keep_promises`), the card reads *signed Oct 12*.
- **Who may award:** dev while built. The Board's door keeps it to estimators, masters and devs.

## 5. The contract step (B6-a's migration, first)

- `ALTER TABLE public.gc_projects DROP COLUMN IF EXISTS general_conditions, DROP COLUMN IF EXISTS contingency_pct, DROP COLUMN IF EXISTS fee_pct;`
- **Before it is cut:**
  - B5-c's client (which reads `gc_project_money`) has been on the live build a day.
  - A grep of `src/` and `supabase/functions/` finds no reader of the three columns.
  - The doc reads every project's values from both places, and they match.
- The types are regenerated after the push. `projectRows.ts` stops mapping the three fields in the same PR.

## The PRs, in order

| PR | What | Migration | Waits on |
|---|---|---|---|
| **B6-a** | The contract step. Award columns. `gc_sows` and `gc_sow_lines`. `gc_award` with the SQL gate and its parity test. `esign_consents` gains `'gc_sow'`. | yes | B5-c live a day |
| types | regenerated (Helper 7) | | the push |
| **B6-a-ii** | Award in Compare quotes. The statement of work on the trade's card. **Send to sign** (P3). The mapper fills `sow`. | | types; P3's `gc-trade-email` |
| **P (Helper 3)** | `gc_trade_sign_sow` and the portal's sign screen | theirs | B6-a |
| **B6-b** | Papers: `person_contract_documents.company_id` with the sentinel CHECK and the trigger guard; `gc_paper_sends`; the master agreement from the Contract Book; the W-9 and certificate rows; `send-contract-for-signature`'s company branch | yes | B6-a-ii |
| **B6-c** | Get started: `startChecklist` (on main) on real rows, **Start** and **Start anyway** (`gc_start_project`), the Contracts tab | | B6-b |

Each PR gets its guide (*award a trade on a GC project*, *send a trade its papers*, *get a GC job ready to start*), release note, fragment, docs and a live walk on the kept test rows. The test company is approved up to $50,000, so the gate's refusal can be walked by quoting above it.

## Calls for the lead

- **6. The statement of work stands alone in `gc_sows`; `step_commitments` is not touched.** *My pick:* yes, for R1 to R11 above.
- **5. Papers on `person_contract_documents`** with `company_id`, the `gc-company:<id>` name, the CHECK and the trigger guard. *My pick:* yes. The alternative is a second signing path.
- **E. `esign_consents.record_type` gains `'gc_sow'`.** It is the one CHECK on a live table that B6-a widens. *My pick:* yes.
- **G. The award gate re-checked in SQL** with a parity test against `leveledTotal`, instead of trusting the client's number. *My pick:* yes, since a statement of work is a contract.
- **W. Who may award** after the door: estimators, masters and devs, as the plan says. **The owner's call**, since it decides who can commit our money to a trade.

## Is this the best we can do?

- **The audit is the plan's best evidence.** The two defaults were sound when written, before the reader review the lead asked for. The review finds a hard failure (R5), wrong money on other people's sheets (R7), and a security hole on a shared table (P3). The recommendations follow from those findings, not from taste.
- **Standing alone costs a dozen copied columns and saves twenty guards.** Copying the lifecycle columns is boring and safe. Guarding every reader of a table the Subs tab uses all day is neither. If the owner later wants GC statements of work in the Subs tab, a read-only view can join them in. Nothing about the tables would need to change.
- **The sentinel name is a little unusual, and it is the cheapest correct fix.** It turns every name-matching reader into a non-match without touching them, and the CHECK makes the shape impossible to get wrong. The alternative of making those readers company-aware is the twenty-guard trap again.
- **What it does not close.** A person deliberately named `gc-company:…` would match. The doc's check proves no such name exists, and a CHECK on `people.name` could forbid the prefix if the owner wants belt and braces. It is not proposed, since it would be one more live-table change.
- **What I would still change.** The SQL gate duplicates `leveledTotal`. If a third copy is ever needed (the portal, say), the right move is a SQL function that both the gate and a read call. Until then, the parity test keeps the two copies honest.

## Status

Plan written 2026-10-08 by Helper 2 at the lead's ask, on `spike/board-b6-plan`. The facts come from the reader audit of origin/main at a1137d746 (file:line in section 1; every reader in `board-b6-reader-audit.md` beside this plan), from `esign_consents`' CHECK (`20261006040000`), and from `gc_change_orders` (O1, `20261008010000:92`). Nothing is cut or claimed. It waits for the lead's word on calls 6, 5, E and G, and the owner's on W.
