---
title: reconcile the books against bank statements
category: Office
roles: dev, master_technician, controller
keywords: reconcile, reconciliation, bank statements, mercury, books match the bank, receipt, last reconciled, missing transactions, live balance, presence only, sync
order: 58
---

**Banking → Reconciliation** answers one question: is every transaction on the bank's statements also in our books? It checks by transaction id, month by month, and compares the live balance for the open month. It changes nothing in the books.

## Running a check

Pick a **Window** (how many months back) and press {{button:blue|Check against bank statements}}. The banner says either *✓ All N accounts match their bank statements* or *⚠ N accounts need review · M transactions missing from the books*, and each account card lists the months with what's missing.

## The receipt

Every check now leaves a receipt, so "did the books match the bank on Friday?" has an answer after you leave the tab:

:::example A receipt
**Receipt.** 412 of 412 statement transactions present in the books across 2 accounts, 2026-03 – 2026-08; live balance within $0.01 on every account. Scope: presence only, statement → books — books-only rows and amount differences are not checked; manual transactions have no statement.
:::

The scope sentence is the important half. *Presence only, statement → books* means the check confirms that each bank line exists in the books. It does not compare amounts, and it does not look for rows that exist only in the books. A green check is "nothing from the bank is missing", not "the books equal the bank".

## Last reconciled

Under the account cards, **Last reconciled** lists the ten most recent runs: when, the window, the result ({{chip:green|✓ 412 / 412 present · balance ✓}} or {{chip:yellow|⚠ 410 / 412 present}}), and who ran it. Tap a result to read that run's scope sentence.

## Not the sync

The 30-minute **sync** that pulls new bank transactions into the books is a different thing with a similar name. The sync writes rows; this check only reads and reports. If a check finds transactions missing, the sync usually backfills them on its next pass — check again after.

## Who can run it

Anyone with Banking access: dev, leader, assistant and controller.
