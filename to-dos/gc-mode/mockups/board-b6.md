---
name: "B6: award, the statement of work and the papers, after a reader audit of the two live tables"
rows: BOARD_REAL_BUILD.md, decisions 5 and 6 and B6 (The PRs, in order, rows 7 and 8); PORTAL_REAL_BUILD.md (the trade's sign verbs, P3's emails); Building (draw lines on gc_sow_lines.id)
branch: the plan on spike/board-b6-plan (from origin/spike/gc-mode at b85b5335f); the PRs from origin/main when the lead says go
status: plan 2026-10-08 by Helper 2 at the lead's ask. The reader audit changes both of the plan's defaults, so calls 6 and 5 below come first. B6-a is built as #4973 (migration 20261009140000); its SQL as built closes this page, amended 2026-10-08 by Helper 12 after the lead's compare.
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

The two tables as built are in *B6-a's SQL as built*, the last section of this page.

- **Notes on the shape:**
  - The kernels' `SovLine.id` is `scope_item_id`, except on a change order's line, as agreed with Building.
  - The keys, as built after the lead's compare. The statement of work's two keys to its ask (an ask of this company, on this trade) are the default NO ACTION. Its lines' keys to a scope item or a change order wait for the end of the transaction, as Owner Billing's lines do. So a whole project still goes by cascade, and a single scope item or change order on a statement of work is refused.
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

- **On `gc_trade_packages`:** `awarded_invite_id` (a composite FK to an ask on this trade, as B5's carry does, with `ON DELETE SET NULL (awarded_invite_id)`), `awarded_by` (a user) and `awarded_on` (`public.app_today()`), with a check that an award always has its day.
- **`gc_award(p_invite_id uuid, p_estimator uuid)`**, SECURITY INVOKER, the estimator defaulting to the caller. In one transaction it:
  0. **Refuses anyone but a dev**, in words, before any write (call W at its default, added when door 2 opened the trades to the office).
  1. **Re-checks the gate in SQL** against the company's vetting: new or declined is refused, and an approved company with a limit is refused above it. The price is the **leveled total**, recomputed in SQL as `leveledTotal` does: the newest quote's amount, plus the ask's plugs on lines it leaves out, its taken alternates and its exclusion covers. A parity test runs the SQL and the kernel on the test rows, as `bid_pricing_history` does today.
  2. **Writes the award.**
  3. **Drafts the statement of work** as `sowFromBid` does: the price, retainage 10, the plan set, one line per scope item (the price split evenly, with the remainder on the last line), their own schedule of values and their exclusions from the quote.
  - The refusals are the gate's own words (`canAward`): *"…is not vetted yet. Approve them on Trade partners first."*, *"…is approved up to $50,000. This award is $61,200."*
  - Refused too, each in words that pass the plain-words rules: an ask not on a GC trade, our own trade, a lost project, a trade already awarded, and an ask with no quote.
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

Plan written 2026-10-08 by Helper 2 at the lead's ask, on `spike/board-b6-plan`. The facts come from the reader audit of origin/main at a1137d746 (file:line in section 1; every reader in `board-b6-reader-audit.md` beside this plan), from `esign_consents`' CHECK (`20261006040000`), and from `gc_change_orders` (O1, `20261008010000:92`). B6-a was cut as #4973 the same day. The lead said yes to calls 6, E and G on 2026-10-08. Call 5 waits for B6-b, and W is the owner's, at its default (dev only) until award's door.

**Amended 2026-10-08, evening, by Helper 12** (the Board lane after the handoff), on the lead's calls from the byte-for-byte compare of #4973:

- Each CHECK is named (`gc_sows_status_known` and the rest), with the predicates unchanged.
- The statement of work has a second key to its ask, `gc_sows_ask_on_trade`, so the ask awarded is on this trade.
- The award's key is `ON DELETE SET NULL (awarded_invite_id)`, as this plan said, and a check keeps an award with its day.
- The statement of work's keys to its ask are NO ACTION, and its lines' keys are deferred to the end of the transaction. The bed deletes an awarded project in one statement and runs every deferred check, and it refuses a scope item on a statement of work.
- What they will not do carries a unit price only when there is one, as `sowExcluded` does.
- `gc_award` refuses anyone but a dev first, and two more refusals are new: an ask not on a GC trade, and an ask with no quote. `awardSql.test.ts` holds every refusal in the bed to the plain-words rules.
- The stamp stays `20261009140000`, applied after `20261009180000` through `--include-all`.

## B6-a's SQL as built

`supabase/migrations/20261009140000_gc_award_and_sow.sql` on #4973 at a175d6a69, word for word. A difference between the migration and this block that is not a comment is a question for the Board lane.

```sql
SET lock_timeout = '3s';

-- GC mode, the Board's B6-a (to-dos/gc-mode/mockups/board-b6.md on spike/gc-mode, approved 2026-10-08):
-- the contract step for our number's money, award, and the statement of work standing alone (call 6).
-- No live table changes shape except gc_projects (the contract step) and esign_consents' record_type
-- CHECK (call E). Dev only while the Board is built; the Board's door opens the new tables.

-- 1) The contract step. B5-a (20261008130000) copied our number's three inputs to gc_project_money, and
-- since B5-c (v2.4930) no client or function reads gc_projects' copies. The doc reads both places on prod
-- before the push and finds them equal.
ALTER TABLE public.gc_projects
  DROP COLUMN IF EXISTS general_conditions,
  DROP COLUMN IF EXISTS contingency_pct,
  DROP COLUMN IF EXISTS fee_pct;

-- 2) Award on the trade: the ask whose quote we awarded, who decided and the company's day.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_invites_id_company' AND conrelid = 'public.gc_invites'::regclass) THEN
    ALTER TABLE public.gc_invites ADD CONSTRAINT gc_invites_id_company UNIQUE (id, company_id);
  END IF;
END $$;

ALTER TABLE public.gc_trade_packages
  ADD COLUMN IF NOT EXISTS awarded_invite_id uuid,
  ADD COLUMN IF NOT EXISTS awarded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS awarded_on date;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_trade_packages_awarded_on_this_trade' AND conrelid = 'public.gc_trade_packages'::regclass) THEN
    -- An ask on this trade, let go with the ask as B5's carry is. A project's or a trade's delete takes the
    -- award with it; the awarded ask alone is still kept, by the award's day and the statement of work's key.
    ALTER TABLE public.gc_trade_packages ADD CONSTRAINT gc_trade_packages_awarded_on_this_trade
      FOREIGN KEY (awarded_invite_id, id) REFERENCES public.gc_invites (id, package_id) ON DELETE SET NULL (awarded_invite_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_trade_packages_awarded_with_day' AND conrelid = 'public.gc_trade_packages'::regclass) THEN
    ALTER TABLE public.gc_trade_packages ADD CONSTRAINT gc_trade_packages_awarded_with_day
      CHECK ((awarded_invite_id IS NULL) = (awarded_on IS NULL));
  END IF;
END $$;

COMMENT ON COLUMN public.gc_trade_packages.awarded_invite_id IS
  'GC mode (B6-a, v2.4934): the ask whose quote this trade is awarded to. Written by gc_award only, with awarded_by and awarded_on.';
COMMENT ON COLUMN public.gc_trade_packages.awarded_by IS
  'GC mode (B6-a, v2.4934): the estimator who decided the award.';
COMMENT ON COLUMN public.gc_trade_packages.awarded_on IS
  'GC mode (B6-a, v2.4934): the company''s day of the award (public.app_today()).';

-- 3) The statement of work, standing alone (call 6): step_commitments is not touched.
CREATE TABLE IF NOT EXISTS public.gc_sows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL UNIQUE REFERENCES public.gc_trade_packages(id) ON DELETE CASCADE,
  invite_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.gc_companies(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft'
    CONSTRAINT gc_sows_status_known CHECK (status IN ('draft', 'sent', 'signed', 'cancelled')),
  price numeric NOT NULL
    CONSTRAINT gc_sows_price_not_negative CHECK (price >= 0),
  retainage_pct numeric NOT NULL DEFAULT 10
    CONSTRAINT gc_sows_retainage_range CHECK (retainage_pct >= 0 AND retainage_pct <= 100),
  -- The plan set it is based on (gc_plan_sets.rev).
  based_on_rev integer NOT NULL DEFAULT 0,
  -- Their own schedule of values from the quote, [{label, amount}]. Null: they sent none.
  their_sov jsonb
    CONSTRAINT gc_sows_their_sov_array CHECK (their_sov IS NULL OR jsonb_typeof(their_sov) = 'array'),
  -- What they will not do, [{name, by, unitPrice?}], from the quote awarded. Null: it named nothing.
  excluded jsonb
    CONSTRAINT gc_sows_excluded_array CHECK (excluded IS NULL OR jsonb_typeof(excluded) = 'array'),
  sent_on date,
  signed_on date,
  -- The ESIGN fields, as step_commitments' offer signing has them; the trade's sign verb writes them.
  signer_printed_name text,
  signer_signature_storage_path text,
  signer_consented_at timestamptz,
  signer_ip text,
  signer_user_agent text,
  -- Closeout: the day we accepted their work.
  accepted_on date,
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- The ask awarded: an ask of this company, on this trade.
  CONSTRAINT gc_sows_ask_of_company FOREIGN KEY (invite_id, company_id) REFERENCES public.gc_invites (id, company_id),
  CONSTRAINT gc_sows_ask_on_trade FOREIGN KEY (invite_id, package_id) REFERENCES public.gc_invites (id, package_id)
);

COMMENT ON TABLE public.gc_sows IS
  'GC mode (B6-a, v2.4934): a trade''s statement of work with the company awarded (TradePackage.sow), drafted by gc_award from the quote and signed in the trade''s portal. Stands alone: step_commitments is not touched (board-b6.md call 6).';

CREATE TABLE IF NOT EXISTS public.gc_sow_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_id uuid NOT NULL REFERENCES public.gc_sows(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  amount numeric NOT NULL
    CONSTRAINT gc_sow_lines_amount_not_negative CHECK (amount >= 0),
  -- The kernels' SovLine.id: the scope item, or the change order that added the line. One on a statement
  -- of work is not deleted; the check waits for the end of the transaction, so a whole project still goes
  -- by cascade (as Owner Billing's lines, 20261008010000).
  scope_item_id uuid REFERENCES public.gc_scope_items(id) DEFERRABLE INITIALLY DEFERRED,
  change_order_id uuid REFERENCES public.gc_change_orders(id) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT gc_sow_lines_one_source CHECK ((scope_item_id IS NULL) <> (change_order_id IS NULL)),
  CONSTRAINT gc_sow_lines_scope_once UNIQUE (sow_id, scope_item_id)
);

COMMENT ON TABLE public.gc_sow_lines IS
  'GC mode (B6-a, v2.4934): a statement of work''s schedule of values, one line per scope item (or change order). Draws, back charges and sent-backs point at these ids.';

ALTER TABLE public.gc_sows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_sow_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gc_sows_dev ON public.gc_sows;
CREATE POLICY gc_sows_dev ON public.gc_sows FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_sow_lines_dev ON public.gc_sow_lines;
CREATE POLICY gc_sow_lines_dev ON public.gc_sow_lines FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
REVOKE ALL ON public.gc_sows, public.gc_sow_lines FROM anon;

-- 4) The e-sign ledger takes a signed statement of work (call E), with nothing else changed.
ALTER TABLE public.esign_consents DROP CONSTRAINT IF EXISTS esign_consents_record_type_check;
ALTER TABLE public.esign_consents
  ADD CONSTRAINT esign_consents_record_type_check
  CHECK (record_type IN ('estimate', 'job_contract', 'person_contract_document', 'step_commitment', 'bid_proposal_room', 'lien_owner_record_request', 'gc_sow'));

-- 5) The leveled total in SQL, as leveledTotal (src/lib/gc/bids.ts) reads it (call G): the newest quote,
-- plus the ask's plug on each scope line it does not say yes to, its taken alternates, and its cover on
-- each exclusion beyond the trade's Known exclusions. exclusionCoversTotal matches names by fold().
-- src/lib/gc/awardSql.test.ts and supabase/tests/gc_award hold this copy to the kernel.
CREATE OR REPLACE FUNCTION public.gc_exclusion_key(p_words text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT btrim(regexp_replace(replace(lower(coalesce(p_words, '')), '&', ' and '), '[^a-z0-9]+', ' ', 'g'))
$$;

COMMENT ON FUNCTION public.gc_exclusion_key(text) IS
  'GC mode (B6-a, v2.4934): exclusions.ts'' fold() in SQL: "Permits & fees" and "permits and fees" are one key.';

CREATE OR REPLACE FUNCTION public.gc_leveled_total(p_invite_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ask AS (
    SELECT i.id, i.package_id, i.plugs, i.exclusion_covers, i.taken_alternates FROM public.gc_invites i WHERE i.id = p_invite_id
  ), quote AS (
    SELECT q.* FROM public.gc_quotes q WHERE q.invite_id = p_invite_id ORDER BY q.created_at DESC, q.id DESC LIMIT 1
  )
  SELECT quote.amount
    + coalesce((
        SELECT sum(coalesce((ask.plugs ->> s.id::text)::numeric, 0))
        FROM public.gc_scope_items s
        WHERE s.package_id = ask.package_id AND coalesce(quote.includes ->> s.id::text, '') <> 'yes'
      ), 0)
    + coalesce((
        SELECT sum((a ->> 'amount')::numeric)
        FROM jsonb_array_elements(coalesce(quote.alternates, '[]'::jsonb)) a
        WHERE (a ->> 'label') = ANY (coalesce(ask.taken_alternates, '{}'))
      ), 0)
    + coalesce((
        SELECT sum(coalesce((ask.exclusion_covers ->> (e ->> 'name'))::numeric, 0))
        FROM jsonb_array_elements(coalesce(quote.exclusions, '[]'::jsonb)) e
        WHERE public.gc_exclusion_key(e ->> 'name') NOT IN (
          SELECT public.gc_exclusion_key(k.label) FROM public.gc_scope_exclusions k WHERE k.package_id = ask.package_id
        )
      ), 0)
  FROM ask JOIN quote ON true
$$;

COMMENT ON FUNCTION public.gc_leveled_total(uuid) IS
  'GC mode (B6-a, v2.4934): an ask''s all-in number, as leveledTotal reads it. Null when no quote is in. SECURITY INVOKER.';

-- 6) Award: the gate re-checked in SQL against the company's vetting (canAward's words), the award
-- written, and the statement of work drafted as sowFromBid draws it. One transaction.
CREATE OR REPLACE FUNCTION public.gc_award(p_invite_id uuid, p_estimator uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ask record;
  v_total numeric;
  v_rev integer;
  v_count integer;
  v_each numeric;
  v_sow uuid;
  v_quote record;
  v_excluded jsonb;
  v_dollars text;
BEGIN
  -- Who may award (call W, the owner's): dev while built. Door 2 opened the trades to the office, so the
  -- refusal is said here, before any write, rather than left to gc_sows' policy.
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev awards a trade while GC mode is built.' USING ERRCODE = 'P0001';
  END IF;
  SELECT i.id AS invite_id, i.company_id, k.id AS package_id, k.trade, k.ours, k.awarded_invite_id,
         g.project_id, g.lost_on, p.name AS project_name,
         c.name AS company, c.vetting_status, c.vetting_limit, c.vetting_note,
         EXISTS (SELECT 1 FROM public.gc_company_vetting_forms f WHERE f.company_id = c.id) AS form_in
  INTO v_ask
  FROM public.gc_invites i
  JOIN public.gc_trade_packages k ON k.id = i.package_id
  JOIN public.gc_projects g ON g.project_id = k.project_id
  JOIN public.projects p ON p.id = g.project_id
  JOIN public.gc_companies c ON c.id = i.company_id
  WHERE i.id = p_invite_id
  FOR UPDATE OF k;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That ask is not on a GC trade.' USING ERRCODE = 'P0001';
  END IF;
  IF v_ask.ours THEN
    RAISE EXCEPTION 'We do % ourselves, so it is not awarded.', v_ask.trade USING ERRCODE = 'P0001';
  END IF;
  IF v_ask.lost_on IS NOT NULL THEN
    RAISE EXCEPTION '% is lost. Bring it back before you award a trade.', v_ask.project_name USING ERRCODE = 'P0001';
  END IF;
  IF v_ask.awarded_invite_id IS NOT NULL THEN
    RAISE EXCEPTION '% is already awarded.', v_ask.trade USING ERRCODE = 'P0001';
  END IF;

  v_total := public.gc_leveled_total(p_invite_id);
  IF v_total IS NULL THEN
    RAISE EXCEPTION '% has not sent a quote for %.', v_ask.company, v_ask.trade USING ERRCODE = 'P0001';
  END IF;

  -- canAward (src/lib/gc/vetting.ts), word for word. A company with no vetting is one we know.
  IF v_ask.vetting_status = 'new' THEN
    IF v_ask.form_in THEN
      RAISE EXCEPTION '% is not vetted yet. Their form came in. Approve them on Trade partners first.', v_ask.company USING ERRCODE = 'P0001';
    END IF;
    RAISE EXCEPTION '% is not vetted yet. They have not sent their form.', v_ask.company USING ERRCODE = 'P0001';
  END IF;
  IF v_ask.vetting_status = 'declined' THEN
    RAISE EXCEPTION '%', 'We declined ' || v_ask.company
      || CASE WHEN coalesce(v_ask.vetting_note, '') <> '' THEN ': ' || v_ask.vetting_note ELSE '' END || '.' USING ERRCODE = 'P0001';
  END IF;
  IF v_ask.vetting_limit IS NOT NULL AND v_total > v_ask.vetting_limit THEN
    v_dollars := '$' || to_char(round(v_ask.vetting_limit), 'FM999,999,999,990');
    RAISE EXCEPTION '% is approved up to %. This award is %.', v_ask.company, v_dollars,
      '$' || to_char(round(v_total), 'FM999,999,999,990') USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.gc_trade_packages
  SET awarded_invite_id = p_invite_id, awarded_by = coalesce(p_estimator, auth.uid()), awarded_on = public.app_today()
  WHERE id = v_ask.package_id;

  -- sowFromBid: the price, retainage 10, the newest plan set, their own schedule of values and what they
  -- will not do (a unit price only when there is one, as sowExcluded), then one line per scope item, the
  -- price split evenly in hundreds with the rest on the last.
  SELECT q.sov, q.exclusions INTO v_quote
  FROM public.gc_quotes q WHERE q.invite_id = p_invite_id ORDER BY q.created_at DESC, q.id DESC LIMIT 1;
  SELECT coalesce(max(s.rev), 0) INTO v_rev FROM public.gc_plan_sets s WHERE s.project_id = v_ask.project_id;
  SELECT CASE WHEN jsonb_array_length(coalesce(v_quote.exclusions, '[]'::jsonb)) = 0 THEN NULL ELSE jsonb_agg(
           jsonb_build_object('name', e ->> 'name', 'by', (
             SELECT k.by FROM public.gc_scope_exclusions k
             WHERE k.package_id = v_ask.package_id AND public.gc_exclusion_key(k.label) = public.gc_exclusion_key(e ->> 'name')
             ORDER BY k.position, k.created_at LIMIT 1
           )) || CASE WHEN coalesce(e -> 'unitPrice', 'null'::jsonb) <> 'null'::jsonb THEN jsonb_build_object('unitPrice', e -> 'unitPrice') ELSE '{}'::jsonb END
           ORDER BY ord) END
  INTO v_excluded
  FROM jsonb_array_elements(coalesce(v_quote.exclusions, '[]'::jsonb)) WITH ORDINALITY AS x(e, ord);

  INSERT INTO public.gc_sows (package_id, invite_id, company_id, price, retainage_pct, based_on_rev, their_sov, excluded)
  VALUES (
    v_ask.package_id, p_invite_id, v_ask.company_id, v_total, 10, v_rev,
    CASE WHEN jsonb_array_length(coalesce(v_quote.sov, '[]'::jsonb)) > 0 THEN v_quote.sov END,
    v_excluded
  )
  RETURNING id INTO v_sow;

  SELECT count(*) INTO v_count FROM public.gc_scope_items s WHERE s.package_id = v_ask.package_id;
  v_each := floor(v_total / greatest(1, v_count) / 100) * 100;
  INSERT INTO public.gc_sow_lines (sow_id, position, label, amount, scope_item_id)
  SELECT v_sow, n - 1, s.label,
         CASE WHEN n = v_count THEN v_total - v_each * (v_count - 1) ELSE v_each END,
         s.id
  FROM (
    SELECT s.*, row_number() OVER (ORDER BY s.position, s.id) AS n FROM public.gc_scope_items s WHERE s.package_id = v_ask.package_id
  ) s;

  RETURN v_sow;
END;
$$;

COMMENT ON FUNCTION public.gc_award(uuid, uuid) IS
  'GC mode (B6-a, v2.4934): award a trade to one ask''s quote, dev only until call W. Refuses our own trade, a lost project, a trade already awarded and an ask with no quote; re-checks canAward against the leveled total in SQL; writes the award; drafts the statement of work as sowFromBid does. Returns the statement of work''s id. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_exclusion_key(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gc_leveled_total(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gc_award(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_exclusion_key(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gc_leveled_total(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gc_award(uuid, uuid) TO authenticated;

-- 7) Training mode and digital twins: the new tables get their blocks; the three create only what is missing.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
```
