---
title: choose who gets the bill on a job
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: bills go to, GC pays, general contractor, homeowner, who pays, billing email, bill to, split, payer, split by line, one bill per payer, pays toggle, pays as GC by default, done right, show it on their statement, share this bill, shown to, eye chip
order: 11
---
Some jobs bill the homeowner, some bill the GC, the general contractor, and some bill each for different work. The job says who pays, in one place, and every bill follows it.

Since v2.3345 you never have to type the GC's address into the customer's email again.

## Tell the job who pays

1. Open the job and go to its **Edit** tab. Make sure the **Customer** is the site owner and **GC/Builder** is the contractor. Use **Use bid's GC** when the job came from a bid with a different GC.
2. A **Bills go to** row appears under the customer's Email. Pick one:

:::example the three choices
{{chip:blue|This customer}} — bills, the statement and the portal address the job customer. This is the default.
{{chip:yellow|GC · Loberg Contracting}} — bills address the GC at its billing email. The customer is not billed.
{{chip:gray|Split by line}} — each draft invoice on the Bill tab picks its own payer.
:::

3. The row saves by itself, like every other fact on the Edit tab.

## Give the GC a billing email

A GC usually has two addresses: the estimator you bid to, and the accounts-payable inbox that pays. Under the GC's rows on the Edit tab, open **Billing email**, enter the AP address and press **Save**. AP is short for accounts payable. It is saved on the GC's customer record, so every job billed to that GC uses it. Blank reads *same as email*. You can also set it on **Edit customer**.

## What Bill Customer does with it

Open {{button:blue|Send bill…}} on a GC-pays job. The window says so at the top: *Billing Loberg Contracting, the GC on this job — not ATI Schertz*. The **Send to** address is the GC's billing email. The contact list is the GC's people. The PDF's *Bill to* line and the Stripe invoice name the GC. Tick **Copy ATI Schertz** to send the customer a copy of the bill. A PDF invoice carries them on the same email. A Stripe bill sends them a copy with the same Pay link when you press Send Email invoice. Or set it once on the job's **Bills also go to** row. Then every bill starts with them ticked. See *send a bill to more than one person*.

If the GC has no billing email yet, the window asks for it right there. It saves the address on the GC.

## Make a GC pay by default

Some builders always pay. Done Right Foundation pays for every pretest. A pretest is the water test that checks the pipes for leaks before the foundation is leveled. Say it once on the builder instead of on each job. Open the GC on **Customers → Edit customer** and tick **Pays as GC by default**. From then on, picking them as the GC switches a job on *This customer* to **Bills go to: GC**. That holds for a job already on the books too. Ticking the box changes no job by itself. Change it on a job and it stays changed.

## Split a job by line

When the owner pays for some of the work and the GC for the rest, keep it on **one job**:

1. Set **Bills go to** to **Split by line** on the Edit tab.
2. On the **Bill tab → ① Line Items**, every work line gets a **Pays** toggle under its name. It shows {{chip:blue|Tommy Gillis}} or {{chip:yellow|Wildflower Springs}}. Tag each line. Untagged lines bill the customer.
3. Click {{button:blue|Make 2 bills by payer — Wildflower Springs $8,400 · Tommy Gillis $3,150}} on the money card. One Ready-to-Bill draft per payer appears in the **Bills** list, with a Draft chip. Each is already addressed. The tagged lines lock to their draft.
4. {{button:blue|Send bill…}} on each draft as usual. For the GC's draft, or a Someone else draft, the Bill Customer window names the payer at the top.

Hours, costs, Burn and the Job Summary stay on the one job number. A discount line follows the work it discounts, so it never needs a tag.

## One bill to a different party

On a **Split by line** job, use {{button:outline|Bill to ▾}} on the draft's row in the job window's **Bill** tab. It also works as a one-off on any job. Pick the customer, the GC, or **Someone else…** for a tenant or property manager. That one still asks for a name and email. See *bill part of a job to someone else*. The row's second line then names the payer, like *not sent · bills Loberg Contracting*. Once sent it reads *sent Sep 4 to Loberg Contracting*. So anyone can see where that bill goes.

## Good to know

- A job's customer and GC are never the same party. Pick a builder as the GC and it comes off the customer row. The bills go to the GC. Pick it as the customer and it comes off GC. A job with a GC and no customer is a **GC job**. Its Customer row reads *none · GC job — Done Right Foundation is the party*. **Bills go to** offers only the GC. Every bill, statement and portal treats the GC as the payer.
- Changing **Bills go to** never changes an email, PDF or Stripe bill that already went out. An open bill with no payer of its own follows the new rule. Its balance moves to the other party's GC Review row and portal.
- **GC Review and the weekly statement** list only what each GC pays. A job whose GC is not the payer sits in the **Not billed to a GC** bucket.
- **The portals** follow it too. A portal is each customer's or GC's own web page of open bills and payments. It opens from a private link, with no sign-in. A GC's balance is what the GC owes. An owner's balance is what the owner owes. A bill the other party does not pay is **not** on their statement unless you shared it. See the next section.

## Show the other party a bill they don't pay

Sometimes the party who is not billed still needs to see the bill. A builder wants to know which of the homeowners they sent you still owe for repairs. Or an owner asked to see the pretest their builder paid for. That is a decision you make **per bill**. You make it in the same place you decide who gets a copy:

1. Open {{button:blue|Send bill…}} on the job. In the **Send to** block, under *Copy Done Right Foundation ap@donerightfoundation.com · the GC, not billed*, there is a second line. It reads **Show it on Done Right Foundation's statement**.
2. Tick it and send. Their portal lists this bill in its own card. For a GC, the card is *Your customers' open bills*. It shows who owes it, the address and job, when it was billed and how long ago. It shows what has been received and what is open. For an owner, the card is *On your job, billed to your builder*. Under a recorded notice it reads *On your property, billed to your builder*. There is no Pay button. It never counts in their balance.
3. Leave it unticked and the bill stays between you and the payer. Nothing is shown unless someone ticked it.

:::example the tick, and what it starts from
☑ **Copy Done Right Foundation** ap@donerightfoundation.com · the GC, not billed
☑ **Show it on Done Right Foundation's statement** — their portal lists this bill as billed to Maria Delgado. No Pay button, not in their balance.
:::

Copy is the email, once. Show is the statement, standing. They are separate ticks. A GC can be copied on a bill without it staying on their statement, and the other way round.

**Changing it later.** On the job window's **Bill** tab, a shared bill says *👁 shown to Done Right Foundation* at the end of its second line. The whole line reads *sent Sep 4 to Maria Delgado · 👁 shown to Done Right Foundation*. Open the row's {{button:outline|⋯}} menu. Under **Who else sees this bill**, pick the other party's statement. Or pick **Only the payer** to hide it again. Their portal changes on its next open. It never changes who pays or who was emailed.

**Remembering it on the job.** The tick starts from the job's memory. On the **Edit** tab, look under *Bills also go to*. The **Show Done Right Foundation** row says whether this job's next bills start ticked. Ticked shows as {{chip:green|on new bills}}. Changing the tick in Bill Customer updates that memory. So a decision carries to the next bill on the same job. Bills already sent are never changed by the memory. Only the bill row's ⋯ on the Bill tab changes a sent bill.

**What the builder can ask.** Under each bill on their *Your customers' open bills* card there is **Ask the office ›**. It offers two choices, *Bill this to us instead* or *Remind the owner for us*, and a note. The ask lands in the **Dispatch inbox** as a Customer waiting request in plain words. It reads *Done Right Foundation asks to be billed for J1017 · 4410 Cedar Hollow ($4,420.00) instead of Maria Delgado*. It comes with the Call button. You decide. To move the bill, first unbill it with **Send back** in the bill row's ⋯. Send back voids any Stripe pay link, and it waits until no payment is applied. Then pick the GC with **Bill to ▾** on the new draft. Or reach out to the owner the way you usually chase. Nothing happens to the owner from the builder's click.

**Starting it on every job for a builder.** A builder may need to see their customers' bills as a rule. Done Right is one, for the repairs on homes they send you. Tick **Sees their customers' bills by default** in the builder's **Edit customer** window. It sits under *Pays as GC by default*. Every new job that names them as GC and someone else as the customer starts with the memory on. Jobs already on the books are not touched.
