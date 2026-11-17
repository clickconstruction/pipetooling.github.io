---
name: "Stickers: record that a sticker's strips came out of the printer"
number: 373
group: ready
status: asked 2026-11-16 · designed the same evening, nothing built · the owner put it here for a later session
summary: >
  The app reserves a run of stickers at the press, before any strip leaves the printer, and keeps no record
  that one did. `sticker_runs.printed_at` is the moment the run was made, so every screen reads *Printed
  Nov 16 by Dana* whether or not anything printed. This card adds one column on a sticker, the time its
  strips last went out, written when the P-touch finishes them. A job's reserved line can then say *None
  printed yet* or *18 not printed yet*, and a press can print only the ones that never came out.
next: Build PR 1 (the column, alone), push it, then PR 2 (the screens). The two calls below have a recommended answer each and need no wait.
size: M as a train of two (S · M)
blocker: None. PR 2 must not merge before PR 1's migration is pushed.
mockup: not required — it adds one sentence and one press to lines the screens already draw, and the card writes both out
opinion: build — a run that never printed looks the same as one that did, and the owner met that on his first run
ver: v2.7523 · 7553
---

# Stickers: record that a sticker's strips came out of the printer (#373)

Beside **Stickers before boxes** (#329, `to-dos/stickers-before-boxes/README.md`), which built the runs, and
the twin of the printed mark on a box's label (`job_containers.label_printed_at`, v2.7518).

## The ask

The owner opened Print future stickers on 2026-11-16 and read a card that said *58 stickers reserved and not on
a box yet … Printed Nov 16 by …*. He could not tell whether they had printed, and nothing printed them. The
press that prints them shipped as v2.7523 and the copies control as v2.7553. The piece left over was written
in `docs/recent-features/v2.7523.md`: *recording that a run's strips went out*. His words on it the same
night, first *add Recording that a run's strips came out. It needs a new column*, then, a few minutes in,
*add it to a punchlist card, I don't want to do it right now*.

## What is there today

- A run is made by `mint_sticker_run` at the press. Its trigger makes one `box_stickers` row a sticker. Then
  the window prints. A printer that fails, a stop, a closed window or a cancelled print dialog all leave rows
  with no strip.
- `sticker_runs.printed_at` is `NOT NULL DEFAULT now()`: when the run was made. `reservedByWords`
  (`stickerPlace.ts`) and `stickerRunByLine` (`stickerRun.ts`) print it as *Printed Nov 16 by Dana*.
- Over USB the window knows exactly what went: `link.print` counts strips, and `stickersPrintedWhole(done,
  copies)` turns that into whole stickers (`PrintStickersModal.tsx`, `printDirect`). It throws the number away
  after saying *2 of 30 stickers printed*.
- Through the browser's print window the app cannot know. `afterprint` fires on Print and on Cancel alike.
- No client writes `box_stickers`. It has a SELECT policy and no other. A sticker changes only through a
  `box_sticker_events` row, whose trigger moves it (`20261113020000_box_stickers.sql`).

## The design

### The column (PR 1)

One nullable column, `box_stickers.printed_at timestamptz`, no default. NULL means the app has not seen this
sticker's strips go out. A time means it has: the moment the last copy of its strip left the P-touch, or the
print window closed on it. Additive, a catalog change alone, no row rewritten, no `CREATE TABLE`, so no fence
calls.

How it is written, the way `sticker_runs.job_id` already is:

- `REVOKE UPDATE ON public.box_stickers FROM anon, authenticated`, then `GRANT UPDATE (printed_at) … TO
  authenticated`. A client can then change this one column and no other. Read the table's grants first; the
  events trigger is `SECURITY DEFINER` and is not touched by the revoke.
- A policy `box_stickers_update` with the SELECT policy's own predicate in `USING` and `WITH CHECK`: a
  sticker on a box follows its box's job, a reserved one its run's job, both through `on_site_can_touch_job`.
- A small trigger, `BEFORE UPDATE OF printed_at`: a time that is not null is replaced by `now()`, so a client
  cannot write a day of its own. NULL is let through, for the take-back below.
- The read-only blocks, the twin fence and the archived seal already stand on `box_stickers`, so a training
  account leaves no mark. The screen must take that refusal quietly.

Looked at and not picked: a new `printed` kind of `box_sticker_events`. It would keep who printed and every
reprint, at the cost of rewriting the judge and apply triggers and 58 rows a print. A security-definer
function is out too: `on_site_can_touch_job` is `SECURITY INVOKER` on purpose and would judge the owner of
the function, not the caller.

### Stickers made before the column

They read NULL whether or not they printed, and nothing can tell the two apart. Do as the label mark's client
does, the one that follows v2.7518 (its `LABEL_MARK_SINCE`): count a NULL as *not printed yet* only for a sticker made since the
mark began, and say nothing about the older ones until they print. The 58 of 2026-11-16 are such stickers.

### The screens (PR 2)

- **Read it.** Add `printed_at` to the two reads of a job's stickers: `fetchStickerRuns`
  (`stickerRunsIo.ts`) and `fetchStickerRunsOfJobs` (`reserveStickersIo.ts`), and to `StickerRowOfRun`.
- **Write it.** A kernel beside `reservedPrint.ts` and one write in `stickerRunsIo.ts`. Over USB, after
  every print, a stop and a failure included: mark the first `stickersPrintedWhole(done, copies)` stickers of
  what was printing. A mark that fails says its reason in a quiet line and does not hide *58 stickers
  printed*. Hand the page a tick (`onPrinted`) so the job's line and the Runs fold read again.
- **Say it.** On the reserved line of the *Which job?* card, the job's line over its boxes and the window's
  ask: *None printed yet.*, *40 printed, 18 not printed yet.* or *All printed.* after the count. Where the
  mark applies, the run's by-line reads *Reserved Nov 17 by Dana*, since that is what the day is. The Runs
  fold's row says the same counts.
- **Print only what never came out.** When a run's reserved stickers are part printed, a second press before
  the first: *Print the 18 not printed yet, G133 to G150* (`countedLabel`), beside *Print the 58 reserved
  stickers, G93 to G150*. This is what *Print the rest* means once the window has been closed.
- **Help guide** `see-what-is-on-every-job-site-and-what-walked-away.md`, the architecture doc's office
  paragraph, `docs/migrations/<stamp>_sticker_printed.md`.

## Two calls, each with a recommended answer

1. **The browser's print window.** The app cannot see whether it printed. *Recommended:* mark the stickers
   when the window closes, say *58 stickers are now marked as printed.* and offer **They did not print**,
   which takes the mark off. The Print labels client that follows v2.7518 does the same for a box. The other way is to mark nothing there.
2. **The old 58.** *Recommended:* say nothing about them, as above. They get their mark the next time they
   print over USB. The other way is a press that says a run already printed, which is one more thing to
   press wrong.

## The plan

1. **PR 1, the database (S).** `supabase/migrations/<stamp>_sticker_printed.sql`, opening on `SET
   lock_timeout = '3s';`, numbered from `origin/main`'s newest file and registered with `npm run claim --
   --migration`. Its `docs/migrations/` page. Push with `bash scripts/db-push.sh` from a checkout at main,
   which also regenerates the types and the dev seat's catalog for their own small PR.
2. **PR 2, the screens (M).** Everything under *The screens*. **It must not merge before the push**: it names
   the column in the read of every sticker, and PostgREST refuses a select that names a column it does not
   have. No sticker would list until the push.

## How to verify

- The migration: as a signed-in office account, an update of `printed_at` on a reserved sticker of a ZZ Test
  job lands with the server's time; an update of `container_id` or `lost_at` is refused; a training account
  changes nothing.
- The screens: render smokes with a mocked P-touch, as `PrintStickersModal.usb.render.test.tsx` has them. A
  run of 30 stopped after 2 marks 2, and the line then reads *2 printed, 28 not printed yet*.
- Live: a run of 3 on a ZZ Test job, stopped after 1 with **Stop printing**. Close the window. The job's line
  must offer *Print the 2 not printed yet*. No real job's run is minted to test.

## Where it stands

Nothing is built. The session that wrote this read the tables, the policies and the label mark's client on
2026-11-16 and wrote no code for it.
