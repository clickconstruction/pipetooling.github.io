---
name: "Legal desk: catch a sub job set up as if we worked for the owner"
number: 166
mockup: not required — shipped (v2.5840); the live desk is the picture, the row closes after the live pass
group: gated
status: proposed 2026-10-24 · rank 1 of 10 from the review of the Burd matter (job 891) · steps 1, 2 and 4 built as v2.5840 (the kernel, the desk's note with Set the GC in one press and Ours with the owner, migration 20261025130000) · step 3 not built: the Jobs page fix-up chip needs a database-side list like Owner of record to confirm, and the Lien desk never lists a job with no GC
summary: >
  The lien clock treats a job as a subcontract only when the job has a GC/Builder. A job set up
  with the GC as its customer reads as if we contracted with the owner: no § 53.056 notice is
  due, the job form hides the retainage box, and the Legal desk says nothing. Flag it where the
  desk lists what to know before release: when the owner of record is a different company than
  the customer and the job has no GC, we are probably the GC's subcontractor. One door opens the
  job form on its GC/Builder row.
next: Push the migration once v2.5840 merges; a live pass on a ZZ TEST job; then decide whether the Jobs page chip (step 3) is worth an RPC, or delete this to-do.
size: S left (the Jobs page chip, an RPC and a list)
blocker: None for what shipped. Step 3 waits on a word about whether the chip is wanted.
opinion: built on the desk — the owner's calls of 2026-10-25: yes to the second signal, yes to Set the GC moving the customer in one press
---

# Legal desk: catch a sub job set up as if we worked for the owner

## The ask

The owner, 2026-10-24, after filing Click v Burd & Assoc. (job 891) on the Legal desk: *"Are
there features that if we had added to the legal desk would have made this recording of the burd
situation better?"* The review found ten, ranked by what each would have saved on job 891, and the
owner asked for each as a to-do with the Burd case as its example. This is rank 1.

## What happened on job 891

Job 891 was set up with Burd & Assoc. as its customer and no GC/Builder. Click was Burd's plumbing
subcontractor, and the property's owner of record is a different company. With no GC on the job,
the payer kernel read it as ours with the owner (`viaGc` false), so:

- the Legal desk's Paper tab called Click the *original contractor* and marked the § 53.056 notice
  *not required · contracted with the owner*;
- the Lien desk tracked no monthly notice for the job;
- the job form hid *Our contract on this job*, so the retainage held could not be entered.

It was caught on 2026-10-24 while filing the case. Setting Burd as GC/Builder (the app then moves
Burd out of the customer slot, v2.3403) turned the Paper tab to *subcontractor under Burd &
Assoc.*, opened the August notice, and showed the retainage box. Nothing on the desk had pointed
at it before then.

## What exists today

- `payerForJob` in `src/lib/legal/legalPacket.ts`: `viaGc` is true only when `gc_customer_id` is
  set, and the lien clock takes `isSub: account.viaGc` (`computeJobLienClock` in
  `src/lib/jobs/lienDeadlines.ts`).
- The owner of record per job: `src/lib/legal/legalProperty.ts` over `resolveLienProperty` in
  `src/lib/jobs/lienProperty.ts`.
- The desk's *Before this goes to an attorney* notes: the gaps list in
  `src/lib/legal/legalPacket.ts`.
- The GC/Builder row and its picker: `src/components/jobs/JobFormEditFactRows.tsx` (row anchor
  `gc`) and `JobFormGcPicker` in `src/components/jobs/JobFormCustomerSection.tsx`; the move rule
  in `src/lib/jobs/jobPartyExclusive.ts`.
- On the customer: `customer_type` (`residential` or `commercial`) and `gc_pays_by_default`.

## The proposal

A pure kernel, `suspectedSubJob`, answers *probably a subcontract* when the job has no GC/Builder,
the property record names an owner of record, that owner is not the customer (a loose name match),
and at least one more signal holds: the customer is `commercial`, has `gc_pays_by_default`, or is
the GC on another job. Where it shows:

1. **The Legal desk**: a note under *Before this goes to an attorney*, *Probably a subcontract on
   891: the owner of record is not Burd & Assoc. Set the GC so the monthly notices are tracked*,
   with a **Set the GC…** door to the job form's GC/Builder row.
2. **The Jobs page fix-ups**: a *Maybe a sub job* chip beside *Owner of record to confirm*.
3. **The Lien desk**: the same line on the job's pane, where the notices are worked.

A job the office confirms is ours with the owner stores that answer, so the note does not come back.

## Open decisions

- Which signals count. The name match alone would also catch a homeowner whose house is held by a
  trust or an LLC; the second signal keeps those out.
- Whether *Set the GC…* moves the customer into the GC slot in one press or always opens the job
  form.

## Where it plugs in

Existing: the payer kernel, the property resolver, the gaps list, the job form's row anchor, the
fix-up chips. New: the kernel and its tests, one gap kind, one chip, and one flag on `jobs_ledger`
for the office's answer (a small migration).

## Plan

1. The kernel, tested on job 891's shape and on a trust- or LLC-held house. XS.
2. The desk's note and door. S.
3. The fix-up chip and the Lien desk line. S.
4. The *ours with the owner* answer (migration). XS.

## How to verify

On a ZZ TEST job, set a commercial customer, no GC, and a property whose owner of record is
another company. The desk shows the note, and *Set the GC…* opens the GC/Builder row. Once the GC
is set, the note goes and the Paper tab reads *subcontractor under …* with the § 53.056 months
open.
