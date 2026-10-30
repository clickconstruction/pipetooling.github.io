/**
 * A report's two sends read the job first and hold back on a ZZ test record (v2.6127): the read, with the one
 * table each kind of report takes, and the rule, the Pipeline's own (`isZzTestJob`).
 */
import { describe, expect, it } from 'vitest'
import {
  readReportSubject,
  reportSendSkip,
  ZZ_TEST_JOB_SKIP_MESSAGE,
  type ReportSubjectClient,
} from '../../../supabase/functions/_shared/reportSubject'

type Rows = Record<string, Record<string, Record<string, unknown>>>

/** The service-role client as the read sees it: one row by id per table, and a log of what was read. */
function fakeDb(rows: Rows, reads: string[] = []): ReportSubjectClient {
  return {
    from: (table) => ({
      select: (columns) => ({
        eq: (_column, id) => ({
          single: async () => {
            reads.push(`${table}:${columns}:${id}`)
            return { data: rows[table]?.[id] ?? null }
          },
        }),
      }),
    }),
  }
}

const report = (over: Partial<{ job_ledger_id: string | null; project_id: string | null; bid_id: string | null }>) => ({
  job_ledger_id: null,
  project_id: null,
  bid_id: null,
  ...over,
})

describe('readReportSubject', () => {
  it('reads a job report’s job by id, with its customer’s name and its number, and nothing else', async () => {
    const reads: string[] = []
    const db = fakeDb({ jobs_ledger: { j1: { job_name: 'ZZ Test job', customer_name: 'Ann Lee', hcp_number: '1085' } } }, reads)
    const subject = await readReportSubject(db, report({ job_ledger_id: 'j1', project_id: 'p1', bid_id: 'b1' }))
    expect(subject).toEqual({ kind: 'job', jobName: 'ZZ Test job', customerName: 'Ann Lee', hcpNumber: '1085' })
    expect(reads).toEqual(['jobs_ledger:job_name, customer_name, hcp_number:j1'])
  })

  it('reads a project report’s project and a bid report’s bid', async () => {
    const reads: string[] = []
    const db = fakeDb({ projects: { p1: { name: 'Riverside' } }, bids: { b1: { project_name: 'ZZ Twin b482', gc_contact_name: 'Cole' } } }, reads)
    expect(await readReportSubject(db, report({ project_id: 'p1' }))).toEqual({ kind: 'project', name: 'Riverside' })
    expect(await readReportSubject(db, report({ bid_id: 'b1' }))).toEqual({ kind: 'bid', projectName: 'ZZ Twin b482', gcContactName: 'Cole' })
    expect(reads).toEqual(['projects:name:p1', 'bids:project_name, gc_contact_name:b1'])
  })

  it('reads nothing for a report on nothing, and a row that does not come back has no names', async () => {
    const reads: string[] = []
    const db = fakeDb({}, reads)
    expect(await readReportSubject(db, report({}))).toEqual({ kind: 'none' })
    expect(await readReportSubject(db, report({ job_ledger_id: 'gone' }))).toEqual({ kind: 'job', jobName: null, customerName: null, hcpNumber: null })
    expect(reads).toEqual(['jobs_ledger:job_name, customer_name, hcp_number:gone'])
  })
})

describe('reportSendSkip', () => {
  it('holds a report on a ZZ job back, by the job’s name or its customer’s, with the reason and its words', () => {
    const skip = { reason: 'zz_test_job', message: ZZ_TEST_JOB_SKIP_MESSAGE }
    expect(reportSendSkip({ kind: 'job', jobName: 'ZZ Test job', customerName: 'Ann Lee', hcpNumber: '1085' })).toEqual(skip)
    expect(reportSendSkip({ kind: 'job', jobName: 'Repipe', customerName: '  zz test customer', hcpNumber: null })).toEqual(skip)
    expect(ZZ_TEST_JOB_SKIP_MESSAGE).toBe('ZZ test job: nothing sent')
  })

  it('holds a report on a ZZ project or a ZZ bid back the same way', () => {
    expect(reportSendSkip({ kind: 'project', name: 'ZZ Shadow tower' })?.reason).toBe('zz_test_job')
    expect(reportSendSkip({ kind: 'bid', projectName: 'ZZ Twin b482', gcContactName: 'Cole' })?.reason).toBe('zz_test_job')
  })

  it('lets a real job’s report go out: a plain name, a name with zz inside it, no names, no subject', () => {
    expect(reportSendSkip({ kind: 'job', jobName: 'Buzz Electric repipe', customerName: 'Izzy Park', hcpNumber: '1090' })).toBeNull()
    expect(reportSendSkip({ kind: 'job', jobName: null, customerName: null, hcpNumber: null })).toBeNull()
    expect(reportSendSkip({ kind: 'project', name: null })).toBeNull()
    expect(reportSendSkip({ kind: 'bid', projectName: 'Riverside', gcContactName: 'ZZ not the bid' })).toBeNull()
    expect(reportSendSkip({ kind: 'none' })).toBeNull()
  })
})
