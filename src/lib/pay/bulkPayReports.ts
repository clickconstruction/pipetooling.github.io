/**
 * Draft Payroll → Generate N reports, after the press (punch list #184, sweep A, PR 2). The run
 * makes each person's report in turn and keeps going past one that fails; the people whose
 * report did not generate stay in the window, each with the reason and a Try again door.
 * Before this the toast counted the failures and pointed at one error line, which only ever
 * held the last person's reason.
 */
import { batchOutcomeWords, type BatchOutcome } from '../batchWords'

/** One person's report run: made, or not, with the reason a person reads. */
export type PayReportRun = { ok: true } | { ok: false; why: string }

/** A person whose report did not generate, and why. */
export type PayReportFailure = { person: string; why: string }

/** The last run's failures, kept with the period they were for. */
export type BulkPayReportFailures = { start: string; end: string; failures: PayReportFailure[] }

/** The run, person by person: who was made, who was not with the reason, and the toast. */
export function bulkPayReportOutcome(results: ReadonlyArray<{ person: string; run: PayReportRun }>): { generated: string[]; failures: PayReportFailure[]; words: BatchOutcome } {
  const generated: string[] = []
  const failures: PayReportFailure[] = []
  for (const r of results) {
    if (r.run.ok) generated.push(r.person)
    else failures.push({ person: r.person, why: r.run.why })
  }
  return { generated, failures, words: bulkPayReportWords(generated.length, failures.length) }
}

/** The toast and the head over the list: *Generated 4 reports. 2 did not generate.* */
export function bulkPayReportWords(generated: number, failed: number): BatchOutcome {
  return batchOutcomeWords({ verb: 'generate', past: 'generated', done: generated, failed, noun: 'report' })
}

/** The failures to draw for the period on screen: the run's own period only, so another week never shows them. */
export function bulkPayReportFailuresFor(last: BulkPayReportFailures | null, start: string, end: string): PayReportFailure[] {
  if (!last || last.start !== start || last.end !== end) return []
  return last.failures
}

/** After one person's Try again: they leave the list when the report is made, else their reason is the new one. */
export function afterPayReportRetry(failures: ReadonlyArray<PayReportFailure>, person: string, run: PayReportRun): PayReportFailure[] {
  if (run.ok) return failures.filter((f) => f.person !== person)
  return failures.map((f) => (f.person === person ? { person, why: run.why } : f))
}
