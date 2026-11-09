import { describe, expect, it } from 'vitest'
import { makeInvoice, makeJob } from '../../test/renderSmokeMocks'
import type { BilledLienClock } from '../../hooks/useBilledLienClocks'
import { billedLienClockJobsOf, buildLienCalendarRows, lienRunwayForJob, paceContextPayerIds } from './lienCalendarRows'
import type { StageRow } from '../jobsStagesBoard'

const TODAY = '2026-09-14'

const clock = (extra: Partial<BilledLienClock> = {}): BilledLienClock => ({ propertyKind: 'non_residential', filedYmd: null, releasedYmd: null, noticedMonths: [], noticeOnFile: false, mailedMonths: [], workMonths: ['2026-07'], ...extra })

function billedJob(id: string, extra: Record<string, unknown> = {}) {
  return makeJob({
    id,
    hcp_number: `1${id.slice(-2)}`,
    status: 'billed',
    job_name: `Job ${id}`,
    customer_name: 'Ridgeway Builders',
    gc_customer_id: 'gc-1',
    gcCustomer: { id: 'gc-1', name: 'Loberg Contracting' },
    customer_address_id: 'addr-1',
    revenue: 9000,
    payments_made: 0,
    last_work_date: '2026-07-20',
    invoices: [makeInvoice({ id: `inv-${id}`, job_id: id, amount: 9000, status: 'billed', billed_at: '2026-08-01T12:00:00Z' })],
    ...extra,
  })
}

describe('lienCalendarRows (punch list #182: the Deadlines rows, one kernel for the Pipeline and the page)', () => {
  it('reads the clocks for the billed jobs alone, never one given up on', () => {
    const jobs = [billedJob('j1'), billedJob('j2', { collections_at: '2026-08-20T15:00:00Z', uncollectible_at: '2026-09-01T00:00:00Z' }), makeJob({ id: 'j3', status: 'working' })]
    expect(billedLienClockJobsOf(jobs)).toEqual([{ id: 'j1', customer_address_id: 'addr-1', gc_customer_id: 'gc-1' }])
  })

  it('a job with no clock yet has no runway; with one, the runway counts from the work month', () => {
    const job = billedJob('j1')
    const deps = { clocks: null, paySpeeds: null, promisedPayDates: null, paceContext: null, todayYmd: TODAY }
    expect(lienRunwayForJob(job, null, deps)).toBeNull()
    const runway = lienRunwayForJob(job, job.invoices[0]!, { ...deps, clocks: { j1: clock() } })
    expect(runway).not.toBeNull()
    expect(runway!.state).not.toBe('none')
    // A sub job owes the § 53.056 notice for its work month: the notice date is a day.
    expect(runway!.noticeByYmd).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('shapes a Deadlines row from a billed job, skipping the paid, the given up on and the runway that says nothing', () => {
    // Paid in full: the bill is paid, so the runway has nothing to say.
    const paid = billedJob('j4', { revenue: 9000, payments_made: 9000, invoices: [makeInvoice({ id: 'inv-j4', job_id: 'j4', amount: 9000, status: 'paid', billed_at: '2026-08-01T12:00:00Z' })] })
    const jobs = [billedJob('j1'), billedJob('j2', { collections_at: '2026-08-20T15:00:00Z', uncollectible_at: '2026-09-01T00:00:00Z' }), makeJob({ id: 'j3', status: 'working' }), paid]
    const clocks = { j1: clock(), j2: clock(), j4: clock() }
    const rows = buildLienCalendarRows(jobs, (job, inv) => lienRunwayForJob(job, inv, { clocks, paySpeeds: null, promisedPayDates: null, paceContext: null, todayYmd: TODAY }))
    expect(rows.map((r) => r.jobId)).toEqual(['j1'])
    const row = rows[0]!
    expect(row.number).toBe('1j1')
    expect(row.name).toBe('Job j1')
    expect(row.customer).toBe('Ridgeway Builders')
    expect(row.gcId).toBe('gc-1')
    expect(row.gcName).toBe('Loberg Contracting')
    expect(row.openBalance).toBe(9000)
    expect(row.isSub).toBe(true)
    expect(row.lastWorkYmd).toBe('2026-07-20')
    expect(row.addressId).toBe('addr-1')
    expect(row.runway.state).not.toBe('none')
  })

  it('the pace rule reads the payer of every open bill on the board, and no job-only row', () => {
    const job = billedJob('j1', { customer_id: 'cust-1' })
    const inv = job.invoices[0]!
    const rows: StageRow[] = [
      { kind: 'invoice', inv, job },
      { kind: 'job', job },
    ]
    expect(paceContextPayerIds(rows)).toEqual(['cust-1'])
  })
})
