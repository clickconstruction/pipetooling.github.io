---
title: see what the team sees
category: Office
roles: dev
keywords: what the team sees, team emails, staff emails, digest preview, crew day, money waiting, payment forecast, billed awaiting, who gets which email, whose week, a person, email subjects, sign-in email, invitation email, workflow notification, email me the real one, next release, settings
order: 66
---
**Settings → What the team sees** shows every email the app sends someone on the team. The tab lays them out as **one person's week**, in the order they land in the inbox.

The tab is the other side of *What customers see*. The emails include these:

- the morning digests, the summary emails that land each morning
- the notices when money moves or a stage changes
- the weekly reports
- the sign-in and invitation emails

Each row shows when the email arrives, who gets it and the From line. The row shows the **subject with sample values filled in**. The row opens to the email itself where the app can build one. Devs see the tab.

## Whose week

The chips at the top pick a role. The roles are Dev, Leader, Assistant, Controller, Estimator, Primary, Superintendent, Helper and Subcontractor. The tab shows every email that role can receive. You can pick **A person** instead and type a name. Then the rows become what that person actually gets.

Some streams, the kinds of email, go to a list kept on **Emails & reports**. Those streams are Paid job, Ready to bill, Signed agreements, Portal requests and Job reports. For those, the tab reads the list. For the rest, the role decides, the same way the sender does.

:::example A controller's morning
Crew day · Money waiting · Payment forecast — then, during the day, Payment recorded and Check returned as they happen; Weekly money movement on Monday; the account man's ask on Wednesday.
:::

## What each row can show

The count line under the toolbar says where things stand. The line says how many of the 25 render live and how many can show the real one. The line also says how many are still built on the server. Every row wears one of three chips:

- {{chip:green|renders live}} means the row uses the same email builder the sender runs, fed the sample company. You open the row and the email is in the frame. The four template emails read the live rows on **Email templates**. The four are the invitation, sign-in, workflow notices and the task reminder's words. So an edit on Email templates shows here the moment you refresh.
- {{chip:yellow|shows the real one}} marks the digests whose server function has a preview mode. Those digests are Crew day, Money waiting, Payment forecast and Billed awaiting. You open the row and press {{button:outline|Show the real one}}. The function builds today's email over live rows, for your eyes only. {{button:outline|Email me the real one}} sends that same email to you.
- {{chip:gray|next release}} means the email is built inside its server function, straight from the database. So nothing renders yet. Each of these emails is lifted into its own builder in turn. The row says which function.

A lifted digest, one moved into its own builder, still keeps its real-one buttons under its sample.

You toggle **Only what doesn't render yet** to see just those.

## Changing who gets one

Nothing on this tab edits recipients or wording. Each row's **Change who gets it →** lands on the stream's card on **Emails & reports**. For the template emails, it lands on **Email templates**. The change shows here on the next refresh.

## The promise behind the count

A test reads the outbound email catalog on every change. The catalog is the list of every email the app sends. Every email marked for the team has a row here. A new team email cannot ship without a place on this tab.
