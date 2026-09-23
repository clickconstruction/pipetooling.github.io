---
name: Pay codes — QR codes on the lien notice and in View bill
number: 36
group: close
status: asked 2026-09-23 · mock-up drawn the same day (`mockup.html`) · all four PRs built and walked live the same day (v2.3754 the address · v2.3757 View bill · v2.3758 the page in the packet · v2.3759 the previews) — awaiting push, merge and `supabase functions deploy pay-link`
summary: >
  The packet the office used to mail by hand had a page the app never learned: after the § 53.056
  notice, one QR code per unpaid bill under "Once these bills are paid, there will be no lien
  filed." The app builds the cover letter, the notice and the enclosed invoices, and stops there.
  This adds the pay page to the packet (printed run, emailed PDF, the single-notice window), shows
  it in the Lien desk pane and the GC-run preview, and puts a fourth Payment Link in View bill —
  a QR code, large enough to scan off a screen, with Copy image · Download PNG · Print. Every code
  carries an app address (`/pay/<bill id>`) that fetches Stripe's current link at scan time, so a
  code on paper outlives Stripe's 30-day link. The company mark sits in the middle of every code;
  the QR library already shipped does that for free.
next: >
  Push and merge the four commits, deploy `pay-link`, then the real scan: print the ZZ TEST GC's
  run, scan a code from the paper, pay a $1 test-mode bill. Decision 2 stays the owner's — the
  GC's copy carries no pay page until counsel says (`PAY_PAGE_ON_GC_COPY`, one line).
size: M (4 PRs: S · M · S · S)
blocker: the merge and the function deploy, then a real scan. The GC's copy of the pay page wants counsel's nod (decision 2); the build gates it on one line, default off.
ver: v2.3754 · v2.3757 · v2.3758 · v2.3759
mockup: to-dos/lien-notice-pay-codes/mockup.html — drawn 2026-09-23
opinion: build — the office is about to mail the Dudley run; a code that still works in month four is the difference between a scan and a search bar.
---

# Pay codes: QR codes on the lien notice and in View bill

**The ask (2026-09-23):** "We want to add QR codes to notices that go out for notices surrounding
liens and be able to preview them in the lien desk. Historically when we sent out lien notices,
they were sent out like this [the *RE: 273 DUDLEY (LENNOX)* packet: cover letter · notice · a page
of QR codes · owner-of-record copy]. Right now our app fulfills the first two of three sections.
It does not fulfill the QR codes. These QR codes link back to Stripe." And, same vein: "The View
bill modal in Jobs Pipeline — in the payment links there are several options to share, but no
option for a QR code. We would like a QR code there." Plus: "sometimes QR codes can be custom. If
a custom QR code does not add that much extra, it would be fun to put our logo in the middle."

**The mock-up:** `mockup.html` — the packet before/today/proposed, the pay page as it prints
(owner's copy with the letter's rule; GC's copy without), the desk pane and the GC-run preview
with page 3, the View bill row and the QR modal, the three states of the `/pay/…` page on a
phone, the three codes side by side (plain · with the mark · Stripe's own address), the decisions
table and the train. The codes on it are real, rendered with `qrcode.react` and the mark carved
out; they scan to the proposed addresses and 404 until PR 1 ships.

## Where it plugs in

Everything the page needs is already loaded for the run; what is missing is one address, one
image block and one preview page.

| Piece | Exists | New |
|---|---|---|
| The unpaid bills behind a notice | `unpaidBilledInvoices(job)` / `noticeInvoiceDocs(job)` (`src/lib/jobs/noticeInvoiceEnclosure.ts`, v2.3437) — number, date, description (`lineDescription`), amount, all on the `PhysicalInvoiceDocument` | `NoticeInvoiceDoc` gains `invoiceId` (it has it), `stripeInvoiceId`, the balance still owed |
| The packet, printed | `runPacketHtml` (`src/lib/jobs/lienDeskRun.ts:205`): cover sheet → per envelope, per notice: cover page (owner) → form → invoice sections | a fourth argument `payPagesByJob`, one page pushed after the form and before the invoices, gated by recipient key (decision 2) |
| The packet, emailed | `emailNoticePdf` (`src/lib/jobs/lienDeskRunIo.ts:18`): cover PDF + form PDF merged, invoices merged behind via `buildDemandLetterPacket` | a pay-page PDF blob merged between the form and the invoices |
| One notice from the Lien window | `LienFilingTabs.tsx` `noticeEnclosureHtml` / `withNoticeEnclosure` / `downloadPdf` / `emailNoticeTo` | the same page, the same three ways |
| The document model | `FilingDocBlock` (`src/lib/jobsDocuments/lienFilingDocuments.ts:23`): letterhead, refstrip, title, paragraph, … — no image kind; `filingDocHtml` / `filingDocPdfBlob` | one `payRow` block (svg + png data URL, number, description, balance) rendered by both; jsPDF `addImage` precedent is the signature in `lienWaiverRelease.ts:406` |
| The code | `qrcode.react` 4.2.0 (`QRCodeSVG`, portal and sub-portal cards) — `imageSettings` + `excavate` draws the mark and carves the hole; `renderToStaticMarkup` via `import('react-dom/server')` precedent in `PartnerStatement.tsx:30` | `src/lib/billing/payQr.ts`: `payQrSvg(url)` for print and preview, `payQrPngDataUrl(url)` (SVG → canvas → PNG, the mark inlined) for the PDF; `public/brand/click-mark.png` cropped square from `click-plum.png` |
| The stable address | the customer portal renews a stale Stripe link at request time with `refreshStripeInvoiceLinks` + `linkMayBeStale` (`supabase/functions/customer-portal/index.ts:212`, v2.3590); the nightly `refresh-stripe-invoice-links` sweep (v2.3589) | `pay-link` edge function (public GET, `verify_jwt = false`, rate-limited like `check_edge_boot`): by bill id → billed Stripe invoice → renew if stale → `{ url, number, job_name, amount_remaining, status }`; `src/pages/PayLink.tsx` at `/pay/:id` (opening · paid · not found), the SPA 404 fallback already serves any path |
| Desk pane preview | `LienDeskModal.tsx:1090` stacks *Page 1 of 2 · cover note* / *Page 2 of 2 · the notice* from `coverHtml` / `docHtml`; the new-window page `buildLienNoticePreviewHtml` counts `cover ? 2 : 1` | a third paper *Page 3 of 3 · pay codes*; the pane fetches the job once (`fetchJobWithDetailsById`, as the run does) when it opens; `LienNoticePreviewPages` gains `payHtml` |
| GC-run preview | `buildGcNoticePreview` → `pages: { owner: [cover, notice], original_contractor: [notice] }` (`src/lib/jobs/gcNoticePreview.ts:78`); `GcNoticePreviewModal` renders the list with labels | `{ key: 'pay', label: 'pay codes' }` on the owner's list (and the GC's when decision 2 says so); the toggle's line changes with it; the hook loads the bills per job (`useGcOnNoticeData` has the job ids) |
| View bill | `StripeInvoiceSharePanel.tsx:165–216` — the icon cluster Copy · SMS · Email over `hostedInvoiceUrl`; the labeled cluster Text · Copy link · Email on the Bills tab (`JobFormInvoiceList.tsx:511`) | a fourth icon / the word *QR*, opening `BillQrModal` (the code at 240 px, the number, the amount remaining, the address in words, Copy image · Download PNG · Print · Close); `JobFormInvoiceList.render.test.tsx:123` pins the label list and grows by one |

## Decisions (the mock-up's table, in short)

1. **The address the code carries** — `clicktooling.com/pay/<bill id>`, the app's page that fetches
   Stripe's current link at scan time. Stripe expires its link 30 days after the due date; the
   nightly sweep keeps the stored copy fresh, not the paper. A short code column is a later polish.
2. **Which envelopes** — the owner's copy, with a shaded line repeating the cover letter's rule
   (pay us directly only with the GC's written okay); the GC's copy is the owner's call, default
   off, since counsel's memo says the GC's envelope is "the form and invoices only".
3. **Where** — after the notice, before the enclosed invoices; page 3 of the owner's copy.
4. **The words** — "Once these bills are paid, there will be no lien filed." unchanged; rows say
   *Still owed*, not *Total*.
5. **The mark** — yes, level Q (41 × 41 for the pay address; plain M is 37, H would be 49), the hand-and-wrench cropped square; free with the library shipped. Built as drawn.
6. **View bill's code** — the same `/pay/…` address; Copy · Text · Email keep Stripe's link.
7. **A bill outside Stripe** — a row with no code (*pay by check to the address above*); no icon.
8. **Later** — the code on the invoice sheet itself (which would also settle 2 for the GC's
   envelope, since the invoices already go there); a short code column.

## The train

1. **PR 1 · the address (S)** — `pay-link` + `config.toml`, `/pay/:id`, `payLinkUrl(id)` kernel,
   `docs/EDGE_FUNCTIONS.md` section + TOC, `docs/twins/APP_DIRECTORY.md`. No migration.
2. **PR 2 · the page in the packet (M)** — `lienNoticePayPage.ts` (rows from the bills, the
   heading, the rule by copy), `payQr.ts`, the `payRow` block in `lienFilingDocuments.ts`, the
   page in `runPacketHtml`, `emailNoticePdf` and the Lien window's three doors; the mark asset;
   tests beside each kernel (`lienDeskRun.test.ts:89` and `:178` pin the page order — they grow);
   guides *send lien notices from the Lien desk* and *file a lien and never miss its deadlines*.
3. **PR 3 · the previews (S)** — the desk pane's third paper + the one-job fetch, the preview
   window, the GC-run preview page and the copy toggle's line.
4. **PR 4 · View bill (S)** — the icon, `BillQrModal`, the labeled *QR*, the render test, the
   guide *bill a customer and get paid* (Sharing the Billed report / Payment Links).

PR 4 can follow PR 1 the next day and is the quick win. Cut each from fresh main; #32 (the
creation-month fallback) changes which bills reach the packet, not the packet code, so no
collision; #33's invoice-enclosure split (progress vs retainage) touches `noticeInvoiceDocs` —
whichever lands second rebases.

## How to verify

- **PR 1:** open `/pay/<id>` for a test-mode bill — it names the bill and forwards to Stripe; a
  paid bill says *Paid*; a random UUID says *not found*; curl the function 30 times in a minute
  and the 31st is refused.
- **PR 2:** print the run for the ZZ TEST GC's job (dev login as Robert, `/jobs?tab=stages`,
  Lien desk → Send the run → Print); scan every code on the paper with a phone; pay a $1
  test-mode bill through it; the emailed copy's PDF has the same page between the form and the
  invoices. A job with a paper-only bill prints the row without a code.
- **PR 3:** the desk pane reads *Page 3 of 3 · pay codes*; the GC window's *Preview all* shows
  it on the owner's copy and the toggle's line reads right for both copies; 375 px has no
  sideways scroll.
- **PR 4:** View bill on a billed Stripe invoice shows the fourth icon; the modal's code scans to
  `/pay/…`; Copy image pastes into a text; Print gives the half-sheet; the Bills tab reads
  *Text · Copy link · Email · QR*; a paper-only bill shows none.
- **The real one:** the Dudley re-run once #32's fallback is in, with a code scanned from the
  printed packet before it goes in the envelope.
