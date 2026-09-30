---
title: find a supply house and its rep
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: supply house, supply houses, directory, rep, reps, contact, vendor, phone, email, website, price request, who to call, ferguson, moore supply, reece, counter, quotes desk, trades served, plumbing, electrical, hvac, vendor kind, job account, job accounts, roster, mark opened, curly, role
---

The Directory on Materials → Supply houses lists every supply house the company deals with. It says who to talk to there and what we already know about each one.

It is one list for the whole company. A rep is the person you call at that house. A rep one person adds is the rep everyone else sees. Estimators see the directory on its own. The office sees it above **Accounts payable**.

## Find a house

Type in the search box: a house name, part of an address, a rep's name or email. The list narrows as you type.

The trade chips beside the search are {{chip:blue|Plumbing}} {{chip:gray|Electrical}} {{chip:gray|HVAC}}. They keep the houses that serve the trades you have on. If your account is limited to one trade, the chips start on that trade. A house nobody has tagged with a trade yet always shows.

Each row shows:

- **Reps**: the people at that house we send price requests to. The {{chip:yellow|★}} starred rep is the default. A price request goes there unless you pick someone else. Hover a rep to see who added them and when.
- **Phone**: tap it on a phone to call the counter.
- **Prices on file**: how many parts that house has priced in the Parts Book. Beneath it sits the last price request: when, who sent it, and whether the house answered.
- {{button:outline|Open website}}: the house's order portal, when one is on file.

## Add a rep

Expand a house by tapping its name. Use the **Contacts** box. Enter a name, an email, a phone and a **role**. You can add an optional label like *quotes desk* or *outside sales*. Then tap {{button:blue|+ add contact}}. The first rep you add becomes the default. **make default** moves the star. Archive a rep with the ×. Past requests keep their history.

The role says what the app does with the contact:

- {{chip:green|Job accounts}}: the person who opens a **job account** for a property. A job account is an account the house opens for one property. Their name and phone show wherever a job needs one. That means the house's Job accounts roster, the job window and the PO code. PO means purchase order. It also shows as a teal tag on the Directory row itself. One per house is enough. A house that expects accounts with no such rep says so under its reps.
- {{chip:gray|Price requests}}: the default. Where price requests go.
- {{chip:gray|Billing}}: statement and payment questions.

Click a role chip on an existing contact to move them.

:::example The line above the list
**22 supply houses · 6 with a rep · 16 need a rep — add one when you next call.** Houses with no rep sit together at the bottom of the list under a *Needs a rep* band. Until someone adds one, a price request to that house has to be addressed by hand.
:::

:::example Ferguson
**Curly Conley · curly.conley@ferguson.com · 210-344-4950** {{chip:green|Job accounts}} — the office calls Curly before a job's first parts run. The starred **cristian.almendarez** {{chip:gray|Price requests}} still gets the price requests.
:::

## Job accounts at a house

Some houses open an account per property. A job's purchases then land on their own statement. Ferguson, Reece and Moore do this. The office marks each house on **Edit**. **Job accounts** is set to *Expects one per property*, *Optional*, or *None*. Only *expects* houses raise a signal when a job buys there with no account on record.

Expand a house in **Accounts payable**. The **Job accounts** roster sits above its invoices. It lists every job with an account there. {{chip:green|open}} shows the house's reference and how it was opened. {{chip:purple|requested}} means someone is waiting on the office. {{chip:gray|not needed}} shows the reason. In amber, it lists every job that has invoices at this house but **no account on record**. {{button:green|Mark opened…}} on a row takes two taps after the call. You record how it was opened: by phone, the packet, or at the counter. You add the reference if the house gave one, the rep and a note. **Not needed** records why, so the signal stops for that job. The reason might be that the job buys on the builder's account, or a small service call.

See [mark an invoice as on a job account](?g=mark-an-invoice-on-a-job-account) for what the account changes on invoices.

## Add or edit a house

{{button:blue|Add supply house}} opens the form. The office's button says **Add vendor**. {{button:outline|Edit}} on any row opens the same form for that house. Name, address, main phone, website and notes live there. So does **Trades served**. Tick the trades the house sells for. Leave them all off to show it to everyone. For the office, the form also holds the vendor's **Kind** and the monthly payment date used for invoice due dates.

## What the Directory is not

Invoices, aging and balances owed live in **Accounts payable**. Aging is how long each invoice has waited. Only the office sees it, right below the Directory on its tab. The Directory never shows a dollar figure. An estimator's Supply houses tab has none.
