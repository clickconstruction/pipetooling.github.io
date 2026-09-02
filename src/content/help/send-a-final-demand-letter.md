---
title: send a final demand letter
category: Billing & Money
keywords: demand letter, final demand, collections, certified mail, tracking number, deadline, escalate, lien instruments, theft of services, chapter 53
roles: dev, master_technician, assistant, controller
---
When calls and re-sends have not shaken a payment loose, the next step is a **final demand letter** — a formal, dated deadline with legal follow-through named in writing. The app now writes it from the job's real history and holds you to the deadline you set.

## Open Lien instruments

On a **Billed Awaiting Payment** or **Collections** row, the orange lien icon now opens **Lien instruments**. The demand letter is the first tab (the § 53.056 notice and mechanic's lien tabs arrive with the next phase; the {{button:outline-blue|lientooling.com ↗}} button still opens the old external forms).

## What fills itself in

- **The debt** — from the billed lines you select: invoice total, payments received, outstanding balance.
- **The notice history** — this is the part no form site can write. The letter lists, with dates, every invoice send, every Stripe re-send, and every collection call recorded in call mode: *"July 15 — Invoice sent · August 5 — Invoice re-sent by email · August 26 — Collection call."* A debtor reading a dated list knows you keep records.
- **The recipient** — the bill-to override when the line carries one, otherwise the job's customer with their address on file.
- **The deadline** — defaults to 10 business days out; one click resets it.
- **The Chapter 53 line** — when the job is linked to a property record, the letter quotes your *actual* lien-filing window for the work. A threat with a date behind it reads differently.

:::example The § 31.04 line
The theft-of-services escalation (Texas Penal Code § 31.04) is a checkbox that ships **off** until the attorney package signs off on it. Small claims, the mechanic's lien, and the late-fees note are on by default — every line is a toggle.
:::

## Record the send

{{button:blue|Save & record send…}} asks how it physically went out — **certified mail**, traceable courier, email, or hand-delivered — plus the tracking number and the mailing date (a notice is effective the day it's mailed). That creates the record; nothing sends from the app, so the legal path stays physical and provable.

## The deadline watch

Once recorded:

- The job's lien icon wears an **amber ring** while the letter is out, and the modal lists every sent letter with **View** (the exact document again) and **Void** (withdrawn or recorded in error).
- If the deadline passes with the covered lines still unpaid, a **red Needs-you card** appears: *"A demand-letter deadline passed unpaid"* — because the fastest way to make demand letters worthless is to not do the thing they promised. It clears itself when payment lands or the letter is voided.
