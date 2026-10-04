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
Type an **ORIGINAL CONTRACT SUM** of 48,500 and **WORK COMPLETED THIS PERIOD** of 19,400 with **Retainage %** at 10. The paper shows total completed $19,400.00, retainage $1,940.00 and **CURRENT PAYMENT DUE $17,460.00**.
:::

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

- **WORK COMPLETED FROM PREVIOUS APPLICATION** is the work you asked for before.
- **LESS PREVIOUS CERTIFICATES FOR PAYMENT** is what the last application had earned, less retainage.
- Last month's change orders move to the previous months.
- **Retainage %** stays what it was. Type 5 when the contract drops it.

:::example the second application
Application 1 asked for $19,400.00 of work at 10% retainage, so $17,460.00 was due. A month later the job is at $29,100.00. Application 2 opens with 19,400 as previous work and 9,700 this period. **CURRENT PAYMENT DUE** reads $8,730.00.
:::

## An application sent before today

Type it in as its own application. Type its **APPLICATION NUMBER** and its amounts, then press {{button:outline|Save}}. The next application starts from it.

## Take one off the job

Open the saved application and press **Delete**. The window asks first. A later application keeps the amounts it was saved with.
