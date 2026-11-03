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

## What comes next

These numbers feed the Statement of charges and the Job Summary's Charges column. Both arrive in later releases. Until then the cards and the desk field hold the facts, and nothing prints.
