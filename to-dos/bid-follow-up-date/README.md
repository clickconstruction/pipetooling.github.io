---
name: "Call again on a date: follow-up dates for bids"
number: 80
group: ready
status: building on claude/bid-next-followup-* · PR 1 of 5 (the database) is v2.4419
summary: >
  A GC says "next budget year, call us in January". The Call queue could only bring a bid back
  every seven days, and nothing held the date or who to ask for. Now a contact can say when to
  call again, who to ask for and what the bid waits on. The queue sorts by what is due, and the
  date shows on the Dashboard, the Calendar and the phone on the day.
next: PR 2, the Call queue asks "Call again" and sorts by what is due.
size: M — five small PRs
blocker: none
ver: v2.4419
opinion: do — the owner approved the mock-up and the re-sort on 2026-10-02
---

# Call again on a date: follow-up dates for bids

## The ask, in the owner's words

> The city of Seguin thinks they want to do it next year. I think we need to contact them in
> January (specifically Councilman Joe Raya). I would like to come up with a way to set the date
> we should follow back up, but this needs to be explored across the app.

On the mock-up ([before-after.html](before-after.html)): *"I like your proposal, the queue can
re-sort"* and *"please build it all testing along the way"* (2026-10-02).

## The decision

One idea: **every open bid has a next date**. It is said in the tap you already make after a
call, and it rides the contact log entry, so the history is the log.

- **Call again**: Next week, 2 weeks, Next month, 3 months, or a picked day. No pick means the
  bid comes back in seven days, as it always did.
- **Ask for**: a person already on the customer, or a new one added to the customer for good.
- **Waiting on**: Their budget, Owner deciding, Not awarded yet, Other.
- **The queue sorts by what is due**: Due, Overdue, No date yet, Later. A year of silence no
  longer outranks a call promised for today.
- **A picked date is a promise**: only picked dates reach the Dashboard, the Calendar and the
  phone. The seven-day default only orders the queue.
- **One date per bid**, not per GC. A bid sent to two GCs shares its date; the person shows on
  the GC they belong to.
- **The builder's date still counts.** The call window already saves a next follow-up per
  builder, which the queue ignored. A bid with no date of its own takes its builder's.
- **When a date is spent.** A date holds until a contact is logged on or after it. An earlier
  contact that names no new date leaves it alone: a call in November does not erase January 5.
- **Who is told on the day**: the bid's account manager, else its estimator.

Rejected: a separate "Follow up on" record with its own button and history (a second idea beside
the seven-day rule, and a second place to look); "on hold" as a special state.

## Where it plugs in

| Piece | Where |
|---|---|
| The date in the log | `bids_submission_entries.next_followup_on`, `…_contact_person_id`, `…_reason`, `…_cleared` |
| The bid's roll-up | `bids.next_followup_on`, `…_contact_person_id`, `…_reason`, `…_entry_id`, kept by trigger `sync_next_followup_from_entries` |
| The builder's date | `customer_followup_prefs.next_followup_at` (exists; written by `BuilderCallSessionModal`) |
| The queue | `src/lib/bids/callQueue.ts`, `src/lib/bidPendingChase.ts`, `BidsCallQueueTab.tsx` |
| People on a customer | `customer_contact_persons` |

## The plan

1. **The database** (v2.4419): the columns, the trigger, `npm run test:pg:bid-next-followup`. **This PR.**
2. **The Call queue**: the three questions under Left message, Still pending and Rebid / RFQ; Due,
   Overdue, No date yet and Later; the due card with who to ask for and what they said last time;
   *change date* on a Later row.
3. **The rest of Bids**: the chip on the Bid Board row and the By builder card; the field beside
   Log contact in Edit Bid.
4. **Dashboard and Calendar**: a Needs You item for picked dates due or overdue; a chip on the day.
5. **The phone**: a notification on the morning of the date to the account manager.

## How to verify

- `npm run test:pg:bid-next-followup` for the trigger (22 checks, a throwaway copy of the schema).
- Live: BP398 *ZZ Test* is the safe bid. Log a contact with a date, read the queue, change the
  date, then delete the test entries from the bid's contact log.
