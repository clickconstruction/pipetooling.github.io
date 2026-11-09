---
name: "A photo of the supply house ticket, taken at the counter"
number: 295
group: ready
status: asked 2026-11-09 · Tally read on main, in prod and live · three shapes put to Diane, the second picked for a mock-up the same day · drawn as thirteen frames · her "is this the best we can do, did we cover the edge cases" the same day: the cases checked against the code and redrawn as fifteen frames · Diane said build as drawn the same day, with the picks she was shown on the calls · PR 1 (the ground, v2.6812) merged, pushed and the sweep deployed 2026-11-09 · PR 2 (the tech's press, v2.6815) and PR 3 (the match and the office's queue, v2.6818) in review · the text door is its own card, #299
mockup: to-dos/ticket-photo/mockup.html
summary: >
  Two papers leave a supply house counter. A card receipt is the only list of what was bought, and
  no invoice ever follows it. An account ticket is followed days later by the bill in the mail.
  Neither reaches the app from the tech: Job Parts Tally has a camera on a box in On site and
  nowhere on its purchase side, and in 90 days about 176 card charges at material houses carry 2
  receipts between them. The office sorts each charge to a job from the clock and the schedule
  without seeing what was bought. The design is one Photo of a ticket press on Tally and on the Job
  Mode card: the camera, then the job in one tap, the shot kept on the phone until it sends and
  filed in the job's Drive folder under Team only, never in Customer Pictures. The ticket is its
  own row. A pure matcher ties it to the card charge by the minute of the swipe, or to the PO
  Generator code and later the bill. The Team queue shows the ticket on the charge, offers its job
  first, and lists the tickets that have no charge. Reading the ticket's lines
  with the bill reader is a later step.
next: PR 2's merge and push (two read policies), PR 3's merge; then PR 4, the other doors (the Job Mode line, + Ticket at the desk, Add invoice's Start from, Record as a bill).
size: L as a train of four (M · M · M · S), the reading step apart
blocker: None for the build. Call 6 (does a cash ticket mean money owed to the tech) is still the owner's; the build only records how such a ticket was paid.
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
   ticket. Its press survives as the late door (*+ ticket* on a purchase with none, frame H).
2. **Snap the ticket, match it later.** Picked for the mock-up. Drawn in `mockup.html`.
3. **A receipt is a job photo.** The press files a job photo marked Receipt. One PR and no table,
   and the office still sorts blind, since nothing ties the photo to the charge.

## The mock-up

[`mockup.html`](./mockup.html), fifteen frames, every name and number made up.

- **Today**: the tech's Transactions tab, with nothing to take the ticket.
- **A · B · C, at the counter**: the press under the tab row on every tab, with a small link for a
  photo or a PDF the tech already has; the sheet after the shutter (the job clocked in now first, a
  second tap for a second job, Another job…, Not for one job, Retake, + Another page, the total and
  a note behind two links); the same sheet when the office made a PO code for this tech today.
- **D · E · F · G, afterwards**: saved and My tickets (Waiting for its charge or its bill · On
  account, waiting for the bill · Matched · a return matched to money back); no signal; a ticket
  taken hours later and one charge that fits, asked as Yes or No; the tech's own ticket (Change the
  job, Add a page, Remove this ticket).
- **H · I**: the settled purchase wearing its ticket with *Sort to JP1042* as one press, and the
  late door *+ ticket*; the Job Mode card's Ticket line beside Photos.
- **J · K · L · M, the office**: the Team day card (the ticket's job first on its charge, a loose
  match asked as *It is* / *It is not*, *+ Ticket* for a paper handed in); the ticket window; the
  Tickets list (no charge yet, and a ticket that disagrees with where its charge went); Add
  invoice's *Start from* with the tech's ticket beside the mail.
- **N, later**: the sheet once the app reads the ticket.

## The calls that are the owner's

1. Not for one job: to the Office job by itself, or held for the office to place (frame L)?
2. The matches that make themselves: the only swipe on that person's card in the half hour before
   the photo; a typed total equal to the charge within a day. Both, one or neither with no press?
   The sort to a job takes a tap either way.
3. Who may see a ticket: the tech who took it, the office, whoever can open the job's Team only
   folder.
4. Any receipt, or material only: the press takes fuel, a meal, a tool. Wanted, or should the
   words say supply house only?
5. The Job Mode door: in the first build, or after the Tally press has been used?
6. A ticket that never meets a charge (cash, the tech's own money): *Paid another way…* records
   which; does the office then read it as money owed to the tech?

**Answered 2026-11-09: build as drawn, with the picks she was shown.** 1 held for the office to
place. 2 both, and each only when exactly one charge fits. 3 as written, and the holder of the card
that paid. 4 any receipt. 5 in the first build. 6 is still open, so the build records how such a
ticket was paid and nothing about money owed.

**The half hour, measured the same day** (the dev seat, 200 card charges from 2026-10-10 to 10-23):
the feed's `created_at` is the swipe itself and is on the row while the charge is still pending. A
field card's swipes mostly stand alone. Two cards ran five and more charges inside ten minutes, and
a few visits made two charges seconds apart, so the match makes itself only when exactly one charge
is in the window; two that fit are told apart by a typed total, or the office picks. Many rows had
failed, a card declined and run again, and a failed charge is never a candidate.

## The edge cases

Checked 2026-11-09 against the code and the feed. *Drawn* names the frame; *rule* is a rule of the
build the mock-up does not need a frame for; *call* is the owner's.

| The case | What happens | Where |
|---|---|---|
| No signal at the counter | The shot is kept on the phone and sent by itself; the waiting presses bar counts it | drawn E |
| Still unsent the next morning | It says so in red and offers Share instead (the outbox's own next-morning rule) | drawn E's words |
| The charge is not on the tech's list yet | The ticket never needs it: the feed holds the swipe's minute (`raw.createdAt`, `mercurySwipeAtIso`) the day it is made, so the match can land while the charge is still pending | rule |
| The tech skips the total | The swipe's minute matches instead; the total sits behind a link | drawn B, F |
| The ticket is taken hours later, at the truck | No minute to go on: one fitting charge is asked as a question, to the tech or the office | drawn F, J |
| The photo is taken from the phone's library | Its own taken time is read (`readTakenAt`), not the press's | rule |
| The store emailed the receipt | The small link takes a photo or a PDF already on the phone | drawn A |
| The paper is handed in at the office | *+ Ticket* on the charge's line takes a scan, a photo or a PDF | drawn J |
| A long receipt or a two-page ticket | + Another page, at the counter or later | drawn B, G |
| A blurred shot | Retake before the save; the Large size keeps small print | drawn B |
| The wrong job | The tech changes it until the office has used the ticket; the office changes it in the window | drawn G, K |
| The same ticket taken twice | A resend carries the same id and counts once; a second press is a second ticket, which the tech removes | drawn G |
| A ticket taken by mistake | Remove this ticket, kept out of sight and never deleted | drawn G |
| One ticket for two jobs | A second tap adds the job; the office splits the charge, the even split first | drawn B |
| A purchase for no one job | Not for one job, with a note; the office places it | drawn B, L · call 1 |
| A helper takes the photo, the lead's card pays | The match looks past the card holder as a question, never by itself; the lead's purchase names whose ticket it is | drawn H's words |
| A card the app has tied to no one | The same: a question to the office | rule |
| An account ticket with a PO code | The code is the first choice and carries the job and the house; the bill's printed code closes it | drawn C, M |
| An account ticket with a job's name as its PO and no code | Many bills print one. Add invoice offers the tickets taken for that job in the days before the bill | drawn M's words |
| Cash, or the tech's own money | No charge ever fits: the ticket sits in Tickets as *No charge fits* with Pick the charge and Paid another way… | drawn L · call 6 |
| A return | The ticket matches the money that came back, by the same rules | drawn D |
| One ticket, two payments (part cash, two cards) | No exact match; Pick the charge ties it to one, and the note says the rest | drawn L |
| A charge that fails and is run again | A failed charge never matches; the ticket takes the one that goes through | rule |
| The total typed wrong | No match on the total; the minute or the question still finds it | rule |
| The app matched the wrong charge | Not this charge takes it off and the ticket waits again | drawn K |
| The office sorted the charge before the ticket arrived | Nothing is changed behind the office's back: the Tickets list shows the disagreement with both choices | drawn L |
| The ticket's job is not the clock's guess | The ticket's job is offered first on that charge; the sorter still taps | drawn J |
| A personal purchase on the company card | Backcharge works as today, and now with the receipt in front of the office | rule |
| Prices in a folder a customer may see | Phone photos file into the job's Customer Pictures folder today. A ticket files under Team only › Tickets | drawn K's words |
| A job with no Drive folder | The photo sweep makes one, as it does for a job photo | rule |
| A training account, a twin, a teammate who left | The table's four fences refuse the save, and the press says why | rule |
| The office on a desk with no camera | The press opens the file picker | rule |
| The camera refused by the phone | The small link's file picker still takes a photo from the library | drawn A |
| A job the tech is not on | Another job… searches every job, as sorting a purchase does | drawn B |
| The phone is replaced or its data cleared before the send | The photo is gone with it. Share instead on the waiting ticket is the only guard | not covered |
| Nothing makes a tech take the photo | *No ticket yet* on the Team line is the only pressure in the first build; a reminder is a later step | not covered |

## Where it plugs in

Exists, to reuse:

- The camera, the shrink and the send: `hooks/useShotTiles.ts` (`useShotTileEngine`, a new `io`),
  `lib/photos/shrink.ts` (the Large size for small print), `lib/photos/jobPhotoNotesIo.ts` as the io
  to copy, `lib/photos/photoName.ts`, `lib/photos/photoTakenAt.ts`.
- The wait with no signal: the outbox (`lib/offline/outbox.ts`, a new kind beside `job-photos` and
  `task-photo`; `keptPhotos.ts`, `useOutboxReplay`, `OutboxDoor`). A photo may queue; nothing here
  writes money, so `NEVER_QUEUES` is untouched.
- The filing: `photo-save`'s `sweepNamedPhotos`, a ninth source, into Team only › Tickets under the
  job's folder (`driveJobFolder.ts`'s path under the job's folder), never Customer Pictures; the
  `uploaded_photos` view gains the source.
- The swipe's minute: `lib/mercurySwipeTime.ts` (`mercurySwipeAtIso`, the feed's `raw.createdAt`).
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
  (pure: made by itself, offered, none; by the swipe's minute, then the total, then the day; a
  failed charge never, a refund against money that came back, another person's card only as an offer), `ticketJobs.ts` (the
  sheet's choices in order), each with tests.
- The press and the sheet, My tickets and the tech's own ticket, the ticket window, the Team
  queue's Tickets list, with render smokes.
- A guide, `take-a-photo-of-a-supply-house-ticket`, and a section in *sort the team's card
  purchases from the office*.

## The plan

1. **PR 1, the ground** (M): the migration, the bucket, the sweep's ninth source, the kernels and
   their tests. No screen. Push the migration and deploy `photo-save` after the merge.
2. **PR 2, the tech's press** (M): the press on Tally's three tabs, the sheet, the outbox kind, My
   tickets, the guide.
3. **PR 3, the match and the office** (M): the match written when a charge reaches the feed and on
   a Yes; the Team day card's ticket, its first choice, its question and *+ Ticket*; the ticket
   window; the Tickets list with the disagreement; the tech's settled purchase (*Sort to JP1042*,
   *+ ticket*).
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
