---
title: open a job account before buying parts
category: Field Work
roles: dev, master_technician, assistant, controller, subcontractor, helpers, estimator, primary, superintendent
keywords: job account, supply house, counter, ferguson, reece, moore, curly, parts, buy, ask the office, dispatch, mark opened, rep, phone, reference
---

Some supply houses open a job account per property. Ferguson, Reece and Moore do.

With a **job account**, what you buy for a job lands on that job's own statement. The rule is simple. **Before the first parts run, the job should have an account at the house you are buying from.** The app shows you whether it does, right on the job.

## Read the line on the job

Every job card you open carries a **Job accounts** line. That is the Dashboard schedule, Assigned Jobs, Dispatch Mode, and the job window. The line has one chip per house that expects an account:

- {{chip:green|Ferguson ✓}} means open. You tap it for what to say at the counter.
- {{chip:purple|Reece · requested}} means someone asked the office. Dispatch is on it.
- {{chip:gray|Moore · none yet}} means nothing on record. You tap it to ask.
- {{chip:gray|not needed}} means the office decided this job does not need one there. That may be a small service call, or a builder's own account. You tap it to see why.

Only houses that expect job accounts appear. So most jobs show one to three chips.

## At the counter: tap the ✓

The sheet gives you the three things the counter asks for:

- **Tell the counter** is one sentence. It reads *Click Plumbing and Electrical · job account for 4114 Pond Hill Rd, Bldg 2 · ref JA-4114*. {{button:outline|Copy for the counter}} puts it on your clipboard. Your PO code still goes on the ticket as usual.
- **Reference** is the house's own number when they gave one. Otherwise the house keys it on the address.
- **Rep** is who opened it and their number. {{button:outline|Call Curly}} dials them if the counter cannot find the account.

## No account yet: ask the office in one tap

You tap {{chip:gray|none yet}}:

1. The houses with no account are pick chips. The one you tapped is already on. Add another if you will buy there too.
2. Leave **I'm at the counter now** checked when you are. The office sees it in amber at the top of their card.
3. Say what you are buying, and roughly how much. Then tap {{button:purple|Send to Dispatch}}.

The chip turns {{chip:purple|requested}}. Dispatch gets the ask with the rep's name and number. Dispatch marks it open in two taps. **You get a push** when it is. It reads *Dispatch answered: … Ferguson job account open · ref JA-4114*. The next time you open the job the chip reads ✓.

You may rather call the rep yourself. The number is on the sheet. The office still has to mark it opened, so send the ask too.

:::example What the office sees
**Open a job account at Reece for 951 · Shearer Pinpoint — asked from the counter, buying now** · Abraham · 1:40 PM · *"Rough-in for the slab, ~$1,800"* · **Reece** rep Curly Conley · 210-344-4950 {{button:outline|Call Curly}} {{button:green|Mark opened…}} {{button:outline|Send the packet}}
:::

## For the office: when the job is made

A new job saves, and the contract question is answered. Then a second question appears: **Job accounts for J1018?** You pick the houses the job will buy from: {{chip:blue|Ferguson}} {{chip:blue|Reece}} {{chip:gray|Moore Supply}}. Then you press {{button:blue|Send to Dispatch}}. The ask lands in the Dispatch inbox that day. So the account is open before the first parts run. **None needed** records it for every house so nothing signals. **Later** just closes.

Another job at the same address may already have an open account at a house. Then a teal band offers to carry it over: {{chip:green|Same Ferguson account · JA-4114}}. It copies the reference, how it was opened and the rep. So the office never asks Curly twice for one property.

## For the office: the PO code is the moment

Most parts runs start with a PO code minted by the office. A PO is a purchase order. You mint it at **Materials → PO Generator**, or on the **PO** tab in Dispatch Mode on a phone. Once the job and the supply house are picked, the status sits right under the house:

- Amber reads *No job account at Ferguson for 964 · Pondhill demo yet. Ferguson expects one per property. Curly Conley opens them: 210-344-4950.* It comes with {{button:outline|Call Curly}}, {{button:green|Mark opened…}}, {{button:outline|Send the packet}} and *Not needed for this job*. You make the call, mark it opened, then mint the code.
- Teal reads *Ferguson job account open · ref JA-4114 · Sep 2 · by phone · rep Curly Conley*. You mint the code.

A tech's open ask shows here too. It reads *asked Sep 14 from the counter — not open yet*. So marking it opened from the PO tab closes their request and sends their push. The code always mints. This is a signal, never a gate.

## For the office: the errand card

The ask lands in the **Dispatch inbox** with a line per house. The inbox sits in both Dashboard positions and in Dispatch Mode.

- {{button:outline|Call Curly}} calls the house's job-accounts rep. You set the rep on the house's contacts with the **Job accounts** role.
- {{button:green|Mark opened…}} takes how it was opened, the reference if the house gave one, and a note. Saving records the account on the job. It closes the request and pushes the tech.
- {{button:outline|Send the packet}} opens the job window's *Share with supply house* email. You use it when the house wants the setup packet. It needs the property owner. See [share a job with a supply house](?g=share-job-with-supply-house).
- **Not needed** records why. Then the signal stops for that job and house.

The account then shows on the house's **Job accounts** roster under **Materials → Supply houses**. See [find a supply house and its rep](?g=find-a-supply-house-and-its-rep).
