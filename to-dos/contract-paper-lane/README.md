---
name: Signing it on paper
group: ready
status: >
  PR 1 shipped v2.3527 (Download PDF on the sweep pane and the editor; the unsigned agreement
  with Sign / Date rules; `share-job-contract` and `sign-job-contract` deployed) · Grace endorsed
  the revised design 2026-09-16; the owner's approval is pending for PRs 2–6 · reaches 24 of the
  105 rows today
summary: >
  **Signing it on paper**: prod says the sweep's only outcome is the one that has never worked — 0
  contracts ever signed through the e-signing link, 3 of 3 finished ones signed on paper, 0
  customer documents in the Contract Book so the Terms dropdown has exactly one option (a source
  constant). The lane runs one way: the app files signed paper but cannot produce the page to
  sign. Proposed: *How this one gets signed* per row (email the PDF to sign by hand · email a
  signing link · download to print), a `gc_job` row collapsing to *File their subcontract*, terms
  as two labelled levers with the built-in wording seeded into the Book, and **Edit & re-send**
  while a sent agreement is still unopened. Reach, counted live 2026-09-16: 24 of the 105 rows
  are ready and are what this sends; 21 need an email or amount first; 59 are builder rows that
  nothing here sends to — their lever is the owner's customer-level agreements decision. Mock-up
  carries the rejected first pass and the five-point critique.
next: >
  Ask Taunya which terms she means (legal paragraphs or the payment line) — one message, it
  resizes PR 4. Then PR 2 the hand-off stamp (one migration); PR 3 email the PDF; PR 4 terms as
  two levers; PR 5 the three-way block; PR 6 Edit & re-send.
size: L (5 PRs left)
blocker: >
  The owner's approval of the design for PRs 2–6. Five owner decisions listed.
ver: proposed 09-15 · endorsed 09-16 · PR 1 v2.3527
---

# Signing it on paper — the Contract sweep's missing lane, and terms the office can change

## The ask, in the owner's words

Relayed from Taunya (assistant, working the sweep of 105 jobs), 2026-09-15:

> I want to be able to Export as pdf and ability to update terms

Then, on the first pass (a Download PDF button plus an *Edit these terms* link): **"is this the best we can do?"** — the answer is the revised design below. The first pass is kept in the mock-up as the rejected option because its mistakes are the useful part.

## Findings — what the code and the data already say

**Read live from prod on 2026-09-15, read-only. This is the spine of the argument; re-read it before changing the plan.**

| In production | Count |
|---|---|
| `job_contracts` rows, all time | 6 |
| Ever signed through the e-signing link | **0** |
| Signed on paper (`signer_mode = 'paper'`), then filed | 3 |
| Customer-audience documents in `contract_template_documents` | **0** (8 staff, 8 sub) |
| Options in the sweep's Terms dropdown | **1** |
| Live jobs with no agreement on file | 105 · $1,302,646 · 81 "need a look" |

- **The only real attempt at the e-sign flow took one day and ended on paper.** A Michael Palmer job (the same builder at the top of the sweep today, `job_id` starting `51f92a6f`): revision 1 sent 2026-09-03 and opened once, revised and sent again (never opened), revised and sent a third time (never opened), then revision 4 signed **on paper** on 2026-09-04. All three voids carry `void_reason = 'Revised by the office'`, which is what `JobContractModal`'s void-and-revise path writes.
- **The Terms dropdown has nothing to drop down to.** `JobsContractSweepModal` selects `contract_template_documents` where `audience = 'customer'`; prod has none, so the only option is the built-in. The built-in wording is `DEFAULT_JOB_CONTRACT_TERMS_PLAIN`, **a constant in `src/lib/jobs/jobContractDocument.ts`** — its own comment calls it "used until the office adds a customer template to the Contract Book". Nobody ever has.
- **The office already has permission, just no reachable door.** The baseline RLS on `contract_template_documents` admits `is_assistant()` for SELECT / INSERT / UPDATE, so Taunya may author a customer document today. The only UI is People → Contracts → **Contract library** (`PeopleContractsTab` → `ContractLibraryModal` → `ContractBookModal`), and the only pointer to it is a hint in `JobContractModal` that renders **only when `templates.length === 0`**.
- **Paper flows one way.** The app takes signed paper in (`JobContractFileSheet` / `fileSignedJobContract`, plus the Drive pass). It cannot produce the page to sign. There is no PDF of an unsigned draft anywhere.
- **A PDF renderer exists but is post-signature.** `supabase/functions/_shared/jobContractPdf.ts` (`buildJobContractPdf`) is called by `sign-job-contract` and `share-job-contract`. Its `JobContractPdfInput.signature` is **required**, and the block it draws is tagged `SIGNED ELECTRONICALLY` with the signer's printed name. `share-job-contract` already answers `mode: 'pdf_url'`, but only for a **signed** contract or a customer-accepted estimate.
- **`job_contracts.minted_pdf_path` exists and nothing writes it** (0 rows). The column is free for the draft PDF.
- **A download with no stamp would corrupt the sweep's own count.** `isContractGap` in `jobContractCoverage.ts` counts only `none` and `draft` as a gap, so a job leaves the 105 exactly when its contract becomes `sent`. Download-and-email-it-yourself would leave every such job in the pile forever.
- **The sweep already knows rows want different doors.** `contractSweepRowState.ts` names `gc_job` with action `file_theirs` — a builder's own subcontract is the agreement, so our service agreement is the wrong document on those rows.
- **Reach — what this train moves, counted live on 2026-09-16 (sweep filter *All · 105*):**

  | Rows | Count | What moves them |
  |---|---|---|
  | Ready (email, scope and amount all present) | **24** | PRs 1–3 and 5: these are the rows the paper lane sends |
  | No amount, or no email (not builders) | 21 (8 · 13) | A fix on the job first; then the same three ways |
  | Builder rows (`gc_job`, 54 of them also with no email) | **59** | Nothing in this train sends to them. PR 5 only names the door they already have (*file theirs*); the **customer-level agreements** decision below is what clears them |

  So the paper lane, fully built, takes the pile from 105 to about 80. Anyone expecting it to empty the sweep is reading the wrong to-do — the other half is the builder half.
- **Half the pile is one decision, not six PRs.** Dudley Mason (22 live jobs), Knight, Palmer, Heron and Structura each work under **one master subcontract**, not one per job, which is why 59 rows are builders and why the first Drive pass could file only 2 of 104. A `customer_contracts` record that coverage reads after the job-level one is listed in [`owner-decisions-pending.md`](../owner-decisions-pending.md) → *Customer-level (master) agreements* and in [`contract-sweep-seen-first/`](../contract-sweep-seen-first/README.md). It is not part of this train and this train does not need it, but it is the bigger lever on the same number, and PR 5's builder-row collapse is the per-job shape of the same idea — build the collapse so that a customer-level record can sit behind *File their subcontract* later without a redesign.
- **Two different things on that screen are called terms.** The **Terms** dropdown (which Book document supplies the boilerplate, sweep-wide) and **Payment** (`payment_terms_key`: `half_down` · `on_completion` · `progress` · `custom`, per job, editable only in the full editor — the sweep's in-place edit covers scope and amount only).

## The decision (proposed; endorsed by Grace 2026-09-16, the owner's approval pending)

Build the paper lane properly and make terms changeable, but **do not** build either the way it was asked for.

1. **Three ways, chosen per row.** The bottom of the pane becomes *How this one gets signed*, with the answer pre-picked by what the row is and the other two one tap away:
   - **Email the PDF to sign by hand** — the app sends the paper document as an attachment, and still records that it went, to whom, and when. *This is the option the first pass missed, and it is the one the record supports.*
   - **Email a signing link** — today's behaviour, kept.
   - **Download to print** — for the counter or the mail; taking it marks the job handed over.
   On a `gc_job` row the block collapses to **File their subcontract** and our two ways demote.
2. **Terms as two labelled levers**, replacing one dropdown that locks: **This job** (scope · amount · payment preset) and **Standard terms** (the Book document, its version date, an **Edit** door, and a line saying *editing changes the wording on all 105 agreements*).
3. **Seed the built-in wording into the Book** as a real versioned customer document, so the dropdown stops being a dropdown with one option and the constant becomes the fallback it was always documented as.
4. **Edit & re-send while unopened** — the fix for what actually happened on 2026-09-03. Nobody asked for it; it is the highest-value item in the train.

**Rejected — the first pass** (kept in [`mockup.html`](./mockup.html)): a Download PDF button in the footer plus an *Edit these terms* link under the dropdown. Five faults, each one a design note for whoever builds this:
- It left **Send & next** as the blue primary when no send has ever been signed. Adding a quieter button beside an action that has never worked is hedging.
- **Download is a step, not an outcome.** Sent from Taunya's own mail, the record, the reminder and the signature are all lost.
- **The terms link walks into a shared document with no warning**, so someone fixing one sentence for one homeowner changes the language on all 105.
- **It ignores the three voids.** The pain was sending and then needing to change it.
- **It treats a builder's row like a homeowner's**, inviting the wrong paper.

Also rejected: **a free-text terms box per job.** Contract language is legal text; per-job free text means 105 divergent agreements with no version record and no way to answer what a customer agreed to. The Book already stamps `template_name` / `template_version_date` onto every contract row — use it, don't bypass it.

## Ask Taunya first (one message, before PR 4)

**Which terms does she mean — the legal paragraphs, or the payment line (50% down vs due on completion)?** Both readings are plausible from where she was sitting and they lead to different work. If she means payment, PR 4 shrinks to putting the four `PAYMENT_TERMS_PRESETS` into the pane's in-place edit. Also worth asking what she does with the PDF once she has it: print and hand over, email it herself, or keep a copy. That decides whether the hand-off stamp is a must or a nicety.

## The mock-up

[`mockup.html`](./mockup.html) — the evidence table, the one-day story, the pane as it is with its four faults, the rejected first pass, the five-point critique, and the revised design on both a homeowner row (J363 Michael Palmer) and a builder row (J804 Summit GC). Also published as the Claude artifact *Signing it on paper*.

## Where it plugs in

| Exists | New |
|---|---|
| [`JobsContractSweepModal.tsx`](../../src/components/jobs/JobsContractSweepModal.tsx) — the two-pane sweep, the Terms `<select>` (sweep-wide, read-only once a draft exists), the in-place scope/amount edit, the footer, the ⋯ menu | the *How this one gets signed* block; the two-lever terms rows; Download / Email-the-PDF actions |
| [`JobContractModal.tsx`](../../src/components/jobs/JobContractModal.tsx) — the full editor; `PAYMENT_TERMS_PRESETS` chips; the void-and-revise path that writes `void_reason: 'Revised by the office'` | **Edit & re-send** when `first_viewed_at` is null, in place of void-and-revise |
| [`jobContractDocument.ts`](../../src/lib/jobs/jobContractDocument.ts) — `DEFAULT_JOB_CONTRACT_TERMS_PLAIN`, `JobContractFields`, `paymentTermsSentence`, `buildJobContractPrefill`, `buildJobContractDocumentHtml` | the constant becomes the seeded Book document's body; keep the constant as the fallback |
| [`jobContractCoverage.ts`](../../src/lib/jobs/jobContractCoverage.ts) — `JobContractCoverage` (`none` · `draft` · `sent` · `signed` · `not_needed`), `isContractGap` | nothing, **if** a hand-off stamps `sent` (see the open decisions) |
| [`contractSweepRowState.ts`](../../src/lib/jobs/contractSweepRowState.ts) — `ready` · `thin_scope` · `no_amount` · `no_email` · `gc_job`; actions `send` · `fix_email` · `file_theirs` · `add_scope` | **`contractSigningWays.ts`** — the pure kernel that picks the default way per row and lists the alternatives |
| [`jobContractFileWrite.ts`](../../src/lib/jobs/jobContractFileWrite.ts) — `fileSignedJobContract`, the one write for all three filing doors; writes a `recorded` row to `job_contract_events` | a `handed_over` event and the sent stamp, through one write in the same style |
| [`_shared/jobContractPdf.ts`](../../supabase/functions/_shared/jobContractPdf.ts) — `buildJobContractPdf`; `signature` is required and its frame is tagged `SIGNED ELECTRONICALLY`; TS test twin at [`src/lib/jobs/jobContractPdf.test.ts`](../../src/lib/jobs/jobContractPdf.test.ts) | an **unsigned variant**: blank signature and date rules, no electronic-signature tag |
| [`share-job-contract`](../../supabase/functions/share-job-contract/index.ts) — modes `email` and `pdf_url`, staff JWT validated in-body, rows read through the caller's RLS, `JOB_CONTRACT_BUCKET` | mode **`draft_pdf`** (and the attachment send for the middle way) |
| [`send-job-contract`](../../supabase/functions/send-job-contract/index.ts) — modes `email` and `link` | the PDF-attachment send, or a new mode here rather than on share — builder's call |
| [`JobSignedAgreementModal.tsx`](../../src/components/jobs/JobSignedAgreementModal.tsx) — already calls `mode: 'pdf_url'` and `window.open`s the result | the same call shape for a draft; copy it rather than inventing one |
| `contract_template_documents` (`audience`, `document_name`, `book_body_html`, `book_version_date`); [`ContractBookModal.tsx`](../../src/components/contracts/ContractBookModal.tsx) reached from People → Contracts → Contract library | a migration seeding one `audience = 'customer'` row; an **Edit** door from the sweep straight into it |
| `job_contracts` — `status`, `sent_at`, `send_count`, `first_viewed_at`, `minted_pdf_path` (nothing writes it), `signer_mode`, `paper_upload_path` | **one migration**: `job_contracts.sent_channel` (`link` · `pdf_email` · `handed`), plus the seeded Book row |

## The plan

1. **PR 1 · the unsigned PDF — BUILT as v2.3527** (`UNSIGNED_BLOCK` in `_shared/jobContractPdf.ts`, `mode: 'draft_pdf'` on `share-job-contract`, **Download PDF** in `JobsContractSweepModal` and `JobContractModal`, guide *get a job contract signed*). Originally: teach `_shared/jobContractPdf.ts` an unsigned variant (blank signature and date rules, no `SIGNED ELECTRONICALLY` tag), add `mode: 'draft_pdf'` to `share-job-contract`, put **Download PDF** in the sweep pane and the full editor. Tests go on the TS twin. *Client + one function; no migration.*
2. **PR 2 · record the hand-off.** Migration for `job_contracts.sent_channel`; taking the PDF offers **Mark as handed to the customer**, stamping `sent` + `sent_channel = 'handed'` + a `job_contract_events` row. The job leaves the 105; *Already signed? File it* closes the loop. *Deploy the client first, then push.*
3. **PR 3 · email the PDF to sign by hand.** The middle way: the app sends the same PDF as an attachment, `sent_channel = 'pdf_email'`, reminders as today. This is the one most likely to actually get signatures.
4. **PR 4 · terms as two levers.** Seed the built-in wording as a versioned customer Book document; split *This job* from *Standard terms*; state what an edit reaches; add the **Edit** door. Drop the zero-templates-only hint. *Shrinks a lot if Taunya meant the payment line.*
5. **PR 5 · How this one gets signed.** The `contractSigningWays.ts` kernel, the three-way block with a per-row default, and the `gc_job` collapse to *File their subcontract*.
6. **PR 6 · Edit & re-send while unopened.** Replaces void-and-revise when `first_viewed_at` is null.

Each PR: `npm run claim`, a release note + `docs/recent-features/` fragment, the help guide *get a contract signed* updated, and a live pass before it merges.

The mock-up's *Order, smallest first* lists the same six, in the same order, with the Taunya question as the step before PR 1. PRs 2 and 3 stay separate on purpose: PR 2 carries the only migration and has to deploy client-first, and PR 3 is the first PR that sends anything to a customer, which wants its own live pass.

## How to verify

- Dev login as Robert → **Jobs → Pipeline** → the *Get contracts signed* card → **Start the sweep →**. Today: *105 without a contract · $1,302,646 of work · 81 need a look*, filters *To send · 24 | Needs a look · 81 | All · 105*.
- **The "before" proof, in two seconds:** open the Terms dropdown. It has exactly one option. Confirm with
  `supabase.from('contract_template_documents').select('*').eq('audience','customer')` → zero rows.
- **The contract table is tiny and every row matters** — 6 rows, 3 of them real signed paper. Re-read it before and after any write:
  `supabase.from('job_contracts').select('id,status,signer_mode,sent_at,first_viewed_at,voided_at')`.
- **PR 1:** download the PDF on J363 and open it. The signature area must show blank *Sign* and *Date* rules and must **not** say signed electronically. Downloading writes nothing — safe on a real row.
- **PR 2 and 3 write to real contracts.** Make a throwaway job first (the owner-of-record train used J1023 this way), or exercise the flow up to the confirm and **Cancel**. Never press a send on a live customer row; `palmertexashomes@gmail.com` on J363 is a real builder's address.
- **PR 4:** after the seed, the dropdown shows *Service agreement · v. <date>*, and an existing draft's stamped `template_name` / `template_version_date` still read the same.
- **Phone width (375 px)** on the pane — the sweep is a two-pane modal and the ways block is new furniture in it.

## Gotchas

- **Never render a draft through the signed renderer unchanged.** The frame is tagged `SIGNED ELECTRONICALLY`; handing that to a customer claims a signature that does not exist.
- **A draft PDF must not leak the signing token.** `share-job-contract` mints public links elsewhere in the same file; the draft mode returns bytes only.
- **`_shared/` edits never show in `npm run check:edge-drift`** — redeploy every importer by hand after touching `jobContractPdf.ts` (`sign-job-contract`, `share-job-contract`).
- **Worktrees are not Supabase-linked** — deploy with `supabase functions deploy <name> --project-ref yewfzhbofbbyvkvtaatw`; run the drift checks with `export SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_MGMT_TOKEN=' .env.local | cut -d= -f2-)`.
- **Do not push a migration from a feature worktree** — the v2.3285 incident pushed three branch-only migrations in one run.

## Open decisions (the owner's, not the builder's)

- **Does handing over paper count as `sent`?** It moves the job out of the 105 and into waiting-on-a-signature. Proposed **yes** — the pile's question is whether the customer has been asked. A third state is the alternative and costs a reader sweep.
- **Which way is the default on a plain homeowner row?** The mock-up pre-picks *email the PDF* because that is what the record supports. The signing link is defensible and is a one-line change in the kernel.
- **May a builder row send ours at all?** Shown demoted rather than removed.
- **Who may edit the standard terms?** Any assistant can write the Book today (baseline RLS). Contract language may deserve a narrower door than the rest of the Book.
- **Should the sweep's primary button stay Send?** Not proposed yet. PR 5 will show which way people actually press; decide after a week of it.
- **The builder half** — the customer-level agreements decision (above, under *Reach*) is the owner's and is tracked in `owner-decisions-pending.md`; it is listed here only so nobody sizes this train as the whole sweep.
