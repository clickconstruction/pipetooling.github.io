---
title: work Today's sends
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: today's sends, todays sends, offers, prepared text, morning run, send all, hold until, stop reminding, not this one, send later, send in the morning, change the time, dashboard, needs you, flows
where: /dashboard
order: 41
---
Today's sends is the list of texts the app prepared but did not send. You read each one, change a word if you like, and press Send. Nothing on this list goes on its own.

## Find the list

1. Open the Dashboard.
2. Under **Needs you**, find the row that counts the texts, like *3 texts to send*. Under the count are the names the texts go to.
3. Press {{button:amber|Read them}}. The press opens the list. It sends nothing.

:::example The row on the Dashboard
**3** texts to send
**Dana Whitfield** · **Marcus Bell** · **Priya Raman**
{{chip:gray|1 · Tue 9:00 AM}} {{chip:yellow|1 held · no number}} {{button:amber|Read them}}
:::

The count is the texts you can send now. A grey chip with a clock is a text set to go at a time, and it shows the time. A yellow chip is a held text, and it shows why. With one text to send, the row shows the text itself.

When no text can go, the row reads *2 texts cannot go* and names each person with the cause. When only timed texts wait, the row is grey and needs nobody.

The row only shows when a text waits.

## Where the texts come from

A step in Flows can be set to **Offers**. Each morning at 9 AM the app prepares that step's text for every customer who is due. It writes the words and puts them here. See [let the app send a reminder](/help/set-up-the-steps-a-person-goes-through#let-the-app-send-a-reminder). The owner can also set it on Phone and texts, under **Reminders the app offers**. See [offer the app's reminders](/help/offer-the-apps-reminders).

The office can also hand a text to a time. On the Tell the customer sheet, press **Send later** and pick when. The text waits here until that time, then the app sends it. See [schedule a job and tell the customer](/help/schedule-a-job-and-tell-the-customer#send-it-later-instead).

A first visit moved to another day or window puts its Rescheduled text here too. Press it when the move is settled. Once the new day has passed, the text is held, and the app puts it away the next morning.

## Press one, or all that are ready

Each row shows the person, the step and the text.

1. Read the text. Press **Edit** to change a word, then **Done editing**.
2. Press {{button:green|Send}}. The text goes from the company number and lands in the customer's thread.
3. Or press {{button:green|Send all 3 that are ready}} at the bottom. It presses each ready text in turn and says how many went.

:::example A row on Today's sends
**Dana Whitfield** · Approved
Dana, any word on the estimate? Happy to walk through it.
{{button:green|Send}}
:::

A text you prepared for later shows its time instead of a Send button, like *Goes Tue 9:00 AM*. The app sends it then. Press **Change the time** to pick another day or time. Texts go between 8 AM and 9 PM only. Press **Not this one** to take the text back.

## Put one away

- **Not this one** removes the text. The step stays as it was.
- **Hold until…** picks a day. The step waits until then before the app prepares it again.
- **Stop reminding on this job** turns the step off for this customer on this job.

If the app says the step is not on the customer's flow, press **Not this one**. Someone took the step off the flow after the text was prepared.

## When a text is held

A held row says why under the text and has no Send button.

- The customer has no phone number on file. Add one on the customer, or call instead.
- The number sent STOP. Call instead.
- The customer asked to hear from us by email. Email them, or call.
- The customer answered the review already. Press **Not this one** to put it away.
- A text for this step already went to the customer after this one was prepared. The row says the day. Press **Not this one**.
- A newer text for the same step is on the list. Press **Not this one** on the older one.
- The text names a visit on a day that has passed. Press **Not this one**. The app puts it away on its own the next morning.
- An in kind arrangement pays the job's bills. The app holds its own pay reminder for that job. Press **Not this one**. See [work paid in kind](/help/keep-track-of-work-paid-in-kind).
- The step's line still has a blank the app cannot fill. The app fills {amount} and {bill} from the job's newest open bill. The hold shows when the customer has no open bill on the job. It also shows when that bill has no pay page. Send it from the customer's thread, or change the step's line.
- Quo turned the text away. The row holds Quo's words.

Fix the cause, then send the text from the customer's thread. Press **Not this one** to clear the row.
