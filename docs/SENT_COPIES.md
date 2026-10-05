# Sent copies

> Every time the company sends someone something, a copy is kept and the office can find it in Documents. This file is the plan, the rules and the list of what is wired; the code is `src/lib/sent/`.

last_updated: 2026-10-05

## The owner's rules

Set 2026-10-05:

1. **Every send keeps a record**: what went, to whom, how, when and by whom, with the copy as it went out.
2. **Printing counts as sending.** A print files a copy the same as an email does.
3. **Keep the email**: the message as it was read, and its attachments.
4. **The office finds it in Documents** when they need it. Nobody takes an extra step to file anything.

Why it matters: before this, about thirty kinds of paper kept a "sent" date and were drawn again from live data when reopened. A bill or a records packet opened a month later could show other numbers than the one the person received.

## How it works

- **One table**, `sent_documents` ([migration doc](./migrations/20261005173119_sent_documents.md)): one row per send. Append-only: no UPDATE policy on the table or on the bucket.
- **One bucket**, `sent-documents` (private): `<row id>/copy.html` for a page, `<row id>/<file>` for a PDF or an attachment.
- **One helper each side.** The client calls `fileSentCopy(filing, body)` or `printAndFile(html, filing)` ([`sentCopiesIo.ts`](../src/lib/sent/sentCopiesIo.ts)). The email functions get their own in `supabase/functions/_shared/` in step 2.
- **Best effort, never in the way.** Filing never throws and is not awaited by a click. If the copy cannot be stored the row is still written with no path, and the list says *The copy was not kept*.
- **A repeat does not pile up.** The copy's SHA-256 is on the row. A second print of the same page points at the first file, and the list folds the rows into one line (*Printed 3 times, last …*).
- **A copy is shown, never run.** A kept page opens inside a frame whose sandbox has scripts, forms and navigation off (`sentCopyFrameHtml`): the file was stored by someone on staff and is treated as a file.
- **Where it reads.** The Job window's Documents tab, section **Sent from this job** ([`JobDocumentsSent.tsx`](../src/components/jobs/JobDocumentsSent.tsx)), by `job_ids`. Step 4 adds the Documents page and the customer page for sends with no job.

Who: the office reads (`is_office_staff()`: dev, master, assistant, controller). Staff who send can file (the office, estimators, primary, superintendent). Deletes are dev only.

## Wiring a send

A print:

```ts
if (!printAndFile(html, { kind: 'owner_records_packet', title: `Records for ${address}`, recipientName: owner, jobIds, customerId, source: { table: 'lien_owner_record_requests', id: rowId } })) { /* the popup was blocked */ }
```

A send recorded by a button (handed over, mailed): after the save succeeds, `void fileSentCopy({ ...filing, how: 'hand' }, { html })`, built **before** the save so the copy is the page the person saw.

`kind` is lower case with underscores and never changes once rows exist. `title` is what the office reads. Give every key you have (`jobIds`, `customerId`, `bidId`, `personId`): they are how the copy is found.

## The ratchet

[`sentCopiesCoverage.test.ts`](../src/lib/sent/sentCopiesCoverage.test.ts) reads the source for every file that prints. Each must file a copy, be on `PRINTS_OWED`, or be on `NOT_A_SEND` with its reason. A new print fails CI until it has an answer, and `PRINTS_OWED` only shrinks. Step 2 adds the same hold on the email functions.

Deliberately not filed: our own working sheets and reports, a page the other party prints from their own portal, and **pay stubs** — pay stays with payroll and never enters a list the whole office reads.

## The train

| Step | What | State |
|---|---|---|
| 1 | The table, the bucket, the client helper, **Sent from this job**, the ratchet for prints. First paper: the owner's records packet (its two prints and *Record it as sent*). | v2.4554 |
| 2 | Emails: a `_shared` helper that keeps the message and its attachments, then each function that writes outside — bills (a re-email leaves no trace today), lien notices and demand letters, lien releases, hazmat notices, GC statements, test reports, estimates, job contracts, RFQs, supply-house accounts, bid-room links, submittal replies. A ratchet over the functions. | owed |
| 3 | The prints on `PRINTS_OWED`, by surface: the Lien desk and lien papers; bills and GC papers; contracts; bids and submittals; subs and suppliers. | owed |
| 4 | Finding a copy without a job: a **Sent** tab on the Documents page, the customer's page, and the *Sent 10/02/2026* words on a bill or a contract row linking to the copy (`source_table`, `source_id`). | owed |
| 5 | Sends that leave the app unseen: a pay application's workbook at download, a bid marked sent by hand. | owed |

Copies start the day each paper is wired. What went out before cannot be rebuilt as it was.
