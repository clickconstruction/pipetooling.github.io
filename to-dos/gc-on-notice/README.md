---
name: Put a GC on notice
group: close
status: >
  **built** 2026-09-15 (v2.3469, v2.3470, v2.3482, v2.3479) · both migrations pushed · GUI pass
  2026-09-21 (v2.3664–v2.3668); the gate-3 kind switch it left followed the same day (v2.3670) ·
  left: the first real run on a TEST GC, then delete · the attorney still owns the § 53.081 wording
summary: >
  **Put a GC on notice**: one modal that sends the § 53.056 notice (the notice of intent to lien —
  fund trapping, § 53.081) to every owner on every job with a failing GC, for every unnoticed
  month, no 30-day window: find the owners first, months and claim amounts named, one cover letter
  for all, one decision (reason on the record + the GC's standing rule, payment terms, a Legal
  desk account) → the run. Three doors (Pipeline GC filter ⋯, Customer review, the desk header).
  Mock-up in the folder.
next: >
  The first real run on a TEST GC (approve, print, record), then delete the folder. Residuals stay
  listed: a GC-wide demand letter, one envelope for two notices to one owner, the attorney's §
  53.081 wording — and, from the 2026-09-21 GUI pass, the first live property-kind pick and the
  "TX Null" job addresses the new preview showed (the gate-3 kind switch shipped, v2.3670).
size: XS
blocker: A live run.
ver: v2.3469 · 3470 · 3482 · 3479 · 3664 · 3665 · 3667 · 3668 · 3670 · 3684 · 3688
opinion: your call — the code is done; the first real run on a test GC is yours to sit through.
---

# Put a GC on notice — every owner on every job with a failing GC, in one approved run

## Where it stands

**built** 2026-09-15 — PR 0 v2.3469 (#3214) · PR 1 v2.3470 (#3217) · PR 2 v2.3482 (#3228) · PR 3 v2.3479 · both migrations pushed · live pass of the modal on real data (read-only) in the PR 2 notes · GUI pass 2026-09-21 v2.3664 / v2.3665 / v2.3667 / v2.3668 (below) · same day: the Lien desk's gate 3 answers the kind in place (v2.3670), a claim set by hand on the desk follows into the run's amounts and approve draft (v2.3684), the *mail goes somewhere else* chip only fires on a house (v2.3688) · left: the residuals below (a GC-wide demand letter, one envelope for two notices, the attorney's § 53.081 wording) and the first real run on a TEST GC — then delete this file · second-pass mock-ups at the Claude artifact *Put a GC on Notice* · first mock-up: [`mockup.html`](./mockup.html) · built on the Lien desk (v2.3405 / v2.3410 / v2.3412)

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

## Deferred from PR 2

- **A demand letter to the GC for the whole balance** as a fourth tick on the decision. The demand letter (v2.3425–v2.3437) is per job — one bill, one letter, its own basis lines; a GC-wide letter for $74,900 across nine jobs is a new instrument (one statement of account across jobs, one fee clock). Owner decision: build it, or send the per-job letters from Bill Customer as today.
- **One envelope for two notices** to the same owner at the same address (1016 + 1031 in the mock-up) — the run lists an envelope per notice; merging is a run-modal change.

## Left open by the 2026-09-21 GUI pass

The window was reworked in four PRs — v2.3664 (the footer clears the bottom bar; literal fills), v2.3665 (the four steps as numbered steps under a pinned step bar), v2.3667 (property kind in one click) and v2.3668 (read each notice before approving). Mock-ups: *On Notice, Step by Step* — https://claude.ai/artifact/SQPsc4ZVjf8DGowGxMX5BW · *Property Kind, One Click* — https://claude.ai/artifact/UW5xfDqWRWxHn78mB2Emyw · *Read Before You Approve* — https://claude.ai/artifact/VcUPixrm9Fvz5pqNu1PrfA. What they left:

- ~~**The Lien desk's gate 3 still sends the user away to answer the kind.**~~ **Shipped the same day, v2.3670**: gate 3 renders `PropertyKindSwitch` in place on a linked property (`savePropertyKind` on the row, toast, `onChanged`, the *same property as 881, which follows it* line); a job with no `customer_address_id` keeps the *Set property kind ›* door. The render test covers the pick. No kind was written on prod in that pass either.
- **The property-kind save has never run against the live database.** The 2026-09-21 live pass was read-only by choice — a pick writes a real property's kind and moves a legal deadline. `savePropertyKind` is covered by render tests (`GcOnNoticeModal`, `JobFormEditFactRows`) with the write mocked. The first real pick should be watched: answer one property whose kind the office actually knows, confirm `customer_addresses.property_kind` changed, that the row reads *residential · change*, that a job at the same saved property followed it, and that the § 53.056 dates re-read (residential is a month earlier — a July window due Oct 15 becomes Sep 15).
- **"TX Null" in job addresses prints on the owner's letter.** The preview's first live run showed job 273's `job_address` stored as `9703 Lenox Hl San Antonio, TX Null`; the cover letter's `{{property}}` fill and the form's *Project description and/or address* line print it as stored. Job 881 sits at the same saved property and was not opened. Two pieces: the **data** (an office fix — `owner-decisions-pending.md`), and the **cause** — find what writes the literal word `Null` for a missing ZIP (an import or an address formatter joining a null), count the jobs carrying it (`job_address ILIKE '% Null'`), and fix the writer. Not investigated: the session had no database read (the dev-mcp key was revoked, the Supabase connector unauthorized; still so on the 2026-09-21 sweep). Known already: v2.2609 traced the token to old-import `jobs_ledger.job_address` values and strips it at display in `displayAddress.ts` (`stripTrailingZip`), leaving the stored values alone; the run's `{{property}}` fill (`lienDeskRun.ts`) and the form's address line read the raw column, which is why the paper still shows it. The one-time cleanup `UPDATE` is written out in that fragment and was deliberately not run.
- **One word for the kind** — the lien screens say *Commercial*, Edit Job and the customer's property sheet say *Non-residential*; `propertyKindWords` / `PROPERTY_KIND_OPTIONS` in `propertyKind.ts` keep each screen's word behind a `voice`. Owner call (`owner-decisions-pending.md`); if it is *Commercial* everywhere, the change is the `sheet` strings there plus the two pills in `CustomerPropertyRecordPanel.tsx`.
- **Not built, by decision (recorded so nobody re-derives it):** no *set all N* on the kind callout (different properties; a wrong kind silently moves a deadline); no kind guessed from the appraisal roll except, later, as a suggestion; no editing inside the notice preview (the letter is edited once in Step 3, per-notice wording on the Lien desk).

## Decisions taken as proposed (2026-09-15; the owner can flip any)

- **Unbilled jobs** claim the unpaid contract balance, said out loud on the row with *Bill the finished work first ›*.
- **Closed windows** are named in the notice as information, in red on the row.
- **The cover letter's offer** to be paid directly stays. **Attorney:** the § 53.081 paragraph prints as written until replaced (`owner-decisions-pending.md`).
- **Who may press it:** Approve all is master / dev; the office prepares Steps 1–3 and sends to the leader (one card) or on his word.

## How to verify

Dev login → Jobs → Pipeline → GC filter → ⋯ → Put <GC> on notice: Step 1 lists every job of that GC with unpaid work (billed and Working), the owner column reads the property record, and saving a pasted CAD page turns the row green and moves the footer count; Step 2 shows months with a closed window in red and an unbilled job's contract balance; Approve all as a master creates N approved desk items with the reason in `fields`, flips the GC's rule and terms, opens the Legal desk account, and the run lists N notices × 2 envelopes. Prod-safe until *Record the run*; use a TEST GC with TEST jobs for the live pass.
