---
name: Lien notices sent by hand — record them, link the file, combine a property
number: 35
group: close
status: asked 2026-09-23 · PR 1 shipped v2.3763 · PR 2 (record a notice sent by hand) built v2.3770 · PR 3 (one notice per property, the tick) built v2.3777 · the closed-months call answered 2026-09-25 (v2.3821 — every notice claims the whole balance) · left: the office records the Lenox paper through PR 2's door, and the $350 call
summary: >
  **A notice went out and the app never learned of it.** Taunya mailed a § 53.056 notice on
  2026-09-22 to the owner of 9703 Lenox Hl: one paper for jobs 273, 858 and 866 (three jobs at one
  property under RMC- Dudley Mason), claiming $28,987 for April, June, July and August, with the
  residential cover letter, the homestead statement and a page of QR codes to the five bills. The
  filings table had no row for any notice, ever; 273 still sat in *Awaiting approval* with a draft
  for July and August, and 858 and 866 were "ready" in the Dudley run, so the next run would have
  mailed them again. Three gaps: no way to record a notice that went out by hand; nowhere to keep
  the file (the owner's ask — "plain text fields with a Google Drive link to the file in
  question"); and one paper over several jobs at a property, claiming the whole balance, where the
  app prints one notice per job and (counsel, v2.3745) claims the timely months only.
next: >
  The office records the Lenox paper through *Already mailed? Record it…* on 273 (858 and 866 ticked,
  $28,987, April–August, the Drive link). The owner answers the one call left below (the closed-months
  call was answered 2026-09-25 by v2.3821: the form claims the whole balance); the combine tick stays
  off until then. Then delete the folder — the release notes carry the record.
size: XS (PR 1) · S (PR 2) · M (PR 3)
blocker: >
  One call left — whether 1009's $350 (Lenox Check PU) was left out of the Lenox notice on
  purpose. (Whether the office may claim closed months on the form was answered 2026-09-25: the
  owner had every notice claim the whole balance, v2.3821, reversing counsel's timely-months rule.)
opinion: build now — the record is wrong today (273 asks the leader for a notice already in the mail) and the Lenox paper cannot be recorded without PR 2.
---

# Lien notices sent by hand

**The ask (Grace, 2026-09-23, with the PDF Taunya mailed):** *"Can you help me figure out how we
need to update the app to accommodate this? And maybe we should add fields where it is clarified
when things like this are sent, even if they're just plain text fields with a Google Drive link to
the file in question."*

## What was mailed, and what the app knows

| | The paper (2026-09-22) | The app (2026-09-23) |
|---|---|---|
| Jobs | 273 + 858 + 866 at 9703 Lenox Hl (1009's $350 left out) | one notice per job; 858/866 first entered the lien readers with v2.3747 |
| Claim | $28,987 for April, June, July, August | 273's balance $17,585; timely months only (v2.3745) — only August is open |
| Record | none — the filings table is empty | 273 *Awaiting approval* (Jul + Aug draft); 858, 866 *ready* in the Dudley run |
| File | a PDF in Taunya's mail | nowhere to keep it (before PR 1) |

The pages are the app's own paper (the residential letter of v2.3745, the form with the § 53.254(g)
statement of v2.3744, the *Copy for: Owner of record* page of the run) plus a QR page the app does
not print. So the office prints from the app and mails by hand; the record has to follow.

## The plan

1. **PR 1 — the saved copy on every filing (v2.3763).** `document_url` + `document_note` on
   `job_lien_filings`; typed on Record the run, on the Lien window's three record steps (notice
   sends, affidavit filing, release), and added or changed on any recorded filing's row after the
   fact (*link the saved copy* / *change*); shown on the row (*Saved copy · Drive ›*) and on the
   Legal desk's filings table. The migration also lands `packet_id`, `by_hand` and
   `printed_claim` for PRs 2–3, so one push serves the stream.
2. **PR 2 — Record a notice sent by hand.** The door, the tick list of the other unpaid jobs at
   the same property (`customer_address_id`, else the street key), the filings on one packet,
   the awaiting item marked sent, the `noticed` months. The row says *printed $28,987 · the
   app's timely claim would have been $X* when they differ. Guide + GLOSSARY + a
   PROJECT_DOCUMENTATION line (a new door on the desk pane and the Lien window).
3. **PR 3 — one notice per property, on purpose.** The run already shares the owner's envelope
   per property (v2.3720); a *combine* tick prints one form with the summed claim and the union
   of months, still one filing per job on one packet, and the GC modal offers the same per
   property. Owner call first (the form's claim changes).

## Where it plugs in

- Writes: `lienDeskRun.ts` → `runFilingPayload` / `lienDeskRunIo.ts` (the run), `LienFilingTabs.tsx`
  (the Lien window's three record steps, `insertFiling`), the new by-hand door (PR 2).
- Reads: `LienFilingTabs.tsx` *Filings on this job*, `legalPacket.ts` → `LegalDeskModal`, the desk's
  Sent pile (needs the filings loaded — PR 2 loads them for the packet), the Customer review's
  *on notice since* chip (filings per GC — unchanged).
- Kernel: `lienFilingDocumentLink.ts` (the URL rule, the words, the payload keys only when they
  carry a value — a client deployed before the push still records).

## Verify

- PR 1: Lien window → a job with a GC → **Save & record sends…** shows *Saved copy* with a link and
  a note; a recorded row reads *Saved copy · Drive ›* and *change*; the Legal desk's filings table
  has a *Copy* column; the run's footer has the same two boxes. Kernel tests + the run modal smoke.
- PR 2: the Lenox record — 273's item moves to Sent, 858/866 leave the Dudley run, the three
  filings share a packet and the Drive link; *Put RMC- Dudley Mason on notice* lists them as
  noticed.
