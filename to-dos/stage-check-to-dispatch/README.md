---
name: "Send a stage check to Dispatch: the crew's reason rides with the job, the stage and the check, and Dispatch opens it with the context and acts on it in place"
number: 245
group: ready
status: asked 2026-11-02 on the sheet's screenshot; thought through and mocked up the same day; PR 1 (the send and the inbox doors) built the same day as v2.6360, PR #6829, merged 2026-11-03 with its migration pushed, walked live the same day; PR 2 built 2026-11-04 as a train of two, v2.6494 (the self-close, PR #7010) and v2.6495 (the window and the loop back, PR #7013), both merged, pushed and deployed, walked live the same day; PR 3 (the marks) next; three calls carry recommendations as defaults
summary: >
  A crew member on a stage checklist hits a check they cannot answer: the part is missing, the
  check is wrong for this job, the office has to decide. Today the phone has no door from the row,
  only a free-text note to Dispatch that loses the job, the stage and the check. The owner wants a
  press on the row that opens a sheet on top with the check's context and a reason, sends it to
  Dispatch, and lets Dispatch open it from the inbox with everything they need and jump into the job
  or change the check for that job. It rides the dispatch_requests rail the app already has, as a
  structured request, so the inbox, the push, the thread, the priority card and Questions on this
  job all carry it for free.
next: PR 3, the marks: #246's door is on main and PR 2's live walk passed on the ZZ job 2026-11-04.
size: M as a train of three (S · M · S); one migration (two columns on dispatch_requests); no edge function beyond the push that already sends
blocker: none. Call 1 (the reason set) and call 2 (who may close) take the recommendations below as defaults.
ver: v2.6360 · 6462 · 6466 · 6494 · 6495 · 6328 · 6347 · 6052 · 6214 · 3246 · 6087 · 6084
opinion: now — the sheet's second pass made the row the place the crew stands; a dead end there sends them to a text message, and the context is lost the moment they type one
mockup: to-dos/stage-check-to-dispatch/mockup.html
---

# Send a stage check to Dispatch (#245)

## The ask

The owner, 2026-11-02, on the phone sheet's open row (punch list #237 PR 1, v2.6328), pointing at
the foot of the row where a red *Send to Office* link was drawn:

> I would like text here to send an item to the dispatch where when they click it, it opens an
> additional modal on top with the context and reason … a plan to build this that retains the
> details of the checklist item and job information so when dispatch sees it they have context
> and can jump right into the job or modifying the checklist item for the job.

## The thinking

**What the crew has today.** The sheet (v2.6328, v2.6347) keeps one row open at a time: the
question, Yes · No · Not here, a note, the photo, the plan sheet chip, and for whoever authors on
the job *Take off*, *Skip on this job* and the arrows. When the crew cannot answer, nothing on the
row reaches the office. The header's **Send to Dispatch** (`DispatchTaskModal`, *What do you
need?*) takes free text and an optional job reference, so the stage and the check are whatever the
crew retypes. The bell on Dispatch Mode's Schedule is the same box.

**What Dispatch has today.** `dispatch_requests` is the one inbox: the row's title, a job or bid
reference, a thread of notes, open oldest first with the amber and red age chips, *Customer
waiting* cards at `priority = 'high'` (v2.3246), a per-user dismiss, and a push to the Dispatch
group through `notify-dispatch-request`. A structured flavour already exists: `pending_action =
'link_job_pictures'` (v2.556) draws an inline press on the inbox row that opens the job's edit form
scrolled to the field, and the row closes itself when the field is filled. *Questions on this job*
on the job window (v2.6052) lists every request that names the job.

**So the design is one new flavour of a request, not a second inbox.** A check sent to Dispatch is
a `dispatch_requests` row with `pending_action = 'stage_check'`, the job in `job_ledger_id`, and
two new columns naming the stage (`fixture_id`) and the check (`checklist_question_id`). The title
is built from the context so the inbox row reads right without a window: *Trim Set · "Is the
water heater pan drain run to the hub?" · can't do it: the hub isn't poured yet · JP1088 ZZ TEST
Riders Walk*. The crew's words go into the title's tail and as the first note on the thread. One
open request per check per stage; a second send on the same check while one is open reads
*Already with Dispatch* and opens that thread instead.

**The crew's press.** On the open row, under the note link, the quiet press **Send to Dispatch**
(the app's lane is Dispatch; the office reads that inbox). It opens a second sheet above the
checklist sheet, in the sheet's own shape:

- The context card, read-only, as the row knows it: the job's number and name, the address, the
  stage, the check's words with its chips (photo, plan sheet), the pick so far with its stamp, the
  note, a thumbnail where there is a photo, and who added the check if it is the job's own.
- **Why** as reason chips, one required: *Can't do it* · *Not on this job* · *Need a part* ·
  *Need a decision* · *Something else*. The chip sets the tail of the title and, for *Can't do it*,
  the request's priority to high, since a stopped crew is what *Customer waiting* was built for.
- A words box, *What should Dispatch know?*, required for *Something else*, optional otherwise.
- The foot: *Dispatch gets a push. The answer comes back on this row.* and **Send to Dispatch**.

After the send the row carries a chip, *With Dispatch · 2 min* with the reason, that opens the
thread; the row stays answerable, since Dispatch may simply tell them to press Not here. When
Dispatch answers or closes, the chip reads *Dispatch: "Hub pours Thursday, skip it for now"* and
the words sit under the row until it is answered.

**Dispatch's side.** The inbox row, wherever the inbox draws (Dashboard, Dispatch Mode's Inbox,
Quickfill, Checklist Review), reads the built title with a *Stage check* tag and the job's
reference line, and carries two inline presses: **Open the job** (the job window on the Job tab,
the strip in view) and **Open the check** (the stage's checklist sheet with that row open, so
Dispatch can answer it, add a note, skip it on this job, take it off, or add a check beside it,
exactly as the office does on the Documents tab). Pressing the row opens the **context window**
on top: the same context card the crew saw, the reason, who sent it and when, the thread, and
the acts: **Open the check**, **Open the job**, **Reply** (a thread note; the crew reads it on the
row), **Close** with the closing note the inbox already requires. A request closes itself when
the check is answered, skipped or taken off on that stage, with the note *Answered on the sheet by
Luis Ortega · Yes*, so nobody closes by hand what the row already settled.

**Is that the best we can do?** Three things were weighed and left out, in order of worth:

- A reply from the window that *also* writes the answer (*Not here, and tell them*): one press
  for Dispatch, but it would put Dispatch's pick on the crew's row under the crew's name. The
  stamp is the crew's own. Dispatch answers on the sheet, under their own name, as the office does.
- A text to the crew member's phone with the reply: the row already carries it, and the push the
  crew gets for a thread note on a request they sent covers the moment. Left for a later card if
  the crew says they miss it.
- A *number with unit* reason (*need 3 of P-trap 2"*): the part kind belongs to #237's own later
  item kind, not here.

## Open questions

The owner's, each with the recommendation the build takes unless he says otherwise:

1. **The reason set.** Five chips as above. Recommended: ship these five and watch the thread
   notes for a month; a sixth comes from what the crew types under *Something else*.
2. **Who may close.** The dispatch group and a dev, as every request; the sender may not close
   their own, but the row closes itself when the check is settled. Recommended as is.
3. **Does a high-priority send text the group like a portal request does?** Recommended no: the
   push is enough for a crew that is standing there; the row already leads the inbox under its red
   *Can't do it · waiting* line (v2.6462).

## Where it plugs in

What exists:

- The sheet `StageChecklistSheet.tsx` with its open row (v2.6328, v2.6347), the kernel
  `src/lib/jobs/stageChecklist.ts` and `stageChecklistItems.ts`, the io
  `stageChecklistSheetIo.ts`, the read `useJobStageChecklists` with its change bus.
- `dispatch_requests` with `pending_action`, `job_ledger_id`, `reference_summary`, `priority`
  (v2.3246), the thread `dispatch_request_notes`, dismissals; the inbox `DispatchInboxSection.tsx`
  and Dispatch Mode's `DispatchModeInbox.tsx`; the `link_job_pictures` flavour
  (`lib/linkJobPicturesDispatchRequest.ts`) as the shape to copy; `sendAsk` in
  `lib/developments/askWrites.ts` for the row, the push and the refresh; `notify-dispatch-request`.
- *Questions on this job* (`RecordQuestions.tsx`, v2.6052) and the Development page's Questions
  look (v2.6214), which list any request naming the job.
- The job window deep link `?jobDetail=<id>` and the strip under the address (v2.6084).

What is new: the two columns and the dedupe index; the kernel `stageCheckDispatch.ts` (the title,
the reason chips, the priority rule, the dedupe key, the self-close note, the row's chip words);
the send sheet; the row's chip; the inbox row's tag and two presses; the context window; the
trigger that closes a request when its check is settled; the guides.

## The plan

1. **PR 1 · the send and the inbox doors** (S). The migration (`fixture_id`, `checklist_question_id`
   on `dispatch_requests`, the partial dedupe index on `(fixture_id, checklist_question_id) WHERE
   pending_action = 'stage_check' AND status = 'open'`, `docs/migrations/`), the kernel with its
   tests, **Send to Dispatch** on the open row and the send sheet (the context card, the chips, the
   words, the send through `sendAsk`'s path with the push), *With Dispatch* on the row, the inbox
   row's *Stage check* tag with **Open the job** and **Open the check**, the guide *send a check to
   Dispatch* (Field Work). Useful on its own.
2. **PR 2 · the context window and the loop back** (M). The window on the inbox row with the
   context, the reason, the thread, Reply and Close; the self-close trigger when the check is
   settled (`answered`, `skipped`, `retired`) with its note; Dispatch's reply drawn under the crew's
   row; the push to the sender on a reply (the request's own, already sent for a note); the guide
   *answer a check the crew sent* (Office).
3. **PR 3 · the marks** (S). The Pipeline row's name mark reads *⚑ 3 Trim · with Dispatch* while a
   request is open (the mark of v2.6087 gains a flag), the Documents read-out's row reads *With
   Dispatch* with the reason, and *Questions on this job* draws the tag. Lands after #246's door or
   with it.

## How to verify

On the dev server as the dev, prod data, nothing written outside ZZ Test rows: open a ZZ Test job
with Trim Set, add a check on the sheet, press **Send to Dispatch** on its row, pick *Need a part*,
type a line, send; read *With Dispatch · now* on the row and the push on a phone in the Dispatch
group; on the Dashboard's Dispatch inbox read the built title with the *Stage check* tag, press
**Open the check** and read the sheet with that row open; press the row, read the context window,
reply, and read the reply under the crew's row; answer the check on the sheet and read the request
closed by itself with its note. Delete every ZZ Test row after, the request and its notes too.

## Where it stands

2026-11-02: asked on the sheet's screenshot, thought through and mocked up (`mockup.html`: the
row's press, the send sheet, the inbox row and the context window).

2026-11-02, later: **PR 1 built as v2.6360 (PR #6829)**, merged 2026-11-03 with migration
`20261102113000` pushed within two minutes of the merge and checked on prod (the two columns over
the API, the one-open index, `npm run check:migration-drift`); the types follow in PR #6918. Built:
the kernel `stageCheckDispatch.ts`, **Send to Dispatch** on the open row and the send sheet
`StageCheckDispatchSheet.tsx`, *With Dispatch · 12 min · need a part* in the press's place while a
request is open, the inbox row's *Stage check* tag with **Open the job** and **Open the check**
(`openJobDetail({ openStageChecklist })`), the guide *send a check to Dispatch*. Calls 1 and 2
shipped as recommended, and call 3's no stands: the push alone. Three calls made in the build, in
`docs/recent-features/v2.6360.md`: the inbox's doors read the request's payload rather than the new
columns, so the Dashboard's read never waited on the push; the chip is words, not a press, until PR
2's window gives it somewhere to open; the sheet's confirm carries no aria-label, so it and the
row's press read apart. The send sheet opens from #246's inline door too, since v2.6362 landed first
and the merge mounts it in both frames. The live walk passed on prod 2026-11-03 at 14:38Z, as the
dev on ZZ TEST Riders Walk. The company's list is empty on prod, so no stage had a question: the
walk added a job item for Trim Set first. Then **Send to Dispatch** with *Need a part*, the chip and
the toast, the request with both columns filled, the push function answering 200, the inbox row's
*Stage check* tag with both doors working, and last the request closed with a note and the check
taken off (both kept as ZZ rows). Found in the walk's reading: a *Can't do it* send draws as the
*Customer waiting* card, which keeps the doors but drops the *Stage check* tag; v2.6462 draws it as
its own row instead: the tag, the title and both doors under a red *Can't do it · waiting 4 min*
line, with **Lower priority** beside the thread. On the owner's call of 2026-11-03 it stays off the
app-wide *Customer waiting* banner and **Needs you** too (v2.6466): those stay a customer's. PR 2 is
next; PR 3 can follow it.

2026-11-04: **PR 2 built as a train of two.** A review that morning found the inbox's `stageCheck` and the banner's
`waitsOnTheBanner` were two predicates for one fact; v2.6495 gives both `isStageCheckRequest`. **v2.6494 (PR #7010, PR
2a)**: migration `20261104170000_stage_check_self_close.sql`, three `SECURITY DEFINER` triggers that close every open
request on a stage and check when it is answered on the sheet, skipped on the job or taken off, in the settler's name
with a note that says how (*Answered on the sheet by Luis Ortega · Yes*, *Skipped on this job by Sal Super: the reason*,
*Taken off by Sal Super*, a company question *Taken off the company's list*, a promoted item *Added to the company's
list*); the guard admits it; the SQL bed `test:pg:stage-check-self-close` ran on the local Postgres 15 over every
migration (49 checks, four mutants caught). **v2.6495 (PR 2b)**: the context window on the inbox row's press
(`StageCheckWindow.tsx`: the card live or from the title, the thread with the crew's words first, **Reply**, **Reply and
close** for the dispatch group and a dev and never the sender, **Lower priority**, **Not now**, the two doors), the
crew's words in the payload, the reply push (`notify-dispatch-request` mode `replied`: the function had no note push,
confirmed before adding it), Dispatch's reply under the crew's row, the chip read again after a settle with the close
push to the sender, the guide *answer a check the crew sent*. Call 3 stands. **Walked live 2026-11-04 at 17:45Z** on
the dev server as the dev, on ZZ TEST Riders Walk, after both PRs merged, the migration pushed (drift 1108 of 1108)
and the function deployed, with the owner's yes: a job item added for Trim Set from the Documents tab, **Send to
Dispatch** with *Need a part* (the push answered 200), *With Dispatch · now · need a part* on the row; in Dispatch
Mode's inbox the row's press opened the window with the live count (*0 of 1 answered · 1 left*), the check, *added by
Robert · not answered yet*, the words as the thread's first line, the reply box *Reply to Robert…* and, since the dev
was the sender, no Reply and close and the line *You sent this check. Answer it on the sheet and it closes itself.*;
**Reply** wrote the note (*Reply sent. The crew reads it under the row.*, the function 200), and the sheet drew
*Dispatch: “…” · Robert · just now* under the chip; **Yes** cleared the chip and the request closed itself with
*Answered on the sheet by Robert · Yes* in the dev's name; the item was then taken off. The two ZZ requests and the
retired item stay as ZZ rows. PR 3, the marks, is next.
