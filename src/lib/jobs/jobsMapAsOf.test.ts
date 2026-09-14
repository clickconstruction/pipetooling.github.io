import { describe, expect, it } from 'vitest'
import {
  JOBS_MAP_AS_OF_FLOOR_YMD,
  indexJobsMapHistory,
  jobsMapAsOfMaxBack,
  jobsMapAsOfYmd,
  jobsMapDaysBackLabel,
  jobsMapJobsAsOf,
  jobsMapSinceThen,
  jobsMapSinceThenLine,
  moneyOnDay,
  statusOnDay,
  type JobsMapHistory,
  type JobsMapHistoryJob,
} from './jobsMapAsOf'

function hjob(p: Partial<JobsMapHistoryJob> & { id: string }): JobsMapHistoryJob {
  return {
    hcp_number: '1001',
    click_number: null,
    job_name: 'Test job',
    job_address: '1 Main St, Kyle, TX',
    status: 'working',
    created_ymd: '2026-03-01',
    collections_ymd: null,
    customer_id: 'c1',
    customer_name: 'Ana Customer',
    gc_customer_id: null,
    gc_name: null,
    bill_to_party: null,
    ...p,
  }
}

const history: JobsMapHistory = {
  jobs: [
    hjob({ id: 'j1001', status: 'billed' }),
    hjob({ id: 'j1019', hcp_number: '1019', created_ymd: '2026-09-11', status: 'working', gc_customer_id: 'g1', gc_name: 'Done Right Foundation', bill_to_party: 'gc' }),
    hjob({ id: 'jquiet', hcp_number: '900', status: 'waiting', created_ymd: '2026-01-05' }),
    hjob({ id: 'jcoll', hcp_number: '950', status: 'billed', collections_ymd: '2026-08-20' }),
    hjob({ id: 'jnoaddr', hcp_number: '960', job_address: '' }),
  ],
  moves: [
    { job_id: 'j1001', from_status: 'working', to_status: 'billed', ymd: '2026-08-31' },
    { job_id: 'j1001', from_status: 'waiting', to_status: 'working', ymd: '2026-06-10' },
    { job_id: 'j1019', from_status: null, to_status: 'working', ymd: '2026-09-11' },
    { job_id: 'jcoll', from_status: 'working', to_status: 'billed', ymd: '2026-07-15' },
  ],
  bills: [
    { invoice_id: 'i1', job_id: 'j1001', amount: 20000, billed_ymd: '2026-08-31' },
    { invoice_id: 'i2', job_id: 'jcoll', amount: 5000, billed_ymd: '2026-07-15' },
  ],
  payments: [
    { invoice_id: 'i1', amount: 1600, paid_ymd: '2026-09-05' },
    { invoice_id: 'i2', amount: 5000, paid_ymd: '2026-09-12' },
  ],
  loadedAt: 0,
}
const idx = indexJobsMapHistory(history)

describe('statusOnDay', () => {
  it('reads the last move at or before the day, the first move’s from_status before that, and today’s status with no moves', () => {
    const moves = idx.movesByJob.get('j1001')
    expect(statusOnDay(history.jobs[0]!, moves, '2026-09-14')).toBe('billed')
    expect(statusOnDay(history.jobs[0]!, moves, '2026-08-31')).toBe('billed')
    expect(statusOnDay(history.jobs[0]!, moves, '2026-08-30')).toBe('working')
    expect(statusOnDay(history.jobs[0]!, moves, '2026-06-01')).toBe('waiting')
    expect(statusOnDay(history.jobs[2]!, idx.movesByJob.get('jquiet'), '2026-03-01')).toBe('waiting')
  })
})

describe('moneyOnDay', () => {
  it('counts a bill from its billed day, subtracts payments dated by the day, clamps per bill, and ages the oldest bill', () => {
    const bills = idx.billsByJob.get('j1001')!
    expect(moneyOnDay(bills, idx.paymentsByInvoice, '2026-08-30')).toEqual({ owedDollars: 0, billedAgeDays: null })
    expect(moneyOnDay(bills, idx.paymentsByInvoice, '2026-09-01')).toEqual({ owedDollars: 20000, billedAgeDays: 1 })
    expect(moneyOnDay(bills, idx.paymentsByInvoice, '2026-09-14')).toEqual({ owedDollars: 18400, billedAgeDays: 14 })
    const settled = idx.billsByJob.get('jcoll')!
    expect(moneyOnDay(settled, idx.paymentsByInvoice, '2026-09-14').owedDollars).toBe(0)
    expect(moneyOnDay(settled, idx.paymentsByInvoice, '2026-09-11').owedDollars).toBe(5000)
  })
})

describe('jobsMapJobsAsOf', () => {
  it('June 2: J1019 does not exist yet, J1001 is working, the quiet job keeps today’s status, collections is not yet flagged', () => {
    const { jobs, noAddress } = jobsMapJobsAsOf(history, idx, '2026-06-02')
    const byId = new Map(jobs.map((j) => [j.id, j]))
    expect(byId.has('j1019')).toBe(false)
    expect(byId.get('j1001')).toMatchObject({ section: 'waiting', owedDollars: 0, billedAgeDays: null, pctComplete: null, row: null })
    expect(byId.get('jquiet')?.section).toBe('waiting')
    expect(byId.get('jcoll')).toMatchObject({ section: 'working', inCollections: false })
    expect(noAddress.map((j) => j.id)).toEqual(['jnoaddr'])
  })

  it('September 1: J1001 is billed with the day’s balance and age; the collections job wears its ring; the GC job names its payer', () => {
    const { jobs } = jobsMapJobsAsOf(history, idx, '2026-09-01')
    const byId = new Map(jobs.map((j) => [j.id, j]))
    expect(byId.get('j1001')).toMatchObject({ section: 'billed', owedDollars: 20000, billedAgeDays: 1 })
    expect(byId.get('jcoll')).toMatchObject({ section: 'billed', inCollections: true, owedDollars: 5000, billedAgeDays: 48 })
    expect(byId.has('j1019')).toBe(false)
  })

  it('today: J1019 exists, is working, and names its GC as the payer', () => {
    const { jobs } = jobsMapJobsAsOf(history, idx, '2026-09-14')
    const j = jobs.find((x) => x.id === 'j1019')
    expect(j).toMatchObject({ section: 'working', payerName: 'Done Right Foundation', label: '1019 · Test job' })
  })
})

describe('since then', () => {
  it('counts what moved after the day, and words it with zero parts dropped', () => {
    const s = jobsMapSinceThen(history, '2026-06-02', '2026-09-14')
    expect(s).toEqual({ started: 1, billed: 2, paid: 0, collections: 1 })
    expect(jobsMapSinceThenLine(s)).toBe('+1 job started · 2 billed · 1 sent to collections')
    expect(jobsMapSinceThenLine({ started: 0, billed: 0, paid: 0, collections: 0 })).toBe('')
  })
})

describe('the slider', () => {
  it('spans the floor to today, clamps at the floor, and labels days back', () => {
    expect(JOBS_MAP_AS_OF_FLOOR_YMD).toBe('2026-02-22')
    expect(jobsMapAsOfMaxBack('2026-09-14')).toBe(204)
    expect(jobsMapAsOfYmd('2026-09-14', 0)).toBe('2026-09-14')
    expect(jobsMapAsOfYmd('2026-09-14', 104)).toBe('2026-06-02')
    expect(jobsMapAsOfYmd('2026-09-14', 999)).toBe('2026-02-22')
    expect(jobsMapDaysBackLabel(0)).toBe('')
    expect(jobsMapDaysBackLabel(7)).toBe('1 wk ago')
    expect(jobsMapDaysBackLabel(104)).toBe('104 d ago')
  })
})
