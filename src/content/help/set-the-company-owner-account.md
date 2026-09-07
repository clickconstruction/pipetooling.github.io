---
title: set the company owner account
category: Settings
roles: dev
keywords: company owner, master_user_id, one company, job owner, customer owner, settings, jobs and billing, adoption
---

## One company, one account

Since v2.2967 nobody owns a customer, project, job, estimate or prospect. Every office role — leaders, assistants, controllers — sees every row, and assistants are no longer adopted by a leader first. New rows are still filed under one account (the `master_user_id` column, kept for provenance): the **company owner account**.

## Set it

1. Open **Settings → Jobs & billing** and expand {{button:outline|Company owner account}}.
2. Pick the account in the select. Leaders and devs are offered; leave it on **Not set** to fall back to the single leader account, else the creator.
3. Tap {{button:blue|Save company owner account}}.

:::example What changes
Only rows created from now on. A customer or job already filed under someone else keeps that account, and can still be opened, edited and billed by every office role — the account is not a wall.
:::

## Jobs filed under each account

The table under the select counts jobs per account and lets a dev {{button:outline|Re-assign}} all of one account's jobs to another. That is bookkeeping, not access: it changes the `master_user_id` the jobs carry, nothing about who sees them.
