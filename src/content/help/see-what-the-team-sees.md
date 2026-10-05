---
title: see what the team sees
category: Office
roles: dev
keywords: what the team sees, team emails, staff emails, digest preview, crew day, money waiting, payment forecast, billed awaiting, who gets which email, whose week, a person, email subjects, sign-in email, invitation email, workflow notification, email me the real one, next release, settings
order: 66
---
**Settings → What the team sees** shows every email the app sends someone on the team. It lays them out as **one person's week**, in the order they land in the inbox.

It is the other side of *What customers see*. The emails include the morning digests, the summary emails that land each morning. They include the notices when money moves or a stage changes. They include the weekly reports, and the sign-in and invitation emails. Each row shows when it arrives, who gets it and the From line. It shows the **subject with sample values filled in**. It opens to the email itself where the app can build one. Devs see it.

## Whose week

The chips at the top pick a role. The roles are Dev, Leader, Assistant, Controller, Estimator, Primary, Superintendent, Helper and Subcontractor. The tab shows every email that role can receive. You can pick **A person** instead and type a name. Then the rows become what that person actually gets.

Some streams, the kinds of email, go to a list kept on **Emails & reports**. Those are Paid job, Ready to bill, Signed agreements, Portal requests and Job reports. For those, the tab reads the list. For the rest, the role decides, the same way the sender does.

:::example A controller's morning
Crew day · Money waiting · Payment forecast — then, during the day, Payment recorded and Check returned as they happen; Weekly money movement on Monday; the account man's ask on Wednesday.
:::

## What each row can show

The count line under the toolbar says where things stand. It says how many of the 25 render live and how many can show the real one. It says how many are still built on the server. Every row wears one of three chips:

- {{chip:green|renders live}} means the row uses the same email builder the sender runs, fed the sample company. You open the row and the email is in the frame. The four template emails read the live rows on **Email templates**. They are the invitation, sign-in, workflow notices and the task reminder's words. So an edit there shows here the moment you refresh.
- {{chip:yellow|shows the real one}} marks the digests whose server function has a preview mode. They are Crew day, Money waiting, Payment forecast and Billed awaiting. You open the row and press {{button:outline|Show the real one}}. The function builds today's email over live rows, for your eyes only. {{button:outline|Email me the real one}} sends that same email to you.
- {{chip:gray|next release}} means the email is built inside its server function, straight from the database. So nothing renders yet. Each one is lifted into its own builder in turn. The row says which function.

A lifted digest, one moved into its own builder, still keeps its real-one buttons under its sample.

You toggle **Only what doesn't render yet** to see just those.

## Changing who gets one

Nothing on this tab edits recipients or wording. Each row's **Change who gets it →** lands on the stream's card on **Emails & reports**. For the template emails, it lands on **Email templates**. The change shows here on the next refresh.

## The promise behind the count

A test reads the outbound email catalog on every change. That catalog is the list of every email the app sends. Every email marked for the team has a row here. A new team email cannot ship without a place on this tab.
