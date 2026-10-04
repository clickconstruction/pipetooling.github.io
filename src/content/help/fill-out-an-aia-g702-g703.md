---
title: fill out an AIA G702-G703
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: aia, g702, g703, pay application, pay app, application for payment, continuation sheet, retainage, schedule of values, change orders, workbook
---
Some general contractors pay from an AIA G702-G703. That is an application for payment with a continuation sheet. You fill it in one window and download it as a workbook.

## Open the window

Go to **Jobs → Pipeline**. Find the job in **Ready to Bill** or **Billed Awaiting Payment**. Press the green sheet button on its row. The same button sits in **View bill**.

The window has two sides. The paper is on the left. The form is on the right.

## Fill the form

The form starts with what the job already knows.

- **TO OWNER** is who the bills go to. On a job that bills its GC, that is the GC. The address is the one on their customer page.
- **PROJECT** is the job's name and address.
- **PROJECT NO** is the job's number.
- **CONTRACT DATE** is the day the job's contract was signed. It is empty when the job has no signed contract.
- **Retainage %** starts at 10.
- **APPLICATION DATE** is today.

You type **Period to** yourself. On a job with nothing saved, you type **APPLICATION NUMBER** too.

1. Type in a field on the right. The paper on the left changes as you type.
2. Press a box on the paper to jump to its field.
3. Open **Change Orders** to type additions and deductions.
4. Type **Retainage %** as a plain number. Type 5 for five percent.

A blue box on the paper holds something from the form. A plain number is the sheet's own math. You never type the nine lines of the G702. The sheet works them out.

:::example what the paper works out
Type an **ORIGINAL CONTRACT SUM** of 48,500. On the line, type a **SCHEDULED VALUE** of 48,500 and **WORK THIS PERIOD** of 19,400. With **Retainage %** at 10, the paper shows total completed $19,400.00, retainage $1,940.00 and **CURRENT PAYMENT DUE $17,460.00**.
:::

## The lines

The bottom of the form is **LINES**. Each line is one row of the continuation sheet. A job starts with one line for the whole contract.

A line has these boxes.

- **DESCRIPTION OF WORK** is the line's name.
- **SCHEDULED VALUE** is the line's part of the contract.
- **FROM PREVIOUS APPLICATION** is the work you asked for before.
- **% DONE TO DATE** is how far along the line is. Type a percent and **WORK THIS PERIOD** is worked out for you.
- **WORK THIS PERIOD** is the work you are asking for now. Type dollars here if you would rather.
- **MATERIALS STORED ON SITE** is material on the job that is not installed yet.

Press **Add a line** to add a row. A change order can be its own line. Press **Remove** on a line to take it off.

## Lines from the bid

A job that came from a bid starts with the bid's schedule of values. Those are the lines the GC already saw.

- A bid with its own lines brings them over as written.
- A bid left on the three stages brings three lines. They are Rough In, Top Out and Trim Set.
- A bid with fewer than two stages filled in brings nothing. The job starts with one line.
- A job with no bid starts with one line.

The bid is only the start. Once you save application 1, the lines belong to the job. You can rename them, add to them and take them off.

The bid may print labor and material apart. Then **Labor and material on their own rows** starts ticked. Each line prints as two rows. Untick it to print one row per line.

## The crew's percent

A line that belongs to a stage shows what the crew reported for that stage. It reads *The crew reported Top Out at 90%.* Press **Use 90%** to take it. Nothing changes until you press it.

## When the lines do not add to the contract

The bid's total is not always the job's price. The form says how far the lines are from the contract to date. Press **Scale the lines to** the amount shown. Every line moves by the same share, to the cent.

A change order is not a gap. Add it as its own line, and type it under **Change Orders**.

## How many lines fit

The sheet holds 34 rows. The form shows how many you have used. You can save more than 34 lines. You cannot generate until some are grouped.

## Leave a field empty

A field you leave empty is empty in the download. Nothing is filled in for you after you clear it. Check the paper before you download.

## Download it

Press {{button:green|Generate}}. The workbook downloads to your computer. Its name carries the job's number and the application number. Send it to the general contractor the way they ask for it.

Press {{button:outline|Reset from job}} to start again from what the job knows.

## On a phone or a narrow window

You see one side at a time. Press **Preview** at the top to see the paper. Press **Form** to go back. Pressing a box on the paper takes you to its field.

## Save it on the job

Press {{button:outline|Save}}. The application is kept on the job under its number. {{button:green|Generate}} saves it too, after it downloads.

Saved applications sit at the top of the form, under **APPLICATIONS ON THIS JOB**. Press one to open it. You can change it and save it again. Nothing locks.

The window asks before you lose what you typed. Press **Stay** to keep typing.

## Start the next application

Open the window again next month. It opens on a new application. The number is one more than the last.

The new one starts from the last one saved.

- Each line keeps its name and its value. Its **FROM PREVIOUS APPLICATION** is the work you asked for before.
- **WORK THIS PERIOD** starts empty on each line. Material stored on site stays on its line.
- **LESS PREVIOUS CERTIFICATES FOR PAYMENT** is what the last application had earned, less retainage.
- Last month's change orders move to the previous months.
- **Retainage %** stays what it was.

## When retainage drops to 5%

Some contracts drop retainage to 5% once the job is past 50% complete. The window tells you when the job is past that point. It shows what is held now and what would be held at 5%.

Press **Use 5%** when the contract allows it. The 5% covers everything to date. The retainage let go is added to the payment due.

Leave it alone when the contract keeps the retainage. Nothing changes until you press the button.

:::example the second application
Application 1 asked for $19,400.00 of work on its one line at 10% retainage, so $17,460.00 was due. A month later the job is at $29,100.00. Application 2 opens with 19,400 from the previous application and 9,700 this period on that line. **CURRENT PAYMENT DUE** reads $8,730.00.
:::

## When an earlier application changes

Nothing locks, so an earlier application can change after a later one went out. The later one then shows a warning. It lists each amount that no longer matches.

You can still save and generate it. You have two choices.

- Press **Use application 1's amounts** to take the new amounts. The number in the button is the earlier application.
- Or keep it as it went out. Type the reason under **WHY IT STAYS AS IT IS** and press {{button:outline|Save}}.

The warning also shows on the job's **Documents** tab, with the reason.

## An application sent before today

Type it in as its own application. Type its **APPLICATION NUMBER** and its amounts.

Then paste the Google Drive link to the file under **LINK TO THE FILE YOU SENT**. Press {{button:outline|Save}}. The next application starts from it.

Press **Open** beside the link to see the file. Any saved application can carry a link.

## See them on the job

Open the job and press the **Documents** tab. Every saved application is listed with its number, its period and the payment due.

Press **Open the file** to see the file you sent. Press **Open** to change the application. Press **New application** to start one from there.

## Take one off the job

Open the saved application and press **Delete**. The window asks first. A later application keeps the amounts it was saved with.
