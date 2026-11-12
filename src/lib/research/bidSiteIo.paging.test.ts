import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The bid and permit reads past the API's 1,000 rows (punch list #307). `supabase/config.toml`
 * sets `max_rows = 1000`: a read with no range comes back cut there with no error. With a year of
 * San Antonio on hand the Bid Board's one read holds over 700 rows, so the cut is within reach.
 * Every name, address and number here is made up.
 */
const { rpc, from, getSession } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), getSession: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { rpc, from, auth: { getSession } } }))

import { resetRowCapHitWarningsForTests } from '../supabasePaging'
import { loadAllNameAnswers, loadCustomerNames, loadNameAnswers, loadPermitsByHouseNumber, recordNameAnswer, SITE_PERMITS_RPC_LIMIT } from './bidSiteIo'

type Failure = { code: string; message: string }
type Call = [method: string, ...args: unknown[]]

const API_MAX_ROWS = 1000

/**
 * A stand-in for one PostgREST read. Every step of the chain is kept in `calls`. A ranged read
 * answers its slice, and a read with no range is cut at 1,000 rows with no error, as the API cuts
 * it. `failures` are answered first, one per read, before any rows.
 */
function read(rows: readonly unknown[], failures: Failure[] = []) {
  const calls: Call[] = []
  const answer = (slice: unknown[]) => {
    const failure = failures.shift()
    return Promise.resolve(failure ? { data: null, error: failure, status: 500 } : { data: slice.slice(0, API_MAX_ROWS), error: null, status: 200 })
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

/** Permits as the read hands them over: in id order, their days in no order at all. */
const permits = Array.from({ length: 2340 }, (_, i) => ({
  id: `p${String(i).padStart(5, '0')}`,
  permit_number: `COM-${i}`,
  permit_type: 'Comm New Building Permit',
  issued_on: `2026-${String((i % 9) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
  submitted_on: null,
}))

const MISSING_FUNCTION: Failure = { code: 'PGRST202', message: 'Could not find the function public.bid_site_permits(p_city, p_numbers) in the schema cache' }
const MISSING_TABLE: Failure = { code: 'PGRST205', message: "Could not find the table 'public.builder_customer_answers' in the schema cache" }
const TIMED_OUT: Failure = { code: '57014', message: 'canceling statement due to statement timeout' }

beforeEach(() => {
  rpc.mockReset()
  from.mockReset()
  getSession.mockReset()
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
  resetRowCapHitWarningsForTests()
})

describe('the permits on a house number, past 1,000 rows', () => {
  it('reads every permit a page at a time, cut by id, and hands them back newest first', async () => {
    const asked = read(permits)
    rpc.mockReturnValue(asked.chain)

    const rows = await loadPermitsByHouseNumber('San Antonio', ['4120', '88'])

    expect(rows).toHaveLength(2340)
    expect(new Set(rows?.map((r) => r.id)).size).toBe(2340)
    expect(rpc).toHaveBeenCalledTimes(3)
    expect(rpc).toHaveBeenCalledWith('bid_site_permits', { p_city: 'San Antonio', p_numbers: ['4120', '88'] })
    expect(steps(asked.calls, 'range')).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
    // One order on every page, by a column that cannot tie.
    expect(steps(asked.calls, 'order')).toEqual([['id'], ['id'], ['id']])
    const days = (rows ?? []).map((r) => r.issued_on ?? '')
    expect(days).toEqual([...days].sort().reverse())
    expect(days[0]).toBe('2026-09-27')
  })

  it('asks a page again when it fails once, and loses none of it', async () => {
    const asked = read(permits, [])
    rpc.mockReturnValue(asked.chain)
    let reads = 0
    const range = asked.chain.range as (start: number, end: number) => Promise<unknown>
    asked.chain.range = (start: number, end: number) => {
      reads += 1
      // The second page times out the first time it is asked.
      return reads === 2 ? Promise.resolve({ data: null, error: TIMED_OUT, status: 500 }) : range(start, end)
    }

    const rows = await loadPermitsByHouseNumber('San Antonio', ['4120'])

    expect(rows).toHaveLength(2340)
    expect(reads).toBe(4)
  })

  it('is null before the read is on the database when the numbers are many, and reads the table for a few', async () => {
    rpc.mockReturnValue(read([], [MISSING_FUNCTION]).chain)
    expect(await loadPermitsByHouseNumber('San Antonio', ['1', '2', '3', '4'])).toBeNull()
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(from).not.toHaveBeenCalled()

    rpc.mockReturnValue(read([], [MISSING_FUNCTION]).chain)
    from.mockImplementation(() => read([permits[0]]).chain)
    expect(await loadPermitsByHouseNumber('San Antonio', ['4120', '88'])).toHaveLength(2)
    expect(from).toHaveBeenCalledTimes(2)
  })

  it('says so in the console when the read reaches its own limit of 5,000', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    rpc.mockReturnValue(read(permits.slice(0, 1200)).chain)
    await loadPermitsByHouseNumber('San Antonio', ['4120'])
    expect(warn).not.toHaveBeenCalled()

    const full = Array.from({ length: SITE_PERMITS_RPC_LIMIT }, (_, i) => ({ ...permits[0], id: `q${String(i).padStart(5, '0')}` }))
    rpc.mockReturnValue(read(full).chain)
    expect(await loadPermitsByHouseNumber('San Antonio', ['4120'])).toHaveLength(SITE_PERMITS_RPC_LIMIT)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toMatch(/bid_site_permits/)
    warn.mockRestore()
  })
})

describe('the answers on names, past 1,000 rows', () => {
  const answers = Array.from({ length: 2300 }, (_, i) => ({ id: `a${i}`, customer_id: `c${i % 3}`, builder_key: `k${i}`, answered_at: `2026-11-${String((i % 28) + 1).padStart(2, '0')}T12:00:00Z` }))

  it('reads every answer for the worklist, oldest first with the id settling a tie', async () => {
    const asked = read(answers)
    from.mockReturnValue(asked.chain)

    const res = await loadAllNameAnswers()

    expect(res?.me).toBe('u1')
    expect(res?.rows).toHaveLength(2300)
    expect(res?.rows[2299]).toEqual(answers[2299])
    expect(from).toHaveBeenCalledWith('builder_customer_answers')
    expect(steps(asked.calls, 'range')).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
    expect(steps(asked.calls, 'order')).toEqual([['answered_at', { ascending: true }], ['id'], ['answered_at', { ascending: true }], ['id'], ['answered_at', { ascending: true }], ['id']])
    expect(steps(asked.calls, 'in')).toEqual([])
    expect(steps(asked.calls, 'limit')).toEqual([])
  })

  it('reads every answer on one GC’s customer rows, and asks nothing for no rows', async () => {
    const asked = read(answers.slice(0, 1150))
    from.mockReturnValue(asked.chain)

    const res = await loadNameAnswers(['c1', 'c2'])

    expect(res?.rows).toHaveLength(1150)
    expect(steps(asked.calls, 'in')).toEqual([['customer_id', ['c1', 'c2']], ['customer_id', ['c1', 'c2']]])
    expect(steps(asked.calls, 'range')).toEqual([[0, 999], [1000, 1999]])

    from.mockClear()
    expect(await loadNameAnswers([])).toEqual({ rows: [], me: 'u1' })
    expect(from).not.toHaveBeenCalled()
  })

  it('is null before the table is on the database, and says why on any other refusal', async () => {
    from.mockReturnValue(read([], [MISSING_TABLE]).chain)
    expect(await loadAllNameAnswers()).toBeNull()
    from.mockReturnValue(read([], [MISSING_TABLE]).chain)
    expect(await loadNameAnswers(['c1'])).toBeNull()
    from.mockReturnValue(read([], [TIMED_OUT]).chain)
    await expect(loadAllNameAnswers()).rejects.toThrow(/read the answers on names: .*statement timeout/)
  })
})

describe('our customers by name, past 1,000 rows', () => {
  it('reads every customer a page at a time and leaves out a blank name', async () => {
    const customers = Array.from({ length: 1204 }, (_, i) => ({ id: `c${i}`, name: i === 1100 ? '  ' : `Customer ${String(i).padStart(4, '0')}` }))
    const asked = read(customers)
    from.mockReturnValue(asked.chain)

    const rows = await loadCustomerNames()

    expect(rows).toHaveLength(1203)
    expect(rows[1202]).toEqual({ id: 'c1203', name: 'Customer 1203' })
    expect(steps(asked.calls, 'is')).toEqual([['archived_at', null], ['archived_at', null]])
    expect(steps(asked.calls, 'order')).toEqual([['name'], ['id'], ['name'], ['id']])
    expect(steps(asked.calls, 'range')).toEqual([[0, 999], [1000, 1999]])
  })
})

describe('one read for everyone who asks together', () => {
  const answers = Array.from({ length: 12 }, (_, i) => ({ id: `a${i}`, customer_id: 'c1', builder_key: `k${i}`, answered_at: '2026-11-10T12:00:00Z' }))

  it('hands Builders’ two readers of the answers one read, and reads again for the next to ask', async () => {
    const asked = read(answers)
    from.mockReturnValue(asked.chain)

    const [worklist, column] = await Promise.all([loadAllNameAnswers(), loadAllNameAnswers()])

    expect(worklist?.rows).toHaveLength(12)
    expect(column?.rows).toBe(worklist?.rows)
    expect(steps(asked.calls, 'range')).toEqual([[0, 999]])
    await loadAllNameAnswers()
    expect(steps(asked.calls, 'range')).toEqual([[0, 999], [0, 999]])
  })

  it('hands them one read of the customers too', async () => {
    const asked = read([{ id: 'c1', name: 'Ridgeway Builders' }])
    from.mockReturnValue(asked.chain)

    const [a, b] = await Promise.all([loadCustomerNames(), loadCustomerNames()])

    expect(a).toBe(b)
    expect(steps(asked.calls, 'range')).toEqual([[0, 999]])
  })

  it('never hands a read that began before an answer landed to whoever asks after it', async () => {
    // The first read hangs until it is let go; the answer lands meanwhile.
    let letGo: (value: unknown) => void = () => undefined
    const slow = read([])
    slow.chain.range = () => new Promise((resolve) => (letGo = resolve))
    const insert = vi.fn().mockResolvedValue({ data: null, error: null, status: 201 })
    const fresh = read(answers)
    let reads = 0
    from.mockImplementation(() => ({ ...(reads++ === 0 ? slow.chain : fresh.chain), insert }))

    const before = loadAllNameAnswers()
    // Let the first read reach the database before the answer is saved.
    await new Promise((resolve) => setTimeout(resolve, 0))
    await recordNameAnswer({ builderKey: 'k1', customerId: 'c1', answer: 'works_for', scope: 'all', permitId: null, name: 'Dana Whitlow' })
    const after = await loadAllNameAnswers()
    letGo({ data: [], error: null, status: 200 })

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ builder_key: 'k1', answer: 'works_for', scope: 'all', answered_by: 'u1' }))
    expect(after?.rows).toHaveLength(12)
    expect((await before)?.rows).toEqual([])
  })
})
