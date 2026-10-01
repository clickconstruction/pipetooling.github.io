---
title: set defaults for everyone
category: Office
roles: dev, master_technician
keywords: defaults, org defaults, role defaults, new phone, new device, mobile cards, payroll auto-apply, stripe mode, dismissed alerts, settings, company
order: 40
---

Some switches used to live only on the phone that set them. A new or wiped phone started from scratch every time.

Those switches were **Mobile cards** on Pipeline, **payroll auto-apply** on the Tally and the **Stripe mode**. Which alerts you had dismissed lived there too. Nothing on the server knew what the company preferred. Two things changed.

## Defaults for everyone

**Settings → Company → Defaults for everyone** is one short list. Devs and leaders see it. Each setting says what it does, with three dropdowns under it. They are **Everyone**, **Field roles** and **Office roles**. Set out as a table, a company's choices might read:

:::example For example
| Setting | Everyone | Field roles | Office roles |
|---|---|---|---|
| Mobile cards on Pipeline | No default | On | Off |
| Payroll auto-apply on Tally | Off | — | — |
| Stripe mode | Live | No default | No default |
| Ran long on the Team board | Standard (1.5× the block and 1.5 h over) | No default | No default |
:::

- **Everyone** is the company-wide answer. A **role dropdown** beats it for those roles. Field roles are subs, helpers and superintendents. Office roles are everyone else.
- A device that has **chosen for itself** keeps its choice. The ⋯ menu on Pipeline, the toggle on Tally and the Stripe switch in billing all still work as before. The list only decides what a device starts on when it has not said anything.
- **No default** means each device decides as it does today. Mobile cards keeps its width rule: phones under 560 px start on cards.

Job Mode already has its own role default, on for subs and helpers. It is not in this list.

## Dismissed alerts follow you

When you dismiss the bulk-deletions notice, the claim-dev alert or the rejected-notification banner, that is now remembered on your account. It is not tied to that browser. A new phone starts with the same alerts dismissed. Nothing to set up.

## Things worth knowing

- Changing a default does not reach into devices that already chose. It reaches the ones that have not.
- Stripe mode: **Live** is the real account. Only set **Test** as a default while rehearsing, and set it back.
- Ran long on the Team board sets how far a clocked day may run past its dispatch block. Beyond that, Jobs → Team flags it. Gentle is 1.25× and 1 h over. Standard is 1.5× and 1.5 h over. Loose is 2× and 2 h over. Or off. Field and office roles can differ.
