---
title: keep a sub's paperwork current
category: Office
roles: dev, master_technician, assistant, controller
keywords: subs, subcontractor, compliance, coi, insurance certificate, w9, w-9, license, expiration, add document, paperwork, person desk
order: 81
---
Each sub on People → Subs wears a badge that says whether their paperwork is in order. Here you file a COI, the insurance certificate, a W-9 or a license so the badge turns green.

{{chip:gray|COI missing}} means no insurance certificate is on file at all. It does not mean nobody looked. This guide is the feed. It shows how a COI, W-9 or license gets *onto* the file.

## Three doors, same form

- You open **People → Subs** and click **▶ Documents** under the sub. Then you click {{button:outline|+ Add document}}.
- You open the Person Desk from any person's name and go to **Paperwork**. You click {{button:outline|Add document}} on the *On file* row.
- You open **Jobs → Subs** and click a sheet's rail to open its story. On the Signed row you click **Binds under**. It reads *no MSA on file · no COI on file*, where MSA is the master subcontract agreement. The Desk opens on Paperwork. The story updates when you close it.

All three doors open the same short form. Nothing is saved until you click {{button:blue|Save}}.

## Filling it in

1. **What is it**. Pick COI, W-9, License, an Agreement signed on paper, or Other.
2. **Expires**. You must fill it for a COI. It is optional otherwise. Everything the app knows about lapses flows from this one date.
3. **Link to the file**. This is optional. Paste an `https://` link, and Drive works well. The scan is then one click away from the row.
4. **Name**. It is pre-filled from the type, as *COI (filed)*. You may rename it if you like, as *COI 2026 – Hartford*.

:::example Getting a red badge green
Jesse's row shows {{chip:gray|COI missing}}. Open ▶ Documents → + Add document → COI → expires 2027-03-01 → paste the Drive link → Save. The row now reads {{chip:green|COI ✓}}, flips to {{chip:yellow|COI expiring}} 30 days before March 1, and {{chip:red|COI expired}} after it.
:::

## "Looks like a W-9 — set type"

Anything sent or uploaded from **People → Contracts** is typed as the sub's *Agreement* by default. So a document named "W-9" that came in that way counts toward the wrong badge. When a name and its type disagree, the Subs expander shows an amber pill. You click it once and the row is retyped. The type and expiry pickers on each row still work for anything else. An expiry date on a row saves when it is finished. You pick it from the calendar. Or you type it and press Enter or leave the box. A date left half typed is not saved.

## Who can do this

Dev, leader, assistant, and controller can do this. They are the same roles that can edit these rows. Training-mode viewers see no Add button. Badges warn and never block. An expired COI shows red but does not stop a work order. Check the column before you hand a sub a job. Column reference: [review your subs in one place](?g=review-your-subs).
