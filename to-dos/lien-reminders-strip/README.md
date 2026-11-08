---
name: "Lien desk: a REMINDERS strip between Notices and Affidavits"
number: 262
group: waiting
status: drawn 2026-11-04 from Grace's ask the same day (card #7036) · built the same day as v2.6515 on the recommended defaults · the pressed step's Showing line (v2.6522) gave way to the step brief and the sort under punch list #274 (v2.6574 → v2.6611: one courtesy, the attorney's letter's name, the dated timeline, the partial-payment pause) · left: the owner's five calls below, then this folder goes or its open rows move to #235
summary: >
  On the Lien desk's Do now the sent notices that want a reminder sit in Needs you now beside the
  leader's approvals and the affidavits: seven rows reading "day 21 · nothing since the packet ·
  Send a courtesy notice" on 2026-11-04. The desk already draws a strip of four steps for notices,
  affidavits and retainage. The proposal is a fourth strip, REMINDERS, between NOTICES and
  AFFIDAVITS in the same shape: 1 Reminder due, 2 Reminder sent, 3 Letter two, 4 Closed, each with
  its count, a press on a step listing its rows, and the courtesy rows moved out of Needs you now
  into a Reminders group of their own. Nothing new is sent, written or decided: the strip reads
  the courtesy status and letter two's clock the desk already holds. It is the small version of
  #235's reminders zone.
next: The owner reads the five calls and says which recommendation stands. Each one that changes is a small PR on the kernel; none needs a migration.
size: XS per call that changes
blocker: The owner's word on the five calls. The strip is live meanwhile.
ver: v2.6515
opinion: build — the rows are mixed with approvals today and every count already exists on the desk, so the strip is mostly reading
---

# Lien desk: a REMINDERS strip between Notices and Affidavits (#262)

## The ask

Grace, 2026-11-04, with a screenshot of Do now at desktop width and the gap between the NOTICES
strip and the AFFIDAVITS strip boxed in red: *"in the lien desk think that we could add the
reminders section in between these two sections where someone has gotten a notice but since they
did not respond we think we should send them a reminder"*.

## What exists today

- **Do now** (punch list #82, v2.4588) opens the desk on one list in deadline order. Above the rows
  a rail per kind of paper draws four steps with a count each (v2.4631): NOTICES *Find the owner ·
  Draft notice · Approve · Send the run*, AFFIDAVITS *Fix the property · Draft affidavit · Approve ·
  File it*, RETAINAGE the notice's four again. A press on a step narrows the list to the rows on
  that step; a press again shows every row. Every row wears four dots and a fraction, and a card on
  the dots writes the ladder out.
- **The courtesy notice** (#231, live since 2026-11-01) is one press on a sent § 53.056 notice from
  day 7: *Send a courtesy notice*, an email and a text in plain words, recorded in the sent item's
  `fields.courtesy[]`. `courtesyStatus` (`lienCourtesyNotice.ts`) owns every rule of when it may
  go: waiting before day 7, due from day 7, sent for a week after a press, held when the lien cannot
  go on or the affidavit is inside a week, closed on a payment, the GC's written okay, the owner's
  call, the filed affidavit or a reply.
- **Letter two** (`lienLetterTwo.ts`) is counsel's certified second letter from day 10, overdue
  from day 14, drafted onto the job as a second notice item and run like any notice; the owner's
  call closes it (v2.6383).
- On Do now a sent notice shows one row: the courtesy press while none has gone (even past day
  10), else letter two's press with the courtesy's state in its words. The row has no deadline of
  its own, so it sorts after the dated rows; it is red when letter two is overdue, which puts it in
  **Needs you now** beside the affidavits and, for the office, beside what waits on the leader.
  A sent notice before day 7, one whose courtesy went this week, one whose letter two is drafting
  and one that is closed have no row at all. On 2026-11-04 seven courtesy rows sit at day 21 to 29
  in Needs you now.
- **#235** (the lien month) proposes five zones across the top of the desk by the office rhythm,
  reminders first. The owner called it a great idea that needs more refinement. Nothing is built.
- **#249** lists the courtesy notice's loose ends; its row 3 says a reply never closes the
  courtesy because nothing reads Messages lines after the last send.

## The proposal

One strip, in `mockup.html` beside this card, drawn as *My suggestion* beside *Now* at 1,400 and
375 wide, light and dark.

**The strip.** A fourth rail, REMINDERS, between NOTICES and AFFIDAVITS, in the same shape and
numbering: a circled 1 to 4, a name, a count, violet (`--text-violet-700` / `--bg-violet-tint`)
between the blue of notices and the red of affidavits. It shows only when a sent notice stands on
it, as the affidavit and retainage rails do.

| Step | Counts | The row's press today |
|---|---|---|
| 1 Reminder due | sent notices from day 7 with nothing since the packet; the ones before day 7 read beside the count as *· 2 before day 7* | *Send a courtesy notice* |
| 2 Reminder sent | the courtesy went: this week (waiting), or a week ago with nothing since (never a second courtesy since v2.6594 — the attorney's letter leads); since v2.6611 also *paying it down* after a partial payment | *Send the attorney’s letter* after the week (*Send letter two* until v2.6591), or *Record what they promised* while paying (v2.6611) |
| 3 Letter two | letter two due while the courtesy is held (no reminder may go, counsel's letter still does), or a letter two drafting, awaiting the leader, in the run, held, or sent | *Send letter two*, the letter two's own row on the NOTICES rail, or the notice under Sent |
| 4 Closed | paid, the GC authorized direct pay, the owner called, they answered, the affidavit is filed, or no reminder may go (held) | the notice under Sent |

**The press.** A step's press narrows the list to its rows as the other rails do. The rows a step
has that are not on Do now today (before day 7, sent this week, letter two drafting or sent,
closed) list under the rail when the step is pressed, each a door to the notice under Sent, so
every name behind a count can be seen.

**The group.** The courtesy and letter-two rows leave Needs you now for a group of their own,
**Reminders · N**, between Needs you now and Coming up, so the red group holds dated work and the
leader's list holds approvals. The rows keep their words and their presses.

**The dots.** A courtesy or letter-two row's four dots read on the REMINDERS ladder (1/4, 2/4) in
violet instead of the dash they wear today; the card on the dots writes the four steps out. On a
phone the four tiles read *Due · Sent · Letter two · Closed*.

**What it never does.** Send, write or close anything. The strip has no rule of its own: a row
stands where `courtesyStatus` and `letterTwoStatus` put it.

## What changes underneath

1. **The kernel**, `src/lib/jobs/lienReminders.ts` (11 tests): `lienReminderAt` reads one
   job's rung from its courtesy status and letter two's clock; `buildLienReminders` adds the desk's
   jobs up per rung with the names behind each and the uncounted ones before day 7;
   `lienReminderLadderItems` writes a row's ladder out for the card.
2. **`lienNextUp.ts`**: a courtesy or letter-two row carries its rung (`reminder`), read from the
   two statuses the list already holds; no rule of when a row appears changes.
3. **`lienNextUpSteps.ts`**: a fourth ladder, `reminder`, in the rail's list between notice and
   affidavit; `lienStepOfRow` puts the two actions on it; the counts for it are handed in from the
   kernel as the run count is; the card and the tiles take their words from the kernel.
4. **`groupLienNextUp`**: the Reminders group.
5. **`LienDeskSteps.tsx` / `LienDeskNextUp.tsx`**: the violet tone, the step's list under the rail,
   the group's heading.
6. **`LienDeskModal.tsx`**: builds the kernel's result from `courtesyByJob` and `letterTwoByJob`
   and hands it down. Nothing read, nothing written.

## Critique

- **Four steps for a thing that is mostly one press.** Steps 3 and 4 hold no press of their own on
  Do now; they are counts with names. That is the point of a ladder: the office sees that twelve
  notices are closed and two are at letter two without opening All filings. The other rails have
  the same shape, and a strip with two rungs would not read as one of them.
- **Closed is wide.** Paid, the owner's call, the GC's okay, a reply, the filed affidavit and a
  held courtesy all land on step 4. The row's words name which. A fifth count for held would make
  the rail wider than its neighbours; held is "no reminder may go", which is closed for this
  ladder's purpose. The homestead case is the one that reads oddly as closed, and it is rare.
- **The group moves rows the office is used to seeing in red.** A courtesy row at day 21 with
  letter two overdue was red in Needs you now; it is now in the Reminders group with the same red
  words. The step's count on the rail is the signal. If the office misses it, the group's heading
  can carry the overdue count in red.
- **Two reminders in one strip.** Step 2 counts a courtesy sent this week together with one a week
  old whose next press is letter two. The row's words tell them apart, and letter two's own count on
  step 3 says how many went on to it. A sixth state would be more exact and harder to read.
- **A sent notice before day 7 has no row today and is not counted on step 1.** The rail says *· 2
  before day 7* beside the count so the office knows they are coming; counting them would make the
  count a lie about what can be pressed.
- **The in-flight letter two is on two rails.** Its row is on NOTICES (draft, approve, run) and its
  job is on REMINDERS step 3. Pressing step 3 lights nothing on the list and names the job under
  the rail with a door to its notice. That is honest: the press is the notice's.

## Open calls for the owner, with a recommendation each

1. **When step 1 opens: day 7 after the packet, or #235's reminders week.** Recommended: day 7,
   today's rule, since the strip only reads `courtesyStatus` and #235 moves that clock when the
   owner refines the days. The strip then reads the new clock with no change of its own.
2. **A reply from the GC or the owner in Messages moves the row to Closed.** Recommended: not
   yet. `courtesyStatus` already closes on a reply when one is handed to it, but nothing reads the
   Messages lines after the last send (#249 row 3). When that reader lands the row closes by
   itself; until then the owner's call, recorded on the footer, is the door.
3. **The strip counts affidavits' reminders too.** Recommended: no. The affidavit has no reminder;
   § 53.055 wants its copies served within five days of filing, and that is a step on the
   AFFIDAVITS rail, not a courtesy. Retainage notices (§ 53.057) have no courtesy press either. The
   strip is the § 53.056 notice's.
4. **Where the courtesy rows go when no step is pressed.** Recommended: a Reminders group of their
   own below Needs you now, as drawn. The alternative, leaving them in Needs you now, keeps the
   mix Grace asked to end.
5. **Who the leader's *you* goes on.** Recommended: step 3, since the leader approves letter two
   as he approves any notice; the other three are the office's.

## PRs

| PR | What | Size |
|---|---|---|
| card | this card and the mock-up | XS · #7036 |
| 1 | the strip on Do now with its counts, the step's list, the Reminders group, the dots and tiles, the smoke at 1,400 and 375, the guide, the map | S · v2.6515 |
| 2 | the *Showing N · step* line under a pressed rung with **Show all**, the rung's rule under the rail, the guide `read-the-reminders-ladder-on-the-lien-desk` (Grace's screenshot of eight pale rows) | XS · v2.6522 |
| — | the Showing line and the fade gave way to a pressed step's brief and the sort (punch list #274: v2.6574, v2.6577, v2.6594), the picked notice's timeline (v2.6596) and the partial-payment pause (v2.6611); the strip itself is unchanged | shipped under #274 |

## How to verify

Open the Lien desk as the dev on the dev server (`/dev-login?as=1&to=/jobs?tab=stages&liendesk=1`).
Do now draws REMINDERS between NOTICES and AFFIDAVITS with four counts; the sum of steps 1 and 2 is
the number of courtesy and letter-two rows in the Reminders group below. Press step 1: its brief opens under
the rails and the group's rows lead under *On this step* (since v2.6574; until then the rest dimmed), with any
notice before day 7 inside the brief as *Also on this step, with no row on the list*. Press step 4: the closed
notices read inside the brief the same way, each opening its notice under Sent. At 375 the strip stacks as
the other rails do and the group's rows are cards. Nothing is sent; every press lands on a screen
that exists today. The desk reads real rows read-only; a ZZ Test lien row is made only when a step
has nothing to show, and deleted after.

## Related

- #235 `to-dos/lien-month-rhythm/README.md` — the fuller version: five zones by the office rhythm,
  reminders week first. This strip is one step toward it and reads whatever clock #235 sets.
- #249 `to-dos/lien-courtesy-loose-ends.md` — row 3, the reply that never closes it.
- #248 `to-dos/lien-sent-pile-hides-next-months.md` — the sent pile's rule; untouched here.
- #231 `to-dos/lien-courtesy-notice/README.md` — the press this strip counts.
