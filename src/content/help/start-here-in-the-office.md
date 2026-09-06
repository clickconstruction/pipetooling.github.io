---
title: get started in the office (assistant or controller)
category: Getting Started
roles: assistant, controller
keywords: start here, new, assistant, controller, office, orientation, what field sees, job mode, call dispatch, ask estimating, training mode, new hire
order: 7
---
You run the day from the office: dispatch, billing, people, and paperwork. Controllers additionally see payroll and money detail that assistants don't.

## Your day

:::example A typical morning's dashboard flags
{{chip:red|45}} **Stale tally transactions** — card purchases waiting to be sorted to jobs

{{chip:yellow|2}} **Unallocated bank deposits** — money in the bank not yet applied to a job

{{chip:blue|3}} **Dispatch inbox** — field requests waiting on an answer
:::

1. **Dashboard** — clocked-in crews, unallocated bank deposits, follow-ups, and anything flagged overnight.
2. **Jobs → Pipeline** — the busiest board in the app: every job by billing state, with search, GC and development filters, and print. Set progress, bill, and collect from here.
3. **Schedule** — who is where, day by day. See [dispatch mode](?g=dispatch-mode) and [scheduling people onto jobs](?g=schedule-dispatch).
4. **Quickfill** — the fast path for filling in hours and job time.
5. **People** — accounts, hours, contracts, and [your subs](?g=review-your-subs).

## Money

[Bill a customer and get paid](?g=ready-to-bill-pipeline) is the main flow; [bill part of a job to someone else](?g=bill-part-of-a-job-to-someone-else) covers split billing. What you owe subs lives in [sub labor outstanding](?g=sub-labor-outstanding) and per-step work orders in [pay a sub per step](?g=pay-a-sub-per-step).

## What the field sees

- **Subs and helpers** open the app in **Job Mode** — one card with Clock In, today's stops, Leave Report and a Schedule / Inbox / Customers tab bar — and see only their own assigned steps, their own schedule, and their own pay balance, nothing company-wide. When a sub says "I don't see the job," it's usually because the step isn't assigned to them yet. When a helper says "there's nothing to clock into," their Clock In sheet is already telling them to call dispatch — that call is coming to you; add the block and the job appears as a pick.
- **What the field sends you.** The purple **Ask estimating** button in their header drops a question into the estimators' inbox; the blue dispatch button and the red phone/photo taps on a job land in your **Dispatch inbox**. Closing a request there sends the tech a push (**Dispatch answered**) and shows your note under *My requests* in their Job Mode Inbox — so write the answer, not just "done".
- **Superintendents** see projects, jobs, and dispatch, but not payroll or company totals.
- **Primaries** see their own jobs, estimates, and bills only.

**Settings → Guides** has "Viewing guides for" chips — flip to any role to read exactly what they can, which is the quickest way to answer "where do I click?" over the phone.

## Bringing on a new hire

Sign-ins are created by a dev on **Active Accounts** (see [invite someone to sign in](?g=invite-someone-to-sign-in)). Two things worth asking for when you hand over the name and email: the right **role** (the dialog makes them choose one — a field hire should be Subcontractor or Helper, never Master), and **Start in training mode** if you'd like the person to look around for a few days without being able to change anything. Training mode still lets them clock in and out, so their hours are real from day one — see [put someone in read-only training mode](?g=read-only-training-mode) for what they'll experience.

## When a link isn't for your role

Open a link to a page your role can't use — the owner's Crew P&L, the controller's Payroll — and the app says so once ({{chip:blue|Crew P&L is for the owner — you're on Reports.}}) and lands you on the nearest tab you can use. Nothing is broken; the page just isn't yours. Ask the owner or controller if you need what's on it.

## Controller-only

Payroll, wage detail, and money visibility that assistants don't have. Everything else on this page is shared — including **Banking** (User Sort, Drag Sort, Accounting, Card Review, Category Review, Reconciliation) and the tabbed **Job window**: a controller sees the same queues, can split and label the same transactions, and opens the same {{chip:blue|Job · Edit · Bill}} window an assistant does. If a Banking queue looks empty or a split is refused for a controller, that is a bug, not a permission.
