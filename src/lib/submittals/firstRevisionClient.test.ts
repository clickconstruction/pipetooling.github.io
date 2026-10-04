import { describe, expect, it } from 'vitest'
import { createFirstRevisionFromPicks, overridesByTag, type BidPicks } from './firstRevisionClient'

type Write = { table: string; payload: unknown }

/** A stand-in client: records each insert, hands back `rev-1` for the revision, and counts reads. */
function fakeDb(itemError: { message: string } | null = null) {
  const writes: Write[] = []
  let reads = 0
  const db = {
    from(table: string) {
      return {
        select() {
          reads += 1
          throw new Error(`unexpected read of ${table}`)
        },
        insert(payload: unknown) {
          writes.push({ table, payload })
          if (table === 'bid_submittals') return { select: () => ({ single: async () => ({ data: { id: 'rev-1' }, error: null }) }) }
          return Promise.resolve({ error: itemError })
        },
      }
    },
  }
  return { db: db as unknown as Parameters<typeof createFirstRevisionFromPicks>[0], writes, reads: () => reads }
}

const picks: BidPicks = {
  specified: [
    { tag: 'WC-1', fixture: 'Water  Closet', manufacturer: 'TOTO', model: 'CT708', description: null },
    { tag: 'L-1', fixture: 'lavatory', manufacturer: 'Kohler', model: 'K-2005', description: null },
  ],
  picks: [{ fixture: 'water closet', supplyHouseId: 'h1', houseName: 'Ferguson', quoteLineId: 'l-wc', label: 'TOTO CT708', alternateReasonKind: null, alternateReasonNote: null, leadTimeDays: 5 }],
  overridesByFixture: new Map([['water closet', 'equal']]),
}

describe('overridesByTag', () => {
  it('reads each tag its fixture’s override, whatever the spacing or case; a fixture with none is left out', () => {
    expect(overridesByTag(picks)).toEqual({ 'WC-1': 'equal' })
  })

  it('no overrides, no tags', () => {
    expect(overridesByTag({ specified: picks.specified, overridesByFixture: new Map() })).toEqual({})
  })
})

describe('createFirstRevisionFromPicks', () => {
  it('with the picks handed in it reads nothing: one draft Rev 1, then a row per tag under it', async () => {
    const f = fakeDb()
    const r = await createFirstRevisionFromPicks(f.db, { bidId: 'b1', userId: 'wendi', picks })
    expect(r).toEqual({ revId: 'rev-1', rows: 2 })
    expect(f.reads()).toBe(0)
    expect(f.writes.map((w) => w.table)).toEqual(['bid_submittals', 'bid_submittal_items'])
    expect(f.writes[0]?.payload).toEqual({ bid_id: 'b1', rev_number: 1, status: 'draft', created_by: 'wendi', job_ledger_id: null })
    const rows = f.writes[1]?.payload as Record<string, unknown>[]
    expect(rows.map((x) => [x.tag, x.submittal_id])).toEqual([['L-1', 'rev-1'], ['WC-1', 'rev-1']])
  })

  it('the job it was asked on rides onto the revision', async () => {
    const f = fakeDb()
    await createFirstRevisionFromPicks(f.db, { bidId: 'b1', userId: null, jobLedgerId: 'job-9', picks })
    expect(f.writes[0]?.payload).toMatchObject({ job_ledger_id: 'job-9', created_by: null })
  })

  it('nothing to submit: the revision alone, no rows written', async () => {
    const f = fakeDb()
    const r = await createFirstRevisionFromPicks(f.db, { bidId: 'b1', userId: 'wendi', picks: { specified: [], picks: [], overridesByFixture: new Map() } })
    expect(r.rows).toBe(0)
    expect(f.writes.map((w) => w.table)).toEqual(['bid_submittals'])
  })

  it('a refused row write is thrown, not swallowed', async () => {
    const f = fakeDb({ message: 'row-level security' })
    await expect(createFirstRevisionFromPicks(f.db, { bidId: 'b1', userId: 'wendi', picks })).rejects.toMatchObject({ message: 'row-level security' })
  })
})
