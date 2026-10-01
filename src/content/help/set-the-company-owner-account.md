---
title: set the company owner account
category: Office
roles: dev
keywords: company owner, master_user_id, one company, job owner, customer owner, settings, jobs and billing, adoption
---

## One company, one account

Since v2.2967 nobody owns a customer, project, job, estimate or prospect. Every office role sees every row.

That means leaders, assistants and controllers all see everything. Assistants are no longer adopted by a leader first. New rows are still filed under one account. That account is the **company owner account**. It is stored in the `master_user_id` column, kept for provenance, the record of where a row came from.

## Set it

1. Open **Settings → Jobs & billing** and expand {{button:outline|Company owner account}}.
2. Pick the account in the select. Leaders and devs are offered. Leave it on **Not set** to fall back to the single leader account, else the creator.
3. Tap {{button:blue|Save company owner account}}.

:::example What changes
Only rows created from now on. A customer or job already filed under someone else keeps that account, and can still be opened, edited and billed by every office role — the account is not a wall.
:::

## Jobs filed under each account

The table under the select counts jobs per account. It lets a dev {{button:outline|Re-assign}} all of one account's jobs to another. That is bookkeeping, not access. It changes the `master_user_id` the jobs carry, nothing about who sees them.
