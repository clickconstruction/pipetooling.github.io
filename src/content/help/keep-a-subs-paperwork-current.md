---
title: keep a sub's paperwork current
category: Office
roles: dev, master_technician, assistant, controller
keywords: subs, subcontractor, compliance, coi, insurance certificate, w9, w-9, license, expiration, add document, paperwork, person desk
order: 81
---
A sub's compliance column on **People → Subs** answers one question: is their paperwork in order? {{chip:gray|COI missing}} means no insurance certificate is on file at all — not that nobody looked. This guide is the feed: how a COI, W-9, or license gets *onto* the file so the badge can turn green.

## Two doors, same form

- **People → Subs** → click **▶ Documents** under the sub → {{button:outline|+ Add document}}.
- **Person Desk → Paperwork** (open the Desk from any person's name) → {{button:outline|Add document}} on the *On file* row.

Both open the same short form. Nothing is saved until you click {{button:blue|Save}}.

## Filling it in

1. **What is it** — COI (insurance certificate), W-9, License, an Agreement signed on paper, or Other.
2. **Expires** — required for a COI; optional otherwise. Everything the app knows about lapses flows from this one date.
3. **Link to the file** — optional. Paste an `https://` link (Drive works well) so the scan is one click away from the row.
4. **Name** — pre-filled from the type (*COI (filed)*); rename it if you like (*COI 2026 – Hartford*).

:::example Getting a red badge green
Jesse's row shows {{chip:gray|COI missing}}. Open ▶ Documents → + Add document → COI → expires 2027-03-01 → paste the Drive link → Save. The row now reads {{chip:green|COI ✓}}, flips to {{chip:yellow|COI expiring}} 30 days before March 1, and {{chip:red|COI expired}} after it.
:::

## "Looks like a W-9 — set type"

Anything sent or uploaded from **People → Contracts** is typed as the sub's *Agreement* by default, so a document named "W-9" that came in that way counts toward the wrong badge. When a name and its type disagree, the Subs expander shows an amber pill — click it once and the row is retyped. The type and expiry pickers on each row still work for anything else.

## Who can do this

Dev, master, assistant, and controller — the same roles that can edit these rows. Training-mode viewers see no Add button. Badges warn and never block: an expired COI shows red but does not stop a work order — check the column before you hand a sub a job. Column reference: [review your subs in one place](?g=review-your-subs).
