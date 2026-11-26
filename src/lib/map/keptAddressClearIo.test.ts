import { beforeEach, describe, expect, it, vi } from 'vitest'

/** What the database answers each table's statements in turn, and every call each statement made on its query, in order. */
const db = vi.hoisted(() => ({
  answers: {} as Record<string, Array<{ data: unknown; error: unknown; count?: number | null }>>,
  statements: [] as Array<{ table: string; calls: Array<[string, unknown[]]> }>,
}))

vi.mock('../supabase', () => {
  const builder = (table: string) => {
    const statement = { table, calls: [] as Array<[string, unknown[]]> }
    db.statements.push(statement)
    const b: Record<string, unknown> = new Proxy(
      {},
      {
        get: (_t, op: string) => {
          if (op === 'then') {
            return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(db.answers[table]?.shift() ?? { data: [], error: null, count: 0 }).then(resolve, reject)
          }
          return (...args: unknown[]) => {
            statement.calls.push([op, args])
            return b
          }
        },
      },
    )
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})

import { KEPT_ADDRESS_SOURCES } from './keptAddressClear'
import { clearKeptAddress, readKeptAddressHits, searchKeptAddresses } from './keptAddressClearIo'

const KEY = '1 tset street, austin, tx'
const ok = (data: unknown, count: number | null = null) => ({ data, error: null, count })
const deletes = () => db.statements.filter((s) => s.calls.some(([op]) => op === 'delete'))

beforeEach(() => {
  db.answers = {}
  db.statements.length = 0
})

describe('searchKeptAddresses', () => {
  it('reads the cache and the misses for the typed words, newest kept first, twenty of each at most', async () => {
    db.answers = {
      address_geocodes: [ok([{ address_normalized: KEY, geocoded_at: '2026-11-25T01:48:37Z', geocode_error: null }, { address_normalized: '9 tset lane', geocoded_at: null, geocode_error: 'not found' }])],
      address_geocode_misses: [ok([{ address_normalized: '4 tset bend, alder, tx', checked_at: '2026-11-25T02:00:00Z' }])],
    }
    expect(await searchKeptAddresses('tset')).toEqual([
      { key: KEY, keptAtIso: '2026-11-25T01:48:37Z', placed: true, kind: 'kept' },
      { key: '9 tset lane', keptAtIso: null, placed: false, kind: 'kept' },
      { key: '4 tset bend, alder, tx', keptAtIso: '2026-11-25T02:00:00Z', placed: false, kind: 'miss' },
    ])
    const by = (table: string) => db.statements.find((s) => s.table === table)?.calls
    expect(by('address_geocodes')).toEqual([
      ['select', ['address_normalized, geocoded_at, geocode_error']],
      ['ilike', ['address_normalized', '%tset%']],
      ['order', ['geocoded_at', { ascending: false }]],
      ['limit', [20]],
    ])
    expect(by('address_geocode_misses')).toEqual([
      ['select', ['address_normalized, checked_at']],
      ['ilike', ['address_normalized', '%tset%']],
      ['order', ['checked_at', { ascending: false }]],
      ['limit', [20]],
    ])
  })
})

describe('readKeptAddressHits', () => {
  it('asks every source for the street line, each in its own column', async () => {
    db.answers = { jobs_ledger: [ok([], 2)] }
    const hits = await readKeptAddressHits(KEY)
    expect(hits?.map((h) => `${h.source.table}.${h.source.column}`)).toEqual(KEPT_ADDRESS_SOURCES.map((s) => `${s.table}.${s.column}`))
    expect(hits?.find((h) => h.source.table === 'jobs_ledger')?.count).toBe(2)
    expect(db.statements).toHaveLength(KEPT_ADDRESS_SOURCES.length)
    for (const [i, s] of KEPT_ADDRESS_SOURCES.entries()) {
      expect(db.statements[i]?.table).toBe(s.table)
      expect(db.statements[i]?.calls).toEqual([
        ['select', [s.column, { count: 'exact' }]],
        ['ilike', [s.column, '%1%tset%street%']],
        ['limit', [1]],
      ])
    }
  })
  it('reads nothing for an address too short to check', async () => {
    expect(await readKeptAddressHits('9 st')).toBeNull()
    expect(db.statements).toEqual([])
  })
  it('throws when one source fails or answers no count', async () => {
    db.answers = { customers: [{ data: null, error: { message: 'no signal' } }] }
    await expect(readKeptAddressHits(KEY)).rejects.toEqual({ message: 'no signal' })
    db.answers = { bids: [ok([], null)] }
    await expect(readKeptAddressHits(KEY)).rejects.toThrow(/could not be read/)
  })
})

describe('clearKeptAddress', () => {
  it('reads every source again, then deletes the one row by its key', async () => {
    db.answers = { address_geocodes: [ok([{ address_normalized: KEY }])] }
    await clearKeptAddress(KEY)
    expect(deletes()).toHaveLength(1)
    expect(deletes()[0]?.table).toBe('address_geocodes')
    expect(deletes()[0]?.calls).toEqual([
      ['delete', []],
      ['eq', ['address_normalized', KEY]],
      ['select', ['address_normalized']],
    ])
    expect(db.statements).toHaveLength(KEPT_ADDRESS_SOURCES.length + 1)
  })
  it('refuses an address a record is written under, whichever kind, and deletes nothing', async () => {
    for (const table of ['jobs_ledger', 'bids', 'estimates', 'customers', 'gc_companies', 'legal_matter_people', 'app_settings']) {
      db.answers = { [table]: [ok([], 1)] }
      await expect(clearKeptAddress(KEY)).rejects.toThrow(/^Its street line is written on 1 .+\. It stays\.$/)
    }
    expect(deletes()).toHaveLength(0)
  })
  it('refuses an address too short to check, and deletes nothing', async () => {
    await expect(clearKeptAddress('9 st')).rejects.toThrow('This address is too short to tell apart from the others. It stays.')
    expect(db.statements).toEqual([])
  })
  it('deletes nothing when a source cannot be read', async () => {
    db.answers = { permits: [{ data: null, error: { message: 'no signal' } }] }
    await expect(clearKeptAddress(KEY)).rejects.toEqual({ message: 'no signal' })
    expect(deletes()).toHaveLength(0)
  })
  it('says so when the delete reaches no row', async () => {
    db.answers = { address_geocodes: [ok([])] }
    await expect(clearKeptAddress(KEY)).rejects.toThrow(/was not cleared/)
  })
  it('clears a kept miss from its own table, under the same rule (punch list #443, row 16)', async () => {
    db.answers = { address_geocode_misses: [ok([{ address_normalized: KEY }])] }
    await clearKeptAddress(KEY, 'miss')
    expect(deletes()).toHaveLength(1)
    expect(deletes()[0]?.table).toBe('address_geocode_misses')
    expect(deletes()[0]?.calls).toEqual([
      ['delete', []],
      ['eq', ['address_normalized', KEY]],
      ['select', ['address_normalized']],
    ])
    db.answers = { jobs_ledger: [ok([], 1)] }
    await expect(clearKeptAddress(KEY, 'miss')).rejects.toThrow(/It stays\.$/)
    expect(deletes()).toHaveLength(1)
    db.answers = { address_geocode_misses: [ok([])] }
    await expect(clearKeptAddress(KEY, 'miss')).rejects.toThrow('The miss was not cleared. It may be gone already, or you may not have leave to clear it. Find it again.')
  })
})
