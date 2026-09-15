# Put a GC on notice — every owner on every job with a failing GC, in one approved run

Status: **in progress** · PR 0 (the first-notice rule) v2.3469 on `claude/gc-on-notice-0-first-notice-rule` · PR 1 (the RPC, the kernel, the modal with Steps 1 · 2 · the decision, the three doors, Approve all → the run) v2.3470 on `claude/gc-on-notice-1-modal` · PR 2 (the cover letter) and PR 3 (the leader's card) follow · second-pass mock-ups 2026-09-15 at the Claude artifact *Put a GC on Notice* (four boards: the doors, the modal, the leader's phone card, the run) · the owner-of-record train shipped 2026-09-15 (v2.3447 / v2.3452 / v2.3450 — the app looks owners up on the appraisal roll; Step 1 is *Use all found*, not a paste per row) · 4 owner decisions open (below), one for the attorney · first mock-up: [`mockup.html`](./mockup.html) · built on the Lien desk (v2.3405 / v2.3410 / v2.3412)

## The ask, in the owner's words

> If I just learned a GC has been taking from Peter to pay Paul, and has taken money from all the houses I've been working on. As a result I think he is not going to be able to pay any of his bills, and I would like to send notices of intent to lien to all of his clients. How could I add a button to help do this in the app?

## The reading

- Texas has no separate "notice of intent to lien". The **§ 53.056 notice** the Lien desk already sends is that document; its teeth are **fund trapping** under § 53.081: once an owner receives it, the owner may withhold what we are owed from any further payment to the GC and never owes it twice. The button is therefore not a new instrument — it is "send that notice to every owner on every job with this GC, for every unpaid month, today", instead of one month at a time thirty days before each deadline.
- The desk's queue (`list_lien_notice_months`) only returns jobs with a bill and months inside the 30-day lead window. A GC in trouble needs every job with unpaid work (billed **or** Working with approved hours) and every unnoticed month, no window.
- On the live desk the day this was planned, none of the seven jobs had an owner of record on file. The first live mockup (Draft A: pick the GC, see "9 jobs · $91,400", press Send) would have printed nine forms and mailed three. Owners come first.

## The decision

One modal, the GC already picked, in the order the work goes:

1. **Find the owners** — every job's property and county in a list, the appraisal-district link and an inline *Enter owner…* box per row (the property record's paste-the-CAD-page flow fills owner, mailing address, legal description, homestead); rows turn green as they are saved; the footer count follows. Keyed on the **property**, so one paste covers every job at that address.
2. **What each notice claims** — the months named (every month with approved hours and no live notice), the claim amount, the affidavit date. A closed window is shown, not hidden (that month's lien is gone; the owner still learns the balance). Unbilled work claims the unpaid contract balance and says so, with *Bill the finished work first ›* one click away.
3. **The cover letter, written once for all** — a plain paragraph to owners who paid the GC in good faith: what happened, what § 53.081 lets them do, that we release the moment we are paid, and the offer to be paid directly. Signed by the master on the letterhead; the statutory form underneath unchanged. Replaces the standard cover note for these items.
4. **The decision, once** — a reason (GC not paying its subs · insolvency suspected · promise broken twice · other) kept on every notice's record and on the GC, and three ticks: the GC's standing rule → **send without asking**; the GC's payment terms → **Winding down**; open a **Legal desk** account with all the jobs. Optional: a demand letter to the GC for the whole balance. **Approve all N and send the run ▸** (master / dev) or **The leader said to send them ▸** (office, with the note) → N approved desk items → the run.

Rejected: a bare confirm dialog (Draft A); hiding closed windows; a per-job cover letter; blocking on unbilled work.

## Entry points

- **Jobs → Pipeline**, board filtered to a GC (`stagesGcFilter` exists): the Pipeline tools ⋯ gains *⚠ Put <GC> on notice… · N jobs · $X*.
- **Bids → Customer review**: a *Put on notice…* button on a GC's row beside *set terms…* (only GCs with open jobs).
- **The Lien desk header**: *⚠ Put a GC on notice…* with a picker of GCs with unpaid work — the door from the leader's phone.

## Where it plugs in

| Exists | New |
|---|---|
| The Lien desk (`LienDeskModal`, `lienDesk.ts`, `lienDeskIo.ts`, `job_lien_desk_items`, the run `lienDeskRun.ts` / `LienDeskRunModal`), `list_lien_notice_months()`, `customers.lien_notice_policy` + `set_customer_lien_notice_policy`, `customerPaymentTerms.ts` (winding_down), the Legal desk (`legal_matters`, `LegalDeskModal`), the property record (`CustomerPropertyRecordPanel` with `cadPagePaste.ts`, `JobFormPropertyAddSheet` v2.3401), `stagesGcFilter`, `BidBoardCustomerReviewModal` | RPC `list_lien_notice_months(p_gc_customer_id)` (or a sibling `list_gc_unpaid_months`): every job with unpaid work for the GC, every unnoticed month, no window, plus the unbilled balance per job; kernel `gcOnNotice.ts` (fold per job, readiness, claim amounts, closed windows); `GcOnNoticeModal`; `fields.batch_reason` + `fields.cover_letter` on the desk items (no new columns); the three doors |

Nothing new to store: a run for a GC is N desk items with the same `approval_mode` and a shared reason; the cover letter rides in each item's `fields`.

Read against the code on 2026-09-15 (before PR 0), five corrections to the table above:

- `list_lien_notice_months` has one parameter (`p_within_days`) and hard-filters billed status / a billed invoice / `revenue − payments_made > 0`, so an unbilled Working job is excluded three ways — build the sibling `list_gc_unpaid_months(p_gc_customer_id)` rather than widening it.
- `parseLienDeskDraftFields` whitelists `notice · gcEmail · skipReason`; a `batch_reason` or `cover_letter` written into `fields` is dropped on read until the type and the parser learn them.
- The run's cover note is generated from the boolean `cover_note` column (`buildLienDeskRun`, not only `runCoverNoteBlocks`) — the letter needs the change where the run is built.
- `job_lien_desk_items_live_uniq` allows one live row per job and kind: the batch upserts a job's existing draft / awaiting / held item, never inserts beside it.
- `legal_matter_save_review` replaces the matter's job list — pass existing jobs ∪ the new ones. Payment terms have no RPC (a direct `customers` update under RLS); the Winding-down tick wants a guard like `set_customer_lien_notice_policy`'s. The leader / office role helpers are file-local in `LienDeskModal.tsx` and `LienDeskAffidavitPane.tsx` — hoist to `lienDesk.ts` before a third copy. `canSendOnWord` deliberately excludes the master (he clicks Approve).

## The plan

0. **PR 0 — the first-notice rule** (v2.3469, shipped ahead of the feature because it fixes the desk as it stands). Owner, 2026-09-14: a standing rule of *send without asking* only takes effect once a notice to that GC has gone out and been recorded — the office has then proved the owner, the addresses and the GC's copy on real mail. The kernel checks *first notice we've sent this GC* before honoring the rule; the desk's approval trigger refuses a rule approval on a GC with no recorded notice; the desk and the rule picker say so. In the modal the run **is** the first notice, approved by the leader, so the Step 4 tick reads *starts the moment this run is recorded*.
1. **PR 1 — the modal and the doors.** The GC picker, Steps 1–2 (owners list with CAD links and inline entry; months and claim amounts; closed windows named; the unbilled chip with the *Bill the finished work* door), Step 4 (reason + the three ticks), **Approve all** → N approved items → the run. Kernel + tests; the RPC.
2. **PR 2 — the cover letter.** The one-letter editor stored per item, printed as the cover page of each notice in the run (the run's `runCoverNoteBlocks` reads `fields.cover_letter` when present), the master's signature block, the demand-letter tick.
3. A guide section under *send lien notices from the Lien desk* ("A GC in trouble") and a line in *understand how liens work…*.

## Open decisions

- **Unbilled jobs:** claim the unpaid contract balance (proposed) or require billing first?
- **Closed windows:** include the month in the notice as information (proposed) or leave it out?
- **The cover letter's offer** to be paid directly by the owner — keep it (proposed)? **Attorney:** the wording of the § 53.081 withholding paragraph for homeowners on residential projects.
- **Who may press it:** master and dev only (proposed), with the office able to prepare Steps 1–3 and send on the leader's word.

## How to verify

Dev login → Jobs → Pipeline → GC filter → ⋯ → Put <GC> on notice: Step 1 lists every job of that GC with unpaid work (billed and Working), the owner column reads the property record, and saving a pasted CAD page turns the row green and moves the footer count; Step 2 shows months with a closed window in red and an unbilled job's contract balance; Approve all as a master creates N approved desk items with the reason in `fields`, flips the GC's rule and terms, opens the Legal desk account, and the run lists N notices × 2 envelopes. Prod-safe until *Record the run*; use a TEST GC with TEST jobs for the live pass.
