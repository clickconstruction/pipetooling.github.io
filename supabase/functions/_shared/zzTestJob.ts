/**
 * The ZZ convention's one rule (GLOSSARY → ZZ convention; punch list #61): a name that starts with ZZ, in any case
 * and after trimming, is a test record — a live pass's or a twin's. One copy, read by the app (`src/lib/jobs/zzTestJobSweep.ts`
 * re-exports it, so the sweep, the Pipeline's switch and every list that hides ZZ rows read this file) and by the edge
 * (`_shared/reportSubject.ts`: `send-report-email` and `send-report-notification` hold a report on a ZZ record back,
 * v2.6127), tested from `src/lib/jobs/zzTestJobSweep.test.ts`. Pure: no Deno, no DOM, no imports.
 */

/** The ZZ convention: the name starts with "ZZ" (any case, after trimming). */
export function isZzTestName(name: string | null | undefined): boolean {
  return /^zz/i.test((name ?? '').trim())
}

/** A test job by the convention: its own name or its customer's name is a ZZ name. */
export function isZzTestJob(row: { job_name?: string | null; customer_name?: string | null }): boolean {
  return isZzTestName(row.job_name) || isZzTestName(row.customer_name)
}
