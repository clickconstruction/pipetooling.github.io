---
title: offer the app's reminders
category: Office
roles: dev, master_technician
keywords: reminders the app offers, reminders, reminder, offers, sends, off, the app and this reminder, phone and texts, today's sends, morning run, estimate, approved, paid, bill, flows, settings, switch, messages
where: /settings?tab=settings-phone-texts#settings-phone-texts-reminders
order: 119
---
The app can remind a customer for you. It can write the text and let a person press it, or it can send the text itself. The owner or a dev picks which, on Phone and texts.

## Find the reminders

1. Open [Phone and texts](/settings?tab=settings-phone-texts) in Settings.
2. Scroll to **Reminders the app offers**, the last card.

The card lists every step the app can text a reminder for, under its flow. Today that includes the residential customer's **Approved** and **Paid**. Under each step is the text the app would send. The team's quick reply for the step comes first, else the app's own words. [Edit the quick replies](/help/edit-the-quick-replies-for-the-phone) says how to change it.

:::example A step on the card
**Approved**
{{chip:gray|Off}} {{chip:green|Offers}} {{chip:gray|Sends}}
“Dana, any word on the estimate? Happy to answer any questions.”
:::

## Pick a way

Each step has one control called **The app and this reminder**. Press one of its three ways.

- {{button:outline|Off}}. The app does nothing with this reminder.
- {{button:green|Offers}}. Each morning at 9 AM the app writes the text and puts it on Today's sends on the Dashboard. A person reads it and presses Send. See [work Today's sends](/help/work-todays-sends).
- {{button:outline|Sends}}. The app texts it at 9 AM from the company number.

The control saves the moment you press it. A short message says what changed. Either way the text waits for the step's quiet days to pass. A customer with no number, or one who sent STOP, gets no text. A step's line with a blank the app cannot fill waits too. On Offers the row on Today's sends says why.

The app fills the Paid reminder's {amount} and {bill} from the job's newest open bill. So the office may move Paid from Offers to Sends. A customer with no open bill on the job gets no text until a person sends it from the thread.

## The same control in Flows

Each step in [Flows](/settings?tab=settings-flows) carries the same control. The two read one setting, so a change on either shows on both. Flows is also where a step is first set to send its reminder from the app. See [let the app send a reminder](/help/set-up-the-steps-a-person-goes-through#let-the-app-send-a-reminder).

## The switch card on Messages

The owner's card **Finish switching Messages on** has a row for the reminders. The row reads on once the estimate reminder and the bill reminder are offered or sent. Its door {{button:outline|Offer them}} opens this card.
