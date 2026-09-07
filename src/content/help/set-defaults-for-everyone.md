---
title: set defaults for everyone
category: Office
roles: dev, master_technician
keywords: defaults, org defaults, role defaults, new phone, new device, mobile cards, payroll auto-apply, stripe mode, dismissed alerts, settings, company
order: 40
---

Some switches used to live only on the phone that set them: **Mobile cards** on Pipeline, **payroll auto-apply** on the Tally, the **Stripe mode**, and which alerts you had dismissed. A new or wiped phone started from scratch every time, and nothing on the server knew what the company preferred. Two things changed.

## Defaults for everyone

**Settings → Company → Defaults for everyone** (dev and leader) is one small table:

:::example The table
| Setting | Everyone | Field roles | Office roles |
|---|---|---|---|
| Mobile cards on Pipeline | No default | On | Off |
| Payroll auto-apply on Tally | Off | — | — |
| Stripe mode | Live | No default | No default |
:::

- **Everyone** is the company-wide answer. A **role column** beats it for those roles (field = subs, helpers, superintendents; office = everyone else).
- A device that has **chosen for itself** keeps its choice — the ⋯ menu on Pipeline, the toggle on Tally, the Stripe switch in billing all still work exactly as before. The table only decides what a device starts on when it hasn't said anything.
- **No default** means "each device decides as it does today" (Mobile cards keeps its width rule: phones under 560 px start on cards).

Job Mode already has its own role default (on for subs and helpers) and isn't in this table.

## Dismissed alerts follow you

When you dismiss the bulk-deletions notice, the claim-dev alert or the rejected-notification banner, that is now remembered on your account, not just on that browser. A new phone starts with the same alerts dismissed. Nothing to set up.

## Things worth knowing

- Changing a default doesn't reach into devices that already chose; it reaches the ones that haven't.
- Stripe mode: **Live** is the real account. Only set **Test** as a default while rehearsing, and set it back.
