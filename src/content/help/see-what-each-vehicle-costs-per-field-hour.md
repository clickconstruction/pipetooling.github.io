---
title: see what each person's vehicle costs per field hour
category: Office
roles: dev
keywords: wheels, vehicle, truck, fuel, gas, own vehicle, company truck, per field hour, rate, fixed rate, arrangement, pay config, review, insurance, registration, service, fuel on no job
---

Some people drive their own truck and the company pays their fuel. Others drive a company truck.

Those are two different deals. **Wheels** on People → Vehicles shows what each one costs per field hour. So they can be compared honestly.

## Set the deal on Pay config

You open Payroll → {{button:outline|Pay config}} and pick a **Vehicle** for each person:

- {{chip:blue|🚗 Own vehicle · fuel paid}} means the company pays the fuel for their own truck.
- {{chip:green|🚚 Company truck}} means they drive a truck the company owns. The truck has fixed costs. Those are insurance while on a plan, registration and service.
- **None** means they ride along or work in the office. Their fuel stays on the job as parts.

Fuel stays on the jobs it was put on, whatever the deal. It counts in each job's cost, the same on every screen. So People → Review charges the deal only for what is not on a job.

- For an own vehicle, Review charges their fuel that is on no job.
- For a company truck, Review charges the truck's fixed costs per field hour. It adds their fuel that is on no job.
- A truck with no insurance, registration or service on file charges only that fuel.

The line shows in a person's math drawer. The deal chip sits beside their name on the ranking.

## Read the Wheels report

People → Vehicles → **🛞 Wheels** lists everyone with a deal. It also lists anyone with fuel in the last 90 days:

:::example Wheels · last 90 days
Micah · {{chip:blue|🚗 own}} · fuel $903 · 148.0 h · fuel per field h $6.10 · fixed **$0.00**
Malachi · {{chip:green|🚚 $2.24/h fixed}} · 2019 Ford F-150 · fuel $3,018 · 496.5 h · fixed **$2.24** — F-150 · $1,114 fixed ÷ 496.5 field h; fuel stays on the jobs
:::

The line above the table averages the two deals all-in, fuel included. That comparison tells you whether paying fuel on a personal truck is cheaper than running one of your own.

- **Fuel** is every card charge in the ⛽ Fuel & gas tag attributed to the person. A refund to the card comes off. Card fuel with no person on it is listed by card above the table. Each name is a door to Banking → Debit cards. There you link the card to its person, or mark it a company card. When you link it, past and future purchases fill in. Company-card purchases are management tools, never fuel. Those are GPS, charging and subscriptions. They show as **Not fuel** with the card names. A payment that was not on a card never counts as fuel. One may be filed under a vehicle label. Then the **Not counted** line names it so you can fix the label.
- **Field hours** are approved clock sessions on jobs, the same hours the parts burden divides by.
- **Fixed / field h** is what Review charges per field hour besides their fuel on no job.
- **Override** lets you type a fixed $/field hour for a person, such as a vehicle allowance. It never includes fuel. Blank goes back to the computed fixed rate.

## The truck table

Under the people, each company truck shows its running cost for the window. That is the holder's fuel, insurance plus registration pro-rated over the 90 days, and service events with a cost. It shows the total and the all-in rate per holder field hour. Review charges only the fixed part, without the fuel. Parked or unassigned trucks list what they carried with no hours against them. Wear is not included yet. Wear is the truck's own value over its life.
