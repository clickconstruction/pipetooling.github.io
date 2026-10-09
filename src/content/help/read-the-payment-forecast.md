---
title: read the payment forecast
category: Office
roles: dev, master_technician, assistant, controller, primary
keywords: payment forecast, cash forecast, past expected, this week, next week, no pay history, pay speeds, res, comm, email the forecast, weekly email, schedule, send now
---
The payment forecast gathers every row on Billed Awaiting Payment into one view. It puts open bills in buckets by when their money should land.

## The payment forecast

The {{button:green|Forecast}} button at the top of the Pipeline rolls every chip up into one view. The Forecast button sits next to {{button:blue|New Job}} and {{button:outline-amber|Follow-ups}}. The same view also opens from the {{button:outline|Payment forecast}} button on the Billed Awaiting Payment header. The view opens from the stage strip's hamburger menu too. The view puts open dollars in buckets by expected payment date. **Past expected** comes first, in red. Past expected is your follow-up queue. Then come **This week**, **Next week** and beyond. The forecast reads two ways:

- **As a cash forecast**: "about $35k should land this week, $47k next week."
- **As a work list**: everything in Past expected is a customer running slower than their own norm. You click any row to jump straight to that bill on the board.

A bill with no bill date sits in **No pay history** at the end. So no money ever hides from the total.

The **Pay speeds** strip under the buckets gives the medians at a glance. The strip shows the company-wide pay time next to the {{chip:blue|Res}} and {{chip:yellow|Comm}} medians. Each median says how many payments it's based on. Res means residential and Comm means commercial. Every row also wears its customer's Res/Comm tag. Commercial GCs usually pay on check runs, while homeowners pay on the spot. So the same "late by 10 days" reads very differently between the two.

## Emailing the forecast

The {{button:outline|✉ Email…}} button in the forecast's header sends this exact view as an email. The email has the bucket totals, the pay-speeds line, and every bill with its expected date. Past-expected follow-ups come first. The email is built **fresh at send time**. So a Monday 7 AM email shows Monday's numbers.

- **Send now** emails a teammate immediately. **Schedule…** picks a date and time, in Central time. **Repeat weekly** turns it into a standing subscription. The classic setup is Monday 7:00 AM. Then the week's cash-in picture is in the inbox before the day starts.
- **Preview** opens the email in a new tab. **Email me a test** sends it to your own address first.
- Pending sends list at the bottom of the dialog, each with a **Cancel**. Cancelling a weekly send ends the chain.
- Recipients are office-capable teammates: dev, leaders, assistant-type roles and primary. Scheduled sends also appear on the recipient's {{icon:gear}} **Settings → Your account → My email schedule**.
- Every job in the email links back to the app. The **Open the forecast in ClickTooling** button lands right on this window.

Sending is for dev, leaders and assistant-type roles. Those roles are the same people who can share the Billed report.

## More on the forecast

- Each bill's date comes from its Expected row. A promised date overrides the estimate. The forecast files it later by how far that customer usually slips. Collections jobs are left out. See [see when a customer will pay](/help/see-when-a-customer-will-pay#reading-the-expected-row).
- The Pay speeds strip opens the breakdown. See [see which customers pay slowly](/help/see-which-customers-pay-slowly).
- A row whose job has clock sessions carries a chevron arrow at its left edge. It opens the months people worked. See [see which months need a lien notice](/help/see-which-months-need-a-lien-notice).
