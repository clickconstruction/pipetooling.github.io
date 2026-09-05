---
title: invite someone to sign in
category: Getting Started
roles: dev
keywords: invite, invite via email, new user, new hire, add user, manually add user, create login, role, choose a role, training mode, read only, active accounts, accounts
order: 41
---
A new hire gets into the app one of two ways: you **invite them by email** and they choose their own password, or you **manually add** them with a password you hand over. Both live on the **Active Accounts** panel (Settings → People & teams, or {{button:outline|Accounts · dev}} on People → Users), and both ask you the same two questions first.

## Invite via email

1. Open **Active Accounts** and click {{button:blue|Invite via email}}.
2. Enter their **email**.
3. Pick their **role** from *Choose a role…*. Nothing is pre-selected — {{button:blue|Send invite}} stays greyed out until you choose, so nobody ends up with more access than you meant.
4. Tick **Start in training mode (read-only)** if they should look around before they can change anything.
5. Optionally add their name, then {{button:blue|Send invite}}.

The email says who they are joining as in plain words — *"You've been invited to join … as a Helper"* — and its link opens a **Welcome** page where they set a password once.

:::example Which role?
**Helper** or **Subcontractor** for field crew — they see their own day and their own pay, nothing else. **Estimator**, **Assistant**, **Controller**, **Primary** and **Superintendent** are the office and supervising roles. **Master** sees every office route; **Dev** is administration. If you are unsure, start low — a dev can raise a role later from the same panel or the Person Desk.
:::

## Manually add user

Same panel, {{button:outline|Manually add user}}. It asks for an email, an **initial password** you give them, the **role** (again unselected until you choose), and the same **Start in training mode** box. {{button:blue|Create user}} lights up once all three are filled in. Use this when someone will not click an email link.

## Training mode from the first minute

Ticking **Start in training mode (read-only)** flags the account before they ever sign in: they see everything their role can see, every save is blocked, and clocking in and out still works so their hours reach payroll. Switch it off from their row on Active Accounts or the Person Desk's *Training mode* row when they are ready — see *put someone in read-only training mode*.

## Changing a role later

The role dropdown on each Active Accounts row asks you to confirm before it saves — *Change Sam's role from Helper to Master?* — and **Cancel** leaves the role exactly as it was. The Person Desk's *Access & account* row does the same.

## Good to know

- The invite link is for setting a password once. If they open it again while already signed in, the page says **You're already set up** and offers Sign in — it never resets a password.
- If a link expired, run **Invite via email** again for the same address — it replaces the pending invite with a fresh link. There is no separate "resend" button.
- People → Users → **Add to roster** with *Also invite them to sign in* is the other door; it picks the role from the roster kind (a Subcontractor row invites a Subcontractor) and does not offer training mode.
- The invitation wording, including the company name at the top, is editable at Settings → **Templates** → *Invitation Email*.
