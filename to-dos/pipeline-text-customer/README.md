---
name: "Text the customer from the Pipeline row"
number: 123
group: gated
status: DRAFTED 2026-10-18 — three mock-ups beside this file for the owner's pick (what the door opens) and a second pick for the phone card (the foot icon, the ⋯ sheet row, or both); nothing built
summary: >
  One door on the Pipeline row and the phone card that texts or emails the job's customer. Today the
  office can do it only inside the job window, below the activity: open the job, scroll, press Text,
  write, Send text…, check, send. Five presses and a scroll, and nothing on the row says the job can
  message its customer. The door is a speech-bubble icon in the customer's orange beside the teal ☎
  the row already carries, office only, the same gate as the job window's Note · Text · Email row.
  The three options differ in what the icon opens: the job window already scrolled to the box on
  Text; the box alone in a small window over the board; or the customer's whole thread filtered to
  the job. Every send lands in the customer's thread tied to the job, as the box does now.
next: The owner picks 1, 2 or 3 and the phone placement, then PR 1 builds it; delete this folder when the door is on the row.
size: S for option 1; M for option 2; M–L for option 3, which also mounts the messages host on the Jobs page
blocker: The owner's pick.
opinion: build 2 — one press to writing, nothing to scroll, nothing new to host; the box is the one that exists
mockup: to-dos/pipeline-text-customer/mockup.html
---

# Text the customer from the Pipeline row (#123)

## The ask, in the owner's words

> Do we make it easy for a user to message a customer from the jobs pipeline page?
>
> Yes. Draft the Pipeline row's Text the customer door: where it sits on the row and card, who sees
> it, what it opens, as two or three mock-ups I can pick from. Build nothing yet.

## Today's path

The guide *text a customer from the job* says it: open the job from the Pipeline (the window opens on
its Job tab), scroll past the activity to the notes box, press **Text** or **Email** in the
Note · Text · Email row (`JobCustomerBox.tsx` over `reply/ReplyBox.tsx`, residential R2, v2.5443),
write or press a quick reply, press **Send text…**, check the window that shows what the customer
sees, send. The row shows for the office team only (`jobBoxOffered` in `src/lib/messages/jobBox.ts`,
the GC office team). The Pipeline row and card carry no door: the desktop quick-action stack
(`StagesQuickActionsStack.tsx`) is schedule, week dispatch, call customer, Dispatch and send-as-task;
the phone card's foot (`JobsStagesCardList.tsx`) keeps ☎ as its one quick action with everything
else in the ⋯ sheet (`StagesCardMoreActionsSheet.tsx`). Texts wait on **Send texts** in Settings →
Phone and texts (v2.5440); until it is on, Text says so in place of the box and Email is the fallback.

## What every option shares

- **The door**: a speech-bubble icon in the customer's orange, beside the teal ☎, in the desktop
  stack and on the phone card's foot (the second pick: the foot icon, the ⋯ sheet row *Text the
  customer*, or both). Orange is free on the stack and is already the customer's colour in the box.
- **Who sees it**: the office team, `jobBoxOffered`. The crew's Pipeline keeps ☎ and nothing more.
- **What the row knows**: the job's customer, mobile and email ride on `JobWithDetails`
  (`customer_id`, `customer_phone`, `customer_email`; the call icon reads the same phone), so the
  door needs no new read. The customer's contact comes from `loadCustomerContact(customerId)` as the
  box does it today.
- **The dead states**: no customer, no icon (the ⋯ row reads *This job has no customer yet*,
  `NO_CUSTOMER_WORDS`); a customer with no mobile, a dim icon titled *No mobile on file. Email
  instead.* that opens the door on Email; texts off, the door opens with Text saying so and Email
  live beside it, the switch linked for the owner or a dev; not the office, no icon.
- **Where the message lands**: the customer's thread, tied to the job, the sent copy kept, as now.

## The three options

1. **The job window, already at the box** (S). The icon opens the job window as the name does
   (`openStagesDetailJobModal`), with one new argument that scrolls to the notes box with Text pressed
   and the cursor in it (`JobThreadNotesPanel` already scrolls the note body into view). One press to
   writing; the window and its activity still load above.
2. **The box alone, over the board** (M). The icon opens a small window over the Pipeline, the way
   the Lien desk's windows open over the desk: the job's line on top, the Text · Email pills, the
   quick replies, the box, **Send text…**; nothing else. It mounts `JobCustomerBox` with
   `kind: 'text'` and the job's id and customer; after a send it says *Sent* and the board reads the
   job again (`loadJobs`). On a phone it is a bottom sheet. One press to writing, nothing to scroll,
   nothing new to host.
3. **The customer's thread, filtered to the job** (M–L). The icon opens the thread window
   (`ThreadWindow.tsx`), filtered to this job, with the reply box on Text at its foot, so the writer
   reads what the customer last said first. The Jobs page would mount the messages host
   (`useMessagesHost`) the way `Messages.tsx` and `GcProjects.tsx` do; today no other page does.

The recommendation is 2. Option 1 is the fallback if the budget is one small PR; option 3 is worth
it when the Jobs page hosts the thread for another reason too.

## The PR train, once picked

1. **The door** (one PR): the icon on the stack and the card foot (and the ⋯ row if picked), its
   gate, its dead states, and what it opens. A render smoke on the stack and the card for the icon's
   presence by role and by customer state; a kernel test for the title words. The guide *text a
   customer from the job* gains a *From the Pipeline row* section; the Jobs tabs map's Pipeline
   dossier and the page map name the door.
2. **The verify**: as the dev at 375 px and on the desktop, a job with a customer and a mobile, one
   with no mobile, one with no customer; a helper's Pipeline shows no icon. A send to a test customer
   lands in their thread tied to the job and in the job's activity.
