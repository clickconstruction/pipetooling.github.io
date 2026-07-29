---
title: know when Edit Job saves my changes
category: Office
roles: dev, master_technician, assistant, controller
keywords: autosave, auto save, save button, edit job, unsaved changes, all changes saved, close without saving, undo
order: 64
---
Edit Job has no Save button — everything you change **saves by itself** about a second after you stop typing. This guide explains how to read the status chip and what happens when you close.

## The status chip

The bottom-right corner of Edit Job shows where your changes stand:

- **All changes saved** — everything you've done is stored. Safe to close or walk away.
- **Unsaved changes…** — you just edited something; the save fires about a second after you pause.
- **Saving…** — a save is on its way to the server.
- **Waiting on required fields** — a required field (Job Name, Job Address, or Service type) is empty, so the job's details are held back until you fill it in. Nothing is lost — finish the field and the save catches up.
- **Autosave failed — edit the field again to retry** — the server rejected or missed a save. Touch the field again (or check your connection) to retry.

:::example What auto-saves
Job numbers, name, address, customer info, links, line items, payments, Other job charges, and Team changes — each saves on its own as you edit it.
:::

## Closing the modal

Click {{button:gray|Close}}, click outside the modal, or jump to another view — if anything is still waiting to save, the close **finishes the save first** (the button briefly shows "Saving…").

If the server doesn't respond, the modal stays open and asks what to do: **Retry and close**, **Keep editing**, or **Close without saving**. Your edits are never dropped silently.

## Made a mess? Undo

The {{button:gray|Undo changes}} button (bottom-left, next to Close) reverts **everything** back to how the job looked when you opened the modal. It asks before reverting, and the revert then auto-saves like any other edit.

:::example Where the restore point sits
Undo goes back to when you opened Edit Job — or, if you've created or deleted an invoice since, to just after that. Invoice work is never unwound by Undo.
:::

## New jobs still use a button

Creating a job is different: fill in the New Job form and click {{button:blue|Create Job}}. Auto-save starts once the job exists and you're editing it.
