---
title: clock in and out with Job Mode
category: Field Work
roles: subcontractor, helpers, superintendent, master_technician
keywords: write up a change, change order, clock in, clock out, job mode, time tracking, leave report, next job, my requests, dispatch answered
order: 10
---
Job Mode turns the Dashboard into one big card built for working in the field. It shows your current job, your next job, and big buttons for what you do on site.

## Is Job Mode on?

- **Subs and helpers:** yes, already. Job Mode is on the first time you open the app on any phone. Nothing to set up.
- **Leaders and superintendents:** the Dashboard shows a one-time card, **Working in the field? Turn on Job Mode.** You tap {{button:green|Turn on Job Mode}} and you are in. {{button:outline|Not now}} hides the card on that phone.
- **Anyone who can file field reports:** you tap the {{icon:gear}} **gear menu** in the top-right of the header. You toggle **Job Mode** on or off.

Turning it **off** is remembered on that phone even if your role has it on by default. The same gear-menu row turns it back on. With Job Mode on, the Dashboard shows the Job Mode card first. You can always tap {{button:outline|Show full dashboard}} underneath it. Then you see everything else for the rest of the visit. The next time you open the app you are back on the card.

:::example A new phone
Your helper gets a replacement phone, signs in, and lands straight on the Job Mode card with {{button:green|Clock In}} on top — no gear menu, no guide. If they'd rather see the whole Dashboard, one gear-menu tap turns Job Mode off for that phone.
:::

The header also changes. The three task buttons become a **Contact:** row. It has a green phone button that calls the office. Then {{button:blue|dispatch}}, {{button:purple|estimating}}, and {{button:blue|teammate}} are spelled out. On a narrow phone screen they stay as the compact icon buttons, with the phone button on the left. The purple one is **Ask estimating**. It sends a question to the estimators. You are not opening anyone's inbox.

## The Job Mode card

Here is what the card looks like during a working day:

:::example The Job Mode card
**PLUM 512** | Smith House Repipe
123 Main St
*Clocked in since 8:02 AM*

**TODAY · 1 OF 4 DONE**
✓ 8:00 — PLUM 512 · Smith House Repipe
● 10:30 — PLUM 498 · Baker St Water Heater *(NOW)*
! 1:00 — GAS 77 · Riverbend Gas Test *(STILL OPEN)*
○ 3:00 — PLUM 501 · Oakmont Trim Set

{{button:blue|Leave Report}} &nbsp; {{button:green|Next Job}}

{{button:amber|Turnaway — not ready / not home}}

<u>Clock out</u>
:::

- You tap {{button:blue|Leave Report}} to file a field report on the current job. See the Reports guide.
- The green button changes with your day: {{button:green|Clock In}}, {{button:green|Start First Job}}, {{button:green|Next Job}}. When only your current job is left, it turns into {{button:red|Wrap Up Day}} to clock you out.
- You tap {{button:amber|Turnaway — not ready / not home}} when you arrive and cannot do the work. See the Turnaways guide.

## Your day on the card

Under the job header, the card lists **every job on today's schedule**, in order:

- ✓ green check means you have already clocked time there today.
- A green ring marks the job you are on **now**.
- An amber **still open** flag marks a job you drove past that is still owed a visit. Maybe the customer was not home. Maybe the site was not ready.
- A hollow dot means coming up later.

**Tap any open job to jump straight to it.** You do not need to take them in order. You get the same quick notes sheet, already pointed at the job you tapped. Jobs you skip are not lost. They stay flagged. {{button:green|Next Job}} offers them once the rest of your day is done.

While you are clocked into a job, the card keeps going below the buttons:

- **Customer** shows the customer's name with tap-to-call phone and tap-to-email links. So reaching them is one tap.
- You tap {{button:outline|Job detail}}. It opens the full **Job Detail** modal right over the card.
- A **Street View photo** of the job address. You tap it to open Street View in Google Maps.
- **Job updates** is the same updates thread as Job Detail. You read what the office posted. You add your own note without leaving the card.

## Clocking in and out

{{gif:job-mode-clocking.gif|Starting the day: the Ready to start card, Start First Job with intent notes, and the clocked-in card}}

- You tap {{button:green|Clock In}} to start your day. If you have a schedule, the card offers your scheduled job. Otherwise you can pick a job manually.
- **Nothing listed?** The sheet says so and stays that way. It reads **Nothing on your schedule today, and no jobs assigned to you**. It has dispatch's number to tap and a pointer to the search box. You call, or you type the job's name or number.

:::example Day one, no schedule yet
Your new helper taps {{button:green|Clock In}}. No jobs appear, so the sheet says **Nothing on your schedule today, and no jobs assigned to you — call dispatch at 512 360 0599**. One tap dials the office; dispatch adds the block, and the job shows up as a pick.
:::
- Switching jobs from the full Dashboard uses {{button:blue|Update Focus}}. The job you are clocked into is listed first with a {{chip:green|You are here}} tag. You tap any other job to switch. The same tag shows on the clock-out review.
- Moving on? You tap {{button:green|Next Job}}. You are asked for brief notes about the job you are leaving. The sheet shows **where you can go**. Your suggested next job is preselected. You can pick any open job instead. Or you choose **Done for the day** to clock out.
- Your location is captured when you punch. Your hours flow to the office automatically for approval.

### When you have no signal

The punch may not reach the server in a crawlspace, a basement, or a dead zone. Then the sheet says ***No connection — the app couldn't reach the server, so nothing was saved***. It shows a {{button:outline|Retry}} button. Nothing was recorded. So it is safe to tap it as soon as you have a bar. When your signal comes back on its own, the message changes to ***Back online — tap Retry to try again***. The punch still waits for your tap. So it is never sent twice.

:::example Clocking in from a basement
You tap {{button:green|Clock In}}, the sheet shows **No connection** and {{button:outline|Retry}}. You climb the stairs, the line flips to **Back online**, you tap {{button:outline|Retry}} — the timer starts.
:::

The same Retry appears when you save a report offline. Your **Schedule** tab is different. It reloads by itself the moment the signal returns, no tap needed. A message may say something else, for example that you do not have permission. Then Retry will not appear, because trying again would not change the answer.

## Clocking out

Three ways, depending on your day:

- **End of the day.** When your current job is the last one open, the green button becomes {{button:red|Wrap Up Day}}. You tap it and you get the usual clock-out review, below.
- **From the switch sheet.** You pick **Done for the day** at the bottom of the "Where to next?" list.
- **Any other time.** That is lunch, a parts run, or leaving early. You tap the small underlined **Clock out** link under the buttons. Your remaining jobs stay flagged on the card for when you are back.

### What the clock-out review asks, and why

All three doors run the same short stack. Most days you see one screen. The others only appear when there is something to catch.

1. **Assign your spending before you clock out** appears only sometimes. You see it when you have card charges from today with no job on them. You pick the job for each. Your recent jobs are offered first. Or you **skip** and sort them later in Job Parts Tally. Why now? The charge is easiest to place while you still remember which house you were at.
2. **Review before clock out** always appears. *What did you work on?* takes a one-line note. The note is required. The job list confirms where the time goes. The job you are clocked into is first with a {{chip:green|You are here}} tag. So the usual answer is just to leave it. Why? The note is what the office reads when they approve your hours.
3. ***Missing reports from today (click to make report)*** appears only when a job on today's schedule has no report yet. It shows one red button per job. You tap one to file the report right there. Or you finish clocking out and file it later with **Job Report** on your Dashboard. Why? A report filed the same day beats a phone call tomorrow.
4. **Team feedback** is a short card about how your teammates did. It comes on a cadence the office sets, days or weeks apart, not daily. {{button:blue|Start}} answers it now. {{button:outline|Not now · remind me in N days}} puts it off. Left alone, it closes itself in 30 seconds and comes back when it is due again.

Then {{button:red|Complete clock out}} ends the session. If it fails to reach the server, the same {{button:outline|Retry}} panel as Clock In appears. Nothing is recorded until it succeeds.

:::example A normal Tuesday
Tap **Clock out** → *Review before clock out* → type "trim set, both baths" → the job already shows {{chip:green|You are here}} → {{button:red|Complete clock out}}. One screen, ten seconds.
:::

Salaried teammates do not clock out manually. Their hours are handled automatically. So these buttons do not appear.

The details section also shows for your **Ready to start** job before you clock in. That is the customer contact, Street View, and updates. You review the visit before you head out.

Below the card, **My Schedule** shows your upcoming visits. It is the same section as the full Dashboard. So you can see what is next without leaving Job Mode. {{button:outline|Show full dashboard}} sits just under it.

## The Job Mode tab bar

With Job Mode on, a tab bar pins to the bottom of the screen. Everything on it is **yours only**:

- **Dashboard** is the Job Mode card you know.
- **Schedule** is a two-week strip plus your own day agenda. It lists your visits with times, customer, and address. You tap one to open the job.
- **Inbox** starts with any notification banners meant for you, like stale tally transactions. Then come your **My Inbox** tasks. Then comes **My requests**. That is everything you have sent to Dispatch. A red phone tap, a red photos tap, or a note to Dispatch all land there. They split into **Waiting on Dispatch** and **Answered**. An answered one shows the office's note as {{chip:green|Office answered: "Added — it's 555-0100"}}. You also get a push, **Dispatch answered**, the moment they close it.
- **Customers** is just the customers whose jobs have been on your schedule. You tap one for its full interaction summary.

## Good habits

- Clock into the job you are physically working on. Switching is one tap. Accurate time keeps everyone's numbers right.
- Leave a report before you head out. It takes under a minute and saves phone calls later.

## Extra work the customer asked for

You may have switched **Write up a change from the field** on in Settings. Then a small **Write up a change** link sits under the card's buttons. It opens the write-up already on the job you are clocked into. See *write up a change order from the field*.

## The customer signs on your phone

You are clocked in on a job that has no signed agreement yet. The customer is standing there. Under the card's buttons there is one more line: {{button:outline|✍ Hand the phone to the customer to sign}}.

1. Tap it. The app opens this job's agreement on your phone. It is the same page the office sends by link. It shows the work, the price and payment line and the terms. It shows a note that says you are present.
2. Hand the phone over. They read it. They type or draw their name. They tick **I agree to sign electronically** and press **Sign agreement**.
3. Take the phone back. The job now reads {{chip:green|✍ Signed}} everywhere. Their signed copy goes to the email on the job.

Nothing is emailed until they sign. If the office already sent this customer an agreement, the same one opens. If there is none yet, the app makes it from the job's own facts. So there is nothing to type. The line shows for the master, primary, superintendent and estimator roles. It disappears once the job is signed.
