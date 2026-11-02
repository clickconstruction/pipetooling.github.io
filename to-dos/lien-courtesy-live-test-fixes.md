---
name: "Lien desk: two fixes the courtesy notice's live test found"
number: 243
group: ready
status: found 2026-11-01 in the courtesy notice's live test (#231) · confirmed in code 2026-11-02 · PR 1 built 2026-11-02, v2.6340 · PR 2 built 2026-11-02, v2.6341 (#6800) · left: the data fix on three live items, on the owner's word
summary: >
  The session that built the courtesy notice (#231) found two defects during its live test. Opening
  the courtesy send window makes the GC a Messages contact before anything is sent, so a window
  opened and cancelled leaves a stray contact behind. A § 53.056 notice recorded by hand is marked
  sent on the day it is entered, not the mailing day the office typed, so letter two and the
  courtesy notice start their clocks late. Three live desk items read 14 days short today.
next: >
  Once #6800 is deployed, the owner runs the guarded statement under *The data fix* once, and the
  three live items read 2026-09-22. Then this card goes.
size: S (two PRs, XS and S; no migration expected)
blocker: None for the code, which is built. The data fix on three live items waits on the owner's word.
ver: v2.3770 · 6259 · 6261 · 6269 · 6271 · 6340 · 6341
opinion: build — both are small, and both fix what the office reads, a stray contact in Messages and lien clocks that read short
mockup: not required — no new screen; the fixes remove a stray contact and correct a day count
---

# Lien desk: two fixes the courtesy notice's live test found (#243)

## The ask

The owner, 2026-11-02, verbatim: *"please add the lien follow up card to the punchlist"*.

The session that built the courtesy notice (#231, v2.6259 to v2.6271) found both defects on 2026-11-01. It found them while it tested the live desk with ZZ Test rows. Each was first written up as a session to start. This card holds both.

## 1. The send window makes a contact before anything is sent

**What happens.** Opening *Send a courtesy notice* loads its recipients through `loadCourtesyRecipients` in `src/lib/jobs/lienCourtesyIo.ts`. For the GC it calls `contactForCustomer` from `src/lib/messages/messagesIo.ts`, which makes the GC a Messages contact when there is none. That call runs when the window opens, before any press. So a window opened and cancelled leaves a new contact behind, and so does a send by email alone.

The live test left two such contacts. Both are unnamed *ZZ Test Builder Co* contacts, each with one email channel and no messages. The owner has the one line that deletes them.

**The fix.** When the window opens, read the GC's contact and phone without making anything. Make the contact at the press, and only when a text goes. `quo-send` needs a contact and its phone channel. The email through `send-lien-filing-email` needs neither. A GC with a phone on the customer record but no contact yet must still get the text. So the window reads that phone for its plan, and the press makes the contact before it sends. Check what `contact_for_customer` copies from the customer record, so the plan shows a text as going exactly when it will.

**Done looks like this.** Opening and cancelling the window makes no contact. A send by email alone makes none. A send with a text makes the contact, and the text lands in Messages as it does today.

## 2. A notice recorded by hand starts its clocks on the day it is entered

**What happens.** The by-hand door, *Already mailed? Record it…* (#35, v2.3770), writes one `job_lien_filings` row per covered job. The typed mailing day lives only inside each send, as `sends[].sent_on` (`byHandSends` in `src/lib/jobs/lienNoticeByHand.ts`). Then `recordLienNoticeByHand` in `lienNoticeByHandIo.ts` marks each covered desk item sent through `markLienDeskItemSent` in `lienDeskIo.ts`. That update sets `status` and `sent_filing_id` but no `sent_at`. The trigger on `job_lien_desk_items` fills a missing `sent_at` with `now()`. Its latest copy is in `supabase/migrations/20261023150000_lien_sign_code.sql`. Letter two's clock reads that stamp, through `firstSentAt` into `letterTwoClock` in `lienLetterTwo.ts`. The courtesy notice's day 7 uses the same clock.

**On prod, 2026-11-02.** Four live notices were recorded by hand. All four were mailed 2026-09-22 and recorded 2026-10-06. Three of them, one packet under one tracking number, marked a desk item sent. They match the Lenox paper in #35. Those three items read 2026-10-06, so their clocks read 14 days short. All three are past day 14 either way, so no press is hidden today. Every day count on them is still wrong.

**The fix.** Give `sent_at` the typed day when the by-hand door marks an item sent. The trigger keeps a value it is given. Store it as noon in the app's time zone, so `calendarYmdInAppTz` reads the typed day back. Check the other doors that mark an item sent after the fact. One is `syncLienDeskAfterRecord`, the path when a job has no live item. Another is the Lien window's *Save & record sends…* step. Then check every reader of `sent_at`: letter two, the courtesy notice, Do now (`lienNextUp.ts`), the stop windows on the job's Lien window (`lienTimelineDesk.ts`) and the desk footer.

**Then the data fix.** Set the three items' `sent_at` to their typed day, 2026-09-22, in one guarded line the owner runs. It waits on the owner's word. Change no other row.

**Done looks like this.** A notice recorded with a mailing day ten days back reads day 10 on every clock. The three live items read 2026-09-22.

## The plan

| PR | What | Size |
|---|---|---|
| 1 | The courtesy window reads the GC's contact without making one, and the press makes it only when a text goes. A test opens and cancels the window and finds no new contact. | XS |
| 2 | The by-hand door gives `sent_at` the typed day, and the other doors that mark an item sent after the fact are checked. A test records a notice ten days back and reads day 10 on every clock. | S |
| After | The three live items get their typed day, in one line the owner runs once the owner says so. | — |

Each PR follows CLAUDE.md: `npm run claim` for the version, a release note and its fragment, and `gh pr merge --auto`. No migration was needed: `sent_at` is an ordinary column the office's update policy covers, and the trigger keeps a value it is given.

## Where it stands (2026-11-02)

- **PR 1, v2.6340 (#6788).** The window reads the GC's own contact, or the number and address on their record when there is none, and makes nothing. The press makes the contact through `contact_for_customer`, only when a text goes, and texts the channel on it. A refusal or a contact with no number is the text's reason, and the email still goes. Kernel `lienCourtesyContact.ts`; tests on the kernel and the IO.
- **PR 2, v2.6341 (#6800).** `markLienDeskItemSent` takes the day it went. The by-hand door passes the typed day as noon in the app's calendar when it is before today, and so do the Lien window's *Save & record sends…* path and a run recorded in a later sitting, each from the filing's `sends[].sent_on`. A notice recorded the day it goes out keeps the trigger's stamp. Kernel `lienSentAt.ts`; tests on the kernel, the by-hand IO and the run.
- **The data fix** below waits on the owner.

## The data fix

The three live items were mailed 2026-09-22 and recorded 2026-10-06, each on a filing recorded by hand. Run the read first and expect three rows, then the one update. Both name no customer and touch only an item whose by-hand filing says 2026-09-22 and whose stamp reads 2026-10-06. Nothing else moves. Run them in the dashboard's SQL editor as data, not DDL, after PR 2 is deployed.

```sql
-- Read first: expect 3 rows.
SELECT i.id, i.sent_at, f.sends -> 0 ->> 'sent_on' AS typed_day
FROM public.job_lien_desk_items i
JOIN public.job_lien_filings f ON f.id = i.sent_filing_id
WHERE i.kind = 'notice_53_056' AND i.status = 'sent' AND i.voided_at IS NULL
  AND f.by_hand AND f.voided_at IS NULL
  AND f.sends -> 0 ->> 'sent_on' = '2026-09-22'
  AND (i.sent_at AT TIME ZONE 'America/Chicago')::date = '2026-10-06';

-- Then the one line: noon on the mailing day in the app's calendar, 3 rows.
UPDATE public.job_lien_desk_items i
SET sent_at = ('2026-09-22 12:00'::timestamp AT TIME ZONE 'America/Chicago')
FROM public.job_lien_filings f
WHERE f.id = i.sent_filing_id
  AND i.kind = 'notice_53_056' AND i.status = 'sent' AND i.voided_at IS NULL
  AND f.by_hand AND f.voided_at IS NULL
  AND f.sends -> 0 ->> 'sent_on' = '2026-09-22'
  AND (i.sent_at AT TIME ZONE 'America/Chicago')::date = '2026-10-06';
```

Afterwards the desk's Sent footer on each reads *Sent Sep 22* and the day count moves 14 days forward.

## How to verify

1. Use ZZ Test rows only, and delete them before the session ends. Send nothing real.
2. **PR 1.** On a ZZ Test job whose GC has no Messages contact, open *Send a courtesy notice* and cancel it. The customer still has no contact. Send by email alone to a ZZ address, and there is still no contact. With a test phone on the customer and Send texts on, send again. The contact is made and the text shows in Messages.
3. **PR 2.** Record a ZZ Test notice by hand with a mailing day ten days back. The desk footer reads day 10, letter two is due, and the courtesy press shows. The item's `sent_at` reads the typed day.
