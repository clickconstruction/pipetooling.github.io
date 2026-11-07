---
name: "A task card's photo taken with no signal waits on the phone and sends itself when the signal returns, as a job photo does"
number: 279
group: ready
status: written up 2026-11-07 from #273's close-out, at Taunya's ask that it go on the punch list · the one piece #273's PR 4b (v2.6602) left · nothing built
summary: >
  Since v2.6602 a task card offers a photo at each new percent and asks for one at the finish.
  With no signal, `sendTaskPhoto` refuses with *The phone has no signal.* and the sheet asks the
  person to take it again, so a tech in a basement or a container loses the shot and the moment.
  A job photo has waited on the phone since v2.6370 (`src/lib/offline/*`: the outbox's presses,
  `keptPhotos.ts` holding the shrunk bytes under the photo's id, the replay sending with the same
  id every try so a resend counts once). The task photo takes the same road: the shot is kept,
  the percent or the finish lands as it would, the card's strip shows the photo as *waiting for
  signal*, and when the signal returns the outbox sends it through `sendTaskPhoto` and the strip
  moves on to *on its way* and then *in Drive*.
next: one PR, the task photo as an outbox press (a payload beside the job photo's with the day row, the kind, the percent or the line, and the taken-at), the strip's third standing, the guide add a photo to a task card, release note and fragment
size: M
blocker: None.
mockup: not required — the strip gains one standing word beside the two it has, and the outbox bar the job photo uses draws the rest
opinion: build on the outbox as it is; a second queue for task photos would be a second set of rules for what waits and what is dropped
---

# A task photo with no signal waits through the outbox (#279)

## The ask

2026-11-07, closing out #273 (task cards with a percent, Done when… lines and photos). PR 4b's fragment says a shot taken with no signal does not wait on the phone yet; the card had promised it would. Taunya: "Needs to be added to the punch list."

## The shape

- **The press.** A task photo becomes an outbox press with its own payload: the day row (`checklist_instance_id`), the kind (`progress`, `finish` or `line`), the percent or the criterion, the taker and the taken-at. The bytes go into `keptPhotos.ts`'s store under the photo's id, as a report photo's do.
- **The card does not wait for it.** Set N% and the finish land as they do now. A finish on a card that asks for a photo counts the kept shot as the photo, so the person is never asked to type a reason because the signal dropped.
- **The strip.** `taskPhotoStanding` gains *waiting for signal* beside *on its way* and *in Drive*, drawn from the kept bytes so the thumbnail shows at once.
- **The replay.** When the signal returns, the outbox sends each kept task photo through `sendTaskPhoto` with the same id, so a resend is one photo, then drops the bytes. A photo the bucket refuses is named on the outbox bar with its reason and its door, as a job photo's is.

## Where it lives

`src/lib/photos/taskPhotosIo.ts`, `src/hooks/useTaskShot.ts`, `src/hooks/useTaskCardSheets.ts`, `src/components/checklist/TaskPhotoStrip.tsx`, `src/lib/taskPhotos.ts`, and the outbox in `src/lib/offline/` (`outbox.ts`, `keptPhotos.ts`, `afterLanding.ts`). Guide `src/content/help/add-a-photo-to-a-task-card.md`.

## Done

A tech in airplane mode moves a card to 75% with a photo and finishes another with its finishing photo; both cards read right at once, both strips say *waiting for signal*, and when the phone comes back online both photos land in `task_photos` once each and the sweep files them under PipeTooling Tasks in Drive.
