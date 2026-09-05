---
title: add a customer (and close out the prospect they started as)
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: add customer, new customer, create customer, prospect, converted, started as a prospect, paste fill, customer master, convert
order: 44
---
{{button:blue|+ Add customer}} on **Customers** opens the Add customer form. The same form appears when you create a customer from a bid or an estimate, and at `/customers/new`.

## Fill the form

- **Started as a prospect?** — if this company is already in Prospects, type a few letters of the company, contact, phone, or address and pick them: the form prefills and a {{chip:gray|From prospect: Acme Plumbing — Dana}} chip shows the link. Not from a prospect? Just skip the field, or click **✕** on the chip.
- **Name** is the only required field. Address, phone, email, and **Date Met** are optional and easy to fill in later from the customer's profile.
- **Paste Fill** — paste a tab-separated line (`Name  Address  Email  Phone  Date`) copied from a spreadsheet and click {{button:blue|Fill Fields}} instead of typing.
- **Customer Master** — which master the customer belongs to. Masters are set automatically; assistants and estimators pick from the masters who adopted them.

Press {{button:blue|Save}}. {{button:outline|Cancel}} throws the form away and changes nothing — including the prospect.

:::example What saving does to a linked prospect
When a prospect is linked, Save creates the customer **and** marks the prospect converted: it leaves the Follow Up calling queue, moves under **Converted** on the Prospect List with a note linking the new customer, and counts as a conversion on **Prospects → Activity**. Nothing is written until you press Save.
:::

## Three doors, one result

- **Customers → Add customer** with **Started as a prospect?** — the everyday way; adding the customer *is* the conversion.
- **Prospects → Follow Up → {{button:purple|Converted ✓}}** — mid-call, when the prospect on your card says yes: it opens this same form prefilled with the prospect already linked.
- **Prospects → Convert** — the long form for a prospect who arrives with several contact people and bids to set up at once; it opens on a search box (recently answered prospects are suggested), and saving marks the prospect the same way.
