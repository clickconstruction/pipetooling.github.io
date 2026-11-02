// @vitest-environment jsdom
/**
 * The job-kind kind's reads (punch list #238, PR 2), against a recording stand-in for the client: who the
 * candidates are, whose stage rows are read, the clock and the bills failing soft to no line, and a press
 * telling the line to re-read.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Call = { table: string; steps: Array<[string, unknown[]]> }
type Answer = { data: unknown; error: unknown }

const db = vi.hoisted(() => ({
  calls: [] as Call[],
  answers: {} as Record<string, () => Answer>,
}))

vi.mock('../supabase', () => {
  const builder = (table: string) => {
    const call: Call = { table, steps: [] }
    db.calls.push(call)
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'or', 'is', 'eq', 'not', 'in', 'order', 'update']) {
      b[m] = (...args: unknown[]) => {
        call.steps.push([m, args])
        return b
      }
    }
    // One page per read: past the first, every table answers no rows, so the paging stops.
    let pages = 0
    b.range = () => b
    b.then = (ok: (v: Answer) => unknown, no: (e: unknown) => unknown) => {
      pages += 1
      const a = pages === 1 ? (db.answers[table]?.() ?? { data: [], error: null }) : { data: [], error: null }
      return Promise.resolve({ ...a, status: 200 }).then(ok, no)
    }
    return b
  }
  return { supabase: { from: builder } }
})

import { JOB_KIND_CHANGED_EVENT } from '../jobs/jobKindWrite'
import { jobKindFillInIo } from './fillInJobKindsIo'

const ledgerRow = (id: string, over: Record<string, unknown> = {}) => ({ id, status: 'working', billing_only: false, kind: null, hcp_number: '', click_number: id, bid_id: null, project_id: null, revenue: 0, first_work_date: '2026-09-01', job_name: id, job_address: null, customer_name: null, created_at: '2026-09-01T12:00:00Z', ...over })

const stepOf = (table: string, name: string) => db.calls.find((c) => c.table === table)?.steps.find(([m]) => m === name)?.[1]

beforeEach(() => {
  db.calls = []
  db.answers = {}
})

describe('jobKindFillInIo', () => {
  it('reads the working jobs with no bid and no GC project, and the stage rows of those with no HCP number and no press', async () => {
    db.answers.jobs_ledger = () => ({ data: [ledgerRow('a'), ledgerRow('hcp', { hcp_number: '9057' }), ledgerRow('pressed', { kind: 'project' })], error: null })
    const { jobs } = await jobKindFillInIo.fetchCandidates()
    expect(jobs.map((j) => j.id)).toEqual(['a'])
    expect(String(stepOf('jobs_ledger', 'select')?.[0])).toContain('kind')
    expect(stepOf('jobs_ledger', 'or')).toEqual(['status.is.null,status.eq.working'])
    expect(db.calls.find((c) => c.table === 'jobs_ledger')!.steps.filter(([m]) => m === 'is').map(([, a]) => a)).toEqual([['bid_id', null], ['project_id', null]])
    expect(stepOf('jobs_ledger', 'eq')).toEqual(['billing_only', false])
    expect(stepOf('jobs_ledger_fixtures', 'in')).toEqual(['job_id', ['a']])
  })

  it('adds the approved clock time and the bills for the jobs that stay', async () => {
    db.answers.jobs_ledger = () => ({ data: [ledgerRow('a'), ledgerRow('staged')], error: null })
    db.answers.jobs_ledger_fixtures = () => ({
      data: [
        { id: 'f1', job_id: 'staged', name: 'Rough In', count: 1, line_unit_price: 100, sequence_order: 0, stage_kind: 'any' },
        { id: 'f2', job_id: 'staged', name: 'Top Out', count: 1, line_unit_price: 100, sequence_order: 1, stage_kind: 'any' },
      ],
      error: null,
    })
    db.answers.clock_sessions = () => ({ data: [{ job_ledger_id: 'a', user_id: 'u1', work_date: '2026-09-01', clocked_in_at: null, clocked_out_at: null }], error: null })
    db.answers.jobs_ledger_invoices = () => ({ data: [{ job_id: 'a', amount: 100, status: 'billed' }], error: null })
    const s = await jobKindFillInIo.fetchSources()
    expect(s.sessions).toHaveLength(1)
    expect(s.bills).toHaveLength(1)
    expect(stepOf('clock_sessions', 'in')).toEqual(['job_ledger_id', ['a']])
    expect(stepOf('clock_sessions', 'not')).toEqual(['approved_at', 'is', null])
    expect(stepOf('jobs_ledger_invoices', 'in')).toEqual(['job_id', ['a']])
  })

  it('a refused clock or bill read fails soft to null, and a refused job read is thrown for the deck to leave the kind empty', async () => {
    db.answers.jobs_ledger = () => ({ data: [ledgerRow('a')], error: null })
    db.answers.clock_sessions = () => ({ data: null, error: { code: '42501', message: 'refused' } })
    db.answers.jobs_ledger_invoices = () => ({ data: null, error: { code: '42501', message: 'refused' } })
    const s = await jobKindFillInIo.fetchSources()
    expect(s.sessions).toBeNull()
    expect(s.bills).toBeNull()
    db.answers.jobs_ledger = () => ({ data: null, error: { code: '42703', message: 'column jobs_ledger.kind does not exist' } })
    await expect(jobKindFillInIo.fetchCandidates()).rejects.toBeTruthy()
  })

  it('a press writes the column and tells the line; Undo clears it; an update RLS filters away is said', async () => {
    const heard = vi.fn()
    window.addEventListener(JOB_KIND_CHANGED_EVENT, heard)
    db.answers.jobs_ledger = () => ({ data: [{ id: 'a' }], error: null })
    await jobKindFillInIo.save('a', 'project')
    expect(stepOf('jobs_ledger', 'update')).toEqual([{ kind: 'project' }])
    expect(stepOf('jobs_ledger', 'eq')).toEqual(['id', 'a'])
    expect(heard).toHaveBeenCalledTimes(1)
    db.calls = []
    await jobKindFillInIo.undo('a')
    expect(stepOf('jobs_ledger', 'update')).toEqual([{ kind: null }])
    expect(heard).toHaveBeenCalledTimes(2)
    db.answers.jobs_ledger = () => ({ data: [], error: null })
    await expect(jobKindFillInIo.save('a', 'service')).rejects.toThrow('This account cannot change this job.')
    expect(heard).toHaveBeenCalledTimes(2)
    window.removeEventListener(JOB_KIND_CHANGED_EVENT, heard)
  })
})
