---
title: know when Edit Job saves my changes
category: Office
roles: dev, master_technician, assistant, controller
keywords: autosave, auto save, save button, edit job, unsaved changes, all changes saved, close without saving, undo
order: 64
---
Edit Job has no Save button. Everything you change saves by itself about a second after you stop typing.

This guide explains how to read the status chip and what happens when you close.

## The status chip

The bottom-right corner of Edit Job shows where your changes stand:

- **All changes saved** means everything you've done is stored. It is safe to close or walk away.
- **Unsaved changes…** means you just edited something. The save fires about a second after you pause.
- **Saving…** means a save is on its way to the server.
- **Waiting on required fields** means a required field is empty. The required fields are Job Name, Job Address and Service type. The job's details are held back until you fill it in. Nothing is lost. Finish the field and the save catches up.
- *Autosave failed — edit the field again to retry* means the server rejected or missed a save. Touch the field again to retry. Or check your connection.

:::example What auto-saves
Job numbers, name, address, customer info, links, line items, payments, Other job charges, and Team changes — each saves on its own as you edit it.
:::

A payment's **Sent** or **Received** date saves once it is a finished date. Half typed means `26` for 2026, or a pause part way through. With the year half typed, the rest of the payment saves. A line says the date was not saved. The payment keeps the date it had until you type the year in full.

## Closing the window

Click the **✕** in the top-right, press the **Escape** key, click outside the window or jump to another view. If anything is still waiting to save, the close **finishes the save first**. Switching between the **Job**, **Edit** and **Bill** tabs never needs a save at all. Your work stays put across tabs. Escape never closes the job window while a smaller window sits on top of it. A preview or the create-customer window is such a window. So you won't lose your place by accident.

If the server doesn't respond, the modal stays open and asks what to do. The choices are **Retry and close**, **Keep editing** or **Close without saving**. Your edits are never dropped silently.

## Made a mess? Undo

The {{button:gray|Undo changes}} button sits bottom-left on the Edit tab. It reverts **everything** back to how the job looked when you opened the window. It asks before reverting. The revert then auto-saves like any other edit.

:::example Where the restore point sits
Undo goes back to when you opened Edit Job — or, if you've created or deleted an invoice since, to just after that. Invoice work is never unwound by Undo.
:::

## Move the job's stage from here

Near the top of the Edit tab, right under the **Stages** line, sits the **Status** rail. Its stages are Waiting, Working, Ready to bill, Billed and Paid. Three looks, three meanings. The black pill is where the job is. A **blue outlined** stage with an arrow is one tap away. Tapping it moves the job. The move is posted to its activity thread exactly like the Pipeline board's buttons. A **dashed grey** stage can't be reached from here. Tap it and a line under the rail says why. Paid always goes through the Record payment window. Sending a Billed job back happens from the board, which first handles its invoices. At the right end of the rail, on the same line as Paid, sits a **Collections** switch. It flags a Billed job as difficult to collect, with a note. It clears the same way. Until the job is Billed it stays off and says so.

Tapping **Billed** on a job whose open money has no bill line pauses first. Money without a bill line can't age, be chased or show in the payment forecast. Pick {{button:blue|Create line & mark Billed}} to do it right in one tap. The line is created dated today. Or pick **Mark Billed only** if you really just want the status flip.

## New jobs still use a button

Creating a job is different. Fill in the New Job form and click {{button:blue|Create Job}}. Auto-save starts once the job exists and you're editing it.

A payment, part, line item or team member you typed might not save with the new job. Then a red note says how many of each and why. The job itself is saved. Open it and add them again. Don't create it a second time.
