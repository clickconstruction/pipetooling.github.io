---
title: approve my team's hours
category: Field Work
roles: master_technician, assistant, controller, dev
keywords: my team, approve hours, typed hours, typed by hand, pencil, second person, own hours, missed clock in, pending sessions, clock sessions, supervised crew, approve all, long day, clock strip pill, salary flat hours, midnight, who can approve, on the clock, click to review, hours grid
order: 67
---
If you approve hours, your Dashboard has a My Team section. The clock sessions of the people you supervised this week come there for approval.

You approve hours if you are a dev, a pay-approved master, or the office. Nobody is assigned to you. The roster is read off the schedule and the clock. See *supervise a crew*. The header wears an amber chip {{chip:yellow|7 to approve}} whenever hours are waiting. It stays even while the section is collapsed. A master who is not pay-approved sees the same roster read-only. The approve controls belong to the office. There is no Team leads list any more, since v2.3616.

## The week at a glance

The top row pages one week at a time. Tap **‹** or **›** to move. Or tap the week label itself, like *This week · Aug 16–22*, to pick exact dates. Under it, each person you supervised this week gets one card. It tells the week's story in a sentence:

:::example One person, one sentence
**Paige**
46.4h this week — all waiting on you
:::

The bell button on a person's card turns clock in/out notifications for them on or off.

## Approving sessions

The **Pending approval** card lists every finished session waiting on you, newest first. Each one shows the day and hours up front. It shows the clock-in/out times with map links. It shows the job it's assigned to. A {{button:outline|Change}} button sits there if it landed on the wrong job. It shows any note your member typed.

- {{button:green|Approve 7.8h}} approves that one session. The button says the hours you're attesting.
- {{button:outline|Reject}} sends it back. It asks you to confirm.
- {{button:outline|Edit}} opens the full hours editor when the times themselves need fixing.

**Approve all** at the top of the card approves every listed session in one confirmed tap. It shows the count and total, like *Approve all 7 · 46.4h*. So you know exactly what you're signing off on.

:::example Salaried schedule time approves itself
Sessions the system creates from a **salary schedule** don't wait in this list — they approve automatically about every half hour once they close. Only real punches need your eyes. If you edit an auto-approved session later, the person's hours re-sync just like any other approved-session edit.
:::

## The ⚠ long day flag

A session longer than **12 hours** wears an amber **⚠ long day** tag. A 7:30 AM to 9:59 PM day is one. It doesn't block anything. It's a nudge to look before approving. A forgotten clock-out looks exactly like a long day.

## The quick add chip

Office staff can add 5 to 30 minutes for a call or an email they handled off the clock. They do not clock in for it. See *add a quick call or email to my hours*. It is ordinary time and you approve it like any other entry. But it is self-reported, so it is never hidden inside a punch:

- the row carries a {{chip:purple|quick add}} chip. It shows **the sentence they typed** instead of the job, like *Call — Acme, the Oak St invoice*. Every quick add is on the Office job, so the job would tell you nothing.
- the person's pay-week view totals them under the week's hours. It reads *1 h 05 m across 8 entries this week*. One number tells you whether the button is being used as intended.

A quick add cannot overlap clocked hours. It cannot reach into another day. It cannot pass two hours in a day. The person cannot stretch one after the fact. Reject one like any other session.

## Hours someone typed

A session is either **punched** or **typed**. Punched means the clock button, at the moment. Typed means someone wrote the times. That is a day the clock missed, a longer day, or a worker's own late entry. A typed session wears a pencil wherever hours are approved, like {{chip:blue|✎ typed by Taunya · Wed 9:40 AM}}. Beside it sits what the day read before and after, like *Nothing recorded → 11.0h*. No pencil means a real punch.

Two rules come with it:

- **Whoever typed the hours cannot approve them.** On your own typed row the Approve button is replaced by *You typed these — waiting on a second person*. Anyone else who approves hours can approve it, and their approval is the second look.
- **Nobody approves their own hours.** Your own row reads *Your own hours — someone else approves them*.

:::example An Approve all never takes a typed row
**Approve all 7 punches · 46.4h**
2 typed by hand — approve each one below · 1 waiting on someone else
:::

So a typed row is always opened and approved by itself. On the Hours grid the cell's chip shows the pencil, like {{chip:yellow|! 2 ✎}}. In its popover the typed line has its own {{button:green|Approve 11.00h}}. The day button reads {{button:green|Approve 1 punch}}. In the **All weeks** queue, tick **Typed by hand** to see only those rows.

When typed hours wait on you, the Dashboard's **Needs you** says so. It reads *Hours typed by hand want a second look*. {{button:amber|Look at them}} opens the queue on that filter.

:::example Hours typed onto time that was already approved
**Typed onto hours already approved · 1**
Paige · Thu 9/24 · ✎ typed by Taunya · 6.5h → 9.0h
:::

Changing the times of a session that is already approved keeps it approved. So those hours count in pay straight away, and no approval ever looks at them. They sit in their own section at the top of the queue. {{button:green|Looks right}} is the second look. It is not offered to whoever typed them, or to the person whose hours they are. {{button:outline|Open day}} opens the day to fix it instead.

One more stop, on the Hours grid. Typing **0** into a day that has approved hours from the clock no longer takes them out of pay. It used to do that behind the clock's back. The grid asks. {{button:outline|Open the day}} takes you to the sessions. Change or reject them there, where it is recorded.

A dev turns the rule on at Settings → People & teams → *Typed hours: a second person approves*. The choices are Off, Test accounts only, and On for everyone. The pencil shows whatever is picked.

A trim is a forgotten clock-out cut back. It is recorded too, like *trimmed by Taunya · 12.0h → 8.0h*. But it holds nothing. The person who trimmed it may approve it.

## Everywhere else you can approve

Office roles approve from more than the My Team card. Those roles are assistant, controller and leader. Every one of these places adds the hours to payroll the same way, through the same rule:

- **People → Hours** has four places. The amber banner's {{button:amber|Review & approve}} covers the week on screen. The {{button:outline-amber|All weeks}} queue covers every week. The {{chip:yellow|+9.5 h pending}} chip sits on a grid cell. Its tooltip says *click to review*. It opens a small popover, and the Approve button is in there. The per-session {{button:green|Approve}} sits in the Clock sessions list. While people are still clocked in, the day's column header adds a green **+3 on the clock** line. The grid totals count finished sessions only. Those hours land in the cell when they clock out. The clock strip above the grid is where the live ones show.
- **The clock strip** is on the Dashboard, People → Hours, and Quickfill → People Hours. Use the small square pill beside a finished session. A short click asks first. It reads *"Approve Paige's session (7:12 AM – 3:40 PM)? This adds the hours to payroll."*. So a slip on the tiny pill never writes silently. Long-press still opens **Session actions** for Approve, Reject, Edit. Shift+click does the same.
- **People → Users**: the hours cell on a person's row opens their all-weeks queue.
- **Moneyfill → Sessions pending approval** shows the same Sunday to Saturday pay week Draft Payroll opens to.

:::example Two chips worth a look before approving
**salary — counts as flat hours** — a salaried person: payroll credits their flat day, not this session's length. Approving records the punch; it doesn't change their pay.
**still clocked in at midnight** — nobody clocked out, so the system closed the session at 11:59 PM. Check the real end time with {{button:outline|Edit}} first.
:::

## Everything else

Anyone **on the clock right now** shows in its own card. It has a Force clock out if someone forgot. The full ledger of past sessions lives behind **All clock activity** at the bottom.
