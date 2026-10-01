---
title: open a person's desk
category: Office
roles: dev, master_technician, assistant, controller
keywords: person desk, person, drawer, profile, one person, manage a person, account, role, approvals, portal, roster row, link account, reconcile name, training mode, archive
order: 20
---
Everything about one person used to live on a different tab. The Person Desk gathers it into one drawer you open from their name.

Their role was on Manage accounts. Their sessions were on Hours. Their portal was on Subs. Nothing on the **Person Desk** is new. Every switch is the same switch the tab has. It is just all in one place.

## Open it

You tap a person's **name** anywhere it is underlined with dots. That is People → Users and Subs, the Hours grid, and the clock sessions tables. It is also the Dashboard clock strip, My Team, Crew Day cards, the Contracts list, and the approvals queue. The drawer slides in from the right. On a phone it fills the screen. You press **Esc** or tap outside to close. A link like `/people?tab=users&person=u:<id>` opens it directly.

Or you press **/** on any page, type a name, and press **Enter**.

Or you open the **People → Person** tab. It is the same desk as a page, with a roster rail on the left. The rail's dots say who needs you. {{chip:yellow|amber}} means paperwork unsent or expiring, or a missing roster row. {{chip:red|red}} means expired paperwork. A **Needs attention** group at the top lists them first. Sessions waiting for approval show as a count on the row but never color the dot. Hours are a queue, not an alarm. On a phone the rail and the desk take turns.

## The header

- **Identity dots.** A person can be three things at once. A **login** is their account. A **roster row** is what the HR file, portal and paperwork hang off. A **pay name** is what wages and hours key on. A green dot means that piece exists. A hollow amber one means it does not. The Desk keeps working either way. Sections that need the missing piece say so.
- **Gaps become buttons.** When something is missing or out of step, an amber line says what and offers the one fix. {{button:amber|Create roster row}} asks for the kind and does nothing else. {{button:amber|Link account}} shows when a roster row shares their email but is not linked. {{button:amber|Reconcile to "Name"}} shows when the roster name drifted from the account name. Pay tables key on the account name, so drift silently splits their hours. The Desk never links or creates anything on its own.
- **State chips**: {{chip:green|On the clock · JP878}}, {{chip:yellow|23 sessions waiting · 136.6h}}, {{chip:gray|Archived}}.
- ***Day · week · month*** opens their schedule review. **Imitate** signs in as them after a confirm. Only devs see Imitate.

## What each section does

- **Hours & approvals** shows whether they are clocked in right now, with {{button:red|Force clock out}}. It shows how many sessions are waiting and how old the oldest is. {{button:green|Open approvals}} opens the all-weeks queue pinned to just this person. It also shows this week's closed hours and the last week you marked reviewed.
- **Portal & paperwork** is for subs only. It shows the portal on or off state, with the globe to manage it. It shows the Agreement, COI and W-9 chips, and open work orders. It shows how many Sub Labor sheets are linked to them.
- **Push notifications** is for office roles. It shows whether the app can reach their phone. It reads on with the device count, or off with the one step that turns it on.
- **Team & alerts** shows who approves their hours, with {{button:outline|Assign a leader}} or Remove. A dev can set Full vs Strip. If you are their leader, it has the **Alert me on in/out** switch. Devs also see their Dispatch and Estimator inbox membership here.
- **Pay & schedule** is for pay roles. It shows wage and office rate, with {{button:outline|Edit}}. It has the **Salaried** switch. Turning it off shows the same warning Employment does. History is safe, and pay becomes hours × wage. Today's auto-sessions go, and the workday template is cleared. It has **also record hours** for salaried people. It shows employment start → end. It shows upcoming **time off** with {{button:outline|Add}}. It has {{button:outline|Workday schedule…}} for salaried people. Money shows the last pay report with a {{chip:green|paid}} or {{chip:yellow|unpaid}} chip, and open offsets. Then come {{button:outline|Ledger}}, {{button:outline|Payroll}} and {{button:outline|Add offset}}.
- **Field** shows the truck they hold, with {{button:outline|To motor pool}}, or **Hand off…** any vehicle to them. It shows the housing they occupy, with {{button:outline|End occupancy}} or **Assign…** a unit. It shows their licenses with expiry chips and the {{button:outline|Hours log}}.
- **Paperwork** is for contracts roles. It shows every document on file with its state: {{chip:red|unsent}}, {{chip:blue|sent}}, {{chip:green|signed}}, {{chip:yellow|expiring}}. It has the **clock-in nag** switch per unsigned document. It has the packet. You pick one and {{button:outline|Assign}} to create its documents as unsent. Sending and uploading a signed copy stay on Contracts, one tap away.
- **Records** shows the HR file's freshness and pending reports, with {{button:outline|Open file}} for devs. Everyone else sees whether a file exists and how many entries, nothing more. It shows write-ups and attendance incidents in the last 90 days. {{button:outline|Rate}} goes into Prospects → Hiring → Review.
- **Schedule** shows today's schedule blocks and clock. It is the same view the *Day · week · month* button opens.
- **Access & account** shows role, trades, and last sign-in with {{button:outline|Send sign-in email}}. It shows training mode, and Active / Archived with {{button:red|Archive…}}. Archive opens **End employment** below. So the final report, the salary schedule, customers, the account and the roster row are all finished in one place.

Links can land on one section. You add `&section=paperwork` to a `?person=` link and the Desk opens scrolled there. Other sections are `hours`, `pay`, `push`, `access` and more.

## End employment

The header's **⋯** menu opens **End employment…** for pay roles. It is a checklist of everything still open for that person, built from every section at once. That is a running clock, sessions waiting on approval, and the final pay report. It is a sub's balance, a live portal, a truck they hold, and housing. It is team-lead links, open work orders, and missing paperwork.

- Each row has its one-tap fix. That is {{button:blue|Force clock out}}, or {{button:outline|Open approvals}} with the queue pinned to them. It is {{button:blue|Turn off portal}}, {{button:blue|To motor pool}}, {{button:blue|End occupancy}}, or {{button:blue|Remove}} for a leader. Or it is a link to the tab that does it.
- Rows you mean to leave take {{button:outline|Leave open…}} with a reason. That may be a sub balance still being settled, or a pay report that runs Friday. A live portal, a running clock, pending sessions and a leader link cannot be left open. They would keep paying or exposing.
- **Final pay report** is generated right here. {{button:blue|Generate report}} covers the day after their last report through the end date. It lands on Payroll like any other report. A pay row with no wage and not salaried has nothing to pay, so that row is grey.
- **Salary**: a salaried person who leaves stops being salaried. {{button:blue|Clear salary}} removes their workday template and its unapproved automatic sessions. It turns the pay row hourly. It waits until the final report is done. That report needs the salaried credit for the days it covers. It cannot be left open.
- The footer takes the **end date**. It takes **Archive after**, for a dev, a controller, or a pay-approved Leader. That archives the login account and the roster row both. It asks what to do with any **customers on their name**. You move them to the company owner, the default, or you keep them. It takes **Note to HR file**, for devs. The button reads {{button:red|End employment · 3 open}} until every row is green, grey, or left open on purpose. Finishing writes the end date and appends one factual line to the HR file. It archives both halves if you asked. The confirmation lists exactly what will happen. Nothing routes through Settings.

:::example What the HR line says
"Employment ended 2026-09-05 for Isiah. Closed out: pending sessions. Left open on purpose: final pay report (runs Friday)."
:::

## Start employment

The mirror is **Start employment…**. It lists the start date, wage, packet, truck and housing. You type the date or the wage right on the row and tap {{button:blue|Save}}. The packet and the optional truck and housing link to their tabs. Rows a dev must do stay on the Access section with their {{chip:gray|dev only}} tag. Those are the role and the sign-in. So a controller finishes everything else and sends the dev one message.

:::example Locked rows still show
A controller sees the role with a {{chip:gray|dev only}} tag beside it — the value is shown so you know where it stands and who to ask. Training mode and Archive are theirs (and a pay-approved Leader's) since the Desk shipped; changing a role is still the dev's.
:::

## A note on the clock strip

For office roles the clock strip's name now opens the desk. The desk has *Day · week · month* in its header. Supervisors without office access keep the schedule review they had.

## On a phone

People → Users is a directory on a phone. It has one line per person, grouped by kind. You **tap a row** to open their desk. You **swipe a row left** for the row's actions. Those are {{button:blue|Desk}}, {{button:purple|Imitate}} and {{button:gray|More}}. Imitate is devs only, one tap. More holds Invite, Edit, Link account, Combine and Archive. Search and {{button:blue|+ Add}} sit at the top. Team leads and Archived are under the ⋯ button. The **Needs you** and **Hours** chips say how many people are waiting.
