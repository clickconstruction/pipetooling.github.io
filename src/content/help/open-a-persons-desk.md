---
title: open a person's desk
category: Office
roles: dev, master_technician, assistant, controller
keywords: person desk, person, drawer, profile, one person, manage a person, account, role, team lead, approvals, portal, roster row, link account, reconcile name, training mode, archive
order: 20
---
Everything about one person used to live on a different tab: their role on Manage accounts, their team lead on Users, their sessions on Hours, their portal on Subs. The **Person Desk** gathers it into one drawer you open from their name. Nothing on it is new — every switch is the same switch the tab has — it's just all in one place.

## Open it

Tap a person's **name** on **People → Users** or **People → Subs** (it's underlined with dots). The drawer slides in from the right; on a phone it fills the screen. Press **Esc** or tap outside to close. A link like `/people?tab=users&person=u:<id>` opens it directly.

## The header

- **Identity dots.** A person can be three things at once: a **login** (their account), a **roster row** (what the HR file, portal and paperwork hang off), and a **pay name** (what wages and hours key on). A green dot means that piece exists; a hollow amber one means it doesn't. The Desk keeps working either way — sections that need the missing piece say so.
- **Gaps become buttons.** When something is missing or out of step, an amber line says what and offers the one fix: {{button:amber|Create roster row}} (asks for the kind, does nothing else), {{button:amber|Link account}} when a roster row shares their email but isn't linked, or {{button:amber|Reconcile to "Name"}} when the roster name drifted from the account name (pay tables key on the account name, so drift silently splits their hours). The Desk never links or creates anything on its own.
- **State chips**: {{chip:green|On the clock · JP878}}, {{chip:yellow|23 sessions waiting · 136.6h}}, {{chip:gray|Archived}}.
- **Day · week · month** opens their schedule review. **Imitate** (dev only) signs in as them after a confirm.

## What each section does

- **Hours & approvals** — whether they're clocked in right now (with {{button:red|Force clock out}}), how many sessions are waiting and how old the oldest is, and {{button:green|Open approvals}} — the all-weeks queue pinned to just this person. Also this week's closed hours and the last week you marked reviewed.
- **Portal & paperwork** (subs only) — the portal on/off state with the globe to manage it, the Agreement / COI / W-9 chips, open work orders, and how many Sub Labor sheets are linked to them.
- **Team & alerts** — who approves their hours ({{button:outline|Assign a leader}} / Remove; a dev can set Full vs Strip), and, if you are their leader, the **Alert me on in/out** switch. Devs also see their Dispatch and Estimator inbox membership here.
- **Pay & schedule** (pay roles) — wage and office rate ({{button:outline|Edit}}), the **Salaried** switch (turning it off shows the same warning Employment does: history is safe, pay becomes hours × wage, today's auto-sessions go, and the workday template is cleared), **also record hours** for salaried people, employment start → end, upcoming **time off** with {{button:outline|Add}}, {{button:outline|Workday schedule…}} for salaried people, and Money: the last pay report with a {{chip:green|paid}} or {{chip:yellow|unpaid}} chip, open offsets, and {{button:outline|Ledger}} · {{button:outline|Payroll}} · {{button:outline|Add offset}}.
- **Access & account** — role, trades, last sign-in with {{button:outline|Send sign-in email}}, training mode, and Active / Archived with {{button:red|Archive…}} (which runs through the Active Accounts row so customers can be reassigned on the way out).

## End employment

The header's **⋯** menu (pay roles) opens **End employment…**: a checklist of everything still open for that person, built from every section at once — a running clock, sessions waiting on approval, the final pay report, a sub's balance, a live portal, a truck they hold, housing, team-lead links, open work orders, and missing paperwork.

- Each row has its one-tap fix: {{button:blue|Force clock out}}, {{button:outline|Open approvals}} (the queue pinned to them), {{button:blue|Turn off portal}}, {{button:blue|To motor pool}}, {{button:blue|End occupancy}}, {{button:blue|Remove}} for a leader, or a link to the tab that does it.
- Rows you mean to leave (a sub balance still being settled, a pay report that runs Friday) take {{button:outline|Leave open…}} with a reason. A live portal, a running clock, pending sessions and a leader link can't be left open — they'd keep paying or exposing.
- The footer takes the **end date**, **Archive account after** (dev today), and **Note to HR file** (dev). The button reads {{button:red|End employment · 3 open}} until every row is green, grey, or left open on purpose. Finishing writes the end date, appends one factual line to the HR file, and archives the account if you asked.

:::example What the HR line says
"Employment ended 2026-09-05 for Isiah. Closed out: pending sessions, team lead. Left open on purpose: final pay report (runs Friday)."
:::

## Start employment

The mirror: **Start employment…** lists the start date, wage, team lead, packet, truck and housing. Type the date, the wage, or pick the leader right on the row and tap {{button:blue|Save}}; the packet and the optional truck and housing link to their tabs. Rows a dev must do (the role, sign-in) stay on the Access section with their {{chip:gray|dev only}} tag, so a controller finishes everything else and sends the dev one message.

:::example Locked rows still show
A controller sees the role and the training-mode switch with a {{chip:gray|dev only}} tag beside them — the value is shown so you know where it stands and who to ask. The Desk adds no permissions of its own.
:::

## What's coming

Pay & schedule, employment dates, paperwork, vehicles, housing, licenses, write-ups and the HR file join the drawer next, along with **End employment** and **Start employment** checklists and a name-is-the-door pass across the rest of the app.
