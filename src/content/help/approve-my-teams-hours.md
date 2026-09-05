---
title: approve my team's hours
category: Field
roles: subcontractor, helpers, master_technician, assistant, controller
keywords: my team, approve hours, pending sessions, clock sessions, team lead, approve all, long day, clock strip pill, salary flat hours, midnight, who can approve
order: 67
---
If you lead a team, your Dashboard has a **My Team** section where your members' clock sessions come to you for approval. The header wears an amber chip — {{chip:yellow|7 to approve}} — whenever hours are waiting, even while the section is collapsed.

## The week at a glance

The top row pages one week at a time — tap **‹** or **›** to move, or tap the week label itself ("This week · Aug 16–22") to pick exact dates. Under it, each person you lead gets one card that tells the week's story in a sentence:

:::example One person, one sentence
**Paige**
46.4h this week — all waiting on you
:::

The bell button on a person's card turns clock in/out notifications for them on or off.

## Approving sessions

The **Pending approval** card lists every finished session waiting on you, newest first. Each one shows the day and hours up front, the clock-in/out times with map links, the job it's assigned to (with a {{button:outline|Change}} button if it landed on the wrong one), and any note your member typed.

- {{button:green|Approve 7.8h}} — approves that one session. The button says the hours you're attesting.
- {{button:outline|Reject}} — sends it back (asks you to confirm).
- {{button:outline|Edit}} — opens the full hours editor when the times themselves need fixing.

**Approve all** at the top of the card approves every listed session in one confirmed tap — it shows the count and total ("Approve all 7 · 46.4h") so you know exactly what you're signing off on.

:::example Salaried schedule time approves itself
Sessions the system creates from a **salary schedule** don't wait in this list — they approve automatically about every half hour once they close. Only real punches need your eyes. If you edit an auto-approved session later, the person's hours re-sync just like any other approved-session edit.
:::

## The ⚠ long day flag

A session longer than **12 hours** wears an amber **⚠ long day** tag — like a 7:30 AM–9:59 PM day. It doesn't block anything; it's a nudge to look before approving, since a forgotten clock-out looks exactly like a long day.

## Everywhere else you can approve

Office roles (assistant, controller, master) approve from more than the My Team card — every one of these adds the hours to payroll the same way, through the same rule:

- **People → Hours** — the amber banner's {{button:amber|Review & approve}} (the week on screen), the {{button:outline-amber|All weeks}} queue, the {{chip:yellow|+9.5 h pending}} chip on a grid cell (opens a small popover with its own Approve), and the per-session {{button:green|Approve}} in the Clock sessions list.
- **The clock strip** on the Dashboard, People → Hours, and Quickfill → People Hours — the small square pill beside a finished session. A short click asks first — *"Approve Paige's session (7:12 AM – 3:40 PM)? This adds the hours to payroll."* — so a slip on the tiny pill never writes silently. Long-press (or Shift+click) still opens **Session actions** for Approve, Reject, Edit.
- **People → Users** — the hours cell on a person's row opens their all-weeks queue.
- **Moneyfill → Sessions pending approval** — the same Sunday–Saturday pay week Draft Payroll opens to.

:::example Two chips worth a look before approving
**salary — counts as flat hours** — a salaried person: payroll credits their flat day, not this session's length. Approving records the punch; it doesn't change their pay.
**still clocked in at midnight** — nobody clocked out, so the system closed the session at 11:59 PM. Check the real end time with {{button:outline|Edit}} first.
:::

## Everything else

Anyone **on the clock right now** shows in its own card (with a Force clock out if someone forgot). The full ledger of past sessions lives behind **All clock activity** at the bottom.
