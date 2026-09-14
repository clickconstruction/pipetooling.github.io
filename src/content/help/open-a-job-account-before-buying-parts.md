---
title: open a job account before buying parts
category: Field Work
roles: dev, master_technician, assistant, controller, subcontractor, helpers, estimator, primary, superintendent
keywords: job account, supply house, counter, ferguson, reece, moore, curly, parts, buy, ask the office, dispatch, mark opened, rep, phone, reference
---

Some supply houses open a **job account** per property — Ferguson, Reece and Moore do — so what you buy for a job lands on that job's own statement. The rule is simple: **before the first parts run, the job should have an account at the house you are buying from.** The app shows you whether it does, right on the job.

## Read the line on the job

Every job card you open — the Dashboard schedule, Assigned Jobs, Dispatch Mode, the job window — carries a **Job accounts** line with one chip per house that expects an account:

- {{chip:green|Ferguson ✓}} — open. Tap it for what to say at the counter.
- {{chip:purple|Reece · requested}} — someone asked the office; Dispatch is on it.
- {{chip:gray|Moore · none yet}} — nothing on record. Tap it to ask.
- {{chip:gray|not needed}} — the office decided this job does not need one there (a small service call, a builder's own account). Tap it to see why.

Only houses that expect job accounts appear, so most jobs show one to three chips.

## At the counter: tap the ✓

The sheet gives you the three things the counter asks for:

- **Tell the counter** — one sentence: *Click Plumbing and Electrical · job account for 4114 Pond Hill Rd, Bldg 2 · ref JA-4114*. {{button:outline|Copy for the counter}} puts it on your clipboard. Your PO code still goes on the ticket as usual.
- **Reference** — the house's own number when they gave one; otherwise the house keys it on the address.
- **Rep** — who opened it and their number. {{button:outline|Call Curly}} dials them if the counter cannot find the account.

## No account yet: ask the office in one tap

Tap {{chip:gray|none yet}}:

1. The houses with no account are pick chips; the one you tapped is already on. Add another if you will buy there too.
2. Leave **I'm at the counter now** checked when you are — the office sees it in amber at the top of their card.
3. Say what you are buying, roughly how much, then {{button:purple|Send to Dispatch}}.

The chip turns {{chip:purple|requested}}. Dispatch gets the ask with the rep's name and number and marks it open in two taps. **You get a push** when it is: *Dispatch answered: … Ferguson job account open · ref JA-4114*. The next time you open the job the chip reads ✓.

If you would rather call the rep yourself, the number is on the sheet — the office still has to mark it opened, so send the ask too.

:::example What the office sees
**Open a job account at Reece for 951 · Shearer Pinpoint — asked from the counter, buying now** · Abraham · 1:40 PM · *"Rough-in for the slab, ~$1,800"* · **Reece** rep Curly Conley · 210-344-4950 {{button:outline|Call Curly}} {{button:green|Mark opened…}} {{button:outline|Send the packet}}
:::

## For the office: when the job is made

Right after a new job saves (once the contract question is answered), a second question: **Job accounts for J1018?** Pick the houses the job will buy from — {{chip:blue|Ferguson}} {{chip:blue|Reece}} {{chip:gray|Moore Supply}} — and {{button:blue|Send to Dispatch}}. The ask lands in the Dispatch inbox that day, so the account is open before the first parts run. **None needed** records it for every house so nothing signals; **Later** just closes.

If another job at the same address already has an open account at a house, a teal band offers to carry it over — {{chip:green|Same Ferguson account · JA-4114}} — with the reference, how it was opened and the rep copied, so the office never asks Curly twice for one property.

## For the office: the PO code is the moment

Most parts runs start with a PO code minted by the office — **Materials → PO Generator**, or the **PO** tab in Dispatch Mode on a phone. Once the job and the supply house are picked, the status sits right under the house:

- Amber — *No job account at Ferguson for 964 · Pondhill demo yet. Ferguson expects one per property. Curly Conley opens them: 210-344-4950.* with {{button:outline|Call Curly}}, {{button:green|Mark opened…}}, {{button:outline|Send the packet}} and *Not needed for this job*. Make the call, mark it opened, then mint the code.
- Teal — *Ferguson job account open · ref JA-4114 · Sep 2 · by phone · rep Curly Conley*. Mint the code.

A tech's open ask shows here too (*asked Sep 14 from the counter — not open yet*), so marking it opened from the PO tab closes their request and sends their push. The code always mints — this is a signal, never a gate.

## For the office: the errand card

The ask lands in the **Dispatch inbox** (both Dashboard positions and Dispatch Mode) with a line per house:

- {{button:outline|Call Curly}} — the house's job-accounts rep (set on the house's contacts with the **Job accounts** role).
- {{button:green|Mark opened…}} — how it was opened, the reference if the house gave one, a note. Saving records the account on the job, closes the request, and pushes the tech.
- {{button:outline|Send the packet}} — opens the job window's *Share with supply house* email when the house wants the setup packet (it needs the property owner; see [share a job with a supply house](?g=share-job-with-supply-house)).
- **Not needed** — records why, so the signal stops for that job and house.

The account then shows on the house's **Job accounts** roster under **Materials → Supply houses** — see [find a supply house and its rep](?g=find-a-supply-house-and-its-rep).
