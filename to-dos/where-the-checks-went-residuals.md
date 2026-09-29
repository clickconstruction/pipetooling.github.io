---
name: "Where the checks went: the three pieces left after the train"
number: 55
group: waiting
status: filed 2026-09-28, the day the train (v2.4043–v2.4053, v2.4091) went live; nothing here is started
summary: >
  "Where the checks went" shipped in five PRs plus a print fix: the line under each
  bill (statement print, GC Review's bill lines, the portal), Find a check, the printable
  sheet + CSV, and Your payments on the portal. Three pieces were set aside on purpose
  and said out loud in the fragments; this card is so they are not forgotten.
next: >
  Pick which, if any: (1) the statement EMAIL's line under each bill — the only surface
  a GC sees weekly that still lacks it; (2) the sheet by development, and Find a check
  when the modal is grouped by development; (3) the sheet as a PDF (the browser's
  "about:blank" footer) and Print all across every GC.
size: S (2) · M (1, 3 — a migration and an edge deploy; a PDF builder)
blocker: (1) touches `get_gc_statement_email_payload` and `gc-statement-email-dispatch/render.ts`, whose client render is pinned byte-for-byte by `gcStatementEmailParity.test.ts` — a migration, an edge redeploy, and the parity test move together.
opinion: build (1) when a GC asks or the office wants fewer "did you get our check?" calls by email too; leave (3) unless a bookkeeper asks for a PDF — the print dialog's "Headers and footers" box removes the footer today.
mockup: not required — the wording and the layout exist on the other surfaces; these copy them
---

## The three pieces

### 1. The statement email says what paid each bill

v2.4044 put *paid $12,000.00 by #48211 on Sep 24 · $1,333.00 still open* / *nothing applied yet* under every bill on the printed statement, the certify checklist, the call sheet and the portal — but not on the statement **email**, which is what most GCs actually read. The email's server lane renders from the `get_gc_statement_email_payload` RPC, and `src/lib/jobsDocuments/gcStatementEmail.ts` is pinned byte-for-byte to `supabase/functions/gc-statement-email-dispatch/render.ts` by `gcStatementEmailParity.test.ts`. So the line lands in three places at once: the RPC gains a `paid_by` text per row (built in SQL from `jobs_ledger_payments` under the same oldest-bill-first rule — or the RPC returns the raw payments and the two renders call the kernel), `render.ts` prints it, the client builder prints it, the parity fixture grows the field. One migration (`SET lock_timeout = '3s'`, `CREATE OR REPLACE` from the newest definition — 20260911223500 was the last), one `supabase functions deploy gc-statement-email-dispatch`.

### 2. By development

Find a check (and the sheet inside it) is offered only when GC Review is grouped **By GC** (`!byDevelopment && g.gcId` in `JobsGcReviewModal`), because `fetchGcChecksInputs` reads jobs by `gc_customer_id` / `customer_id`. The mock-up's owner call was "follow the switch": under By development, read the development's jobs (`jobs_ledger.development_id`) and run the same kernel with the payer rule per bill. Small: one branch in the IO, the menu guard, a smoke.

### 3. A PDF, and Print all

The sheet opens in a blank print window, so the browser's own footer prints "about:blank" unless *Headers and footers* is unticked. The unpaid-invoices print avoids this by building a PDF (`gcUnpaidInvoicePrintIo.ts` → `buildPhysicalInvoicePdfBlob`); the sheet could do the same. **Print all** (every GC's sheet at once) was in the mock-up and not built — it would read every GC's jobs in one go; per GC was the ask.

## Where it plugs in

- Kernel: `src/lib/jobs/gcChecksApplied.ts` (`billPaidByWords`, `buildGcChecksReport`); IO `gcChecksAppliedIo.ts`; sheet `src/lib/jobsDocuments/gcChecksAppliedReport.ts`; modal `src/components/jobs/GcFindCheckModal.tsx`.
- Email: `src/lib/jobsDocuments/gcStatementEmail.ts`, `supabase/functions/gc-statement-email-dispatch/render.ts`, `gcStatementEmailParity.test.ts`, migration `20260911223500_who_pays_readers_follow_the_rule.sql` (the RPC's newest definition).
