---
name: "Photo queues: walk a resend after a lost answer on the live site"
number: 338
group: close
status: built in v2.7346 on 2026-11-15 (Taunya picked Build) · the three sends upload with no upsert and take *already exists* as a landing, each with its test · not walked live
summary: >
  Job photos, task card photos and report photos now land on the next try when the first upload reached the office
  and its answer was lost. What is left is one walk on the live site that drops an answer and sees the photo land once.
next: Walk it live at phone width on a ZZ Test job. Let the first upload reach the office, drop its answer, and see the next try land the photo once. Take the test photo back, then delete this card.
size: S
blocker: None.
opinion: walk it once, then retire the card
mockup: not required — no screen changes; the send under the tiles does
---

# Photo queues: walk a resend after a lost answer on the live site

Built in v2.7346 (`docs/recent-features/v2.7346.md`). Not walked live: no walk has dropped an answer on a job, task or report photo. In the browser, let the upload to `/storage/v1/object/<bucket>/…` reach the office, then fail its answer as a lost signal. The tile reads kept, the press queues, and the next try lands the photo once. Take the test photo back after.
