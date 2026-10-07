---
name: "Pipeline → Collections: a look at the section (2026-10-06)"
number: 93
group: ready
status: found 2026-10-06 by the docs catch-up pass — read against main's code and looked at live on the dev account (seven jobs on the desk that day); nothing built
summary: >
  The Collections section does what the guides say — a flag on a billed job, the typed confirm, the note
  under the money, the self-clearing flag, ⚖ Legal and Lien desk on the header. Three things do not match
  their own words: a pill written for Collections shells that has never rendered, a phone card that says
  "billed" for a resend, and a Billed count that reads one number on the phone strip and another on the
  desktop header. The docs side (the term, the three columns, the archived migrations) landed with this card.
next: >
  A: one prop and a smoke. B and C: a read first, then the owner's word on the wording. D is a question.
size: XS (A) · S (B, C) · a question (D)
blocker: None for A. B, C and D want the owner's call on the words once the reads are in.
mockup: not required — A changes no screen a Billed row does not already show; B, C and D are words and a count
---

# Pipeline → Collections: a look at the section

The look read `JobsStagesTab.tsx` §4's Collections site, the row renderers, `set_job_collections_flag`,
the three guides that mention the section and the Dashboard's AR split, then opened the Pipeline on the
dev account on a computer and on a phone. What matches its words is not listed. What does not:

## A. The Collections-shell pill has never rendered — XS, ready

Punch list B6 / J4-10 (v2.2913) wrote a pill for a Collections job with no bill line: *In Collections
N days · no bill line*, the flag day in its title, and the *They said…* door beside it, so the shell ages
from the flag day instead of wearing "can't age". The ageing half shipped (`stageRowBilledAgeReference`
returns the flag day). The pill half did not: the renderer that draws it (`billedBillLineRenderer`,
`JobsStagesTab.tsx` ~1094–1162) is wired at one site — the Billed section's `billedBillLine=` — and a
Collections shell never sits in Billed. The Collections site (`~3864–3871`) passes no `billedBillLine`,
and neither does the follow-up deck. v2.2913's fragment says the chip "reads" on the row; it never has.

Seen live: the two shells on the desk that day (the first row and the last) show nothing where a Billed
shell shows its amber pill; their only age is the dates block's *Lien by* / *Lien gone* line.

**Fix:** pass `billedBillLine={billedBillLineRenderer}` at the Collections site (and in
`stagesSectionActionProps.collections` if the deck should match), then a smoke on
`JobsStagesTab.render.test.tsx` that mounts a Collections shell and finds *In Collections … · no bill line*.
The renderer already branches on `collectionsRef?.source === 'collections'`, so nothing else moves. The
map's §4 Collections row records the gap.

## B. The phone card says "billed 5 weeks ago" for a bill billed 144 days ago — S, a read first

On the phone board a Collections card's second line reads `billed <distance>`; the words come from
`deriveStagesBillingActivityDetail(job)` (`stagesJobReferenceDates.ts`, "the best detail from the
candidates" — the job's latest billing event). The desktop row's dates block reads the bill's own
reference date (`billedReferenceYmd(row)`, `billedDatesLedger.ts`). On a job whose Stripe bill was
resent (one check came back, the bill went out again), the two disagree: the desktop says *Billed
May 15 · 144d ago*, the phone *billed 5 weeks ago* (the resend). The other six cards agreed with their rows.

**Read first:** confirm the candidate that wins on that job is the resend (or the returned check), then
decide the word — *resent 5 weeks ago* keeps the phone honest; reading `billedReferenceYmd` makes it
match the desktop. The owner picks; either is one line in `phoneNextInput`'s `billDisplay`.

## C. Billed reads 64 on the phone strip and 71 on the desktop header — S, a read first

Same account, same minute: the phone strip's *Billed 64* (the cached header stats, `cacheHeaderStats`,
the bill-truth kernel's `billed.count`) and the desktop's *Billed Awaiting Payment 71* (the live rows,
`billedActiveRows.length`, once the scope is merged — 71 rows, every one a bill row). `stagesLiveHeaderStats`
says the two kernels are equal on the same rows (its test pins it), so the gap is in what each counts or
reads: bills vs. rows per job, or the lean fetch vs. the merged scope. Collections read 7 on both.

**Read first:** on the same job set, print `computeStagesHeaderStats(...).billed.count` and
`liveBilledStats(...).billed.count` side by side and name the unit each counts; then make the strip and
the header say the same thing, or say what each is (*64 jobs* / *71 bills*).

## D. The phone board ignores `?stagesSection=collections` — a question

`/jobs?tab=stages&stagesSection=collections` opens the Collections section on a computer. On a phone the
board landed on its last stage (Ready to Bill that day) and Collections had to be chosen on the strip.
Whether the deep link should drive `phoneActiveStage` is the owner's call; the Dashboard's *In
collections* tile is the door most likely to be tapped on a phone.

## What the docs side did (this card's PR)

- `GLOSSARY.md` gained a *Collections (Jobs → Pipeline)* entry — the term had no home.
- `PROJECT_DOCUMENTATION.md`'s `jobs_ledger` column list carries `collections_at/by/note`.
- `BILLING_FLOWS.md` says the three Collections migrations live in `supabase/archive/migrations-pre-baseline/`.
- `JOBS_STAGES_TAB_ARCHITECTURE.md` §4's Collections row records A.

## How to verify

Dev login, Jobs → Pipeline, open Collections. For A: a Collections job with no bill line (Mark Paid but no
View Bill on its row) should show the amber pill once the prop is passed. For B and C: the phone preset at
375 px, the strip's Billed chip against the desktop header, and a card whose bill was resent.
