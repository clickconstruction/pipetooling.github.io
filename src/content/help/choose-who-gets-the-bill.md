---
title: choose who gets the bill on a job
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: bills go to, GC pays, general contractor, homeowner, who pays, billing email, bill to, split, payer, split by line, one bill per payer, pays toggle, pays as GC by default, done right, show it on their statement, share this bill, shown to, eye chip
order: 11
---
Some jobs bill the homeowner. Some bill the GC. Some bill each of them for different work. Since v2.3345 the job says which, in one place, and every bill follows it — you never have to type the GC's address into the customer's email again.

## Tell the job who pays

1. Open the job in **Edit Job**. Make sure the **Customer** is the site owner and **GC/Builder** is the contractor (use **Use bid's GC** when the job came from a bid).
2. A **Bills go to** row appears under the customer's Email. Pick one:

:::example the three choices
{{chip:blue|This customer}} — bills, the statement and the portal address the job customer. This is the default.
{{chip:yellow|GC · Loberg Contracting}} — bills address the GC at its billing email. The customer is not billed.
{{chip:gray|Split by line}} — each draft invoice on the Bill tab picks its own payer.
:::

3. The row saves by itself, like every other fact on the Edit tab.

## Give the GC a billing email

A GC usually has two addresses: the estimator you bid to, and the accounts-payable inbox that pays. Under the GC's rows in Edit Job, open **Billing email** and enter the AP address — it is saved on the GC's customer record, so every job billed to that GC uses it. Blank means "same as their email". You can also set it on **Edit customer**.

## What Bill Customer does with it

Open {{button:blue|Send bill…}} on a GC-pays job and the window says so at the top: *Billing Loberg Contracting, the GC on this job — not ATI Schertz*. The **Send to** address is the GC's billing email, the contact list is the GC's people, and the PDF's *Bill to* line and the Stripe invoice name the GC. Tick **Copy ATI Schertz** to send the customer a copy of the bill (a PDF invoice carries them on the same email; a Stripe bill sends them a copy with the same Pay link when you press Send Email invoice) — or set it once on the job's **Bills also go to** row and every bill starts with them ticked (see *send a bill to more than one person*).

If the GC has no billing email yet, the window asks for it right there and saves it on the GC.

## Make a GC pay by default

Some builders always pay — Done Right Foundation pays for every pretest. Say it once on the builder instead of on each job: open the GC on **Customers → Edit customer** and tick **Pays as GC by default**. From then on, a new job that names them as GC starts with **Bills go to: GC**. It only sets the starting value — change it on a job and it stays changed, and jobs already on the books are not touched.

## Split a job by line

When the owner pays for some of the work and the GC for the rest, keep it on **one job**:

1. Set **Bills go to** to **Split by line** on the Edit tab.
2. On the **Bill tab → ① Line Items**, every work line gets a **Pays** toggle under its name — {{chip:blue|Tommy Gillis}} or {{chip:yellow|Wildflower Springs}}. Tag each line. Untagged lines bill the customer.
3. Click {{button:blue|Make 2 bills by payer — Wildflower Springs $8,400 · Tommy Gillis $3,150}} above the segment bar. One Ready-to-Bill draft per payer appears in the Invoices table, each already addressed, and the tagged lines lock to their draft.
4. {{button:blue|Send bill…}} on each draft as usual — the Bill Customer window names the payer at the top.

Hours, costs, Burn and the Job Summary stay on the one job number. A discount line follows the work it discounts, so it never needs a tag.

## One bill to a different party

On a **Split by line** job, or as a one-off on any job, use {{button:outline|Bill to ▾}} on the draft's row in **Edit Job → Bill**. Pick the customer, the GC, or **Someone else…** for a tenant or property manager (that one still asks for a name and email — see *bill part of a job to someone else*). The row wears a {{chip:yellow|→ Loberg Contracting}} chip so anyone can see where that bill goes.

## Good to know

- A job's customer and GC are never the same party. Pick a builder as the GC and it comes off the customer row (the bills go to the GC); pick it as the customer and it comes off GC. A job with a GC and no customer is a **GC job** — the Customer row reads *none · GC job*, **Bills go to** offers only the GC, and every bill, statement and portal treats the GC as the payer.
- Changing **Bills go to** never touches a bill that has already been sent.
- **GC Review and the weekly statement** list only what each GC pays. A job whose GC is not the payer sits in the **Not billed to a GC** bucket.
- **The portals** follow it too: a GC's balance is what the GC owes, and an owner's is what the owner owes. A bill the other party does not pay is **not** on their statement unless you shared it — see the next section.

## Show the other party a bill they don't pay

Sometimes the party who is not billed still needs to see the bill: a builder wants to know which of the homeowners they sent you still owe for repairs, or an owner asked to see the pretest their builder paid for. That is a decision you make **per bill**, in the same place you decide who gets a copy:

1. Open {{button:blue|Send bill…}} on the job. In the **Send to** block, under *Copy Done Right Foundation · the GC, not billed*, there is a second line: **Show it on Done Right Foundation's statement**.
2. Tick it and send. Their portal lists this bill in its own card — for a GC, *Your customers' open bills*: who owes it, the address and job, when it was billed and how long ago, what has been received, and what is open; for an owner, *On your job, billed to your builder*. No Pay button, and it never counts in their balance.
3. Leave it unticked and the bill stays between you and the payer. Nothing is shown unless someone ticked it.

:::example the tick, and what it starts from
☑ **Copy Done Right Foundation** ap@donerightfoundation.com · the GC, not billed
☑ **Show it on Done Right Foundation's statement** — their portal lists this bill as billed to Maria Delgado. No Pay button, not in their balance.
:::

Copy is the email, once. Show is the statement, standing. They are separate ticks — a GC can be copied on a bill without it staying on their statement, and the other way round.

**Changing it later.** On **Edit Job → Bill**, a shared bill wears a {{chip:green|👁 shown to Done Right Foundation}} chip beside its payer chip. Click the chip (or {{button:outline|👁 ▾}} on a bill nobody sees) to change who sees it or to hide it again. Their portal changes on its next open. It never changes who pays or who was emailed.

**Remembering it on the job.** The tick starts from the job's memory: on **Edit Job → Edit tab**, under *Bills also go to*, the **Show Done Right** row says whether this job's next bills start ticked ({{chip:green|on new bills}}) or not. Changing the tick in Bill Customer updates that memory, so a decision carries to the next bill on the same job. Bills already sent are never changed by the memory — only the chip on the Bill tab changes a sent bill.

**What the builder can ask.** Under each bill on their *Your customers' open bills* card there is **Ask the office ›** with two choices — *Bill this to us instead* or *Remind the owner for us* — and a note. The ask lands in the **Dispatch inbox** as a Customer waiting request in plain words (*Done Right Foundation asks to be billed for J1017 · 4410 Cedar Hollow ($4,420.00) instead of Maria Delgado*) with the Call button. You decide: move the bill with **Bill to ▾** on the Bill tab, or reach out to the owner the way you usually chase. Nothing happens to the owner from the builder's click.

**Starting it on every job for a builder.** If a builder should see their customers' bills as a rule — Done Right and the repairs on homes they send you — tick **Sees their customers' bills by default** on the builder's **Edit customer** page, under *Pays as GC by default*. Every new job that names them as GC (and someone else as the customer) starts with the memory on; jobs already on the books are not touched.
