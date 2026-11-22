import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The reads behind a phone or a web domain as a reason (v2.8303): which names share one with a
 * customer, a name by its key alone, the phone asked with a name's permits, and what each side
 * holds for Compare. Each answers quietly in the window before its migration is pushed. Every
 * name, phone and domain here is made up.
 */
const { rpc, from, getSession } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), getSession: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { rpc, from, auth: { getSession } } }))

import { loadAllNameContactMatches, loadCompanyLookupFacts, loadNameByKey, loadNameContactMatches, loadOurContactRows, loadPermitsOfName } from './bidSiteIo'

type Failure = { code: string; message: string }
type Call = [method: string, ...args: unknown[]]

/** A stand-in for one PostgREST read: every step kept in `calls`, a ranged read answering its slice, `failures` answered first. */
function read(rows: readonly unknown[], failures: Failure[] = [], count: number | null = null) {
  const calls: Call[] = []
  const answer = (slice: unknown[]) => {
    const failure = failures.shift()
    return Promise.resolve(failure ? { data: null, error: failure, status: 400, count: null } : { data: slice.slice(0, 1000), error: null, status: 200, count })
  }
  const chain: Record<string, unknown> = {
    range: (start: number, end: number) => {
      calls.push(['range', start, end])
      return answer(rows.slice(start, end + 1))
    },
    then: (done: (value: unknown) => unknown, fail?: (reason: unknown) => unknown) => answer([...rows]).then(done, fail),
  }
  for (const step of ['select', 'in', 'is', 'eq', 'like', 'not', 'order', 'limit']) {
    chain[step] = (...args: unknown[]) => {
      calls.push([step, ...args])
      return chain
    }
  }
  return { chain, calls }
}

const steps = (calls: Call[], method: string) => calls.filter(([m]) => m === method).map(([, ...args]) => args)

const MISSING_FUNCTION: Failure = { code: 'PGRST202', message: 'Could not find the function public.permit_name_contact_matches(p_customer_ids) in the schema cache' }
const MISSING_COLUMN: Failure = { code: '42703', message: 'column permits.contact_phone does not exist' }
const REFUSED: Failure = { code: '42501', message: 'permission denied for table permits' }

const pairs = Array.from({ length: 1340 }, (_, i) => ({ customer_id: `c${String(i % 7)}`, builder_key: `name${String(i).padStart(5, '0')}`, reason: 'phone', value: `210555${String(i).padStart(4, '0')}`, heard_from: 'permit' }))

beforeEach(() => {
  rpc.mockReset()
  from.mockReset()
  getSession.mockReset()
})

describe('the names that share a phone or a web domain with a customer', () => {
  it('asks nothing for no customer', async () => {
    expect(await loadNameContactMatches([])).toEqual([])
    expect(rpc).not.toHaveBeenCalled()
  })

  it('asks the read for these rows, a page at a time in its own order, and returns every pair', async () => {
    const asked = read(pairs)
    rpc.mockReturnValue(asked.chain)
    const got = await loadNameContactMatches(['c1', 'c2'])
    expect(got).toHaveLength(1340)
    expect(rpc).toHaveBeenCalledWith('permit_name_contact_matches', { p_customer_ids: ['c1', 'c2'] })
    expect(steps(asked.calls, 'range')).toEqual([[0, 999], [1000, 1999]])
    expect(steps(asked.calls, 'order').slice(0, 4).map(([column]) => column)).toEqual(['customer_id', 'builder_key', 'reason', 'value'])
  })

  it('answers null before the read is on the database, so no such reason is drawn', async () => {
    rpc.mockReturnValue(read([], [MISSING_FUNCTION]).chain)
    expect(await loadNameContactMatches(['c1'])).toBeNull()
  })

  it('reads every customer for the worklist, and hands one read to two askers at once', async () => {
    const asked = read(pairs.slice(0, 3))
    rpc.mockReturnValue(asked.chain)
    const [a, b] = await Promise.all([loadAllNameContactMatches(), loadAllNameContactMatches()])
    expect(a).toHaveLength(3)
    expect(b).toBe(a)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('permit_name_contact_matches', { p_customer_ids: null })
  })
})

describe('a name by its key alone', () => {
  it('reads the name as its newest permit lists it, with how many permits it is on', async () => {
    const asked = read([{ contact: 'Paula Kemp, Hartwell Interiors LLC', issued_on: null, submitted_on: '2026-10-21' }], [], 3)
    from.mockReturnValue(asked.chain)
    expect(await loadNameByKey('hartwellinteriors')).toEqual({ key: 'hartwellinteriors', name: 'Hartwell Interiors LLC', permits: 0, lastOn: '2026-10-21', kind: null, allPermits: 3 })
    expect(steps(asked.calls, 'eq')).toEqual([['builder_key', 'hartwellinteriors']])
    expect(steps(asked.calls, 'select')[0]?.[1]).toEqual({ count: 'exact' })
  })

  it('is null when no permit on hand is under the key, and throws a refusal with its reason', async () => {
    from.mockReturnValue(read([]).chain)
    expect(await loadNameByKey('gone')).toBeNull()
    from.mockReturnValue(read([], [REFUSED]).chain)
    await expect(loadNameByKey('gone')).rejects.toMatchObject({ code: '42501' })
  })
})

describe('the phone asked with a name’s permits', () => {
  it('asks the phone with the rest', async () => {
    const asked = read([{ id: 'p1', contact_phone: '2105550142' }])
    from.mockReturnValue(asked.chain)
    expect(await loadPermitsOfName('hartwellinteriors')).toEqual([{ id: 'p1', contact_phone: '2105550142' }])
    expect(String(steps(asked.calls, 'select')[0]?.[0])).toContain('contact_phone')
  })

  it('reads the permits without the phone when the column is not on the database yet, and does not ask for it again', async () => {
    const first = read([{ id: 'p1' }], [MISSING_COLUMN])
    from.mockReturnValue(first.chain)
    expect(await loadPermitsOfName('hartwellinteriors')).toEqual([{ id: 'p1' }])
    const selects = steps(first.calls, 'select').map(([columns]) => String(columns))
    expect(selects).toHaveLength(2)
    expect(selects[0]).toContain('contact_phone')
    expect(selects[1]).not.toContain('contact_phone')
    const second = read([{ id: 'p2' }])
    from.mockReturnValue(second.chain)
    await loadPermitsOfName('danawhitlow')
    expect(steps(second.calls, 'select').map(([columns]) => String(columns))).toEqual([selects[1]])
  })
})

describe('what each side holds for Compare', () => {
  it('reads the customer rows and their people, and nothing for no customer', async () => {
    expect(await loadOurContactRows([])).toEqual({ customers: [], persons: [] })
    expect(from).not.toHaveBeenCalled()
    const customers = read([{ contact_info: { phone: '(210) 555-0142' }, billing_email: null }])
    const persons = read([{ phone: null, email: 'pm@ridgeway.example' }])
    from.mockImplementation((table: string) => (table === 'customers' ? customers.chain : persons.chain))
    expect(await loadOurContactRows(['c1', 'c2'])).toEqual({ customers: [{ contact_info: { phone: '(210) 555-0142' }, billing_email: null }], persons: [{ phone: null, email: 'pm@ridgeway.example' }] })
    expect(steps(customers.calls, 'in')).toEqual([['id', ['c1', 'c2']]])
    expect(steps(persons.calls, 'in')).toEqual([['customer_id', ['c1', 'c2']]])
  })

  it('reads what a company lookup found for the name', async () => {
    const asked = read([{ facts: { phone: '(512) 555-0199', website: 'https://hartwell.example' } }])
    from.mockReturnValue(asked.chain)
    expect(await loadCompanyLookupFacts('hartwellinteriors')).toEqual([{ phone: '(512) 555-0199', website: 'https://hartwell.example' }])
    expect(from).toHaveBeenCalledWith('permit_lookups')
    expect(steps(asked.calls, 'eq')).toEqual([['kind', 'company'], ['lookup_key', 'hartwellinteriors'], ['found', true]])
  })
})
