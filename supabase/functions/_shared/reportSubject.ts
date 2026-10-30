/**
 * What a report is about — its job, project or bid, by name — read once for the two sends a saved report fires
 * (`send-report-email`, `send-report-notification`), and the rule that holds both back on a test record (v2.6127):
 * a report on a ZZ test job (its own name or its customer's, `isZzTestJob`), a ZZ project or a ZZ bid reaches no
 * one — no subscriber's inbox, no phone — and the function answers with the reason instead. Sessions walk live
 * flows on ZZ jobs (AGENTS.md → ZZ test rows need no approval: nothing leaves the building because of one), and
 * until this the office's every-report subscription and every phone opted in for the kind got each walk's report.
 *
 * The client is structural (as `paidJobBillGuard.ts`'s), so the read is tested from
 * `src/lib/reports/reportSubject.test.ts` with a fake; the functions pass their service-role client.
 */
import { isZzTestJob, isZzTestName } from './zzTestJob.ts'

/** The columns of `reports` the read needs. */
export type ReportSubjectRow = { job_ledger_id: string | null; project_id: string | null; bid_id: string | null }

export type ReportSubject =
  | { kind: 'job'; jobName: string | null; customerName: string | null; hcpNumber: string | null }
  | { kind: 'project'; name: string | null }
  | { kind: 'bid'; projectName: string | null; gcContactName: string | null }
  | { kind: 'none' }

/** The one read each table takes: `.from(table).select(columns).eq('id', id).single()`. */
export type ReportSubjectClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        single: () => PromiseLike<{ data: unknown }>
      }
    }
  }
}

/** The report's job, project or bid by name — one read; a row that does not come back reads as a subject with no names. */
export async function readReportSubject(db: ReportSubjectClient, report: ReportSubjectRow): Promise<ReportSubject> {
  const one = async (table: string, columns: string, id: string): Promise<Record<string, unknown> | null> => {
    const { data } = await db.from(table).select(columns).eq('id', id).single()
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null
  }
  const text = (row: Record<string, unknown> | null, key: string): string | null => {
    const v = row?.[key]
    return typeof v === 'string' ? v : null
  }
  if (report.job_ledger_id) {
    const row = await one('jobs_ledger', 'job_name, customer_name, hcp_number', report.job_ledger_id)
    return { kind: 'job', jobName: text(row, 'job_name'), customerName: text(row, 'customer_name'), hcpNumber: text(row, 'hcp_number') }
  }
  if (report.project_id) {
    const row = await one('projects', 'name', report.project_id)
    return { kind: 'project', name: text(row, 'name') }
  }
  if (report.bid_id) {
    const row = await one('bids', 'project_name, gc_contact_name', report.bid_id)
    return { kind: 'bid', projectName: text(row, 'project_name'), gcContactName: text(row, 'gc_contact_name') }
  }
  return { kind: 'none' }
}

/** The reason a send is held, as the function answers it: `reason` names it (`skipped` on the wire), `message` says it. */
export type ReportSendSkip = { reason: 'zz_test_job'; message: string }

export const ZZ_TEST_JOB_SKIP_MESSAGE = 'ZZ test job: nothing sent'

/** Null when the report may go out; the reason when its subject is a ZZ test record. */
export function reportSendSkip(subject: ReportSubject): ReportSendSkip | null {
  const zz =
    subject.kind === 'job'
      ? isZzTestJob({ job_name: subject.jobName, customer_name: subject.customerName })
      : subject.kind === 'project'
        ? isZzTestName(subject.name)
        : subject.kind === 'bid'
          ? isZzTestName(subject.projectName)
          : false
  return zz ? { reason: 'zz_test_job', message: ZZ_TEST_JOB_SKIP_MESSAGE } : null
}
