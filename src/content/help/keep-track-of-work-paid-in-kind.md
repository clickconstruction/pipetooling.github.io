---
title: keep track of work paid in kind
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: in kind, in kind page, paid in kind, pays in kind, trade, barter, rent credit, credit instead of money, concrete, gravel, arrangement, ledger, add a line, overhead, counts on a job, scheduled in kind, take back a line, landlord, monthly credit, credit every month, not entered, no credit this month, needs you
---
Some customers pay for finished work with something other than money. A landlord takes it off the rent. A supplier sends concrete. The customer's page keeps that deal in one place.

## Set up paying in kind

:::steps

Open the customer's page. Under the money strip, press **Set up paying in kind**. The press shows for a customer with money open.

Say what they give instead of money, for example *Rent credit, the shop*.

Write the terms in your own words. This is the note the next person reads.

Tick the jobs it pays. The open billed jobs start ticked.

Press {{button:blue|Save the arrangement}}.

:::

The customer's page now shows a card named **Pays in kind**. It says the deal in a sentence, what has been paid in kind and what is still to come.

The bills of those jobs now read as scheduled in kind. The open balance stops reading as late. The collected line says how much of it was in kind. Pay speed leaves in kind payments out.

## Add a line when something is given

Each thing given is one line. A line has an amount, a date and a memo of the details.

:::steps

On the card, press {{button:blue|Add a line}}.

Type the amount it was worth and the date it was given.

Under **What was given instead of money**, write the details. For example *6 yards of concrete, the yard pad behind the shop*.

Read **Where it goes**. The line pays the oldest open bill first. A line bigger than one bill carries on to the next.

Press the blue press. It names the amount, for example *Add the line for $885.00*.

:::

One line can pay two bills. The app writes one In kind payment on each, and each says its part of the line.

:::example A load of concrete
A supplier owes $6,800.00 for a wash rack job. They send 6 yards of concrete worth $885.00. You add one line for $885.00. The wash rack bill now has $885.00 less open.
:::

## A credit every month

Some deals have a credit each month, such as rent. Tick **It has a credit every month** when you set the deal up, or under **Change the terms**.

:::steps

Type the usual credit a month.

Pick the first month to enter. Months before it were typed by hand and stay as they are.

If the credit comes off a bill you pay, type the whole monthly bill and its name at the bank. Both are optional.

:::

The app then watches each month. A month is due once it is over, or once its bill has left the bank. The card shows an amber line, and the Dashboard's **Needs you** card shows one too.

:::steps

Press the blue press on that line. It names the month, for example *Enter November's credit*.

Read **What the bank shows**. The window picks the credit from it.

Pick another answer if the bank is wrong. **No credit this month** settles a month when the whole bill was paid.

Press the blue press. It names the month and the amount.

:::

:::example Half the rent
The rent is $3,000.00 and the usual credit is $1,500.00. In a month $1,500.00 left the bank, the window picks $1,500.00. In a month nothing left the bank, it picks $3,000.00. In a month the whole rent was paid, it picks no credit.
:::

Nothing is entered by itself. The app suggests, and you press.

You can enter a month before it is due. Open the ledger and press **Enter it early** on that month's row. The window picks the usual credit, since the bank has nothing to say yet. If the amount changes later, take the line back and enter the month again.

## Overhead or a job

A line is a cost that never touched a card or a supply house bill. Under **Counts as**, say where it belongs.

:::cards

:::card Overhead
The line is a cost of the company, on no job. This is how a new line starts.
:::

:::card A job
Pick the job the goods were used on. The line counts as that job's material.
:::

:::

A line on a job can go back to overhead. Open the ledger and press **Count as overhead** on that line.

An overhead line shows in the overhead pool on the day it was given. A line on a job shows on that job's **Costs** tab as *Given in kind*, and it counts in the job's profit.

## Read the ledger

Press **Open the ledger** on the card. The ledger shows each line with what it counts as and the bills it went to. Under the lines are the bills the deal pays, oldest first. The next bill in line is marked.

An In kind payment typed on a bill by hand still counts as paid. The ledger says how many there are, and **Show them** lists them.

## The chip beside a customer's name

A customer who pays in kind carries a small chip beside the name. It shows on the Customers list and on the customer's page.

The chip says where the deal stands. *In kind · $9,375.40 to come* is what is still open on the deal's bills. *In kind · November due* means a month's credit is waiting, and the chip turns amber. *In kind · we owe $1,400.00 of work* means they gave more than is billed.

Press the chip to open the deal's ledger.

On the Customers list, **Total open balance** counts money owed only. The part a deal pays is named under it as scheduled in kind. **Owes money** leaves that part out too. Press **In kind** to list everyone who pays this way.

## A new job for a customer who pays in kind

A new job is not on the arrangement until a person puts it there. The job window says so in a strip under the tabs. Press **Put it on the arrangement** to add the job.

Bill Customer asks the same thing once. It says the customer pays in kind and asks how this bill is paid. Nothing is picked for you.

Pick **In kind, on the arrangement** to put the job on the deal. Then press **Record the bill in kind**. The bill is recorded and sent to nobody.

Pick **With money** to bill it like any other job. It is sent and chased as usual.

A customer can have more than one arrangement. Then the first choice reads **In kind, on an arrangement**, and Bill Customer cannot know which one pays. Pick that choice and press **Open the arrangements**. On the customer's page, put the job on one of them under **Change the terms**. Then open Bill Customer again. Nothing is billed until you do. The strip in the job window opens the same page.

A job that is already on the arrangement gets no question. Bill Customer opens ready to record the bill in kind. To bill that job for money, take it off the arrangement first under **Change the terms**.

## See every arrangement

Open [Accounts Receivable](/accounts-receivable) and press **In kind** at the top. The [In kind](/in-kind) page lists every customer who pays this way.

Each row says what is given, how far along it is and what is still to come. A row with a month due comes first. Press the row's press to open that deal on the customer's page.

**Set up paying in kind** on that page finds a customer by name. Use it for a customer with nothing open yet.

## Take a line back

In the ledger, press **Take back** on the line. A window asks first, and its press names the amount.

The payments that line wrote leave their bills. Those bills read as open again. The line stays in the ledger, crossed out, under **Show lines taken back**.

## A bill on Stripe

A line passes over a bill that went out through Stripe. The window names that bill. Stripe has to be told from the bill itself, so record that payment there. See [record payments so they count](/help/record-payments-so-they-count#a-payment-that-is-not-money).

## Change the terms or end it

In the ledger, press **Change the terms**. You can change the words and the jobs it pays.

**End the arrangement** closes it. It takes no more lines. Its open bills read as ordinary bills again, so they can read as late.

**Remove it** shows only while no line stands on the arrangement. It is for one made by mistake.
