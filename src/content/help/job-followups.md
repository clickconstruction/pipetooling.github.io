---
title: follow up on quiet jobs
category: Jobs & Scheduling
roles: assistant, controller, master_technician
keywords: follow up, follow-ups, quiet jobs, stale jobs, review, deck, snooze, looks fine, pipeline
---
Jobs stop falling through the cracks when the app builds the list for you. The **Follow-ups** button on Jobs → Pipeline deals you every open job that's been **quiet too long for its stage** — no notes, no work, no billing movement — one card at a time, stalest first.

The **Dashboard** keeps score too: when jobs are waiting, an amber card counts them ("37 billed with no nudge · 11 working with no recent notes") and {{button:blue|Start review →}} drops you straight into the deck. When the queue is empty, the card disappears.

## Working the deck

Each card is one job: its number, stage, and an amber {{chip:yellow|quiet 9 days}} chip, the street view with the address (click it for the full Street View), a *Why it's here* line, the money picture, and the last few notes from its activity thread.

The note box is already focused. You have three ways to move on:

- **Type a note and press Enter** — it posts to the job's real activity thread with your name (the same thread the field sees) and the next card appears.
- {{button:outline|✓ Looks fine}} — nothing to say, but you looked. The job rests for a few days and leaves the queue without cluttering the thread.
- {{button:outline|Snooze ▾}} — waiting on a customer? Park the job for 3 days, a week, or two weeks.

**Open job ↗** pops the full Job window if the card needs real work, and the stage chips at the top narrow the deck to just Billed, just Working, and so on.

:::example A two-minute morning
34 cards → 12 got a quick note, 18 got ✓ Looks fine, 4 got snoozed. Every open job has now been seen by a human this week.
:::

## Setting the review periods

The **⚙ Review periods** button on the deck opens the rules — how many quiet days each stage gets before it needs eyes:

- **Working** — quiet longer than 5 days
- **Waiting** — nothing scheduled for 7 days (a job with a future visit on the schedule never nags)
- **Ready to Bill** — invoice not sent for 2 days
- **Billed Awaiting Payment** — no nudge for 7 days
- **Collections** — no activity for 3 days
- and how long **✓ Looks fine** rests a job (3 days)

The numbers are org-wide — one queue, one definition of "too quiet" for the whole office. Master and dev can change them; changes take effect immediately.
