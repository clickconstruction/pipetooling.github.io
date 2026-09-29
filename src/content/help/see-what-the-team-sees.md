---
title: see what the team sees
category: Office
roles: dev
keywords: what the team sees, team emails, staff emails, digest preview, crew day, money waiting, payment forecast, billed awaiting, who gets which email, whose week, a person, email subjects, sign-in email, invitation email, workflow notification, email me the real one, next release, settings
order: 66
---
**Settings → What the team sees** is the other side of *What customers see*: every email the app sends someone on the team — the morning digests, the notices when money moves or a stage changes, the weekly reports, the sign-in and invitation emails — laid out as **one person's week**, in the order it lands in their inbox. Each row shows when it arrives, who gets it, the From line and the **subject with sample values filled in**, and opens to the email itself where the app can build one. Devs see it.

## Whose week

The chips at the top pick a role — Dev, Leader, Assistant, Controller, Estimator, Primary, Superintendent, Helper, Subcontractor — and the tab shows every email that role can receive. Pick **A person** instead and type a name: the rows become what that person actually gets. For the streams whose recipients are a list on **Emails & reports** (Paid job, Ready to bill, Signed agreements, Portal requests, Job reports), the tab reads the list; for the rest, the role decides, the same way the sender does.

:::example A controller's morning
Crew day · Money waiting · Payment forecast — then, during the day, Payment recorded and Check returned as they happen; Weekly money movement on Monday; the account man's ask on Wednesday.
:::

## What each row can show

The count line under the toolbar says where things stand — *25 emails · 11 render live · 4 show the real one · 10 built on the server (next release)* — and every row wears one of three chips:

- {{chip:green|renders live}} — the same builder the sender runs, fed the sample company. Open the row and the email is in the frame. The four template emails (invitation, sign-in, workflow notices, and the task reminder's words) read the live rows on **Email templates**, so an edit there shows here the moment you refresh.
- {{chip:yellow|shows the real one}} — the digests whose function has a preview mode (Crew day, Money waiting, Payment forecast, Billed awaiting). Open the row and press {{button:outline|Show the real one}}: the function builds today's email over live rows, for your eyes only. {{button:outline|Email me the real one}} sends that same email to you.
- {{chip:gray|next release}} — the email's HTML is built inside its function over the database, so nothing renders yet. Each one is lifted into its own builder in turn; the row says which function.

Toggle **Only what doesn't render yet** to see just those.

## Changing who gets one

Nothing on this tab edits recipients or wording. Each row's **Change who gets it →** lands on the stream's card on **Emails & reports** (or on **Email templates** for the template emails), and the change shows here on the next refresh.

## The promise behind the count

A test reads the outbound email catalog on every change: every email marked for the team has a row here. A new team email cannot ship without a place on this tab.
