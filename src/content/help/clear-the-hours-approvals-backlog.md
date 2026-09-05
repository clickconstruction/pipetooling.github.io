---
title: clear the hours approvals backlog
category: Office
roles: dev, master_technician, assistant, controller
keywords: approvals, pending hours, clock sessions, approve all, backlog, all weeks, payroll, needs you, long day, near-zero, no job, reject, edit session
order: 68
---
Every clock session someone punches waits for a person to approve it before the hours count for payroll, the Hours grid, and the Overhead numbers. The Hours tab shows one week at a time, so when approvals slip for a while the older weeks quietly fall out of view. The **Hours approvals** queue is the fix: one list of every pending session, no matter how old, grouped so you can clear a person or a week in a tap.

## Where it is

- The Dashboard's **Needs you** card grows a {{chip:yellow|Time approvals}} item once the oldest unapproved session is three or more days old. {{button:amber|Open approvals}} lands you in the queue.
- On **People → Hours**, the header's {{button:outline-amber|Approvals}} button (with a count when anything is waiting) opens it any time.
- The amber "not yet in payroll" banner above the Hours grid has an {{button:outline-amber|All weeks}} button beside {{button:amber|Review & approve}} — the banner itself only knows about the week on screen. When older weeks are still waiting it says so at the end — **+16 sessions in earlier weeks** — and that text is a link into the queue.
- In both Review & approve and the queue, a row can wear **salary — counts as flat hours** (payroll credits the person's flat day, not the session length) or **still clocked in at midnight** (the system closed the session at 11:59 PM — check the real end time with Edit before approving).

## Reading the queue

The top line is the whole pile: sessions, people, hours not yet in payroll, how old the oldest one is, and how many sessions carry a flag.

:::example The top line after a three-week stall
**120** sessions · **12** people · **622h** not yet in payroll · oldest 122 days ago · ⚠ 3 long days · 4 near-zero
:::

People are listed **oldest stall first** — whoever has the furthest-back pending day leads, so the thing the Needs you card was nagging about is at the top. Each person shows their sessions, hours, how many weeks are involved, and their oldest pending day. Open a person to see one row per **week**; open a week to see the sessions themselves — day, clock-in and clock-out, hours, the job or bid, and the note they typed.

## The three flags

A flag never blocks anything. It says "look before you approve this one":

- {{chip:yellow|⚠ long day}} — longer than 12 hours. A forgotten clock-out looks exactly like a long day; **Edit** fixes the times.
- {{chip:yellow|⚠ near-zero}} — under a minute. Almost always a double-tap on the clock button. **Reject** it, or Edit if it was real. (Zero-length sessions can't be approved at all — the approve step skips them and tells you so.)
- {{chip:yellow|⚠ no job}} — no job or bid on the session. Approving still pays the hours, but no job carries the labor. Use the {{button:outline|Assign}} control on the row to put it somewhere first.

Tick **Flagged only** to see nothing but the flagged sessions, and the big green button becomes **Approve flagged** — handy for a second pass after you've cleared the ordinary ones.

{{button:outline|Expand all}} opens every person and every week at once so you can read the sessions straight down; it turns into {{button:outline|Collapse all}} to fold them back. From People → Users, tapping a person's clock cell opens this window already pinned to them.

## Approving

Every Approve button says what it's about to do — the count and the hours:

- {{button:green|Approve}} on a session row approves that one session, no confirmation.
- {{button:green|Approve week · 9}} approves every session in that person's week after a confirm.
- {{button:green|Approve all 23 · 137h}} on a person's header approves everything they have waiting, all weeks, after a confirm.
- {{button:green|Approve everything · 120 · 622h}} at the top clears the entire queue after a confirm.

Approved sessions leave the list right away and the hours land in payroll behind them. {{button:red|Reject}} sends a session back for good (rejected time never reaches payroll); {{button:outline|Edit}} opens the full session editor when the times or the split need fixing, and the queue refreshes when you save.

:::example Salaried schedule time never shows here
Sessions the system creates from a salary schedule approve themselves within the hour. Only real punches wait in this queue.
:::
