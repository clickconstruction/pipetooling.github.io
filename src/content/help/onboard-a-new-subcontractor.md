---
title: onboard a new subcontractor
category: Office
roles: dev, master_technician, assistant, controller
keywords: onboard, onboarding, new sub, subcontractor, first time, roster, invite, packet, master subcontract, handbook, coi, w-9, insurance, license, checklist, where is
order: 74
---
Onboarding a sub is four stops in the app. A sub is a subcontractor, an outside tradesman you hire for a job.

First you get them **on the roster**. Then you get the **paperwork signed**. Then you get their **insurance and tax documents on file**. Then you hand them their **first job**. Everything below lives under **People** except the hiring board. None of it requires the sub to have a login before you start.

## Before you open the app

Have these from the sub, or know you will be asking for them:

- Legal name and entity, phone, and the **email they will sign from**. The entity is sole proprietor, LLC or corporation.
- Trade and Texas license or registration number. That is the TSBPE or TDLR number.
- Certificate of insurance. Or their decision to take **Option B** in the Master Subcontract. Option B means no coverage on file, and 10% held from each payment.
- W-9, and a workers' comp certificate. A sub with no employees can give a signed DWC-83 waiver instead.

## 1. Put them on the roster

There are two doors, depending on where the person came from:

- **From the hiring board**. You go to Prospects → **Hiring** → the **Hire** stage. Advancing a candidate offers *Add to the People roster?*. You pick **Subcontractor**. Their name, phone, and email carry over. The Hire stage also has the company **onboarding checklist**. Each item's box goes red, then yellow, then green. Devs edit the items under {{icon:gear}} **Onboarding settings**. So you can track the documents you are still waiting on right there.
- **Straight to People**. You go to People → **Users** → {{button:blue|+ Add to roster}}. You pick **Subcontractor** and save. That is a roster row with no login. It is all the portal, paperwork and sub sheets need. You tick *Also invite them to sign in* on the same dialog if they should have a login. Will they not click an invite? Then {{button:outline|Accounts · dev}} → {{button:outline|Manually add user}} creates the login now, with a password you hand them. The invite link is single-use for setting a password. Re-opening it while signed in shows *You're already set up* and a Sign in button, nothing else.

:::example External vs. account
A sub added from the hiring board or from **Add to roster** is a roster row with no login — it wears a {{chip:gray|no login}} chip on People → Users. That's enough for contracts, sub labor sheets, work orders and the portal. When they get an account later, use **Link account** in the row's ⋯ menu so the two rows fold into one — see [link an external subcontractor to their new account](?g=link-external-person-to-account).
:::

## 2. Send the paperwork

You go to **People → Contracts** and expand the sub's row.

1. Click {{button:blue|Assign packets}} and tick **Subs**. It bundles the **Master Subcontract Agreement** and the **Subcontractor Handbook**. The note tells you exactly what lands. It reads *Will add for Darren: Master Subcontract Agreement, Subcontractor Handbook — 2 documents, created as unsent.* Someone who already has one of them only gets the missing one. Then click {{button:blue|Save}}.
2. Both documents appear on their row as {{chip:red|unsent}}. Click {{button:blue|Send}} on each. The email opens with their roster address filled in.
3. Tick ***Remind on Dashboard after clock-in (until signed)*** if they already have a login. The app then shows a *Required Signatures* prompt every time they clock in. It stops once everything is signed.

{{gif:onboard-a-new-subcontractor.gif|People → Contracts: expand the sub, Assign packets, tick Subs. The note spells out the two documents that will be created.}}

:::example What the sub sees
An email with a link to the signing page — no login needed. They read the document, type their name or draw a signature, tick the agreement box, and submit. The row flips from {{chip:yellow|sent}} to {{chip:green|signed}} the moment they do, and their signed copy (with date, IP, and signature image) is under the row's ⋯ menu.
:::

Need one document for one person, or a document that is not in a packet? See [send one contract to one person](?g=send-one-contract-to-one-person).

## 3. File insurance and tax documents

COIs, W-9s, and waivers are not signed in the app. A COI is a certificate of insurance. They are **filed** against the sub so the app can watch expirations for you.

1. Go to **People → Subs** and click **▶ Documents** under the sub. The panel opens **below the table**, so scroll down to it. Then click {{button:outline|+ Add document}}. The same button is on the sub's **Person Desk → Paperwork**.
2. Pick the **type**: COI, W-9, license, or a paper-signed agreement. Set the **expiration**, which a COI requires. Paste an optional link to the scan in *Drive*. Then click {{button:blue|Save}}. A DWC-83 waiver files as *Other* with its annual expiry.
3. The compliance badges update immediately. {{chip:green|COI ✓}} shows when current. {{chip:yellow|COI expiring}} shows inside 30 days. {{chip:red|COI expired}} shows when lapsed. {{chip:gray|W-9 missing}} shows when nothing is filed. Details: [keep a sub's paperwork current](?g=keep-a-subs-paperwork-current).

{{gif:onboard-a-new-subcontractor-compliance.gif|People → Subs → Documents: set each document's type and expiry, and the badges update}}

:::example Insurance election
The Master Subcontract lets a sub choose **Option A** (their own coverage, COI on file) or **Option B** (no coverage, 10% held from every payment). File the COI only for Option A subs — a sub with no COI document shows {{chip:gray|COI missing}}, which is the reminder that the 10% charge applies. Workers' comp isn't optional either way: coverage or a DWC-83 waiver, filed annually.
:::

The Subs tab is warn-never-block. An expired COI shows red but will not stop scheduling. You check it before each job you hand them. The full column reference is in [review your subs in one place](?g=review-your-subs).

## 4. Record their license

You go to **People → Licenses** and expand the person. You click {{button:blue|+ Add license}} with the trade, level, number, and expiry. A helper may be working toward the next level under one of your leaders. Then the same row's {{button:outline|Hours log}} builds the board's experience export. See [export a license hours log](?g=license-hours-log).

## 5. Hand them their first job

- **Per-step work order** is the normal way to run a sub through a project. You open the step on the Workflow page. You {{button:outline|+ Add}} a sub work order with the agreed amount. Then you click {{button:blue|Send offer}}. They accept from their dashboard and you are notified. See [pay a sub per step](?g=pay-a-sub-per-step).
- **Hourly or one-off**: you add them to the job's people and schedule them like anyone else. See [add or remove people on a job](?g=add-or-remove-people-on-a-job) and [Schedule Dispatch](?g=schedule-dispatch).

Point them at [get started as a sub or helper](?g=start-here-as-a-sub). It is written for them. It is the first thing they will find under {{icon:help}}.

## Where everything is

| What | Where |
|---|---|
| Hiring board and onboarding checklist | Prospects → Hiring → Hire |
| Create a login / invite | People → Users → Add to roster with *Also invite* ticked, or *Accounts · dev* |
| Link a roster-only sub to their login | People → Users → the row's ⋯ → Link account |
| Assign packets, send for signature, signed copies | People → Contracts |
| Contract text, packets, version dates | People → Contracts → Contract library |
| Document types, expirations, compliance badges | People → Subs → ▶ Documents |
| Licenses and hours logs | People → Licenses |
| Work orders and what you owe them | Workflow step card. People → Subs. Jobs → Subs → Pay |

:::example A clean first week
Monday: hired from the board, roster entry created, Subs packet and Handbook sent. Tuesday: both signed, COI and W-9 filed and typed on the Subs tab — every badge green. Wednesday: first work order offered and accepted; they clock in Thursday and the *Required Signatures* prompt never appears because there's nothing left to sign.
:::
