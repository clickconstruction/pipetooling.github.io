---
name: "Plan sets by part: an updated set mid-project, and our own as-builts kept with the build"
number: 239
group: ready
status: building 2026-11-01 · PR 1 the tables merged as v2.6297 (#6743), migration 20261101210000 pushed · PR 2 the Plans section in the job window's Documents tab merged as v2.6298 (#6744) · PR 3 the Development page's Plans look by part merged as v2.6302 (#6749) · the papers ground v2.6312 (#6760) and doors v2.6313 (#6762) merged, migration 20261102010000 pushed · PR 4 the bid's priced-on and the hand-off v2.6342 (#6789) and PR 6 the row and History v2.6344 (#6790) merged, both migrations pushed · PR 5 Drive and photos merged as v2.6345 (#6793) and `plan-set-files` deployed; its live check on a ZZ Test job passed on 2026-11-03 (an as-built's photos land in its own folder under Plans, a later photo takes the next name, a set with no link gets its folder) · the live walk of the papers doors passed on 2026-11-02 · the walk of v2.6356 on 2026-11-03 found two phone faults on the Plans look, fixed as v2.6435 (#6915) and v2.6442 · the last code item, the as-built author's row-level move, closed 2026-11-06 as v2.6583 (#7131; migration 20261106180000, the SQL bed plan_sets_author) merged and pushed 2026-11-06, check:migration-drift read 1130 of 1130 applied, types #7136; the walk on a ZZ Test job's Plans section passed at 1280 and 375 and its rows were deleted · the bed found the crew's read gate closed on a development's job, card (#272), opened as v2.6604 (migration 20261106234500; the card's second claim, that every helper read no part, did not hold, and the card retired) · the walk of v2.6604 found the crew's own job window had no Plans section, card (#276), mounted as v2.6609 and retired
summary: >
  The owner, 2026-11-01, after a read-only assessment of a development's Plans look: on a project they
  often get an updated set of plans halfway through, or the crew makes its own as-builts and wants them
  saved with the build. Today a bid carries set rows but a job holds one link, nothing carries a set from
  a bid to the job it becomes, the Development page's Plans look counts a job's empty Plans folder as a
  set, two sets were current at once for two buildings of one site, and ten jobs read "on an older set"
  with no door to move them. Four options were drawn; the owner picked D: a set belongs to a PART of a
  site (the Lodge, the Bunker, the whole site), each part has one set it builds from, a job names its
  part and follows it, a bid pins what it was priced on, and an as-built is ours, on the job, marking up
  the set it built from. A job outside any development owns its own part, so it gets the same thing.
next: The real site's papers are kept through Keep a paper, once the owner says which part a few of them go on. A mail's file following its paper is still to be seen live: no ZZ Test mail with a file is tagged to a ZZ Test job, and a session cannot open a Workspace mailbox to send one, so a person sends the test mail or the first real paper proves it.
size: S (PR 1 the tables) + M (PR 2 the job section) + M (PR 3 the site look) + S (PR 4 the bid) + M (PR 5 Drive and photos) + S (PR 6 the row and History)
blocker: None in the code. The real site's papers wait on one call of the owner's, about which part a few of them go on; the mail-file check waits on a ZZ Test mail with a file, which only a person with a mailbox can send.
ver: v2.6297 · 6298 · 6302 · 6312 · 6313 · 6317 · 6342 · 6344 · 6345 · 6351 · 6355 · 6356 · 6435 · 6442 · 6583
opinion: build the train as ordered; the one judgement call left to the owner is PR 3's "join an existing part" when a lone job is put into a development
---

# Plan sets by part (#239)

Mock-up: [`mockup.html`](./mockup.html) — the Plans look as it reads today, options A, B and C, the critique, option D on a development and on a standalone job. Made-up data (Quail Ridge, Ridgeway Builders, Harlow Ranch).

## The ask

The owner, 2026-11-01, after a read-only assessment of a development's Plans look:

> on a project they often get an updated set halfway through, or make their own as-builts and want to save them with the build. Does the infrastructure do a good job of offering this today?

Then, on the mock-ups: *I like D.* *For jobs that are not a part of developments and are standalone jobs, how can we offer this as well when we get multiple sets of plans?* *I love the idea of being able to see plans in the documents tab of jobs.* And: *When that job is a part of a development and there are other plans in that development, I would like to see a notice that says there are other plans in the development, so a user knows that there might be other plans that could affect this.*

## What the assessment found

- A bid carries set rows (`bid_plan_sets`, v2.6168: name, memo, date, link, the probe) and one link the robot reads (`bids.plans_link`). No kind, source, revision, replaces or current flag; "robot reads" is derived by link equality.
- A job holds one text column, `jobs_ledger.job_plans_link`. The job window shows *Job Plans · Open plans*; the only edit is the Job form. Nothing carries a won bid's set onto the job: the folder maker reuses the bid's Drive folder as the job folder and makes an empty `Plans` subfolder inside it, then stamps that on the job.
- The Development page's Plans look (`src/lib/developments/plans.ts`) groups by the bare links and reads `bid_plan_sets` for memos only. On the real site it read *11 sets*: one real set and ten jobs' empty Plans subfolders. The two source sets with a name and a date were not in the table. "Newest" is the day a link was pasted, since no bid carried a design drawing plan date.
- GC mode (dev-only, `gc_plan_sets` on `projects`) has the richer model: rev, kind, issued_on, per-sheet changes, sends. It knows nothing of bids, jobs or developments.
- No as-built notion anywhere but the portal's closeout-binder placeholder words.

## The decision

Option D. Why not the others: A (fields on the existing rows) fixes the words and not the problem, since a job still points at a set and ten jobs are still ten edits; B (one register on the development with one current set) is D without parts, and the real site breaks it, since two buildings had two current sets on the same day; C (lift GC mode's window) brings the sheet index and the send list nobody on a plumbing bid will type.

Rules D holds:

- **Sets belong to a part, not the site.** A part is a building or area of a development, or the whole site, or the one part a standalone job owns.
- **A bid pins; a job follows.** A bid keeps its rows and says what it was priced on. A job names its part and builds from whatever that part builds from today. It can never be "on an older set".
- **An as-built marks up a set.** It is ours, on the job that made it, and says which set it marks up.
- **The date on the sheets is the date.** The day it came is a second fact.
- **The job's old plans link stays** and mirrors the current set's link, so every old reader (the trade portal, the dashboards, *Open plans*) keeps working.
- **A job in a development says when the site has other plans**, so a reader knows another part's set might touch this job.

The one call the owner still makes, in PR 3: when a lone job is put into a development, its part comes along under the job's name, and the office may fold it into an existing part instead. Folding is the judgement call.

## Where it plugs in

- Tables: `plan_parts`, `plan_sets`, `jobs_ledger.plan_part_id` and the mirror triggers (migration `20261101210000`, PR 1). `bid_plan_sets` and `bids.plans_link` stay as they are.
- Job window: `src/components/jobs/JobWindowDocumentsTab.tsx` gains a Plans section (PR 2, `JobPlansSection.tsx` over the kernel `src/lib/plans/planSets.ts`).
- Development page: `src/lib/developments/plans.ts` and `DevelopmentSideCards.tsx`'s Plans card read the parts (PR 3).
- Bid: `BidPlanSetsField.tsx` gains *priced on*; the New job from bid path seeds the job's part (PR 4).
- Drive: the edge function `plan-set-files` (its rules in `_shared/planSetFilesRun.ts`) makes one subfolder per set inside the job's Plans folder and files the crew's photos or PDF, and a mail's files, into it (PR 5).
- Pipeline row: the plans icon reads the part (PR 6).

## The plan

1. **PR 1 — the tables** (v2.6297): `plan_parts`, `plan_sets`, the job column, the mirror, RLS. No screen.
2. **PR 2 — the job's Plans section** (v2.6298): in the Documents tab, *Building from* with the set's kind, source, date and link; *Older sets*; *Our as-builts*; **+ New set** (kind, from, dated, memo, link; make it what the job builds from, or keep the old one current); **Add our as-built** (a link for now, photos in PR 5); the notice when the job's development has other plans, with a door to the site's Plans look. A standalone job's part is made on the first set. Guide *keep the plans on a job*.
3. **PR 3 — the site by part**: the Development page's Plans look lists parts with what each builds from, older sets folded, our as-builts under it, **+ New set** and **+ Part**; the chips become *a part with no set* and *a job with no part*; a job's empty Plans folder is no longer a set. Put a job in: its part comes along, or joins one.
4. **PR 4 — the bid**: *priced on* a set; the amber note when the part moved on; New job from bid seeds the job's part with the bid's pinned set.
5. **PR 5 — Drive and photos**: one subfolder per set under the job's Plans folder, the register mirrored; the crew's *Add our as-built* takes photos of the marked sheets or a PDF and files them.
6. **PR 6 — the row and History**: the Pipeline row's plans icon opens the current set or the picker; a History line on every job of a part when the part switches.

## The papers train (added 2026-11-01)

The owner, sorting the documents that came with a real site's sets: *I feel like each one needs either an action item or an event description. They all seem important to save to a job.* Mock-up (`papers-on-a-job.html` in the session's notes), critique, spike behind `?papers=1`, then: *I think this is pretty good. Let's build it right here and right now.*

A paper is a document on a part, kept in the same register as the sets (a `plan_sets` row with a paper kind), beside the set it goes with (`marks_up_set_id`), carrying the question it raised (`ask_lane` + `ask_request_id`, the lane's own inbox) and an *owed* state for one that has not come. Keeping one writes the History line by trigger. A paper can never be what a part builds from.

- **PR A — the ground** (v2.6312, migration `20261102010000`): kinds, sources, the three columns, the two triggers, the crew's insert.
- **PR B — the doors** (v2.6313): `src/lib/papers/papers.ts`; *Papers with the plans* under the job's Plans (`JobPapersSection.tsx`); *Keep this mail as a paper on JP…* in My Mail (`MailPaperDoor.tsx`); the Plans look's *Papers* column. Guide *keep the papers with the plans*.
- **Later**: dev-mcp verbs `plan_paper → apply_paper` and `plan_plan_set → apply_plan_set`, and `file_plans` onto parts (#6843). The mail door files the attachment into Drive with PR 5 (#6793).

## How to verify

PR 2: as the dev on a ZZ Test job with no development, Documents → Plans: add an issued set, then an addendum that replaces it and becomes current; *Open plans* on the Job tab now opens the addendum's link (the mirror); add an as-built; remove it. Then on a ZZ Test job inside a ZZ Test development with a second part carrying a set: the notice reads and its door opens the site's Plans look. Delete every ZZ Test row after.

PR 5, once `plan-set-files` is deployed: as the dev on a ZZ Test job with a Drive folder, Add our as-built with two photos from this computer; they land in Plans › <the as-built's name> and the as-built's Open ↗ opens that folder. Make its folder on a set with no link gives it its folder. A ZZ Test mail kept as a paper in My Mail brings its file into the paper's folder. Delete every ZZ Test row and folder after.
