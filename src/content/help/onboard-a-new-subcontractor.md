---
title: onboard a new subcontractor
category: Office
roles: dev, master_technician, assistant, controller
keywords: onboard, onboarding, new sub, subcontractor, first time, roster, invite, packet, master subcontract, handbook, coi, w-9, insurance, license, checklist, where is
order: 74
---
Onboarding a sub is four stops in the app: get them **on the roster**, get the **paperwork signed**, get their **insurance and tax documents on file**, then hand them their **first job**. Everything below lives under **People** except the hiring board, and none of it requires the sub to have a login before you start.

## Before you open the app

Have these from the sub, or know you'll be asking for them:

- Legal name and entity (sole proprietor, LLC, corporation), phone, and the **email they'll sign from**.
- Trade and Texas license or registration number (TSBPE or TDLR).
- Certificate of insurance — or their decision to take **Option B** in the Master Subcontract (no coverage on file, 10% held from each payment).
- W-9, and a workers' comp certificate or a signed DWC-83 waiver if they have no employees.

## 1. Put them on the roster

Two doors, depending on where the person came from:

- **From the hiring board** — Prospects → **Hiring** → the **Hire** stage. Advancing a candidate offers *Add to the People roster?* — pick **Subcontractor** and their name, phone, and email carry over. The Hire stage also has the company **onboarding checklist** (red → yellow → green boxes per item; devs edit the items under {{icon:gear}} **Onboarding settings**), so you can track the documents you're still waiting on right there.
- **Straight to People** — People → **Users** → {{button:blue|+ Add to roster}}, pick **Subcontractor**, and save. That is a roster row with no login, which is all the portal, paperwork and sub sheets need. Tick *Also invite them to sign in* on the same dialog if they should have a login; if they won't click an invite, {{button:outline|Accounts · dev}} → {{button:outline|Manually add user}} creates the login now with a password you hand them.

:::example External vs. account
A sub added from the hiring board or from **Add to roster** is a roster row with no login — it wears a {{chip:gray|no login}} chip on People → Users. That's enough for contracts, sub labor sheets, work orders and the portal. When they get an account later, use **Link account** in the row's ⋯ menu so the two rows fold into one — see [link an external subcontractor to their new account](?g=link-external-person-to-account).
:::

## 2. Send the paperwork

Go to **People → Contracts** and expand the sub's row.

1. Click {{button:blue|Assign packets}} and tick **Subs** — it bundles the **Master Subcontract Agreement** and the **Subcontractor Handbook**. The note tells you exactly what lands — *Will add for Darren: Master Subcontract Agreement, Subcontractor Handbook — 2 documents, created as unsent.* (someone who already has one of them only gets the missing one) — then {{button:blue|Save}}.
2. Both documents appear on their row as {{chip:red|unsent}}. Click {{button:blue|Send}} on each; the email opens with their roster address filled in.
3. Tick **Remind on Dashboard after clock-in (until signed)** if they already have a login — the app then shows a *Required Signatures* prompt every time they clock in until everything is signed.

{{gif:onboard-a-new-subcontractor.gif|People → Contracts: expand the sub, Assign packets, tick Subs — the note spells out the two documents that will be created}}

:::example What the sub sees
An email with a link to the signing page — no login needed. They read the document, type their name or draw a signature, tick the agreement box, and submit. The row flips from {{chip:yellow|sent}} to {{chip:green|signed}} the moment they do, and their signed copy (with date, IP, and signature image) is under the row's ⋯ menu.
:::

Need one document for one person, or a document that isn't in a packet? See [send one contract to one person](?g=send-one-contract-to-one-person).

## 3. File insurance and tax documents

COIs, W-9s, and waivers aren't signed in the app — they're **filed** against the sub so the app can watch expirations for you.

1. On the sub's row in **People → Contracts**, click {{button:outline|+ Add document}} → **Custom or already-signed**. Name it (*COI 2026*, *W-9*, *DWC-83 waiver*), paste a link to the file, set the **Signed date**, and {{button:blue|Save}}.
2. Go to **People → Subs** and click **▶ Documents** under the sub — the panel opens **below the table**, so scroll down to it. Set each document's **type** — agreement, COI, W-9, or license — and its **expiry date**.
3. The compliance badges update immediately: {{chip:green|COI ✓}} when current, {{chip:yellow|COI expiring}} inside 30 days, {{chip:red|COI expired}} when lapsed, {{chip:gray|W-9 missing}} when nothing is filed.

{{gif:onboard-a-new-subcontractor-compliance.gif|People → Subs → Documents: set each document's type and expiry, and the badges update}}

:::example Insurance election
The Master Subcontract lets a sub choose **Option A** (their own coverage, COI on file) or **Option B** (no coverage, 10% held from every payment). File the COI only for Option A subs — a sub with no COI document shows {{chip:gray|COI missing}}, which is the reminder that the 10% charge applies. Workers' comp isn't optional either way: coverage or a DWC-83 waiver, filed annually.
:::

The Subs tab is warn-never-block: an expired COI shows red but won't stop scheduling. Check it before each job you hand them. Full column reference in [review your subs in one place](?g=review-your-subs).

## 4. Record their license

**People → Licenses** → expand the person → {{button:blue|+ Add license}} with the trade, level, number, and expiry. When a helper is working toward the next level under one of your masters, the same row's {{button:outline|Hours log}} builds the board's experience export — see [export a license hours log](?g=license-hours-log).

## 5. Hand them their first job

- **Per-step work order** — the normal way to run a sub through a project: open the step on the Workflow page, {{button:outline|+ Add}} a sub work order with the agreed amount, and {{button:blue|Send offer}}. They accept from their dashboard and you're notified. See [pay a sub per step](?g=pay-a-sub-per-step).
- **Hourly or one-off** — add them to the job's people and schedule them like anyone else: [add or remove people on a job](?g=add-or-remove-people-on-a-job) and [Schedule Dispatch](?g=schedule-dispatch).

Point them at [get started as a sub or helper](?g=start-here-as-a-sub) — it's written for them, and it's the first thing they'll find under {{icon:help}}.

## Where everything is

| What | Where |
|---|---|
| Hiring board and onboarding checklist | Prospects → Hiring → Hire |
| Create a login / invite | People → Users → Add to roster (tick *Also invite*) or Accounts · dev |
| Link a roster-only sub to their login | People → Users → their row → ⋯ → Link account |
| Assign packets, send for signature, signed copies | People → Contracts |
| Contract text, packets, version dates | People → Contracts → Contract library |
| Document types, expirations, compliance badges | People → Subs → ▶ Documents |
| Licenses and hours logs | People → Licenses |
| Work orders and what you owe them | Workflow step card · People → Subs · Jobs → Sub Labor |

:::example A clean first week
Monday: hired from the board, roster entry created, Subs packet and Handbook sent. Tuesday: both signed, COI and W-9 filed and typed on the Subs tab — every badge green. Wednesday: first work order offered and accepted; they clock in Thursday and the *Required Signatures* prompt never appears because there's nothing left to sign.
:::
