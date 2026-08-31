---
title: understand how ClickTooling works
category: Getting Started
roles: all
keywords: overview, masters, assistants, subs, projects, stages, sharing, mission
order: 1
---
ClickTooling is one system for the whole shop: win work (**Bids**, **Estimates**), run it (**Projects** with workflow steps, the **Jobs** pipeline, **Schedule & Dispatch**), and settle it (billing, payments, payroll, banking).

**People** come in nine roles. **Masters** own customers and projects. Office staff — **Assistants** and **Controllers** — work across the company's customers; controllers also handle payroll. Field roles — **Subs** and **Helpers** — see only work assigned to them. **Estimators** live in Bids and Materials, **Primaries** are customer-side principals with billing visibility, **Superintendents** supervise their assigned projects, and **Devs** administer everything.

## The basic model

1. Master accounts have **Customers**
2. Customers can have **Projects**
3. Masters assign People to **Project Steps**
4. When People complete Steps, Masters are updated

Day-to-day service work runs through **Jobs**: each job belongs to a customer and moves through a simple pipeline. You'll see these status chips all over the app:

:::example The job pipeline
{{chip:gray|Waiting}} → {{chip:blue|Working}} → {{chip:yellow|Ready to bill}} → {{chip:red|Billed}} → {{chip:green|Paid}}
:::

**New jobs start in Working** — whether you add them with New Job or they come out of an accepted estimate. **Waiting** is the parking stage you send a job *back* to when it isn't live yet.

A job collects everything about the work in one place — schedule blocks, clock time, reports, materials, and billing.

## Sharing

- Office staff (assistants, controllers) automatically have access to the company's customers and projects — assistants can manage workflow steps, see **Notes for Office**, and see job and project money, but never wages or payroll (controllers see those too).
- Masters can choose to **share with other Masters** — shared masters get assistant-level **view** access to the sharing master's data.

## Subcontractors

- Only see a workflow step when it is assigned to them
- Can Start and Complete their steps, and **accept or decline work orders** offered on a step
- See **their own pay** — their sub sheets and a money view on the Dashboard — but never Notes for Office or anyone else's financials
- Cannot add, edit, delete, or assign steps

When a Master or Assistant selects **Notify** on a step, that step shows up in their Subscribed Steps on the Dashboard.

## Finding your way around

The header is your map. On a phone, most of these live behind the {{icon:gear}} gear menu in the top-right.

:::example Header icons (top-right)
{{icon:gear}} **Gear menu** — Job Mode toggle, Dark Mode toggle, Calendar, Help (this page), Settings, Sign out
:::

- **Dashboard** — your day at a glance: assigned jobs, clock, inboxes, and (for office roles) billing queues.
- **Jobs** — the job ledger and its Pipeline board. Jobs open in two modals that link to each other: **Job Detail** (read-only view with the activity history; has an Edit affordance) and **Edit Job** (the form; its {{button:outline-blue|Job Detail}} button at the top closes the form and opens the detail view). Edit Job has no Save button — changes save automatically as you make them (see the "know when Edit Job saves my changes" guide).
- **Schedule** — who is on which job, each day.
- **Bids / Estimates** — winning the work before it becomes a job.
- **Settings** — your profile, notifications, and role-specific configuration.
- **Help** (this page) — guides for every part of the app. Each guide has a feedback box at the bottom that goes straight to the devs.

## Our mission

ClickTooling is designed to decrease the actions and thinking necessary for Plumbers, Electricians, and HVAC techs to engage and win work, while reducing the communication risk of completing that work with Assistants, Teammates, Subs, and Customers. The mission is to reduce uncertainty so better and faster decisions can be made.
