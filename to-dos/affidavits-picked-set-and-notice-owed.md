---
name: "Affidavits: print a picked set, and say why a job with a recorded notice still owes one"
number: 353
group: close
status: written 2026-11-14 from a Lien desk session · the owner picked all three doors for part 2 the same day · part 1 built 2026-11-14 as v2.7268 (#8122) and part 2 as v2.7269 (#8124), both on main
summary: >
  Two gaps the office hit on one property's jobs on 2026-11-14. First, the Affidavits list's two
  batch presses take every paper in their pile. Print N for notarization prints every approved
  affidavit, and Send N for approval sends every draft. The find box narrows the list on screen
  but not what either press takes, so the office cannot print just the three papers for one
  property. Second, a § 53.056 notice was recorded by hand on those jobs with its mail receipt,
  yet each job still shows Notice to draft on To do. The desk is right by its own rule: the
  recorded paper names four earlier months, and each job's last work month is a later one with
  no notice. But the row does not say so, and the affidavit pane let a draft through without
  naming the month still owed. The workflow from recording a mailing to drafting the affidavit
  needs a cleanup so the office sees what is owed and why.
next: Retire the card once the office has worked a row with the doors.
size: M as two PRs (S · M)
blocker: none
ver: v2.6918 · v2.7209 · v2.7247 · v2.7268 · v2.7269
---

# Affidavits: print a picked set, and say why a job with a recorded notice still owes one (#353)

## Where this comes from

On 2026-11-14 the dev seat saved affidavit drafts on three jobs at one property, all under one
GC. Each draft was saved through `apply_affidavit_draft` (v2.7247), on the owner's word. The
owner then asked two things. How does the office print just those three? And why do the same
three jobs still show **Notice to draft** on the desk's To do, when the notice's mail receipt was
recorded? He also asked to clean up the workflow for jobs like these.

Which jobs these are is in the session notes, not here, because the repo is public. Find them
again with `read_rows` on `job_lien_desk_items`: `kind eq affidavit`, `status eq drafted`,
drafted on 2026-11-14 by the dev seat.

## Part 1 · The batch presses take what the list shows (S)

**Today.** `LienDesk.tsx` builds both batch presses from every entry on the desk:

- `affPrintPapers` and `affPrintPlan` read `data.affidavits.entries` through
  `lienAffidavitPrintPlan` (`src/lib/jobs/lienAffidavitBatch.ts`).
- `affSendPlan` reads the same entries through `lienAffidavitSendPlan`.
- The list itself draws `affVisible`, which the pile chips, the amber held-only press and the
  find box narrow.

So a find that leaves three rows on screen still prints every ready paper. The one-job path is
each job's Lien window, on the **Lien affidavit** tab, **Print for notarization**: three print runs,
each with its own help sheet and notice record.

**The change.** While the find box narrows the list, both presses take only the rows it shows.
The words say so, through `batchWords` / `countedLabel`. For example *Print 3 shown for
notarization*, with a line under the bar such as *9 more ready papers are not shown. Clear the
find to print them too.* With no find typed, nothing changes. The help sheet's left-out rows
still name each held or gated paper with its reason. A paper the find hides is not listed as
held, since nobody held it.

**Rejected for now.** Tick boxes on each row. They would work, but the find box already picks a
property, a GC or an owner, and a tick box is a second way to say the same thing.

**Tests.** The kernels stay pure and take the narrowed entries. Kernel tests for the words with
and without a find. A render smoke that types a find and reads the press.

## Part 2 · A job with a recorded notice that still owes one (M)

**What the desk did.** The recorded notice is one paper for the three jobs, mailed by certified
mail to the owner on 2026-09-22. Its months covered are April, June, July and August 2026. Each
job's last work month is September 2026, from a last day of work set by hand. No notice names
September. September's § 53.056 notice closes on the 15th of the third month. That is Sunday,
Nov 15, so the desk rolls it to Monday, Nov 16. So each job sits in the notices' To draft pile
(`lienDesk.ts`, `dueMonths`: a month not noticed with days left), and To do draws
**Notice · Notice to draft · Nov 16 · Draft notice** (`lienNextUp.ts`).

**Why it reads wrong.** The row gives no reason. The office recorded the mailing and its receipt
and expects the row to clear. Nothing on the row says the recorded paper names other months, or
which month is still owed. The affidavit pane has the same gap. Its gate asks for *a* notice on
record, and one is, so the affidavit drafts for September's last work month while September's
own notice is still due in two days. On two of the three jobs no recorded month falls inside the
job's work span. Their affidavits print a blank where the months go.

**The change, to mock up.**

1. **The To do row names the month.** On a job with a notice on record, *Notice to draft* becomes
   something like *September has no notice. The one on record names April to August.*
2. **The row offers the doors that fit.** The owner picks which ones:
   - **Draft September's notice**: the press that is there today.
   - **The paper named September too**: corrects the recorded months, through the Lien window's
     record of the send. Only when that is true of the paper as mailed.
   - **The last day of work is wrong**: opens **Last work › change**, as the Lien window does.
3. **The affidavit pane warns before a draft.** While the last work month's notice is still due
   and not recorded, the pane says so above **Send for approval ▸**, with the day it is due. It
   is a line, not a gate. The owner and the attorney decide the paper.

**Where it plugs in.** `src/lib/jobs/lienDesk.ts` (the months and the piles),
`src/lib/jobs/lienNextUp.ts` (To do's rows and words), `src/components/jobs/LienDeskAffidavitPane.tsx`
and `src/lib/jobs/lienAffidavitNoticeCheck.ts` (the pane's notice lines), and the dev seat's
`plan_affidavit_draft`, which should carry the same line. The help guides are
`file-a-lien-and-never-miss-its-deadlines` and `send-lien-notices-from-the-lien-desk`.

## How to verify

- On the live desk, find the three jobs (see *Where this comes from*). Before part 2, each shows
  *Notice to draft* with no reason. After it, each names September and the recorded months.
- For part 1, type the property's street in the find box on the Affidavits list. The print press
  counts only the rows shown.
- Walk with a ZZ test job before a live one: record a notice by hand for two earlier months, set
  the last day of work a month later, and read the row. The memory note on walking ZZ jobs in
  pickers has the switch.

## Where it stands

Both parts are built and on main: part 1 as v2.7268 (#8122) and part 2 as v2.7269 (#8124), on
2026-11-14. Since v2.7302 the pane's line says the paper names the month from the last day on site,
and since v2.7327 the pile reads To send (To send for Master approval since v2.7434). The owner
picked all three of part 2's doors on 2026-11-14: draft the month's notice, the paper named that
month too, and the last day of work is wrong.
