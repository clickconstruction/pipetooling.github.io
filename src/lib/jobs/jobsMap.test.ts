import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import {
  JOBS_MAP_DEFAULT_SECTIONS,
  JOBS_MAP_SECTION_COLOR,
  jobsMapDistanceLine,
  jobsMapJobs,
  jobsMapLegend,
  jobsMapOwedLine,
  jobsMapStatusLine,
  jobsMapUnmappedLine,
  jobsMapVisiblePins,
  readJobsMapHidden,
  resolveJobsMapPins,
  writeJobsMapHidden,
} from './jobsMap'

function job(p: Partial<JobWithDetails> & { id: string }): JobWithDetails {
  return {
    hcp_number: '1019',
    click_number: null,
    job_name: 'Vasquez pretest',
    job_address: '173 Atlantis, Kyle, TX',
    status: 'working',
    collections_at: null,
    pct_complete: 60,
    customer_name: 'Maria Vasquez',
    customer_id: 'c1',
    gc_customer_id: null,
    bill_to_party: null,
    invoices: [],
    payments: [],
    materials: [],
    fixtures: [],
    team_members: [],
    ...p,
  } as unknown as JobWithDetails
}

describe('jobsMapJobs', () => {
  it('buckets by Pipeline section, rings Collections, and keeps the billed color', () => {
    const rows = [
      job({ id: 'w', status: 'waiting' }),
      job({ id: 'k', status: 'working' }),
      job({ id: 'r', status: 'ready_to_bill' }),
      job({ id: 'b', status: 'billed' }),
      job({ id: 'c', status: 'billed', collections_at: '2026-08-01T00:00:00Z' }),
      job({ id: 'p', status: 'paid' }),
    ]
    const { jobs, noAddress } = jobsMapJobs(rows)
    expect(noAddress).toEqual([])
    expect(jobs.map((j) => [j.id, j.section, j.inCollections])).toEqual([
      ['w', 'waiting', false],
      ['k', 'working', false],
      ['r', 'readyToBill', false],
      ['b', 'billed', false],
      ['c', 'billed', true],
      ['p', 'paid', false],
    ])
    expect(JOBS_MAP_SECTION_COLOR.billed).toBe('#f97316')
  })

  it('labels number first, names the payer under the who-pays rule, and drops a job with no address to noAddress', () => {
    const { jobs, noAddress } = jobsMapJobs([
      job({ id: 'gc', gc_customer_id: 'g1', bill_to_party: 'gc', gcCustomer: { id: 'g1', name: 'Done Right Foundation' } } as Partial<JobWithDetails> & { id: string }),
      job({ id: 'cust', hcp_number: '', click_number: '204', job_name: 'Coe remodel' }),
      job({ id: 'none', job_address: '' }),
    ])
    expect(jobs[0]!.label).toBe('1019 · Vasquez pretest')
    expect(jobs[0]!.payerName).toBe('Done Right Foundation')
    expect(jobs[1]!.label).toBe('204 · Coe remodel')
    expect(jobs[1]!.payerName).toBe('Maria Vasquez')
    expect(noAddress.map((j) => j.id)).toEqual(['none'])
  })

  it('a job listed twice pins once', () => {
    const j = job({ id: 'x' })
    expect(jobsMapJobs([j, j]).jobs).toHaveLength(1)
  })

  it('owed dollars: open bills minus payments, only on billed / ready-to-bill jobs', () => {
    const billed = job({
      id: 'b',
      status: 'billed',
      invoices: [{ id: 'i1', status: 'billed', amount: 20000 }, { id: 'i2', status: 'paid', amount: 5000 }] as unknown as JobWithDetails['invoices'],
      payments: [{ invoice_id: 'i1', amount: 1600 }] as unknown as JobWithDetails['payments'],
    })
    const working = job({ id: 'k', invoices: [{ id: 'i3', status: 'billed', amount: 900 }] as unknown as JobWithDetails['invoices'] })
    const { jobs } = jobsMapJobs([billed, working])
    expect(jobs[0]!.owedDollars).toBe(18400)
    expect(jobsMapOwedLine(jobs[0]!)).toBe('$18,400 owed')
    expect(jobs[1]!.owedDollars).toBe(0)
    expect(jobsMapOwedLine(jobs[1]!)).toBeNull()
  })
})

describe('pins, legend and visibility', () => {
  const { jobs } = jobsMapJobs([job({ id: 'a' }), job({ id: 'b', status: 'paid', job_address: '9 Elm St, Austin' }), job({ id: 'c', job_address: '1 Cold Rd, Nowhere' })])
  const coords = new Map([
    ['173 atlantis, kyle, tx', { lat: 30.0, lng: -97.9 }],
    ['9 elm st, austin', { lat: 30.3, lng: -97.7 }],
  ])

  it('resolves cached coordinates and reports the rest as unmapped', () => {
    const { pins, unmapped } = resolveJobsMapPins(jobs, coords)
    expect(pins.map((p) => p.id)).toEqual(['a', 'b'])
    expect(unmapped.map((j) => j.id)).toEqual(['c'])
  })

  it('the legend counts every section in board order, and Paid starts off', () => {
    const { pins } = resolveJobsMapPins(jobs, coords)
    expect(jobsMapLegend(pins)).toEqual([
      { section: 'waiting', count: 0 },
      { section: 'working', count: 1 },
      { section: 'readyToBill', count: 0 },
      { section: 'billed', count: 0 },
      { section: 'paid', count: 1 },
    ])
    expect(jobsMapVisiblePins(pins, JOBS_MAP_DEFAULT_SECTIONS).map((p) => p.id)).toEqual(['a'])
    expect(jobsMapVisiblePins(pins, { ...JOBS_MAP_DEFAULT_SECTIONS, paid: true }).map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('status, distance and unmapped lines', () => {
    expect(jobsMapStatusLine({ section: 'working', inCollections: false, pctComplete: 60 })).toBe('Working · 60%')
    expect(jobsMapStatusLine({ section: 'billed', inCollections: true, pctComplete: 100 })).toBe('Billed · Collections')
    expect(jobsMapStatusLine({ section: 'waiting', inCollections: false, pctComplete: null })).toBe('Waiting')
    expect(jobsMapDistanceLine({ lat: 30.0, lng: -97.9 }, null)).toBeNull()
    expect(jobsMapDistanceLine({ lat: 30.0, lng: -97.9 }, { lat: 30.0, lng: -97.9 })).toBe('0 mi from the office')
    expect(jobsMapDistanceLine({ lat: 30.5, lng: -97.9 }, { lat: 30.0, lng: -97.9 })).toBe('35 mi from the office')
    expect(jobsMapUnmappedLine(0)).toBeNull()
    expect(jobsMapUnmappedLine(1)).toBe('1 job has no map location yet')
    expect(jobsMapUnmappedLine(4)).toBe('4 jobs have no map location yet')
  })

  it('the hidden preference round-trips through storage and survives a throwing store', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    }
    expect(readJobsMapHidden(storage)).toBe(false)
    writeJobsMapHidden(true, storage)
    expect(readJobsMapHidden(storage)).toBe(true)
    writeJobsMapHidden(false, storage)
    expect(readJobsMapHidden(storage)).toBe(false)
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => {} }
    expect(readJobsMapHidden(broken)).toBe(false)
    expect(() => writeJobsMapHidden(true, broken)).not.toThrow()
  })
})
