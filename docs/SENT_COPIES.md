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
- **One helper each side.** The client calls `fileSentCopy(filing, body)`, `printAndFile(html, filing)` or `printWhenReadyAndFile(build, filing)` ([`sentCopiesIo.ts`](../src/lib/sent/sentCopiesIo.ts)); the rules are pure in [`sentCopies.ts`](../src/lib/sent/sentCopies.ts) (13 tests). Opening a kept file goes through [`storageSave.ts`](../src/lib/storageSave.ts) since v2.4610: a PDF opens in its own tab, a file the browser cannot show is read into the page and saved from the app's own address, so Safari asks once at most. An email function calls `fileSentEmailBestEffort(filing, message)` ([`_shared/fileSentCopy.ts`](../supabase/functions/_shared/fileSentCopy.ts)), or passes `options.file` to `sendEmailViaResend`: the message as it was read and each attachment are kept.
- **Best effort, never in the way.** Filing never throws and is not awaited by a click. If the copy cannot be stored the row is still written with no path, and the list says *The copy was not kept*.
- **A repeat does not pile up.** The copy's SHA-256 is on the row. A second print of the same page points at the first file, and the list folds the rows into one line (*Printed 3 times, last …*).
- **A copy is shown, never run.** A kept page opens inside a frame whose sandbox has scripts, forms and navigation off (`sentCopyFrameHtml`): the file was stored by someone on staff and is treated as a file.
- **Where it reads.** The Job window's Documents tab, section **Sent from this job** ([`JobDocumentsSent.tsx`](../src/components/jobs/JobDocumentsSent.tsx)), by `job_ids`. A send that names no job (a GC statement, a price request, a bid letter, a law-firm notice) is kept and waits for step 4: the Documents page and the customer page.

Who: the office reads (`is_office_staff()`: dev, master, assistant, controller). Staff who send can file (the office, estimators, primary, superintendent). Deletes are dev only.

## Wiring a send

A print:

```ts
if (!printAndFile(html, { kind: 'owner_records_packet', title: `Records for ${address}`, recipientName: owner, jobIds, customerId, source: { table: 'lien_owner_record_requests', id: rowId } })) { /* the popup was blocked */ }
```

A send recorded by a button (handed over, mailed): after the save succeeds, `void fileSentCopy({ ...filing, how: 'hand' }, { html })`, built **before** the save so the copy is the page the person saw.

An email, in the function that sends it, after the send succeeded:

```ts
await fileSentEmailBestEffort({ kind: 'lien_release', jobIds: [jobId], customerId, source: { table: 'job_lien_releases', id: releaseId }, sentBy: user.id }, { to, from, subject, html, attachments, resendEmailId })
```

Where the function stamps a row after sending, file after the stamp: keeping the copy must never delay it.

`kind` is lower case with underscores and never changes once rows exist. `title` is what the office reads (an email's subject when none is given). Give every key you have (`jobIds`, `customerId`, `bidId`, `personId`): they are how the copy is found.

## The ratchet

[`sentCopiesCoverage.test.ts`](../src/lib/sent/sentCopiesCoverage.test.ts) reads the source for every file that prints. Each must file a copy, be on `PRINTS_OWED`, or be on `NOT_A_SEND` with its reason. [`sentCopiesEmailCoverage.test.ts`](../src/lib/sent/sentCopiesEmailCoverage.test.ts) holds every edge function that hands a message to Resend the same way (`EMAILS_OWED`, `NOT_OUTSIDE`). Both owed lists are empty: a new print or a new sender fails CI until it files or says why not.

Proving it live: `test-email` with `file_copy_only: true` sends nothing and files a `self_test` copy through the email helper; a dev reads the row back and deletes it.

Deliberately not filed: our own working sheets and reports, mail to our own staff, a page the other party prints from their own portal, **pay stubs** — pay stays with payroll — and **partnership notices**, which are kept on the partnership itself. Neither enters a list the whole office reads.

## The train

| Step | What | State |
|---|---|---|
| 1 | The table, the bucket, the client helper, **Sent from this job**, the ratchet for prints. First paper: the owner's records packet (its two prints and *Record it as sent*). | v2.4554 |
| 2 | Emails: the `_shared` helper that keeps the message and its attachments, then every function that writes outside — bills (a re-email left no trace before), lien notices and demand letters, lien releases, hazmat notices, GC statements, test reports, estimates, job contracts, person contracts, RFQs, supply-house accounts, bid-room links, submittal replies, law-firm notices (and since v2.4624 the firm's portal link from the Legal desk, filed under the link it carries), field reports to an outside address. The ratchet over the functions. | v2.4557, v2.4558 |
| 3 | The prints: lien papers, counsel's grid and the legal packet; bid letters, schedules of values and procurement updates; contracts; GC statements, checks sheets and pay codes; work orders, sub sheets and purchase orders. | v2.4559 |
| 4 | Finding a copy without a job: a **Sent** tab on the Documents page (by customer, bid, person, kind), the customer's page, and the *Sent 10/02/2026* words on a bill or a contract row linking to the copy (`source_table`, `source_id`). Until then a send with no job is kept and not yet listed. | owed |
| 5 | Sends that leave the app unseen: a pay application's workbook at download, a bid marked sent by hand, a `mailto:` or `sms:` link. | owed |

Copies start the day each paper is wired. What went out before cannot be rebuilt as it was.
