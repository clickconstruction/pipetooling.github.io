---
name: "A photo of the supply house ticket, taken at the counter"
number: 295
group: gated
status: asked 2026-11-09 · Tally read on main, in prod and live · three shapes put to Diane, the second picked for a mock-up the same day · drawn as thirteen frames · waiting on her critique and six calls · nothing built
mockup: to-dos/ticket-photo/mockup.html
summary: >
  Two papers leave a supply house counter. A card receipt is the only list of what was bought, and
  no invoice ever follows it. An account ticket is followed days later by the bill in the mail.
  Neither reaches the app from the tech: Job Parts Tally has a camera on a box in On site and
  nowhere on its purchase side, and in 90 days about 176 card charges at material houses carry 2
  receipts between them. The office sorts each charge to a job from the clock and the schedule
  without seeing what was bought. The design is one Photo of a ticket press on Tally and on the Job
  Mode card: the camera, then the job in one tap, the shot kept on the phone until it sends and
  filed in the job's Drive folder. The ticket is its own row. A pure matcher ties it to the card
  charge once the bank settles the charge, or to the PO Generator code and later the bill. The
  Team queue shows the ticket on the charge and offers its job first. Reading the ticket's lines
  with the bill reader is a later step.
next: Diane's critique of the mock-up and her word on the six calls at its foot; then PR 1, the ground (the table, the bucket, the sweep's ninth source, the matcher kernel), which draws no screen.
size: L as a train of four (M · M · M · S), the reading step apart
blocker: The owner's pick on the mock-up and the six calls.
opinion: build — it is the only shape a tech can press at the counter, and it turns the office's guess into a fact
---

# A photo of the supply house ticket, taken at the counter

## The ask

Diane, 2026-11-09: *"I would like to look at how tally works and potentially come up with a solution
to fill in the missing gap where a user can take and upload a photo of their supply house ticket or
receipt right there in the app."*

## What Tally is today

`/tally` (`src/pages/JobTally.tsx`, map in `docs/JOB_TALLY_ARCHITECTURE.md`) has three tabs.

- **On site**, the default: the cages and boxes ledger. It holds the page's one camera press, the
  Photo of a box (`materials/PhotoPress.tsx`).
- **Transactions**: company card charges sorted to jobs. A field role sees a card per purchase
  (`TallySortModeCardList`: Sort to job, + memo). The office sees Team (`TallyTeamQueue`, one card
  per person per day, the likely job first, Sort the day).
- **Materials Estimate**: the first parts tally (job, fixture, part, quantity, Send to Office, which
  writes `jobs_tally_parts` and makes a purchase order).

What 90 days of production say (read 2026-11-09 through the dev seat, counts only):

- The office sorts, from the clock. Punch list #72 measured one assistant sorting 98% of charges;
  the Team queue's sorted lines still read that way.
- Materials Estimate is dormant: `jobs_tally_parts` holds 9 rows, the last real one in February.
- A charge is hidden at the counter. The bank keeps it pending until it settles and the lists drop
  pending rows; #72 measured 58% of a day's purchases still pending at clock-out.
- About 176 card charges at material houses (one big-box store 94, a plumbing house 36, a second
  big-box store 33, the rest 13). Mercury's `raw.attachments` is non-empty on 2 of them, put on in
  the bank's own app; the stored link is signed for 12 hours and the app shows it nowhere.
- A charge is tied to supply house invoices on 7 charges ever, each one card charge paying several
  statement invoices. None is a counter purchase tied to its own ticket.
- The PO Generator made 25 counter codes in 30 days, each a job, a house and a person.
- The bill reader (`bill-read`, punch list #179, v2.6088) reads a PDF or a picture of a counter
  ticket into the Add invoice window, is switched on, costs about a cent a read and is office only.
- The file index has read no file by OCR; a phone picture filed to Drive is indexed by its name.

## The three shapes, and the pick

1. **A receipt on the charge.** A camera chip on each purchase card. Small. Rejected as the first
   door: the charge is not on the tech's list at the counter, and it does nothing for an account
   ticket. Its press survives as the late door (*+ ticket* on a purchase with none, frame G).
2. **Snap the ticket, match it later.** Picked for the mock-up. Drawn in `mockup.html`.
3. **A receipt is a job photo.** The press files a job photo marked Receipt. One PR and no table,
   and the office still sorts blind, since nothing ties the photo to the charge.

## The mock-up

[`mockup.html`](./mockup.html), thirteen frames, every name and number made up.

- **Today**: the tech's Transactions tab, with nothing to take the ticket.
- **A · B · C, at the counter**: the press under the tab row on every tab; the sheet after the
  shutter (the job clocked in now first, Another job…, Shop or truck stock, an optional total); the
  same sheet when the office made a PO code for this tech today, the code first.
- **D · E · F, afterwards**: saved and My tickets (Waiting for the card charge · On account, waiting
  for the bill · Matched); no signal (the ticket is on this phone, Send now); a ticket with no total
  and one charge that fits, asked as Yes or No.
- **G · H**: the settled purchase wearing its ticket with *Sort to JP1042* as one press, and the
  late door; the Job Mode card's Ticket line beside Photos.
- **I · J · K, the office**: the Team day card (1 with a ticket; the ticket's job as the first
  choice on its charge, never picked for the sorter); the ticket window (Open in Drive, Not this
  charge, Record as a bill); Add invoice's *Start from* with the tech's ticket beside the mail.
- **L, later**: the sheet once the app reads the ticket.

## The calls that are the owner's

1. Shop or truck stock: to the Office job, or held for the office to place?
2. The match that makes itself: same card holder, same amount to the cent, within a day of the
   swipe. Sure enough to tie the photo with no press? The sort to a job takes a tap either way.
3. Who may see a ticket: the tech who took it, the office, the job's team through its folder.
4. The total: an optional field as drawn, or left out until the app can read it?
5. The Job Mode door: in the first build, or after the Tally press has been used?
6. A ticket that never meets a charge (cash, the tech's own money): how long it waits, and whether
   the office then reads it as money owed to the tech.

## Where it plugs in

Exists, to reuse:

- The camera, the shrink and the send: `hooks/useShotTiles.ts` (`useShotTileEngine`, a new `io`),
  `lib/photos/shrink.ts` (the Large size for small print), `lib/photos/jobPhotoNotesIo.ts` as the io
  to copy, `lib/photos/photoName.ts`, `lib/photos/photoTakenAt.ts`.
- The wait with no signal: the outbox (`lib/offline/outbox.ts`, a new kind beside `job-photos` and
  `task-photo`; `keptPhotos.ts`, `useOutboxReplay`, `OutboxDoor`). A photo may queue; nothing here
  writes money, so `NEVER_QUEUES` is untouched.
- The filing: `photo-save`'s `sweepNamedPhotos`, a ninth source, into the job's Drive photo folder;
  the `uploaded_photos` view gains the source.
- The job in one tap: `lib/tally/fetchSortModeDayJobs.ts`, `sortModeDayJobsOrder.ts`,
  `TallyChooseJobSheet`, `PhoneSheet`; the PO codes from `material_po_generator_entries`
  (`for_user_id`, today).
- The office's side: `TallyTeamDayCard` and its `SuggestionChip`, `tallySortSuggestion.ts` (a
  ticket's job as a line's own first choice), `tallySuggestionWords.ts`.
- The bill's side: `SupplyHousesTab`'s *The bill* and `lib/materials/bills/` (the reader, the
  matcher by PO code, the checks).
- Failed reads: `OfflineRetryPanel` with `recoveryFailureFromError`; errors through
  `formatErrorMessage`; the empty My tickets through `EmptyState`.

New:

- A table `counter_tickets` (the job or null for stock, who, when, the house when known, the total
  when typed, the PO Generator entry when picked, the photo's path, Drive id and filing state, the
  matched charge, the matched invoice, how the match was made and by whom) and its pages table for
  a second shot; a private bucket; RLS (the taker, the office, the job's team); the migration
  opening with the lock timeout and closing with the four fence calls.
- `src/lib/tickets/`: `ticket.ts` (the states and their words, the file's name), `ticketMatch.ts`
  (pure: exact, offered, none; a refund matches a charge that reads *back*), `ticketJobs.ts` (the
  sheet's choices in order), each with tests.
- The press and the sheet, My tickets, the ticket window, with render smokes.
- A guide, `take-a-photo-of-a-supply-house-ticket`, and a section in *sort the team's card
  purchases from the office*.

## The plan

1. **PR 1, the ground** (M): the migration, the bucket, the sweep's ninth source, the kernels and
   their tests. No screen. Push the migration and deploy `photo-save` after the merge.
2. **PR 2, the tech's press** (M): the press on Tally's three tabs, the sheet, the outbox kind, My
   tickets, the guide.
3. **PR 3, the match and the office** (M): the match written when a charge settles and on a Yes;
   the Team day card's ticket and its first choice; the ticket window; the tech's settled purchase
   (*Sort to JP1042*, *+ ticket*).
4. **PR 4, the other doors** (S): the Job Mode card's Ticket line, the job's Documents tab, a
   charge on the job's cost rows, Add invoice's *Start from*.

Apart, each on the owner's word: the bill reader on a tech's ticket (the house, the total, the day
and the PO code filled; the lines offered to Materials on site as a delivery, which Jobs → Materials
→ Deliveries says is not built); a reminder for a charge with no ticket; a copy of the photo to the
bank, whose feed marks every charge as short of its receipt policy.

Steer around at build time: `applyPayrollRules` in `JobTally.tsx` (another session's fix), the Team
day card's day strip prototype (PR #6532), the Materials on site PRs of punch list #294.

## How to verify

A ZZ test job, a sample field account and a sample card are needed for a live walk; a real charge
cannot be made for a test, so PR 3's walk matches a ticket to a settled ZZ-safe charge on the dev's
own linked card and takes the match off again with *Not this charge*. With no signal: the pane's
offline switch, the ticket reads *On this phone*, then sends on its own when the switch is lifted.
