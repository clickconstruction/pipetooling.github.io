---
name: "Where the checks went: Print all, the one piece left after the train"
number: 55
group: waiting
status: filed 2026-09-28; piece 1 (the statement email's line) built the same day as v2.4100; piece 2 (by development) v2.4912; piece 3's PDF v2.4913 — only Print all left
summary: >
  "Where the checks went" shipped in five PRs plus a print fix: the line under each
  bill (statement print, GC Review's bill lines, the portal), Find a check, the printable
  sheet + CSV, and Your payments on the portal, and (v2.4100) the statement email's line. Two pieces were set aside on purpose
  and said out loud in the fragments; this card is so they are not forgotten.
next: >
  Print all (every GC's sheet at once) stays unbuilt: per GC was the ask. (1) shipped as v2.4100,
  (2) as v2.4912, (3)'s PDF as v2.4913.
size: S (Print all — one PDF over every GC's sheet)
blocker: None.
opinion: leave Print all until someone asks for every GC's sheet at once.
mockup: not required — the wording and the layout exist on the other surfaces; these copy them
---

## The pieces

### 1. The statement email says what paid each bill — shipped, v2.4100

v2.4044 put *paid $12,000.00 by #48211 on Sep 24 · $1,333.00 still open* / *nothing applied yet* under every bill on the printed statement, the certify checklist, the call sheet and the portal — but not on the statement **email**, which is what most GCs actually read. The email's server lane renders from the `get_gc_statement_email_payload` RPC, and `src/lib/jobsDocuments/gcStatementEmail.ts` is pinned byte-for-byte to `supabase/functions/gc-statement-email-dispatch/render.ts` by `gcStatementEmailParity.test.ts`. So the line lands in three places at once: the RPC gains a `paid_by` text per row (built in SQL from `jobs_ledger_payments` under the same oldest-bill-first rule — or the RPC returns the raw payments and the two renders call the kernel), `render.ts` prints it, the client builder prints it, the parity fixture grows the field. One migration (`SET lock_timeout = '3s'`, `CREATE OR REPLACE` from the newest definition — 20260911223500 was the last), one `supabase functions deploy gc-statement-email-dispatch`.

### 2. By development — shipped, v2.4912

Find a check and its sheet are offered on a development's Share menu too: `fetchDevelopmentChecksInputs` reads the development's jobs, and the kernel with `gcId: null` counts every bill on them, whoever pays it.

### 3. A PDF — shipped, v2.4913 — and Print all

The sheet is a PDF now (`gcChecksAppliedPdf.ts`), opened in a tab and filed as the sent copy, so the browser's "about:blank" footer is gone. **Print all** (every GC's sheet at once) was in the mock-up and not built — it would read every GC's jobs in one go; per GC was the ask.

## Where it plugs in

- Kernel: `src/lib/jobs/gcChecksApplied.ts` (`billPaidByWords`, `buildGcChecksReport`); IO `gcChecksAppliedIo.ts`; sheet `src/lib/jobsDocuments/gcChecksAppliedReport.ts`; modal `src/components/jobs/GcFindCheckModal.tsx`.
- Email: `src/lib/jobsDocuments/gcStatementEmail.ts`, `supabase/functions/gc-statement-email-dispatch/render.ts`, `gcStatementEmailParity.test.ts`, migration `20260911223500_who_pays_readers_follow_the_rule.sql` (the RPC's newest definition).
