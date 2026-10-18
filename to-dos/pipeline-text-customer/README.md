---
name: "Text the customer from the Pipeline row"
number: 123
group: close
status: BUILDING 2026-10-18 — the owner read the three mock-ups, asked whether that was the best we could do, and picked the two better shapes (the customer's name as the door; the stage move offering the text); PR 1 (v2.5626) found the row already carried a speech bubble to the customer's thread (v2.5451) and made it the door, the customer's sheet over the board with Call · Text · Email · Open their thread · Their record and whose word came last, the name keeping its press to the record; left: PR 2, the stage move's Tell the customer offer with its Flows step
summary: >
  One door on the Pipeline row and the phone card that texts or emails the job's customer. Today the
  office can do it only inside the job window, below the activity: open the job, scroll, press Text,
  write, Send text…, check, send. Five presses and a scroll, and nothing on the row says the job can
  message its customer. The door is a speech-bubble icon in the customer's orange beside the teal ☎
  the row already carries, office only, the same gate as the job window's Note · Text · Email row.
  The three options differ in what the icon opens: the job window already scrolled to the box on
  Text; the box alone in a small window over the board; or the customer's whole thread filtered to
  the job. Every send lands in the customer's thread tied to the job, as the box does now.
next: PR 2, the stage move offers the text through Tell the customer, governed by a Flows step per stage; delete this folder when it is on the board.
size: M for PR 1 (shipped, v2.5626); M–L for PR 2
blocker: none for PR 2; the owner's read of the first stage's text is its gate
opinion: built as 2 on the bubble the row already had; PR 2 is the one that makes the door unnecessary for the common case
ver: v2.5626
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

## Where it stands

**2026-10-18, PR 1 (v2.5626).** The owner read the three mock-ups and asked whether that was the best we could
do. It was not: the three varied where an icon opens and never questioned the icon. The two better shapes were
the customer's name as the door and the board's own stage move offering the text through Tell the customer.
Building the first found what the mock-ups had missed: the row already carried a speech bubble to the customer's
thread (residential R2, v2.5451, `MessagesButton`), which left the board for the Messages page. So the name keeps
its own press (the customer's record) and the bubble is the door: on the Pipeline's rows and cards it opens the
customer's sheet over the board (`JobCustomerSheet.tsx`, its rows from `lib/messages/customerDoor.ts`): the job
and the customer named, *Waiting on us: Dana wrote last, yesterday.* from the job's own lines, Call, Text, Email
(the job window's box, tied to the job), Open their thread and Their record. A customer with no mobile sees Text
grey with the reason. Everywhere else the bubble sits (the job window, Customers, Estimates) it is unchanged.

**Left.** PR 2: the stage move's offer. Every move on the board goes through `updateJobStatus`; the offer is Tell
the customer's sheet drafted from the move, governed by a Flows step per stage (Off · Offers · Sends), so nothing
reaches a customer without a person pressing it. The owner reads the first stage's text before it goes On.
