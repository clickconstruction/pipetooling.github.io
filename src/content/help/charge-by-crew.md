---
title: set what a crew's hour is charged
category: Office
roles: dev, master_technician, assistant, controller
keywords: charge rate, rate card, crew, master with a helper, two techs, helper alone, markup, materials, margin, charged as, standing, 285, import days, imported days, days the app never recorded
order: 101
---
The company charges the customer for a crew's hour, not for each person. What a day costs depends on who was out. A master with a helper is one rate. Two techs together are one rate. A tech alone is another. A helper alone is another. The rate card in Settings holds those numbers. A dev sets what each person counts as.

## Say what each person counts as

A dev opens the person's desk under **People** and finds **Access**. The row **Charged as** has four choices. Everyone else reads the row and asks a dev to change it.

:::cards

:::card Master
A master plumber or electrician. Out with anyone, the day is a master with a helper.
:::

:::card Tech
A licensed tech. Out with another tech or a helper, the day is two techs.
:::

:::card Helper
A helper. Alone, the day is a helper alone.
:::

:::card Not charged
Never charged to a customer. Office work, estimating, or a sub on their own sheet.
:::

:::

The dev picks one and it saves at once. A person with nothing picked counts as not charged. The app never prices them by accident.

To set everyone at once, a dev opens **Settings**, then **Jobs & billing**, then **Rates charged by crew**. Under the rates, **Who counts as what** lists every person with the same four choices. The dev's pick saves at once. People who left sit at the foot, because their past days still price by it.

A day prices at nothing until someone out counts as a master, a tech or a helper. When that happens, the Charges window names who counts as nobody. It counts only the days a standing would fix. A dev sees a link to each desk and to the list. Anyone else sees the names and asks a dev. The Statement of charges window and the charged hours paper's window name them too.

## Set the rates

Open **Settings** and go to **Jobs & billing**. Open **Rates charged by crew**. The table has one row for each crew.

:::example The rows

Master with a helper {{chip:blue|285.00}}

Two techs {{chip:blue|285.00}}

Master alone {{chip:gray|not set}}

A tech alone {{chip:blue|185.00}}

Two helpers {{chip:gray|not set}}

A helper alone {{chip:blue|75.00}}

Each person beyond two {{chip:gray|not set}}

:::

Type a number in dollars for the crew's hour. Press {{button:blue|Save the rates}}. A blank row is a rate the company has not set. A day that needs it says so on the paper. The app never guesses a rate.

## How a day gets its rate

The people who clocked on a job on the same day are that day's crew. The two highest standings pick the row. A master with anyone is a master with a helper. A tech with anyone below a master is two techs. Two helpers are two helpers. Everyone past two adds the row **Each person beyond two**.

The crew's hours are the longest day of anyone in it. Two techs out eight hours each make one line of eight crew hours. The customer is never charged sixteen hours for that day.

## Set the markup on materials

Under the rates, open **Markup on materials**. Two boxes sit side by side. The first is the markup, a percent over cost. The second is the margin, a percent of the sale. Type in either box and the other follows. A bar under the boxes shows $1,000 of materials as cost and markup. The bar reads what the customer pays. For example, 25% over cost is a 20% margin on the sale. Press {{button:blue|Save the markup}}. Leave both boxes blank and materials are charged at cost. The paper says so when they are.

## Give one job its own rule

Open the job window and go to **Edit**. The last row reads **Charging the customer**. Press it to open the row.

**Charge this job's labor as** lists the choices. The first is the crew on each day, from the rate card. Each shape follows with its rate. The last is a flat rate for every hour. Pick the flat rate and the dollars box wakes.

**Markup on materials** takes a percent for this job alone. Type it as a markup over cost or as a margin on the sale. The other box follows. Leave both blank and the company's markup stands. The row saves when you leave the box. The Charges window writes the same facts, so a change there shows here.

## See what a job is charged at

Open **Jobs** and go to **Job Summary**. Two columns sit at the right of the table. **Charges** is the job's crew days at the rate card plus its materials at the markup. **Premium** is how far the contract price stands above the charges. A shortfall reads red. The premium waits until every day on the job prices, so a dash can mean days still price at nothing. The total leaves out a job whose premium waits. A chip over the table names the rate card and markup in force.

## Adjust a job's charges

Press a **Charges** cell and the Charges window opens. The job's rule and markup sit at the top. The markup shows its margin beside it, and you can type either one. The bar under them starts from this job's own materials cost. Change them and the job keeps the change. Four tiles follow. The tiles show labor, materials, charges, and the stand against the revenue.

Every crew day lists under its week. Each day has a tick and a chip. Untick a day to leave it off. Change the chip to set that day's crew. A reason box appears under it. Every material line has a tick and {{button:outline|Pass through}}. Pass through charges that line at cost.

:::steps

Change a day's chip or untick a line.

Type the reason under it.

Press {{button:blue|Save 1 adjustment}}. The button counts what you changed.

:::

Adjustments live on the job's charges. They never touch anyone's clock session or invoice. The log on the right lists every one with its reason. Press {{button:outline|Revert to the record}} to undo them all. The app asks first.

## Import the days the app never recorded

A dev can put a person's old days into the clock. Open the person's desk and find the **Imported days** row under Hours. Press {{button:outline|Import days…}}.

Type the job number in **Job number**. Paste one day a line in the box. Each line has the day, the hours, and where the day came from. Use a comma between them.

:::example Three days from the bank
2026-10-06, 8, bank row of Oct 10

2026-10-07, 8, bank row of Oct 10

2026-10-08, 4, bank row of Oct 10
:::

Press **Import** and read the answer. The answer says how many days went in and how many were already there. A line that was refused says why. The days wait for approval like a punch. A day that is already there is skipped, so the same lines can be pasted twice.

## Show the customer a statement of charges

Open the job window and go to **Documents**. Under Hours statements sits **Statements of charges**. Press {{button:outline|Statement of charges…}}. The button counts the people who clocked here and the material lines.

The window reads the job. From and To start at the job's first and last day. Change them to cut the period. The box under them names the job's rule. Change the rule in the Charges window, never here. The paper draws on the right as you work.

:::steps

Set From and To.

Leave **Office copy** on to read cost, margin and the premium. Turn it off for the customer copy.

Press {{button:blue|Save the statement}}. The paper gets a number like SC-1042-0001.

Press {{button:outline|Print}} to print it. Print saves it as printed.

:::

The office copy has a box marked office only. It carries the premium or shortfall and every adjustment with its reason. The customer copy carries charged amounts only. It says it is not an invoice.

Printing the customer copy keeps a copy in the job's Documents, under **Sent from this job**. The office copy is never kept there.

A saved statement keeps the paper as it read. Open it later and it prints the same, even after the rates change. Make a new one for today's rows.
