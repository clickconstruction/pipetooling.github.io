---
title: set what a crew's hour is charged
category: Office
roles: dev, master_technician, assistant, controller
keywords: charge rate, rate card, crew, master with a helper, two techs, helper alone, markup, materials, margin, charged as, standing, 285
order: 101
---
The company charges the customer for a crew's hour, not for each person. What a day costs depends on who was out. A master with a helper is one rate. Two techs together are one rate. A tech alone is another. A helper alone is another. The rate card in Settings holds those numbers. Each person's desk says what they count as.

## Say what each person counts as

Open the person's desk under **People** and find **Access**. The row **Charged as** has four choices.

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

Pick one and it saves at once. A person with nothing picked counts as not charged. The app never prices them by accident.

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

Under the rates, open **Markup on materials**. Type a percent over cost and press {{button:blue|Save the markup}}. The line under the field reads the number both ways. For example, 25% over cost is a 20% margin on the sale. Leave it blank and materials are charged at cost. The paper says so when they are.

## See what a job is charged at

Open **Jobs** and go to **Job Summary**. Two columns sit at the right of the table. **Charges** is the job's crew days at the rate card plus its materials at the markup. **Premium** is how far the contract price stands above the charges. A shortfall reads red. A chip over the table names the rate card and markup in force.

## Adjust a job's charges

Press a **Charges** cell and the Charges window opens. The job's rule and markup sit at the top. Change them and the job keeps the change. Four tiles follow. They show labor, materials, charges, and the stand against the revenue.

Every crew day lists under its week. Each day has a tick and a chip. Untick a day to leave it off. Change the chip to set that day's crew. A reason box appears under it. Every material line has a tick and {{button:outline|Pass through}}. Pass through charges that line at cost.

:::steps

Change a day's chip or untick a line.

Type the reason under it.

Press {{button:blue|Save 1 adjustment}}. The button counts what you changed.

:::

Adjustments live on the job's charges. They never touch anyone's clock session or invoice. The log on the right lists every one with its reason. Press {{button:outline|Revert to the record}} to undo them all. The app asks first.

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

A saved statement keeps the paper as it read. Open it later and it prints the same, even after the rates change. Make a new one for today's rows.
