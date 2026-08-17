---
title: follow up on quiet jobs
category: Jobs & Scheduling
roles: assistant, controller, master_technician
keywords: follow up, follow-ups, quiet jobs, stale jobs, review, deck, snooze, looks fine, pipeline
---
Jobs stop falling through the cracks when the app builds the list for you. The **Follow-ups** button on Jobs → Pipeline deals you every open job that's been **quiet too long for its stage** — no notes, no work, no billing movement — one card at a time, stalest first.

The **Dashboard** keeps score too: when jobs are waiting, an amber card counts them ("37 billed with no nudge · 11 working with no recent notes") and {{button:blue|Start review →}} drops you straight into the deck. When the queue is empty, the card disappears.

Prefer to see everything at once? The **Deck | List** toggle at the top switches to the whole queue as a table — quietest first, each row with a color-coded days badge ({{chip:red|21d}} means two weeks or more), the reason it needs eyes, and its stage. Click {{button:outline|Review →}} on any row and the deck opens on exactly that job — triage the list, then work the cards.

## Working the deck

Each card is one job: its number, stage, and an amber {{chip:yellow|quiet 9 days}} chip, the street view with the address (click it for the full Street View), a *Why it's here* line, the money picture, and the last few notes from its activity thread. Tap that **Latest activity** box (the ↗ in its corner) and the job's full activity view opens over the deck — the complete thread with notes, reports, status history, and crew, plus the note composer; close it and the deck is right where you left it.

The note box is already focused. You have three ways to move on:

- **Type a note and press Enter** — it posts to the job's real activity thread with your name (the same thread the field sees) and the next card appears.
- {{button:outline|✓ Looks fine}} — nothing to say, but you looked. The job rests for a few days and leaves the queue without cluttering the thread.
- {{button:outline|Snooze ▾}} — waiting on a customer? Park the job for 3 days, a week, or two weeks.

**Open job ↗** pops the full Job window if the card needs real work, and the stage chips at the top narrow the deck to just Billed, just Working, and so on. Delete a job from that window (or migrate it to a bid) and its card leaves the deck immediately — the next card deals in.

At the bottom of every card sits the job's **Pipeline row** — the same row you'd see on the Pipeline board, with all of its buttons live and a stage chip ({{chip:red|Billed Awaiting Payment}}, {{chip:blue|Working}}, …) naming exactly which section of the board it came from. Click that label and you jump to the row on the Pipeline board itself — section opened, row flashed so your eye lands on it. Under the row, a **Line items** footer lists the job's Bill-tab items with amounts and the Job total; if they don't add up to the bid, an amber note says how much isn't itemized yet, and an empty bill offers **Add line items ↗** straight into the Bill tab. You can nudge the % done, {{button:blue|Ready to Bill}} a finished job, {{button:outline|Mark Paid}} a billed one, or open {{button:outline|Edit}} without ever leaving the deck; when you're done, the deck is right where you left it.

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

## Seeing who reviewed what

The **History** view (next to Deck and List) is the paper trail: every {{chip:green|✓ Looks fine}} and snooze, newest first, with the time, who did it, and which job. Snoozes show their wake-up date. Notes aren't repeated here — they live on each job's activity thread, where the field can see them too.
