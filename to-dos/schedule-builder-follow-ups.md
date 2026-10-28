---
name: "GC mode: the schedule builder's three follow-ups, and the owner's look"
number: 210
group: close
status: saved 2026-10-28 from the close of #204, whose six PRs shipped the same day (v2.5995, v2.6020, v2.6022 to v2.6025) and whose folder retired with its Closed line in to-dos/README.md · nothing built here yet · the owner has not looked at the builder
summary: >
  The schedule builder shipped as planned: a template is phases and rows with no dates, made on
  the Templates page or pasted from a spreadsheet, saved as a new version on each save, put on a
  job's first draft from a start day so every row lands, read By phase on the chart and the list,
  and shown to a trade partner as a strip of phases and dates to meet. Three small pieces were
  left by design and named in the fragments of v2.6024 and v2.6025, and two test rows wait on the
  owner. This card holds them so nothing is lost.
next: the owner opens the Templates page, makes a template for the next quick-lube shell, and says what the editor should do differently. Then the three pieces below as one small PR, or two when the migration is better alone.
size: S (one PR, or two with the migration alone; the owner's look is a conversation)
blocker: Nothing. The owner's look comes first only because it may change the editor's words.
ver: v2.5995 · 6020 · 6022 · 6023 · 6024 · 6025
opinion: build the three pieces after the owner's look, not before; each is an hour, and his look may add a fourth
---

# GC mode: the schedule builder's three follow-ups, and the owner's look (#210)

## Where it comes from

Punch list #204, the schedule builder, shipped as six PRs on 2026-10-28 with all seven owner calls
taken as drawn. The live walk on the dev server (in `docs/recent-features/v2.6025.md`) read as the
mock-up on a ZZ test template and on *GC test project, delete me*. Three pieces were left by
design, each named in a fragment, and two prod rows from the walk wait on the owner.

## The three pieces

1. **The rough while bidding from a template with rows.** `roughPress` in
   `src/lib/gc/schedule/scheduleWindow.ts` copies `template.lines` into `rough.like`, so a template
   made on the Templates page, whose `lines` is empty, draws nothing special on a rough. The rough
   should draw a rows template as the first draft does (`rowsDraft(project, start,
   templateRows(template), days)` in `schedule/builder.ts`) and keep a copy of the rows on the rough
   beside `like` (`RoughSchedule` in `schedule/types.ts`, `roughRowOf` in `schedule/writes.ts`, the
   rough's mapper in `schedule/rows.ts`; `gc_rough_schedules.template_lines` holds the lines copy
   today, so either that column takes the rows too or a migration adds one). `GcRoughSchedule.tsx`'s
   pick says D3's lines for a rows template as `GcTemplatePick` does.
2. **A phase on the job's own work.** On a schedule drawn with phases, Add an activity
   (`GcScheduleCards.tsx`, `ownWorkPress`, `gc_schedule_add_activity` in
   `supabase/migrations/20261008040000_gc_schedule_writes.sql`) lands under *Not in a phase*. The form
   offers a phase pick; the RPC takes a `phase` in `p_bar` (a migration replacing the function, its
   doc, the gc-schedule SQL bed extended); `RpcAddedBar` in `writes.ts` gains `phase`; the opened
   bar's form may move a bar to another phase as a record, since `phase` is a record column the
   plan guard lets through.
3. **The typed RPC call.** `saveTemplateBody` in `src/lib/gc/scheduleTemplatesIo.ts` calls
   `gc_schedule_template_save` through `supabase as unknown as SupabaseClient`, written before the
   generated types carried the function. Once `src/types/database.ts` on main has it, drop the cast
   and call it typed, and `loadSchedule` in `scheduleIo.ts` may name the header's columns again,
   `phases` among them.

## The owner's rows

- The template **ZZ TEST quick-lube shell** (`17d4d74c-f9b6-46f8-b97d-62a81276a4c9`) is set aside
  on prod. Bring it back to play with the editor, or leave it.
- **GC test project, delete me** (`ef8905d1-039a-4cbc-9d69-9468cfea50e0`) keeps the schedule drawn
  from it at version 1. A schedule on a building job is never redrawn or deleted from the app, so
  it stays until the test job itself goes.

## How to verify

1. The rough: on a bidding test job, pick a template made on the Templates page under Start from a
   template on the rough. The pick says D3's lines and the rough's weeks follow the rows.
2. The phase: on *GC test project, delete me*, Add an activity with a phase picked, and the row
   lands under that phase on the list By phase.
3. The call: `npm run typecheck` with no cast in `scheduleTemplatesIo.ts`.
