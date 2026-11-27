import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The Market view's reads and its one write (punch list #405): a year of permits read past
 * PostgREST's 1,000 with the later pages asked together, the answers on the call list read as
 * none before their table is on the database, and an answer written as the person signed in.
 */
const { from, getSession, rpc } = vi.hoisted(() => ({ from: vi.fn(), getSession: vi.fn(), rpc: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { from, rpc, auth: { getSession } } }))

import { loadBuilderLookupOf, loadBuilderLookups, loadBuildersOfCities, loadCallAnswers, loadMarketBids, loadMarketPermits, recordCallAnswer, recordLookupCheck } from './permitMarketIo'

type Answer = { data: unknown[] | null; error: { code: string; message: string } | null; status: number; count?: number | null }

/** A chain that records what was asked and answers each range through `answer`. */
function table(answer: (lo: number, hi: number, counted: boolean) => Answer, log: Array<Record<string, unknown>> = []) {
  const asked: Record<string, unknown> = {}
  let counted = false
  const chain: Record<string, unknown> = {}
  const step = (name: string) => (...args: unknown[]) => {
    asked[name] = [...((asked[name] as unknown[]) ?? []), args]
    return chain
  }
  for (const name of ['eq', 'or', 'order', 'gte', 'not']) chain[name] = step(name)
  chain.select = (columns: string, opts?: { count?: string }) => {
    asked.select = columns
    counted = opts?.count === 'exact'
    return chain
  }
  chain.range = (lo: number, hi: number) => {
    log.push({ ...asked, lo, hi, counted })
    return Promise.resolve(answer(lo, hi, counted))
  }
  return chain
}

const permits = Array.from({ length: 3645 }, (_, i) => ({ builder_key: `b${i % 400}`, stage: 'issued', work_type: 'Commercial remodel', submitted_on: null, issued_on: '2026-10-01', declared_value: null, n: i }))

beforeEach(() => {
  from.mockReset()
  rpc.mockReset()
  getSession.mockReset().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
})

describe('loadMarketPermits', () => {
  it('reads the first page with its count, then every later page together', async () => {
    const log: Array<Record<string, unknown>> = []
    from.mockImplementation(() => table((lo, hi, counted) => ({ data: permits.slice(lo, hi + 1), error: null, status: 206, count: counted ? permits.length : null }), log))
    const rows = await loadMarketPermits('San Antonio', '2025-11-19')
    expect(rows).toHaveLength(3645)
    // Every row once, whatever order the pages landed in.
    expect(new Set(rows.map((r) => (r as unknown as { n: number }).n)).size).toBe(3645)
    expect(log.map((l) => [l.lo, l.counted])).toEqual([[0, true], [1000, false], [2000, false], [3000, false]])
    expect(from).toHaveBeenCalledWith('permits')
    expect(log[0]?.select).toBe('builder_key, stage, work_type, submitted_on, issued_on, declared_value, address_key')
    expect(log[0]?.eq).toEqual([['city', 'San Antonio'], ['kind', 'building'], ['residential', false]])
    // Issued since the day, or applied for since then and not issued: the permit's own day.
    expect(log[0]?.or).toEqual([['issued_on.gte.2025-11-19,and(issued_on.is.null,submitted_on.gte.2025-11-19)']])
  })

  it('asks once for a city whose year fits a page', async () => {
    const log: Array<Record<string, unknown>> = []
    from.mockImplementation(() => table((lo, hi) => ({ data: permits.slice(0, 908).slice(lo, hi + 1), error: null, status: 200, count: 908 }), log))
    expect(await loadMarketPermits('Austin', '2025-11-19')).toHaveLength(908)
    expect(log).toHaveLength(1)
  })

  it('reads on a page at a time when no count comes back, so a full page is never taken for the whole', async () => {
    const log: Array<Record<string, unknown>> = []
    from.mockImplementation(() => table((lo, hi) => ({ data: permits.slice(0, 2000).slice(lo, hi + 1), error: null, status: 200, count: null }), log))
    expect(await loadMarketPermits('San Antonio', '2025-11-19')).toHaveLength(2000)
    expect(log.map((l) => l.lo)).toEqual([0, 1000, 2000])
  })

  it('says why when a page is refused, the first or a later one', async () => {
    from.mockImplementation(() => table(() => ({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' }, status: 500 })))
    await expect(loadMarketPermits('San Antonio', '2025-11-19')).rejects.toThrow(/statement timeout/)
    from.mockImplementation(() => table((lo, hi, counted) => (lo === 2000 ? { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' }, status: 500 } : { data: permits.slice(lo, hi + 1), error: null, status: 206, count: counted ? permits.length : null })))
    await expect(loadMarketPermits('San Antonio', '2025-11-19')).rejects.toThrow(/statement timeout/)
  })
})

describe('loadMarketBids', () => {
  it('reads our bids from the day before the window, with the names they were priced for', async () => {
    const log: Array<Record<string, unknown>> = []
    from.mockImplementation(() =>
      table(
        () => ({
          data: [
            { id: 'b1', customer_id: 'c1', outcome: 'won', created_at: '2026-06-01T15:00:00Z', project_name: 'Mill Street Lofts', customer: { name: 'Ridgeway Builders' }, gc: null },
            { id: 'b2', customer_id: null, outcome: null, created_at: null, project_name: null, customer: null, gc: { name: 'Harbor Fitouts' } },
          ],
          error: null,
          status: 200,
        }),
        log,
      ),
    )
    expect(await loadMarketBids('2024-11-19')).toEqual([
      { id: 'b1', customerId: 'c1', customerName: 'Ridgeway Builders', gcName: null, outcome: 'won', bidOn: '2026-06-01', projectName: 'Mill Street Lofts' },
      { id: 'b2', customerId: null, customerName: null, gcName: 'Harbor Fitouts', outcome: null, bidOn: null, projectName: null },
    ])
    expect(from).toHaveBeenCalledWith('bids')
    expect(log[0]?.gte).toEqual([['created_at', '2024-11-18T00:00:00Z']])
  })
})

describe('loadBuildersOfCities', () => {
  it('reads each city’s builders, and a city with none answers with none', async () => {
    rpc.mockImplementation((_fn: string, args: { p_city: string }) => ({ range: () => Promise.resolve(args.p_city === 'Seguin' ? { data: [], error: null, status: 200 } : { data: [{ key: `${args.p_city}-1`, permits: 4 }], error: null, status: 200 }) }))
    expect(await loadBuildersOfCities(['San Antonio', 'Seguin'])).toEqual([
      { city: 'San Antonio', rows: [{ key: 'San Antonio-1', permits: 4 }] },
      { city: 'Seguin', rows: [] },
    ])
  })
})

describe('the answers on the call list', () => {
  it('reads every answer, oldest first', async () => {
    const log: Array<Record<string, unknown>> = []
    const rows = [{ id: 'a1', builder_key: 'ridgewaybuilders', answer: 'not_for_us' }]
    from.mockImplementation(() => table(() => ({ data: rows, error: null, status: 200 }), log))
    expect(await loadCallAnswers()).toEqual(rows)
    expect(from).toHaveBeenCalledWith('builder_call_answers')
    expect(log[0]?.order).toEqual([['answered_at', { ascending: true }], ['id']])
  })

  it('reads as none before the table is on the database, and says why on any other refusal', async () => {
    from.mockImplementation(() => table(() => ({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.builder_call_answers' in the schema cache" }, status: 404 })))
    expect(await loadCallAnswers()).toBeNull()
    from.mockImplementation(() => table(() => ({ data: null, error: { code: '42501', message: 'permission denied for table builder_call_answers' }, status: 403 })))
    await expect(loadCallAnswers()).rejects.toThrow(/permission denied/)
  })

  it('writes an answer as the person signed in', async () => {
    const insert = vi.fn().mockResolvedValue({ data: null, error: null, status: 201 })
    from.mockImplementation(() => ({ insert }))
    await recordCallAnswer({ builderKey: 'ridgewaybuilders', answer: 'pursue', reason: ' Pursued for this job. ', lookAgainOn: '2027-02-17', city: 'San Antonio', prospectId: 'lead-1', permitId: 'p1' })
    expect(from).toHaveBeenCalledWith('builder_call_answers')
    expect(insert).toHaveBeenCalledWith({ builder_key: 'ridgewaybuilders', answer: 'pursue', reason: 'Pursued for this job.', look_again_on: '2027-02-17', city: 'San Antonio', prospect_id: 'lead-1', permit_id: 'p1', answered_by: 'u1' })
    await recordCallAnswer({ builderKey: 'ridgewaybuilders', answer: 'back', reason: '', lookAgainOn: null, city: 'San Antonio' })
    expect(insert).toHaveBeenLastCalledWith({ builder_key: 'ridgewaybuilders', answer: 'back', reason: '', look_again_on: null, city: 'San Antonio', prospect_id: null, permit_id: null, answered_by: 'u1' })
  })

  it('refuses to write for nobody', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    await expect(recordCallAnswer({ builderKey: 'ridgewaybuilders', answer: 'back', reason: '', lookAgainOn: null, city: 'San Antonio' })).rejects.toThrow('Sign in again to answer.')
    expect(from).not.toHaveBeenCalled()
  })
})

describe('what was looked up about the builders', () => {
  const facts = [{ id: 'f1', builder_key: 'ridgewaybuilders', fact: 'phone', value: '(210) 555-0142' }]
  const checks = [{ id: 'c1', lookup_id: 'f1', verdict: 'checked', said_by: 'u1' }]

  it('reads every fact and every press on one, oldest first', async () => {
    const logs: Record<string, Array<Record<string, unknown>>> = { builder_lookups: [], builder_lookup_checks: [] }
    from.mockImplementation((name: string) => table(() => ({ data: name === 'builder_lookups' ? facts : checks, error: null, status: 200 }), logs[name]))
    expect(await loadBuilderLookups()).toEqual({ rows: facts, checks })
    expect(logs.builder_lookups?.[0]?.select).toBe('id, builder_key, fact, value, detail, source_url, looked_up_on, looked_up_by, looked_up_how, city, created_at')
    expect(logs.builder_lookups?.[0]?.order).toEqual([['created_at', { ascending: true }], ['id']])
    expect(logs.builder_lookup_checks?.[0]?.select).toBe('id, lookup_id, verdict, said_by, said_at')
    expect(logs.builder_lookup_checks?.[0]?.order).toEqual([['said_at', { ascending: true }], ['id']])
  })

  it('reads as none before the tables are on the database, and says why on any other refusal', async () => {
    from.mockImplementation(() => table(() => ({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.builder_lookups' in the schema cache" }, status: 404 })))
    expect(await loadBuilderLookups()).toBeNull()
    from.mockImplementation(() => table(() => ({ data: null, error: { code: '42501', message: 'permission denied for table builder_lookups' }, status: 403 })))
    await expect(loadBuilderLookups()).rejects.toThrow(/read what was looked up about the builders|read the checks on what was looked up/)
  })

  /** A chain awaited as it stands, as a read with no range is: it records what was asked and answers once. */
  function whole(answer: Answer, log: Array<Record<string, unknown>>) {
    const asked: Record<string, unknown> = {}
    const chain: Record<string, unknown> = {}
    for (const name of ['select', 'eq', 'in', 'order']) {
      chain[name] = (...args: unknown[]) => {
        asked[name] = [...((asked[name] as unknown[]) ?? []), args]
        return chain
      }
    }
    chain.then = (ok: (v: Answer) => unknown, no?: (e: unknown) => unknown) => {
      log.push({ ...asked })
      return Promise.resolve(answer).then(ok, no)
    }
    return chain
  }

  it('reads one name’s facts, then the presses on those facts alone (the builder’s sheet, v2.8732)', async () => {
    const logs: Record<string, Array<Record<string, unknown>>> = { builder_lookups: [], builder_lookup_checks: [] }
    from.mockImplementation((name: string) => whole({ data: name === 'builder_lookups' ? facts : checks, error: null, status: 200 }, logs[name]!))
    expect(await loadBuilderLookupOf('ridgewaybuilders')).toEqual({ rows: facts, checks })
    expect(logs.builder_lookups?.[0]?.select).toEqual([['id, builder_key, fact, value, detail, source_url, looked_up_on, looked_up_by, looked_up_how, city, created_at']])
    expect(logs.builder_lookups?.[0]?.eq).toEqual([['builder_key', 'ridgewaybuilders']])
    expect(logs.builder_lookups?.[0]?.order).toEqual([['created_at', { ascending: true }], ['id']])
    expect(logs.builder_lookup_checks?.[0]?.in).toEqual([['lookup_id', ['f1']]])
    expect(logs.builder_lookup_checks?.[0]?.order).toEqual([['said_at', { ascending: true }], ['id']])
  })

  it('asks for no presses on a name nobody looked up, reads as none before the tables are there, and says why on a refusal', async () => {
    const logs: Record<string, Array<Record<string, unknown>>> = { builder_lookups: [], builder_lookup_checks: [] }
    from.mockImplementation((name: string) => whole({ data: [], error: null, status: 200 }, logs[name]!))
    expect(await loadBuilderLookupOf('tallpinebuilders')).toEqual({ rows: [], checks: [] })
    expect(logs.builder_lookup_checks).toHaveLength(0)
    from.mockImplementation(() => whole({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.builder_lookups' in the schema cache" }, status: 404 }, []))
    expect(await loadBuilderLookupOf('tallpinebuilders')).toBeNull()
    from.mockImplementation(() => whole({ data: null, error: { code: '42501', message: 'permission denied for table builder_lookups' }, status: 403 }, []))
    await expect(loadBuilderLookupOf('tallpinebuilders')).rejects.toThrow(/read what was looked up about this builder/)
  })

  it('writes a press on a fact as the person signed in', async () => {
    const insert = vi.fn().mockResolvedValue({ data: null, error: null, status: 201 })
    from.mockImplementation(() => ({ insert }))
    await recordLookupCheck({ lookupId: 'f1', verdict: 'wrong' })
    expect(from).toHaveBeenCalledWith('builder_lookup_checks')
    expect(insert).toHaveBeenCalledWith({ lookup_id: 'f1', verdict: 'wrong', said_by: 'u1' })
  })

  it('refuses to write a press for nobody', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    await expect(recordLookupCheck({ lookupId: 'f1', verdict: 'checked' })).rejects.toThrow('Sign in again to check a fact.')
    expect(from).not.toHaveBeenCalled()
  })
})
