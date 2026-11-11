import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The reads behind the answers on names as Builders shows them (punch list #307). Once for the
 * list, never once a row, and a customer's bids a page at a time: the API returns at most 1,000
 * rows to a read that asks for no range. Every name here is made up.
 */
const { from } = vi.hoisted(() => ({ from: vi.fn() }))
const siteIo = vi.hoisted(() => ({ loadAllNameAnswers: vi.fn(), loadCustomerNames: vi.fn() }))
const research = vi.hoisted(() => ({ loadResearchers: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { from } }))
vi.mock('./bidSiteIo', () => siteIo)
vi.mock('./permitResearchIo', () => research)

import { loadBidsToCount, loadBuilderAnswersGround, loadCustomersById } from './builderAnswersIo'
import type { NameAnswerRow } from './nameAnswers'

type Call = [method: string, ...args: unknown[]]

const API_MAX_ROWS = 1000

/** A stand-in for one PostgREST read: a ranged read answers its slice, a read with no range is cut at 1,000 rows. */
function read(rows: readonly unknown[]) {
  const calls: Call[] = []
  const answer = (slice: unknown[]) => Promise.resolve({ data: slice.slice(0, API_MAX_ROWS), error: null, status: 200 })
  const chain: Record<string, unknown> = {
    range: (start: number, end: number) => {
      calls.push(['range', start, end])
      return answer(rows.slice(start, end + 1))
    },
    then: (done: (value: unknown) => unknown, fail?: (reason: unknown) => unknown) => answer([...rows]).then(done, fail),
  }
  for (const step of ['select', 'in', 'order']) {
    chain[step] = (...args: unknown[]) => {
      calls.push([step, ...args])
      return chain
    }
  }
  return { chain, calls }
}

const steps = (calls: Call[], method: string) => calls.filter(([m]) => m === method).map(([, ...args]) => args)

const tie = (over: Partial<NameAnswerRow> = {}): NameAnswerRow => ({ id: 'a1', builder_key: 'ridgewaybuildersoftexas', customer_id: 'c1', answer: 'works_for', scope: 'all', permit_id: null, name: 'Ridgeway Builders of Texas LLC', answered_by: 'u2', answered_at: '2026-11-09T18:00:00Z', ...over })

beforeEach(() => {
  from.mockReset()
  siteIo.loadAllNameAnswers.mockReset().mockResolvedValue({ rows: [], me: 'u1' })
  siteIo.loadCustomerNames.mockReset().mockResolvedValue([{ id: 'c1', name: 'Ridgeway Builders' }, { id: 'c2', name: 'Ridgeway Builders, LLC' }, { id: 'c3', name: 'Hartwell Interiors' }])
  research.loadResearchers.mockReset().mockResolvedValue([{ id: 'u2', name: 'Sam' }])
})

describe('the bids to count, past 1,000 rows', () => {
  it('reads every bid of the customers a page at a time, cut by id, and hands the count what it reads', async () => {
    const bids = Array.from({ length: 2150 }, (_, i) => ({ id: `b${String(i).padStart(5, '0')}`, customer_id: i % 2 === 0 ? 'c1' : 'c2', outcome: i === 0 ? 'won' : null, created_at: '2026-06-02T03:30:00Z', project_name: `Job ${i}`, gc: i === 1 ? { name: 'Ridgeway Builders of Texas' } : null }))
    const asked = read(bids)
    from.mockReturnValue(asked.chain)

    const rows = await loadBidsToCount(['c1', 'c2', 'c1'])

    expect(rows).toHaveLength(2150)
    expect(from).toHaveBeenCalledWith('bids')
    expect(steps(asked.calls, 'in')[0]).toEqual(['customer_id', ['c1', 'c2']])
    expect(steps(asked.calls, 'range')).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
    expect(steps(asked.calls, 'order')).toEqual([['id'], ['id'], ['id']])
    // The day is the company's day, not the first ten characters: 3:30 UTC is still June 1 in Texas.
    expect(rows[0]).toEqual({ id: 'b00000', customerId: 'c1', outcome: 'won', bidOn: '2026-06-01', projectName: 'Job 0', legacyGcName: null })
    expect(rows[1]?.legacyGcName).toBe('Ridgeway Builders of Texas')
  })

  it('reads the customers a chunk at a time, and leaves out a bid with no customer', async () => {
    const ids = Array.from({ length: 151 }, (_, i) => `c${i}`)
    from.mockImplementation(() => read([{ id: 'b1', customer_id: 'c0', outcome: null, created_at: null, project_name: null, gc: null }, { id: 'b2', customer_id: null, outcome: null, created_at: null, project_name: null, gc: null }]).chain)

    const rows = await loadBidsToCount(ids)

    expect(from).toHaveBeenCalledTimes(2)
    expect(rows).toEqual([
      { id: 'b1', customerId: 'c0', outcome: null, bidOn: null, projectName: null, legacyGcName: null },
      { id: 'b1', customerId: 'c0', outcome: null, bidOn: null, projectName: null, legacyGcName: null },
    ])
    expect(await loadBidsToCount([])).toEqual([])
  })
})

describe('customers by id', () => {
  it('reads them by id and leaves out a blank name', async () => {
    const asked = read([{ id: 'gone', name: 'Marlow Design Group' }, { id: 'blank', name: ' ' }])
    from.mockReturnValue(asked.chain)
    expect(await loadCustomersById(['gone', 'blank', 'gone'])).toEqual([{ id: 'gone', name: 'Marlow Design Group' }])
    expect(from).toHaveBeenCalledWith('customers')
    expect(steps(asked.calls, 'in')).toEqual([['id', ['gone', 'blank']]])
  })
})

describe('the answers on names for Builders', () => {
  it('is null before the answers table is on the database, and reads nothing more', async () => {
    siteIo.loadAllNameAnswers.mockResolvedValue(null)
    expect(await loadBuilderAnswersGround()).toBeNull()
    expect(siteIo.loadCustomerNames).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })

  it('reads no people and no bids while nobody has answered', async () => {
    const ground = await loadBuilderAnswersGround()
    expect(ground?.me).toBe('u1')
    expect(ground?.bids).toEqual([])
    expect(ground?.book.groups.map((g) => g.name)).toEqual(['Ridgeway Builders', 'Hartwell Interiors'])
    expect(research.loadResearchers).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })

  it('reads the bids of every row of a tied customer in one read, and the people who answered', async () => {
    siteIo.loadAllNameAnswers.mockResolvedValue({ rows: [tie(), tie({ id: 'a2', builder_key: 'danawhitlow', customer_id: 'c3', answer: 'someone_else', scope: null })], me: 'u1' })
    const asked = read([{ id: 'b1', customer_id: 'c2', outcome: 'won', created_at: '2026-06-01T15:00:00Z', project_name: 'Mill Street Lofts', gc: null }])
    from.mockReturnValue(asked.chain)

    const ground = await loadBuilderAnswersGround()

    expect(siteIo.loadAllNameAnswers).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('bids')
    // Both rows of the one GC, and not the customer someone said No for.
    expect(steps(asked.calls, 'in')).toEqual([['customer_id', ['c1', 'c2']]])
    expect(ground?.bids).toEqual([{ id: 'b1', customerId: 'c2', outcome: 'won', bidOn: '2026-06-01', projectName: 'Mill Street Lofts', legacyGcName: null }])
    expect(ground?.people.get('u2')).toBe('Sam')
    expect(ground?.book.tied.get('ridgewaybuildersoftexas')?.[0]?.name).toBe('Ridgeway Builders')
  })

  it('reads a customer an answer names that the list of live ones leaves out', async () => {
    siteIo.loadAllNameAnswers.mockResolvedValue({ rows: [tie({ customer_id: 'gone' })], me: 'u1' })
    const customers = read([{ id: 'gone', name: 'Marlow Design Group' }])
    const bids = read([])
    from.mockImplementation((table: string) => (table === 'customers' ? customers.chain : bids.chain))

    const ground = await loadBuilderAnswersGround()

    expect(steps(customers.calls, 'in')).toEqual([['id', ['gone']]])
    expect(ground?.book.tied.get('ridgewaybuildersoftexas')?.[0]).toEqual({ key: 'marlowdesigngroup', ids: ['gone'], name: 'Marlow Design Group' })
    expect(steps(bids.calls, 'in')).toEqual([['customer_id', ['gone']]])
  })
})
