---
name: "ZZ test jobs off the Pipeline for everyone but a dev"
number: 61
group: waiting
status: parked 2026-09-29 — the owner took the three calls (the ZZ prefix is the rule, any switch is dev only, the sweep first) and the sweep shipped the same day (v2.4157, Settings → Data & recovery → ZZ test jobs); the hide waits to see whether a swept board still needs it
summary: >
  Jobs → Pipeline shows every ZZ test job the live passes and robot runs leave behind — rows the
  office scrolls past, and $2,200 test bids inside "Ready to ask for", the stage counts and the
  section totals (Ready to Bill read 7 while the Dashboard said 2). The proposal: one kernel
  (`isZzTestJob`, now in `src/lib/jobs/zzTestJobSweep.ts` — job name or customer name starts with
  ZZ) applied where the board loads its jobs and its header money, so for every role but dev the
  rows, counts and dollars are simply absent; a dev keeps one checked-by-default line in the
  ⋯ menu's existing Hide groups… modal, with a quiet chip while hidden and an amber one while
  shown. The mockup beside this card shows the Ready to Bill section before, after for the
  office, and after for a dev.
next: >
  After a week of sweeps (v2.4157), read the Pipeline as an assistant: if ZZ rows still reach the
  board between sweeps, build the hide as the mockup shows — the kernel exists; the work is the
  load-time exclusion in the Pipeline's job fetch and `fetchStagesHeaderStats`, the dev line in
  `JobsStagesHideGroupsModal` / `jobsStagesExcludeFilters.ts`, the chip, and the same rule on the
  other surfaces that read jobs by name (header search, Dashboard cards, Lien desk, AR, Customers).
  If the sweep keeps the board clean, retire this card.
size: M
blocker: None — waiting on a week of use.
opinion: later — the sweep removes the rows at the source; the hide is worth building only if residue still lands between sweeps.
---

# ZZ test jobs off the Pipeline for everyone but a dev

## The ask

The owner, 2026-09-29, after the J1031/J1037 reassigns: *"on jobs, stages, there are a lot of ZZ tests, should we hide 'ZZ TEST' by default from the stages by checkbox that is selected by default for all users? I see them stacking up as we add and play with features — how could we offer this?"* Then: *"the primary goal is to not let other non devs see them on jobs stages in particular."*

## The decision

- **The ZZ prefix is the rule**, not a new column — the glossary's convention already binds twins and live passes to it, and every row on the board fits it.
- **Dev only.** Assistants and the controller never need the rows; for them there is no checkbox — the rows are not loaded.
- **The sweep first** (shipped v2.4157): a dev tool that folds week-old ZZ jobs into the sink (the ZZ job named `ZZ TEST sink`) through the reassign door. The hide is built only if the swept board still shows residue.

## The mock-up

`zz-test-jobs-before-after.html` beside this card: the Ready to Bill section as Taunya sees it today (seven rows, three ZZ, the money strip inflated), the same section after for the office (four rows, honest totals, no control), and after for a dev (the quiet chip and the new line in Hide groups…).

## Where it plugs in

- `src/lib/jobs/zzTestJobSweep.ts` — `isZzTestJob` (exists).
- `src/components/jobs/JobsStagesTab.tsx` — the job load and `fetchStagesHeaderStats` (the exclusion goes here, before anything counts).
- `src/components/jobs/JobsStagesHideGroupsModal.tsx` + `src/lib/jobsStagesExcludeFilters.ts` — the dev line and the chip; the `jobs-stages-*` localStorage switches for the remembered choice.

## How to verify

Read the Pipeline as an assistant (`/dev-login?as=<assistant>`): no ZZ row, and the strip's Ready to Bill count equals the Dashboard's. As the dev: the chip reads *N ZZ test jobs hidden*; unchecking the line brings the rows back with the amber chip.
