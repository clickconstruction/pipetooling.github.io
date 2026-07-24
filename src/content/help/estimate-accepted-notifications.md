---
title: get notified when a customer accepts an estimate
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: estimate accepted, acceptance notification, estimate email, who gets notified, accepted notifications, quote accepted, estimate alert, notify on acceptance
order: 62
---
When a customer accepts an estimate, PipeTooling emails the office. There are two lists, and both are sent:

- **Always notify** — an org-wide list set once. These people get an email for *every* accepted estimate, including estimates already sitting with customers.
- **Email when customer accepts** — extra people picked on one specific estimate.

## Set the always-notify list

1. Go to **Estimates**.
2. Click {{button:outline|⚙ Accepted notifications}} next to {{button:primary|New estimate}}. (Dev and master technician roles see this button.)
3. Check everyone who should hear about every acceptance.
4. Click {{button:outline|Save recipients}}.

:::example The ⚙ button sits in the Estimates page header
{{chip:neutral|Estimates}} … {{button:outline|⚙ Accepted notifications}} {{button:primary|New estimate}}
:::

Only a **dev** can change this list. Master technicians can open the window and see who is on it, but the checkboxes and Save button are disabled for them.

## Add extra people to one estimate

1. Open the estimate.
2. Scroll to **Email when customer accepts**.
3. Tick **Notify me** to include yourself, and use **Also notify** to search for anyone else.
4. Save the estimate.

Those picks apply to that estimate only. They are sent *in addition to* the always-notify list — you do not need to re-add the same people there.

## Who actually receives the email

Someone on either list is skipped if:

- they have no email address on their account,
- their account is archived, or
- they have no access to the estimate's owner (they are not that master, not adopted as an assistant, and not a dev or primary).

So it is safe to add someone broadly — they simply will not be emailed about estimates they could not see anyway.

## What the email says

The subject reads **Quote #123 accepted — <customer name>**, and the body links straight to the estimate in PipeTooling.
