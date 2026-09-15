---
title: find a supply house and its rep
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: supply house, supply houses, directory, rep, reps, contact, vendor, phone, email, website, price request, who to call, ferguson, moore supply, reece, counter, quotes desk, trades served, plumbing, electrical, hvac, vendor kind, job account, job accounts, roster, mark opened, curly, role
---

Every supply house the company deals with, who to talk to there, and what we already know about each one — that is the **Directory** on **Materials → Supply houses**. It is one list for the whole company: a rep one person adds is the rep everyone else sees. Estimators see the directory on its own; the office sees it above **Accounts payable**.

## Find a house

Type in the search box — a house name, part of an address, a rep's name or email. The list narrows as you type.

The trade chips beside the search — {{chip:blue|Plumbing}} {{chip:gray|Electrical}} {{chip:gray|HVAC}} — keep the houses that serve the trades you have on. If your account is limited to one trade, the chips start on that trade. A house nobody has tagged with a trade yet always shows.

Each row shows:

- **Reps** — the people at that house we send price requests to. The {{chip:yellow|★}} starred rep is the default: a price request goes there unless you pick someone else. Hover a rep to see who added them and when.
- **Phone** — tap it on a phone to call the counter.
- **Prices on file** — how many parts that house has priced in the Parts Book, and beneath it the last price request: when, who sent it, and whether the house answered.
- {{button:outline|Open website}} — the house's order portal, when one is on file.

## Add a rep

Expand a house (tap its name) and use the **Contacts** box: name, email, an optional label like *quotes desk* or *outside sales*, a phone, and a **role**, then {{button:blue|+ add contact}}. The first rep you add becomes the default; **make default** moves the star. Archive a rep with the × — past requests keep their history.

The role says what the app does with the contact:

- {{chip:green|Job accounts}} — the person who opens a **job account** for a property. Their name and phone show wherever a job needs one: the house's Job accounts roster, the job window, the PO code, and as a teal tag on the Directory row itself. One per house is enough; a house that expects accounts with no such rep says so under its reps.
- {{chip:gray|Price requests}} — the default; where price requests go.
- {{chip:gray|Billing}} — statement and payment questions.

Click a role chip on an existing contact to move them.

:::example The line above the list
**22 supply houses · 6 with a rep · 16 need a rep — add one when you next call.** Houses with no rep sit together at the bottom of the list under a *Needs a rep* band. Until someone adds one, a price request to that house has to be addressed by hand.
:::

:::example Ferguson
**Curly Conley · curly.conley@ferguson.com · 210-344-4950** {{chip:green|Job accounts}} — the office calls Curly before a job's first parts run. The starred **cristian.almendarez** {{chip:gray|Price requests}} still gets the price requests.
:::

## Job accounts at a house

Some houses open an account per property so a job's purchases land on their own statement — Ferguson, Reece and Moore do. The office marks each house on **Edit**: **Job accounts** — *Expects one per property*, *Optional*, or *None*. Only *expects* houses raise a signal when a job buys there with no account on record.

Expand a house in **Accounts payable** and the **Job accounts** roster sits above its invoices: every job with an account there — {{chip:green|open}} with the house's reference and how it was opened, {{chip:purple|requested}} when someone is waiting on the office, {{chip:gray|not needed}} with the reason — and, in amber, every job that has invoices at this house but **no account on record**. {{button:green|Mark opened…}} on a row takes two taps after the call: how (by phone, the packet, at the counter), the reference if the house gave one, the rep, a note. **Not needed** records why (buys on the builder's account, a small service call) so the signal stops for that job.

See [mark an invoice as on a job account](?g=mark-an-invoice-on-a-job-account) for what the account changes on invoices.

## Add or edit a house

{{button:blue|Add supply house}} (the office's button says **Add vendor**) opens the form; {{button:outline|Edit}} on any row opens the same form for that house. Name, address, main phone, website and notes live there, along with **Trades served** — tick the trades the house sells for, or leave them all off to show it to everyone — and, for the office, the vendor's **Kind** and the monthly payment date used for invoice due dates.

## What the Directory is not

Invoices, aging and balances owed live in **Accounts payable**, which only the office sees, right below the Directory on its tab. The Directory never shows a dollar figure — an estimator's Supply houses tab has none.
