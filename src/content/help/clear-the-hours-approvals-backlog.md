---
title: clear the hours approvals backlog
category: Office
roles: dev, master_technician, assistant, controller
keywords: approvals, pending hours, clock sessions, approve all, backlog, all weeks, payroll, needs you, long day, near-zero, no job, reject, edit session
order: 68
---
Every clock session, one punch in and out, waits for someone to approve it. Until then the hours do not count for payroll, the Hours grid or the Overhead numbers.

The Hours tab shows one week at a time. When approvals slip for a while, the older weeks quietly fall out of view. The **Hours approvals** queue is the fix. It is one list of every pending session, no matter how old. It is grouped so you can clear a person or a week in a tap.

## Where it is

- The Dashboard's **Needs you** card grows a {{chip:yellow|Time approvals}} item. It appears once the oldest unapproved session is three or more days old. {{button:amber|Open approvals}} lands you in the queue.
- On **People → Hours**, the header's {{button:outline-amber|Approvals}} button opens it any time. The button shows a count when anything is waiting.
- The amber *not yet in payroll* banner sits above the Hours grid. It has an {{button:outline-amber|All weeks}} button beside {{button:amber|Review & approve}}. The banner itself only knows about the week on screen. When older weeks are still waiting, it says so at the end: **+16 sessions in earlier weeks**. That text is a link into the queue.
- In both Review & approve and the queue, a row can wear one of two notes. *salary — counts as flat hours* means payroll credits the person's flat day, not the session length. *still clocked in at midnight* means the system closed the session at 11:59 PM. Check the real end time with Edit before approving that one.

## Reading the queue

The top line is the whole pile. It shows sessions, people and hours not yet in payroll. It shows how old the oldest one is. It shows how many sessions carry a flag.

:::example The top line after a three-week stall
**120** sessions · **12** people · **622h** not yet in payroll · oldest 122 days ago · ⚠ 3 long days · 4 near-zero
:::

People are listed **oldest stall first**. Whoever has the furthest-back pending day leads. So the thing the Needs you card was nagging about is at the top. Each person shows their sessions, hours, how many weeks are involved, and their oldest pending day. Open a person to see one row per **week**. Open a week to see the sessions themselves. Each session shows the day, clock-in and clock-out, hours, the job or bid, and the note they typed.

## The three flags

A flag never blocks anything. It says "look before you approve this one":

- {{chip:yellow|⚠ long day}} means the session is longer than 12 hours. A forgotten clock-out looks exactly like a long day. **Edit** fixes the times.
- {{chip:yellow|⚠ near-zero}} means the session is under a minute. Almost always a double-tap on the clock button. **Reject** it, or Edit if it was real. Zero-length sessions can't be approved at all. The approve step skips them and tells you so.
- {{chip:yellow|⚠ no job}} means no job or bid is on the session. Approving still pays the hours, but no job carries the labor. Use the {{button:outline|Assign}} control on the row to put it somewhere first.

Tick **Flagged only** to see nothing but the flagged sessions. The big green button becomes **Approve flagged**. That is handy for a second pass after you've cleared the ordinary ones.

{{button:outline|Expand all}} opens every person and every week at once. You can read the sessions straight down. It turns into {{button:outline|Collapse all}} to fold them back. From People → Users, tapping a person's clock cell opens this window already pinned to them.

## Approving

Every Approve button says what it's about to do. It shows the count and the hours:

- {{button:green|Approve}} on a session row approves that one session, no confirmation.
- {{button:green|Approve week · 9}} approves every session in that person's week after a confirm.
- {{button:green|Approve all 23 · 137h}} on a person's header approves everything they have waiting, all weeks, after a confirm.
- {{button:green|Approve everything · 120 · 622h}} at the top clears the entire queue after a confirm.

Approved sessions leave the list right away. The hours land in payroll behind them. {{button:red|Reject}} sends a session back for good. Rejected time never reaches payroll. {{button:outline|Edit}} opens the full session editor when the times or the split need fixing. The queue refreshes when you save.

:::example Salaried schedule time never shows here
Sessions the system creates from a salary schedule approve themselves within the hour. Only real punches wait in this queue.
:::

If you have payroll access, approving raises a green chip at the top of the Hours tab. It reads **Draft payroll for <week> →**. It opens Draft Payroll on that pay week. See [run the pay week from Hours to Tally](?g=run-the-pay-week).
