import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The on-site store's reads against a stand-in for PostgREST that cuts every answer at 1,000 rows, as the project
 * does (v2.7160). Before the reads were paged, `.limit(5000)` came back as the newest 1,000 rows without a word: a job
 * past 1,000 ledger rows lost its oldest presses, and `capped` could never be true, so the database's summary was
 * never asked for.
 */

const MAX_ROWS = 1000
type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}
const rpcCalls: Array<{ name: string; args: unknown }> = []

function query(table: string) {
  let rows = [...(tables[table] ?? [])]
  const orders: Array<{ col: string; asc: boolean }> = []
  let window: [number, number] | null = null
  let limit: number | null = null
  const sorted = () => {
    const out = [...rows]
    out.sort((a, b) => {
      for (const o of orders) {
        const x = String(a[o.col] ?? '')
        const y = String(b[o.col] ?? '')
        if (x !== y) return (x < y ? -1 : 1) * (o.asc ? 1 : -1)
      }
      return 0
    })
    return out
  }
  const q = {
    select: () => q,
    eq: (col: string, v: unknown) => ((rows = rows.filter((r) => r[col] === v)), q),
    is: (col: string, v: unknown) => ((rows = rows.filter((r) => (r[col] ?? null) === v)), q),
    in: (col: string, vs: unknown[]) => ((rows = rows.filter((r) => vs.includes(r[col]))), q),
    order: (col: string, o?: { ascending?: boolean }) => (orders.push({ col, asc: o?.ascending !== false }), q),
    limit: (n: number) => ((limit = n), q),
    range: (from: number, to: number) => ((window = [from, to]), q),
    then: (resolve: (v: { data: Row[]; error: null }) => unknown) => {
      let out = sorted()
      if (window) out = out.slice(window[0], window[1] + 1)
      if (limit != null) out = out.slice(0, limit)
      // The project's own cut, with no error and no sign.
      return Promise.resolve({ data: out.slice(0, MAX_ROWS), error: null }).then(resolve)
    },
  }
  return q
}

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => query(table),
    rpc: (name: string, args: unknown) => {
      rpcCalls.push({ name, args })
      return Promise.resolve({ data: { lines: [], last_counts: [], counts: [], cannot_find: [], returns: [] }, error: null })
    },
  },
}))

const pad = (n: number) => String(n).padStart(6, '0')
function ledger(jobId: string, boxId: string, count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `m-${jobId}-${pad(i)}`,
    job_id: jobId,
    part_id: null,
    part_name: `part ${i}`,
    manufacturer: null,
    quantity: 1,
    reason: 'delivered',
    from_container_id: null,
    to_container_id: boxId,
    note: '',
    source: null,
    item_id: null,
    by_user_id: null,
    by_name: 'ZZ Test',
    // One row a second from a fixed start, so the order is the index.
    at: new Date(Date.UTC(2026, 9, 29, 0, 0, i)).toISOString(),
  }))
}
const box = (id: string, jobId: string, extra: Row = {}): Row => ({ id, job_id: jobId, label: id.toUpperCase(), kind: 'cage', where_note: '', place_id: null, lat: null, lng: null, retired_at: null, created_at: '2026-10-29T00:00:00.000Z', ...extra })

async function freshStore() {
  vi.resetModules()
  return import('./onSiteStore')
}

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k]
  rpcCalls.length = 0
})

describe('the on-site store reads past 1,000 rows', () => {
  it('reads a job’s whole ledger when it holds more than one page', async () => {
    tables.job_containers = [box('a1', 'job-1')]
    tables.job_material_movements = ledger('job-1', 'a1', 1300)
    const store = await freshStore()
    await store.loadJob('job-1')
    const rows = store.listMovements('job-1')
    expect(rows).toHaveLength(1300)
    // Oldest first in the cache, and the oldest press is there: it is the one the cut used to drop.
    expect(rows[0]!.partName).toBe('part 0')
    expect(rows[1299]!.partName).toBe('part 1299')
    expect(store.jobLedgerCapped('job-1')).toBe(false)
    expect(rpcCalls).toHaveLength(0)
  })

  it('marks a job past the cap, keeps its newest rows and asks the database for the sums', async () => {
    tables.job_containers = [box('a1', 'job-2')]
    tables.job_material_movements = ledger('job-2', 'a1', 5200)
    const store = await freshStore()
    await store.loadJob('job-2')
    const rows = store.listMovements('job-2')
    expect(rows).toHaveLength(store.MOVEMENTS_LIMIT)
    expect(rows[0]!.partName).toBe('part 200')
    expect(rows[rows.length - 1]!.partName).toBe('part 5199')
    expect(store.jobLedgerCapped('job-2')).toBe(true)
    expect(rpcCalls).toEqual([{ name: 'on_site_job_summary', args: { p_job_id: 'job-2' } }])
  })

  it('reads every box, photo and box move of a job with more than a page of each', async () => {
    tables.job_containers = Array.from({ length: 1100 }, (_, i) => box(`b${pad(i)}`, 'job-3', { created_at: new Date(Date.UTC(2026, 9, 29, 0, 0, i)).toISOString() }))
    tables.job_box_photos = Array.from({ length: 1050 }, (_, i) => ({ id: `p${pad(i)}`, job_id: 'job-3', container_id: 'b000000', by_user_id: null, by_name: 'ZZ Test', words: '', file_name: `${i}.jpg`, taken_at: new Date(Date.UTC(2026, 9, 29, 0, 0, i)).toISOString(), bytes: 1, width: 1, height: 1, status: 'filed', storage_path: null, drive_file_id: 'x', filed_at: null, fail_why: null }))
    tables.job_container_moves = Array.from({ length: 1100 }, (_, i) => ({ id: `v${pad(i)}`, container_id: `b${pad(i)}`, from_place_id: null, to_place_id: null, by_name: 'ZZ Test', at: new Date(Date.UTC(2026, 9, 30, 0, 0, i)).toISOString() }))
    const store = await freshStore()
    await store.loadJob('job-3')
    expect(store.listContainers('job-3')).toHaveLength(1100)
    const photos = store.listPhotos('job-3')
    expect(photos).toHaveLength(1050)
    // The newest photo is the one a box shows; the cut used to drop it.
    expect(photos[photos.length - 1]!.fileName).toBe('1049.jpg')
    const moves = store.listContainerMoves('job-3')
    expect(moves).toHaveLength(1100)
    expect(moves[0]!.at < moves[moves.length - 1]!.at).toBe(true)
  })

  it('finds every job on the desk when the live boxes pass one page', async () => {
    tables.job_containers = [
      ...Array.from({ length: 1005 }, (_, i) => box(`b${pad(i)}`, 'job-big')),
      box('z1', 'job-small-1'),
      box('z2', 'job-small-2', { retired_at: '2026-11-01T00:00:00.000Z' }),
    ]
    const store = await freshStore()
    const ids = await store.loadDesk()
    expect([...ids].sort()).toEqual(['job-big', 'job-small-1'])
  })
})
