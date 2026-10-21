import { describe, expect, it } from 'vitest'
import { agingCellAccountSplit, agingCellJobStateWords, agingCellJobsLine, groupAgingCellByJob, type AgingCellRowLike } from './agingCellByJob'
import type { JobSupplyHouseAccountRow } from './jobSupplyHouseAccounts'

const HOUSE = 'house-moore'
const row = (id: string, amount: number, on = false, house = HOUSE): AgingCellRowLike => ({ id, amount, on_job_account: on, supply_house_id: house })
const account = (jobId: string, status: string, over: Partial<JobSupplyHouseAccountRow> = {}): JobSupplyHouseAccountRow => ({
  id: `acct-${jobId}`,
  job_id: jobId,
  supply_house_id: HOUSE,
  status,
  account_ref: '',
  opened_via: null,
  rep_contact_id: null,
  requested_by: null,
  requested_at: null,
  requested_from_counter: false,
  opened_by: null,
  opened_at: null,
  note: '',
  ...over,
})

// Moore Supply's 90+ cell of 2026-10-20: ten invoices, seven jobs, no job account at Moore.
const MOORE = [
  row('i1', 42.97), row('i2', 1037.94), row('i3', 54.07), row('i4', 1927.62), row('i5', 98.8),
  row('i6', 88.63), row('i7', 2486.17), row('i8', 926.47), row('i9', 251.89), row('i10', 284.82),
]
const MOORE_JOB: Record<string, string> = { i1: 'j667', i2: 'j667', i3: 'j742', i4: 'j693', i5: 'j523', i6: 'j759', i7: 'j706', i8: 'j706', i9: 'j706', i10: 'j804' }
const oneJob = (map: Record<string, string>) => (id: string) => (map[id] ? [{ job_id: map[id]! }] : [])

describe('groupAgingCellByJob', () => {
  it('puts each job’s invoices under it, largest unpaid-off-account first, rows in their own order', () => {
    const g = groupAgingCellByJob(MOORE, oneJob(MOORE_JOB), () => null)
    expect(g.jobs.map((j) => j.jobId)).toEqual(['j706', 'j693', 'j667', 'j804', 'j523', 'j759', 'j742'])
    const dudley = g.jobs[0]!
    expect(dudley.rows.map((r) => r.id)).toEqual(['i7', 'i8', 'i9'])
    expect(dudley.total).toBeCloseTo(3664.53, 2)
    expect(dudley.offTotal).toBeCloseTo(3664.53, 2)
    expect([dudley.onCount, dudley.offCount]).toEqual([0, 3])
    expect(g.jobs.every((j) => j.state.kind === 'none')).toBe(true)
    expect([g.split, g.noJob, g.credits]).toEqual([[], [], []])
  })

  it('names each job’s state from its account row and its rows', () => {
    const rows = [row('a1', 100, true), row('a2', 50, true), row('b1', 10), row('b2', 20, true), row('c1', 5), row('d1', 7), row('e1', 9), row('f1', 3)]
    const map = { a1: 'ja', a2: 'ja', b1: 'jb', b2: 'jb', c1: 'jc', d1: 'jd', e1: 'je', f1: 'jf' }
    const accounts: Record<string, JobSupplyHouseAccountRow | null | undefined> = {
      ja: null, // every row on the account, with or without an account row
      jb: account('jb', 'open', { account_ref: '4471-SEG' }),
      jc: account('jc', 'requested', { requested_at: '2026-10-02T15:00:00Z' }),
      jd: account('jd', 'not_needed'),
      je: null,
      jf: undefined,
    }
    const g = groupAgingCellByJob(rows, oneJob(map), (jobId) => accounts[jobId])
    const kindOf = (jobId: string) => g.jobs.find((j) => j.jobId === jobId)!.state.kind
    expect(kindOf('ja')).toBe('all_on')
    expect(kindOf('jb')).toBe('open')
    expect(kindOf('jc')).toBe('requested')
    expect(kindOf('jd')).toBe('not_needed')
    expect(kindOf('je')).toBe('none')
    expect(kindOf('jf')).toBe('loading')
    const jb = g.jobs.find((j) => j.jobId === 'jb')!
    expect([jb.onCount, jb.offCount, jb.offTotal]).toEqual([1, 1, 10])
  })

  it('keeps split invoices, invoices on no job and credit memos out of the job groups', () => {
    const rows = [row('s1', 130.75), row('n1', 94.35), row('c1', -40), row('j1', 10)]
    const allocations = (id: string) =>
      id === 's1' ? [{ job_id: 'ja' }, { job_id: 'jb' }] : id === 'j1' ? [{ job_id: 'ja' }] : id === 'c1' ? [{ job_id: 'ja' }] : []
    const g = groupAgingCellByJob(rows, allocations, () => null)
    expect(g.jobs.map((j) => j.jobId)).toEqual(['ja'])
    expect(g.jobs[0]!.rows.map((r) => r.id)).toEqual(['j1'])
    expect(g.split.map((r) => r.id)).toEqual(['s1'])
    expect(g.noJob.map((r) => r.id)).toEqual(['n1'])
    expect(g.credits.map((r) => r.id)).toEqual(['c1'])
  })

  it('keeps one job at two houses as two groups, each with its own account', () => {
    const rows = [row('x1', 10, false, 'h1'), row('x2', 20, false, 'h2')]
    const g = groupAgingCellByJob(rows, () => [{ job_id: 'ja' }], (_jobId, houseId) => (houseId === 'h2' ? account('ja', 'open') : null))
    expect(g.jobs.map((j) => `${j.houseId}:${j.state.kind}`).sort()).toEqual(['h1:none', 'h2:open'])
  })
})

describe('agingCellAccountSplit', () => {
  it('sums what is on a job account and what is not, leaving credit memos out', () => {
    expect(agingCellAccountSplit(MOORE)).toEqual({ onAmount: 0, onCount: 0, offAmount: expect.closeTo(7199.38, 2), offCount: 10 })
    expect(agingCellAccountSplit([row('a', 100, true), row('b', 25), row('c', -10, true)])).toEqual({ onAmount: 100, onCount: 1, offAmount: 25, offCount: 1 })
  })
})

describe('agingCellJobStateWords', () => {
  it('says each state in words', () => {
    expect(agingCellJobStateWords({ kind: 'none' }, 'Moore Supply')).toEqual({ label: 'No job account at Moore Supply', tone: 'warn' })
    expect(agingCellJobStateWords({ kind: 'all_on' }, 'Moore Supply')).toEqual({ label: 'On the job account ✓', tone: 'on' })
    expect(agingCellJobStateWords({ kind: 'open', account: account('j', 'open', { account_ref: ' 4471-SEG ' }) }, 'Reece').label).toBe('Job account open · ref 4471-SEG')
    expect(agingCellJobStateWords({ kind: 'open', account: account('j', 'open') }, 'Reece').label).toBe('Job account open')
    expect(agingCellJobStateWords({ kind: 'requested', account: account('j', 'requested', { requested_at: '2026-10-02T15:00:00Z' }) }, 'Reece').label).toBe('Job account asked for 10/2')
    expect(agingCellJobStateWords({ kind: 'requested', account: account('j', 'requested') }, 'Reece').label).toBe('Job account asked for')
    expect(agingCellJobStateWords({ kind: 'not_needed', account: account('j', 'not_needed') }, 'Reece')).toEqual({ label: 'No job account needed', tone: 'muted' })
    expect(agingCellJobStateWords({ kind: 'loading' }, 'Reece').tone).toBe('loading')
  })
})

describe('agingCellJobsLine', () => {
  it('says how the cell’s jobs stand at the house', () => {
    const none = { state: { kind: 'none' as const } }
    const on = { state: { kind: 'all_on' as const } }
    const open = { state: { kind: 'open' as const, account: account('j', 'open') } }
    expect(agingCellJobsLine(Array(7).fill(none), 'Moore Supply')).toBe('7 jobs. None has a job account at Moore Supply yet.')
    expect(agingCellJobsLine([none], 'Moore Supply')).toBe('1 job. It has no job account at Moore Supply yet.')
    expect(agingCellJobsLine([on, on], 'Reece')).toBe('2 jobs. Every one’s charges here are on its job account.')
    expect(agingCellJobsLine([on, open, none, none], 'Reece')).toBe('4 jobs: 1 all on a job account, 1 with an account open, 2 with no job account at Reece yet.')
    expect(agingCellJobsLine([none, open], null)).toBe('2 jobs: 1 with an account open, 1 with no job account at the house yet.')
    expect(agingCellJobsLine([], 'Reece')).toBe('')
  })
})
