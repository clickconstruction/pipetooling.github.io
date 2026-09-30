---
title: align unmarked hours with jobs in one pass
category: Office
roles: dev, master_technician, assistant, controller
keywords: align hours, unmarked, unassigned, clock session, no job, assign job, schedule, split, hours grid, people hours
order: 59
---
When someone clocks in and only types what they are working on, their hours land as **unmarked**. The time is counted, but no job gets the labor.

Unmarked means they picked no job or bid. **Align hours** collects every unmarked session in the week. You link them all in one pass, instead of opening each day one at a time.

## Opening Align hours

Go to **People → Hours**. At the top of the **Hours grid** section, next to the section toggle, click:

:::example Hours grid header
{{button:outline|Align hours (7)}}
:::

The number is how many closed sessions in the current week range have no job or bid. The button is grayed out when there is nothing to align.

## Aligning a session

Each row shows the person, their clock-in and clock-out times and hours, and what they typed at clock-in. Quick actions follow:

- **Scheduled job chips** are the jobs that person was scheduled on that day, from Dispatch. One click links the session to that job. Hover a chip to see the scheduled time windows.
- {{button:outline|Split by schedule %}} shows when they were scheduled on two or more jobs. It splits the session across those jobs in proportion to the scheduled time. That is the same as Apply Schedule % on the clock strip.
- **recent:** chips appear when nothing was scheduled. They are the person's most recently worked jobs and bids from the same week.
- {{button:blue|Assign}} searches for any other job or bid.
- {{button:outline|Day editor}} opens the My Time day editor for that person and day. Use it for anything that needs time changes or a custom split.

Aligned rows turn green and show what they were linked to. {{button:outline|Undo}} is there in case you clicked the wrong chip. Splits cannot be undone here. Use the day editor if a split needs to change.

## Approved sessions

Sessions that were already approved stay in the list, marked with an **approved** chip. Linking one to a job keeps its approval. **Splitting** an approved session removes those hours from payroll until a lead re-approves the new segments. The app asks you to confirm first.

:::example
Marcus clocked 8.6 hours with the note "finishing top out at the riverside house" but never picked the job. In Align hours, his row shows the two jobs he was scheduled on that day. One click on the Riverside chip and his hours are on the job — on to the next row.
:::

The modal is the pop-up window. When you close it, the Hours grid and session lists refresh with everything you aligned.
