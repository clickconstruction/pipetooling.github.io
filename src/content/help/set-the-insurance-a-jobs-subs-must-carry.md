---
title: set the insurance a job's subs must carry
category: Office
roles: dev
keywords: insurance, send, send the sheet, send it again, reminder, who it goes to, tell them it changed, take it off their page, not opened yet, their page is off, send it anyway, link, sheet's link, copy the link, make a new link, switch the link off, insurance requirements, insurance sheet, standing sheet, usual sheet, your usual, sub, subs, trade, trades, coverage, coverage line, amount, certificate, certificate of insurance, coi, additional insured, gc, general contractor, job, publish, revision, marks, checked, insurance agent, agent, print the sheet, document builder, builder, dev only, placeholder
where: /documents?tab=builder&builder=insurance
---
The insurance builder makes one sheet for each job you run as the GC. The sheet tells a sub what insurance to carry on that job.

Only a dev sees the builder for now. Every word and every amount on the sheet is a placeholder. The app sets no amount for you. Your insurance agent and your attorney set the real words and amounts.

## Open the builder

1. Open [Documents](/documents?tab=builder).
2. Press the **Document builder** tab.
3. Find **Insurance requirements for subs**.
4. Press {{button:blue|Load the first draft}} when the row reads {{chip:gray|Not loaded yet}}.
5. Press {{button:blue|Open}}.

The sheet is on the right. The cards on the left say what you are changing.

## Set up your usual sheet

Your usual sheet is the standing sheet. Every job starts on its words and amounts.

1. Press **The standing sheet**.
2. Press any words on the sheet and type over them.
3. Wait for the bar to read *Draft saved*.

The bar reads *Draft not saved* when a save fails. Type again to send the draft again.

- **Add an opening line** adds a line at the top of the sheet.
- **Add a coverage line** adds a kind of insurance and its amount.
- The small **×** beside a line removes that line.

Some words on the standing sheet are filled from each job. You cannot type on them here.

## Publish your usual

Nobody outside sees a draft. A sub sees only what you publish.

1. Read the card **Where this change goes**. It lists every job you run as the GC.
2. Press the blue button on the bar. It reads {{button:blue|Publish your usual}} or names how many jobs get the change.

A list **Before this can be published** shows while something is missing. Fix each line and the button wakes.

- {{chip:green|Gets it, as revision 2}} means that job's sheet is published again with the change.
- A held job keeps its sheet as it is. Its chip says why.
- A job with changes of its own that are not published is held. Publish that job to bring it up.

A field a job has changed keeps the job's own words.

## Set one job's sheet

1. Press **This job**.
2. Pick the job in the **Job** list.
3. Type the names and the place the blue fields ask for.
4. Press any other words to change them for this job alone.
5. Press {{button:blue|Publish this job's sheet}}.

- **Add a name** adds one more name the sub's policy must list.
- **Add a coverage line for this job** adds a line that only this job asks for.
- The **×** beside a coverage line stops asking for it on this job.

Publish your usual before the first job. A job's sheet goes out on the published usual.

## Read what differs on a job

The card on the left counts what this job changed from your usual. Each row has its own presses.

- {{button:outline-blue|Back to the usual}} drops the job's own words for that field.
- {{button:outline-blue|Make this the usual}} copies the job's words into your usual draft. Publish your usual to send them to the other jobs.
- On the line under the title, it leaves this job's name out. Every other job then reads the line with its own name.
- {{button:outline-blue|Put it back}} asks again for a coverage this job had stopped asking for.
- {{button:outline-blue|Take it off}} removes a line added for this job.

Three marks on the sheet say where words come from.

- A thin underline is your usual.
- A blue mark is filled from the job.
- An amber mark is changed for this job.

Press **Marks are on** to hide the marks. The sheet then reads as a sub sees it.

## Mark your usual as checked

The bar reads {{chip:yellow|Not checked by your insurance agent}} until someone marks the revision.

1. Publish your usual.
2. Press **Mark it checked** on the bar.
3. Type the name of the agent who checked your usual sheet.
4. Press the blue button. It names the revision.

The name and the day are kept with that revision. A new revision is unchecked again.

A job that differs from a checked usual says so on the bar. Your agent checked the usual, not that job's changes.

## Print a job's sheet

1. Open the job's sheet.
2. Publish it.
3. Press {{button:outline-blue|Print the sheet}}.

It prints the published revision, the one subs see. The copy is kept under [Sent copies](/documents?tab=sent) on Documents.

## Give a sheet by its link

A published sheet has a link. The link opens the sheet with no sign-in. It is for someone with no page of their own, such as a sub's insurance agent.

1. Open the job's sheet and publish it.
2. Find the card **This sheet's link**.
3. Press {{button:outline-blue|Switch the link on}}.
4. Press {{button:outline-blue|Copy the link}}.
5. Paste the link where you want it.

The link always shows the published revision. It never shows a draft.

- **Make a new link** stops the link you have now. Anyone you gave it to needs the new one.
- **Switch the link off** closes the sheet to links. Switching it on again makes a new link.

The card says how often someone outside opened the link. Your own look is not counted.

## Send a sheet to the job's trades

The card **Send the sheet to this job's trades** lists every trade asked to quote on the job.

1. Open the job's sheet and publish it.
2. Find the trade's row on the card.
3. Press {{button:outline-blue|Send it to them}}.
4. Pick who at the company gets the email.
5. Read the note and change it if you want.
6. Press the blue button. It names the person, like {{button:blue|Send to Dana}}.

The trade gets an email with a link to their own page. The sheet is on that page.

- {{chip:gray|No page yet}} means the trade never had a page. Sending to that trade alone makes one.
- {{chip:yellow|Their page is off}} means someone turned the page off. A send never turns a page back on.
- **Turn their page on** is its own press, in the box.

A sheet your agent has not checked goes only after you tick **Send it anyway**.

The check is read on the revision of your usual that the job's sheet went out on. A newer usual your agent checked does not cover an older sheet. Publish the job's sheet again to bring it onto your newest usual.

## Send to every trade that is ready

One press under the list sends to every trade that is ready. The button says how many.

A trade is ready when its page is on and someone there has an email. The rest are listed under the button, each with its reason. A trade that fails is named afterwards, and the others still go.

## Read where a send stands

- {{chip:gray|Sent Nov 20 to Dana Reyes}} names the day and the person.
- {{chip:yellow|Not opened yet}} means they have not opened this revision.
- {{chip:green|Opened Nov 21}} names the day they opened it.
- {{chip:yellow|Changed since they opened it}} means you published a newer revision since.

- {{button:outline-blue|Send it again}} sends a reminder.
- {{button:outline-blue|Tell them it changed}} tells them of the new revision.
- {{button:outline-blue|Take it off their page}} ends the send. The sheet leaves their page.

A reminder goes to the person the sheet was sent to. The line under the buttons names that person and their email.

That person may have left the company record. The two buttons then go grey, and the line says so. Press **Take it off their page**, then send the sheet to someone who is on the record.

Each send is kept under [Sent copies](/documents?tab=sent) on Documents.

Only a dev can send for now. See [use the document builder](/help/use-the-document-builder) for the tab itself.
