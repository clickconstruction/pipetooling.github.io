---
title: add a customer (and close out the prospect they started as)
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: add customer, new customer, create customer, prospect, converted, started as a prospect, paste fill, customer leader, convert
order: 44
---
You press {{button:blue|+ Add customer}} on **Customers** to open the Add customer form. The same form opens from a bid, from an estimate, and at `/customers/new`.

## Fill the form

- **Started as a prospect?** Use this when the company is already in Prospects. Type a few letters of the company, contact, phone or address and pick them. The form prefills, and a {{chip:gray|From prospect: Acme Plumbing — Dana}} chip shows the link. Not from a prospect? Skip the field, or click **✕** on the chip.
- **Name** is the only required field. Address, phone, email and **Date Met** are optional. You can fill them in later from the customer's profile.
- **Paste Fill** takes a tab-separated line copied from a spreadsheet, in the order Name, Address, Email, Phone, Date. Paste it and click {{button:blue|Fill Fields}} instead of typing.
- **No owner to pick.** Every customer belongs to the company. It is filed under the company owner account, which a dev sets in Settings → Jobs & billing. That account decides nothing about who can see the customer.

Press {{button:blue|Save}}. {{button:outline|Cancel}} throws the form away and changes nothing. The prospect is not changed either.

:::example What saving does to a linked prospect
When a prospect is linked, Save creates the customer **and** marks the prospect converted: it leaves the Follow Up calling queue, moves under **Converted** on the Prospect List with a note linking the new customer, and counts as a conversion on **Prospects → Activity**. Nothing is written until you press Save.
:::

## Three doors, one result

- **Customers → Add customer** with **Started as a prospect?** is the everyday way. Adding the customer is the conversion.
- **Prospects → Follow Up → {{button:purple|Converted ✓}}** is for mid-call, when the prospect on your card says yes. It opens this same form prefilled with the prospect already linked.
- **Prospects → Convert** is the long form. Use it for a prospect who arrives with several contact people and bids to set up at once. It opens on a search box, and recently answered prospects are suggested. Saving marks the prospect the same way.
