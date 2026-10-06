---
title: put someone in read-only training mode
category: Getting Started
roles: dev
keywords: read only, training, trainee, learning, explore, new hire, active accounts, restrict, freeze, any role
order: 42
---
Training mode lets someone explore the whole app without changing anything. Every save is blocked until you switch the mode off.

They see everything their role normally sees. That means jobs, materials, customers and reports. The one exception is the clock. They can still **clock in and clock out**. Their real hours keep flowing to payroll while they train.

It works for **any role**, not just assistants. Use it for a new hire finding their feet. Use it to freeze an account you have questions about for a while.

## Start them in training mode when you invite them

The easiest moment is before they exist. You open People → Users and press {{button:blue|+ Hire}}. The dialog has a ***Start in training mode (read-only)*** checkbox beside the invite. **Set a password now** on the same form keeps the checkbox. You tick it and the account is flagged before their first sign-in. There is nothing to remember afterwards. The invite email names the role in plain words, such as *as a Helper*, never a database label. The role itself is a choice you make on the same dialog. There is no default. See [invite someone to sign in](?g=invite-someone-to-sign-in).

If the invite link expires before they use it, you open their desk and press {{button:outline|Send sign-in email}}. The account keeps its training mode. Nothing has to be ticked again.

## Turn it on for an existing account

1. Open People → Users and switch to the **Account** lens. The Training checkbox is on every row there. Or open the person's desk.
2. Find the person's row and tick its **Training** box. On the desk, the same switch is the **Read-only** box on the **Training mode** row.

:::example What they experience
They sign in normally and see an amber **Training mode — read-only** banner at the top of every page. Browsing, searching, and opening records all work; anything that would save a change is rejected with an error instead of saving. Clocking in and out is the exception — punches save normally and go through the usual hours approval.
:::

## Turn it off

You untick the same checkbox. Their normal write access returns the next time the app checks their session. A page refresh picks it up at once.

## Good to know

- **You cannot put your own account in read-only mode.** A read-only user cannot undo it themselves. Doing it to your own account would lock you out. Ask another dev, and ask them to switch it back off.
- Nothing about the account changes except the flag. There is no role change and no data is touched.
- The block is enforced by the database, not just hidden buttons. There is no way around it from the app.
- Save buttons still appear while training. Pressing one shows an error rather than saving. That is expected.
- Clock in and out works only on the person's **own** time. They cannot touch anyone else's sessions. They cannot delete a session or approve hours, not even their own.

## Related

- To take away someone's sign-in entirely, see [archive and restore user accounts](?g=archive-user-accounts).
