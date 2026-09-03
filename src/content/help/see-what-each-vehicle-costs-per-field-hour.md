---
title: see what each person's vehicle costs per field hour
category: people
roles: dev
keywords: wheels, vehicle, truck, fuel, gas, own vehicle, company truck, per field hour, rate, arrangement, pay config, review, insurance, registration, service
---

Some people drive their own truck and the company pays their fuel. Others drive a company truck, and the company carries fuel, insurance, registration and service. Those are two different deals, and **Wheels** on People → Vehicles shows what each one costs per field hour so they can be compared honestly.

## Set the deal on Pay config

Open Payroll → {{button:outline|Pay config}} and pick a **Vehicle** for each person:

- {{chip:blue|🚗 Own vehicle · fuel paid}} — their fuel counts as part of employing them. The rate is their fuel-tag card charges divided by their field hours.
- {{chip:green|🚚 Company truck}} — the truck they hold on Vehicles is priced all-in: fuel, insurance while on a plan, registration and service, divided by their field hours.
- **None** — rides along or works in the office. Nothing changes; their fuel stays on the job as parts.

The deal itself does not move any profit number yet. Review starts using these rates in the next release.

## Read the Wheels report

People → Vehicles → **🛞 Wheels** lists everyone with a deal (or with fuel in the last 90 days):

:::example Wheels · last 90 days
Micah · {{chip:blue|🚗 $6.10/h}} · fuel $903 · 148.0 h · rate **$6.10**
Malachi · {{chip:green|🚚 $8.32/h}} · 2019 Ford F-150 · fuel $3,018 · 496.5 h · rate **$8.32** — F-150 · $4,132 ÷ 496.5 field h
:::

The line above the table averages the two deals, which is the comparison that tells you whether paying fuel on a personal truck is cheaper than running one of your own.

- **Fuel** is every card charge in the ⛽ Fuel & gas tag attributed to the person in Banking → Accounting. Fuel with no person on it is called out above the table; attribute it there and refresh.
- **Field hours** are approved clock sessions on jobs, the same hours the parts burden divides by.
- **Override** lets you type a flat $/field hour for a person; blank goes back to the computed rate.

## The truck table

Under the people, each company truck shows its running cost for the window: the holder's fuel, insurance plus registration pro-rated over the 90 days, service events with a cost, the total, and the rate per holder field hour. Parked or unassigned trucks list what they carried with no hours against them. Wear (the truck's own value over its life) is not included yet.
