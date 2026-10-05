---
title: get started in the office (assistant or controller)
category: Getting Started
roles: assistant, controller
keywords: start here, new, assistant, controller, office, orientation, what field sees, job mode, call dispatch, ask estimating, training mode, new hire
order: 7
---
You run the day from the office: dispatch, billing, people, and paperwork. Controllers also see payroll and money detail that assistants don't.

## Your day

:::example A typical morning's dashboard flags
{{chip:red|45}} **Stale tally transactions** — card purchases waiting to be sorted to jobs

{{chip:yellow|2}} **Unallocated bank deposits** — money in the bank not yet applied to a job

{{chip:blue|3}} **Dispatch inbox** — field requests waiting on an answer
:::

1. **Dashboard** shows clocked-in crews, unallocated bank deposits, follow-ups, and anything flagged overnight. On a phone the Dashboard is in office order:
   - The clock row is one line, ***Clocked in · 3:12***, with {{button:outline|Focus}} and {{button:outline|Clock out}}.
   - My Schedule hides while you have no blocks.
   - Everything under the money tiles is one line each, with {{button:outline|Open ▾}}. That is Who's in, Crew Day, My Inbox, Team inboxes, Recent reports, Billing pipeline and My Time.
   - Every one of those lines says how many, like *Crew Day · 12 people · 14 jobs · 8 flags*, *Recent reports · 3 new · 12 listed* or *My Time · 6.2 h this week*.
   - **Job report** and **Tally** are two small links under the clock row, instead of two squares.
   - With Dispatch Mode on, **Needs you** is a one-line door to the Inbox tab. There the list walks one card at a time.
2. **Jobs → Pipeline** is the busiest board in the app. It shows every job by billing state, with search, GC and development filters, and print. A development is a neighborhood a builder is putting up. Set progress, bill, and collect from here.
3. **Schedule** shows who is where, day by day. See [dispatch mode](?g=dispatch-mode) and [scheduling people onto jobs](?g=schedule-dispatch).
4. **Quickfill** is the fast path for filling in hours and job time.
5. **People** holds accounts, hours, contracts, and [your subs](?g=review-your-subs).

## Money

[Bill a customer and get paid](?g=ready-to-bill-pipeline) is the main flow. Split billing is covered in [bill part of a job to someone else](?g=bill-part-of-a-job-to-someone-else). What you owe subs lives in [sub labor outstanding](?g=sub-labor-outstanding). Per-step work orders are in [pay a sub per step](?g=pay-a-sub-per-step).

- **An owner calls about a lien letter.** A lien is a legal claim on a property for an unpaid bill. Open the Lien desk from the Collections header on Jobs → Pipeline, with {{button:outline|⏱ Lien desk}}. Press {{button:blue|☎ Someone's calling ›}} before you say anything past hello. It finds the letter they are holding. It gives you the words one card at a time. [Answer an owner who calls about a lien letter](?g=answer-an-owner-who-calls-about-a-lien-letter) has the whole call.

## What the field sees

- **Subs and helpers** open the app in **Job Mode**. That is one card with Clock In, today's stops, Leave Report and a Schedule / Inbox / Customers tab bar. They see only their own assigned steps, their own schedule, and their own pay balance. They see nothing company-wide. When a sub says "I don't see the job," it's usually because the step isn't assigned to them yet. A helper may say "there's nothing to clock into." Their Clock In sheet is already telling them to call dispatch. That call is coming to you. Add the block, their time on the schedule, and the job appears as a pick.
- **What the field sends you.** The purple **Ask estimating** button in their header drops a question into the estimators' inbox. The blue dispatch button and the red phone or photo taps on a job land in your **Dispatch inbox**. Closing a request there sends the tech a push alert, **Dispatch answered**. It also shows your note under *My requests* in their Job Mode Inbox. So write the answer, not just "done".
- **Superintendents** see projects, jobs, and dispatch, but not payroll or company totals.
- **Primaries** see their own jobs, estimates, and bills only.

**Settings → Guides** has "Viewing guides for" chips. Flip to any role to read exactly what they can. That is the quickest way to answer "where do I click?" over the phone.

## Bringing on a new hire

Sign-ins are created by a dev from People → Users → **+ Hire**. See [hire someone](?g=hire-someone) and [invite someone to sign in](?g=invite-someone-to-sign-in). Two things are worth asking for when you hand over the name and email. The first is the right **role**. The dialog makes them choose one. A field hire should be Subcontractor or Helper, never Leader. The second is **Start in training mode**. It lets the person look around for a few days without being able to change anything. Training mode still lets them clock in and out, so their hours are real from day one. See [put someone in read-only training mode](?g=read-only-training-mode) for what they'll experience.

## When a link isn't for your role

A link may open a page your role can't use, like the owner's Crew P&L or the controller's Payroll. The app says so once, with {{chip:blue|Crew P&L is for the owner — you're on Reports.}} It lands you on the nearest tab you can use. Nothing is broken. The page just isn't yours. Ask the owner or controller if you need what's on it.

## Controller-only

Payroll, wage detail, and money visibility that assistants don't have. Everything else on this page is shared. That includes **Banking**, with User Sort, Drag Sort, Accounting, Card Review, Category Review and Reconciliation. It also includes the tabbed **Job window**. A controller sees the same queues and can split and label the same transactions. A controller opens the same {{chip:blue|Job · Edit · Bill}} window an assistant does. A Banking queue may look empty, or a split may be refused, for a controller. That is a bug, not a permission.
