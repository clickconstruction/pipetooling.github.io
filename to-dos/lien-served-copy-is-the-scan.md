---
name: "Lien desk: a filed lien's copy is the signed scan — no print without one, and the scan's pages go in the envelope"
number: 378
group: gated
status: asked and designed 2026-11-17, not started · the owner holds it until the split of LienDesk.tsx has landed
summary: >
  After a lien affidavit is filed, § 53.055 has the claimant send a copy of it to the owner, and to the
  original contractor when there is one, by the fifth day. Filed liens, copies to mail prints a page the
  app redraws from its own record, marked COPY, with no signature, no notary's seal and no clerk's stamp.
  The owner asked whether that meets the code. The safe reading is that it may not: an affidavit is a
  signed, sworn paper, and a page without the signature and the notary's block can be called a summary.
  So the rule changes. A filed lien prints its copies only when a scan of the signed affidavit is saved
  on it, and the scan's own pages are the copy in the envelope. The office already adds those scans
  (Add the stamped scans); nothing reads one back from Drive yet.
next: Wait for the split of LienDesk.tsx to land and for PR #8539 (the upload function names its reasons) to merge. Then the owner confirms the two open picks, a mock-up of the window's rows is drawn, and PR 1 starts.
size: M as a train of two (S to M · M)
blocker: The owner's word to start, after the split of LienDesk.tsx lands. PR 1 edits the same function as PR #8539, so that merges first.
---

# A filed lien's copy is the signed scan (#378)

No mock-up yet. One is owed before PR 2: the window's rows with a signed copy, a row with none, and the held list. Made-up jobs only.

## The ask

The owner, 2026-11-17, reading the box on the app's COPY page ("This copy does not show the signatures, the notary's seal or the clerk's stamp"): "are we allowed to do this? does this meet the code? or do we have to show them as they were stamped and signed?"

Then, the same day: "we need to update the print out where it can't print unless we have uploaded a copy and we need to pull those copies into the run. we as users are going to have to upload signed copies or pull them from the recorders offices".

And: "add it to the punchlist to build, since we're going to wait for the decomposition to land before we add more".

## Why the redrawn page is the risk

This is a reading, not counsel's answer. Question 1 on [#366](./lien-serve-filed-copies/README.md) asks counsel the same thing and is still open.

- § 53.055 says the person who files the affidavit sends *a copy of the affidavit*. It does not say a certified copy or a file-stamped copy.
- Texas law defines an affidavit as a written statement that is signed, sworn before an officer and certified under the officer's seal (Government Code § 312.011, quoted from memory; counsel confirms the wording).
- The app's page reprints the words and leaves out the signature and the notary's block. Those are part of what makes the paper an affidavit.
- The clerk's stamp is the least worry: the statute asks for a copy of the affidavit, not of the recorded instrument.

A photocopy of the signed, notarized paper is a copy on any reading. The stamped scan is the safest one, and the office already keeps it.

## The rule

A filed lien prints its copies only when a scan of the signed affidavit is saved on it. The scan's own pages are the copy in the envelope. **A hard gate, no override**: the owner's words are "it can't print unless we have uploaded a copy".

## What the office does

1. Get the paper back: the stamped copy from the clerk, a download from the recorder's site, or a scan of the signed original.
2. **Add the stamped scans** (built: one file a lien, several at once, or one scan of a stack split per lien).
3. Open **Filed liens: copies to mail**. Each lien reads *Signed copy · 3 pages ›* or *No signed copy yet*, with a press that opens Add the stamped scans.
4. Print. The press counts only the liens with a scan (`batchWords`). The others are listed as held, each with its reason and its door. Do what is ready, never all or nothing.
5. The stack comes out as today with one change: after the mail sheet, each envelope holds the letter and then the scan's pages as they are.

## Where it plugs in

What exists:

- The window `src/components/jobs/LienServeWindow.tsx` and the single press `LienServeCopiesPress.tsx` in the job's Lien window.
- The batch kernel `src/lib/jobs/lienServePackets.ts` (`lienServePlan`, `lienServeBatchPrint`) and the papers `src/lib/jobsDocuments/lienServedCopy.ts` (`lienServeHolds`, `lienServePapers`, the COPY box, the two counsel flags).
- The stack is one HTML page handed to `openHtmlPrintWindow`. Each job keeps its print through `fileSentCopy` (`docs/SENT_COPIES.md`).
- A filing's saved copy is a Drive link on `job_lien_filings.document_url`. Scans are a PDF or a picture (`src/lib/jobs/lienScanFile.ts`), put in the job's folder under Sent by us by `drive-link`'s `put`.
- A PDF reader is in the client already (`src/lib/pdfjsDocument.ts`), and `pdf-lib` cuts a stack (`lienScanStackIo.ts`).

What is new:

- **A way to read a scan back.** `drive-link` puts a file and links to one. It hands no office caller a file's bytes. A new office-only action reads one file that sits inside the job's own folder (`halfInside`), with a size cap.
- **Scan pages into the print.** A pure kernel that says what a saved copy is (a PDF, a picture, a link the app cannot read) and an io half that draws a PDF's pages as pictures and passes a picture through. The stack stays one HTML page.
- **The gate.** *No signed copy yet* joins `lienServeHolds`, beside *no recording number*.

## Cases to handle

- **A saved copy the app cannot read**: a link typed by hand, a file outside the job's folder, a file Drive refuses. Held, with *Upload the scan*.
- **A HEIC picture uploaded from a computer.** Most browsers cannot draw it. Held, asking for a PDF or a JPG. A phone's photo through the press is already a JPG.
- **A photo of the first page only.** The app cannot know pages are missing. The row and the mail sheet show the page count, so one page for a three-page affidavit stands out.
- **A lien filed outside the app.** Today it is held as *Mail a photocopy of the filed affidavit* (`no_paper`). With the scan as the copy it prints like the rest.
- **What the job keeps.** The letter and a link to the scan, never the page pictures: a stored print must stay small.
- **A failed read.** The reason comes from the function's own words and offers Try again where a second try can help, as an upload does since v2.7635.

## Open picks for the owner

Recommended, not yet confirmed:

1. **Retire the redrawn COPY page from the envelope.** The letter already names the county, the day and the document number, and two copies in one envelope invite the question of which is the copy. The alternative keeps it as a cover page in front of the scan.
2. **Any saved scan passes the gate**, stamped by the clerk or signed before filing. The app cannot tell them apart, and the row shows what the file was saved as. The alternative asks the office to say which it is and holds an unstamped one.

Counsel's question 1 on #366 stays open and is no longer a blocker: a photocopy is a copy either way. If counsel says the redrawn page counts, the gate is still the owner's rule.

## The plan

1. **Read a scan back, and turn it into pages** (S to M). The new action on `supabase/functions/drive-link/index.ts` with its section in `docs/EDGE_FUNCTIONS.md`; the kernel and its io half with tests; nothing on screen. **Deploy**: `supabase functions deploy drive-link`. Starts after v2.7635 merges, since both edit that function.
2. **The gate and the stack** (M). `lienServeHolds` gains the hold; `lienServePackets.ts` and the window print the scan's pages and list what is held; the single press follows the same rule; the mail sheet shows page counts; the COPY page goes or stays by pick 1; the guide `file-a-lien-and-never-miss-its-deadlines` and the #366 card are amended; `LIEN_SERVED_COPY_READ_BY_COUNSEL` and its amber line go with the COPY page. Release note and fragment.

Later, its own card when asked: Docsmit mails the scan's PDF itself (#366 lists the two server fixes that come first).

## Verify

- Unit: the kernel over a PDF, a picture, a hand-typed link, a HEIC, an empty link. The plan over a batch where some liens have a scan and some do not: the press's count, the held list, the envelopes.
- Render: the window with one held lien shows its reason and its door, and the press prints the rest.
- Live, on a ZZ job only: record a filing, add a made-up two-page PDF, print, and check that the stack holds the letter and both pages for each envelope. Then take the scan off and check that the press holds the lien.

## Where it stands

2026-11-17: designed in a session with the owner, nothing built. The ten liens filed the day before all have a saved scan, so they would print under this rule; until it is built the office prints those scans from Drive by hand.
