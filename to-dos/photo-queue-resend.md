---
name: "Photo queues: a photo sent again after a lost answer is refused, so it never lands"
number: 338
group: ready
status: found 2026-11-13 while fixing the same bug in bid photos (punch list #306, the fix after PR 8, branch claude/306-bid-photo-resend) · read in the code and the migrations, not walked · not built
summary: >
  When a phone keeps a photo with no signal, the outbox sends it again later. If an upload reached the office while
  the phone never heard back, the next upload of that photo is an upsert onto a file that is already there. Three
  photo buckets have no update policy: job photos, task photos and report photos. The project refuses such an upsert
  every try, so the press waits, the bar turns red the next morning, and the photo never lands although its bytes are
  in the bucket. Bid photos had the same bug, confirmed on the project, and its fix is two lines.
next: One small PR, the bid photo fix's change in each of the three sends with its test. No migration.
size: S
blocker: None.
opinion: build — a photo taken on one bar of signal is the case the outbox exists for
mockup: not required — no screen changes; the send under the tiles does
---

# Photo queues: a photo sent again after a lost answer is refused, so it never lands

## What was found (2026-11-13)

The bid photo send uploaded with `upsert: true` into a bucket with no update policy. The project was asked with one
test object under the ZZ Test bid's folder, deleted after:

| Upload | Answer |
|---|---|
| first, with upsert | 200 |
| again, with upsert | HTTP 400, status code 403, *new row violates row-level security policy* |
| again, with no upsert | HTTP 400, status code 409, *The resource already exists* |

The bid photo fix followed. Three other sends upload the same way into buckets with the same three policies: insert,
select, and delete your own. None has an update policy.

| Send | Where | Bucket | Migration |
|---|---|---|---|
| Job photos (punch list #244) | `sendJobPhotoNote` in `src/lib/photos/jobPhotoNotesIo.ts` | `job-photo-notes` | `20261102171500_job_photo_notes` |
| Task card photos (punch list #273) | `sendTaskPhoto` in `src/lib/photos/taskPhotosIo.ts` | `task-photos` | `20261106230000_task_cards_progress` |
| Report photos (punch list #229) | `sendReportPhoto` in `src/lib/photos/reportPhotosIo.ts` | `report-photos` | `20261029220000_report_photos` |

Each of the three writes its row as an upsert on the shot's id after the upload, so the row side is already safe to
send twice. Only the upload is not.

The counter ticket pages (`sendTicketPage` in `src/lib/tickets/ticketsIo.ts`, punch list #295) upload with upsert as
well, but `counter-tickets` has an update policy for the file's owner (`counter_tickets_files_update_own`). Its resend
is likely allowed. Not walked.

## When it bites

The outbox's replay (`useOutboxReplay` and `sendKeptPhotos` in `src/lib/offline/keptPhotos.ts`) sends a kept shot again
only after a try failed. When that try's upload had landed and its answer was lost, every later try is refused.
`sendKeptPhotos` counts a refusal as a failed try. So the press waits, and the next morning the bar turns red with
**Fix**. Dropping the press loses the photo on the phone, while its bytes sit in the bucket with no row. A tile's
**Retry** in each window meets the same refusal when its first upload had landed.

Not seen live for these three: no walk dropped an answer on them. The bid photo case was confirmed on the project, and
these buckets carry the same policies.

## The fix, as it was made for bid photos

- Upload with `upsert: false`. When the answer is *already exists* (`bytesAlreadyThere` in
  `src/lib/photos/shotTiles.ts`), go on to the row as if the upload had landed. The path carries the shot's own id,
  minted on the phone, so what is there is that shot.
- No migration. An update policy on each bucket would also fix it. It was not chosen for bid photos, since it lets a
  person overwrite a photo's bytes.
- The test pattern is `src/lib/bids/bidPhotosIo.test.ts`: the storage client mocked with the project's own answers.

## How to verify

Live, at phone width, with a headless browser that lets the first upload reach the office and then drops its answer
(Playwright's `route.fetch()`, then `route.abort('internetdisconnected')`). The tile reads kept, the press queues, and
the next try lands the photo once. Take the test photo back after.
