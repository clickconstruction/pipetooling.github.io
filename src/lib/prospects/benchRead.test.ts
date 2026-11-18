import { describe, expect, it } from 'vitest'
import type { BoardRows } from '../gc/boardRows'
import type { GcProjectView } from '../gc/projectRows'
import { benchReadFromBoard } from './benchRead'

const company = (id: string, name: string, trades: string[], vetting_status: string | null, phone = '') => ({
  id,
  name,
  trades,
  contact_name: '',
  phone,
  email: '',
  address: '',
  max_miles: null,
  license: '',
  lang: 'en',
  vetting_status,
  vetting_limit: null,
  vetting_decided_on: null,
  vetting_decided_by: null,
  vetting_note: '',
})

const rows = (companies: ReturnType<typeof company>[]): BoardRows =>
  ({ today: '2026-11-17', projects: [], boardDates: {}, customers: [], companies, invites: [], quotes: [], contacts: [], promises: [], promiseMoves: [] }) as unknown as BoardRows

const project = (extra: Partial<Record<string, unknown>> = {}) =>
  ({ id: 'gp-1', name: 'Test Office Shell', stage: 'bidding', bidDue: '2026-12-01', lostOn: null, trades: [{ id: 'pk-1', trade: 'Concrete', ours: false }], ...extra }) as unknown as GcProjectView

describe('benchReadFromBoard', () => {
  it('an empty board reads as nothing on the bench and nothing to plan for', () => {
    expect(benchReadFromBoard(rows([]), [], '2026-11-17')).toEqual({
      benchTrades: [],
      benchQuoted: new Set(),
      gcPlans: [],
      gcBench: { benches: [], ownTrades: [] },
      benchCompanies: [],
    })
  })

  it('counts a trade’s bench through the board’s own rule', () => {
    const read = benchReadFromBoard(rows([company('co-1', 'Lima Concrete', ['Concrete'], 'approved'), company('co-2', 'Mike Concrete', ['Concrete'], 'approved')]), [], '2026-11-17')
    expect(read.benchTrades.map((b) => b.trade)).toEqual(['Concrete'])
    expect(read.gcBench.benches.map((b) => b.trade)).toEqual(['Concrete'])
    expect(read.benchQuoted.size).toBe(0)
  })

  it('lists the companies for the double check: a missing phone is none, vetted is true when approved, false when new, unknown otherwise', () => {
    const read = benchReadFromBoard(
      rows([company('co-1', 'Lima Concrete', ['Concrete'], 'approved', '555-0150'), company('co-2', 'Mike Framing', ['Framing'], 'new'), company('co-3', 'November Steel', ['Structural steel'], null)]),
      [],
      '2026-11-17',
    )
    expect(read.benchCompanies).toEqual([
      { id: 'co-1', name: 'Lima Concrete', phone: '555-0150', trades: ['Concrete'], vetted: true },
      { id: 'co-2', name: 'Mike Framing', phone: null, trades: ['Framing'], vetted: false },
      { id: 'co-3', name: 'November Steel', phone: null, trades: ['Structural steel'], vetted: undefined },
    ])
  })

  it('offers a project out for a bid as a set of plans, with the trades it buys out', () => {
    const read = benchReadFromBoard(rows([]), [project()], '2026-11-17')
    expect(read.gcPlans).toHaveLength(1)
    expect(read.gcPlans[0]).toMatchObject({ id: 'gp-1', name: 'Test Office Shell', trades: ['Concrete'], packageByTrade: { concrete: 'pk-1' }, daysLeft: 14 })
  })

  it('leaves out a project that is lost or past bidding, and a trade we do ourselves', () => {
    expect(benchReadFromBoard(rows([]), [project({ lostOn: '2026-11-01' })], '2026-11-17').gcPlans).toEqual([])
    expect(benchReadFromBoard(rows([]), [project({ stage: 'building' })], '2026-11-17').gcPlans).toEqual([])
    expect(benchReadFromBoard(rows([]), [project({ trades: [{ id: 'pk-1', trade: 'Plumbing', ours: true }] })], '2026-11-17').gcPlans[0]?.trades).toEqual([])
  })
})
