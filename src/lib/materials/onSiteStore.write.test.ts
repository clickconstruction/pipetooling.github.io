import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The on-site store's writes end to end (punch list #344, PR 1, v2.7173): the store, the sender, the outbox and the
 * replay as the app runs them, over a stand-in for the tables. A press made with no signal stays on the screen through
 * a fresh read, lands once when the signal is back, and leaves the screen only when the office says no.
 */

type Row = Record<string, unknown>
type Answer = { data: unknown; error: { message: string; code?: string; details?: string } | null; status?: number }
const tables: Record<string, Row[]> = {}
/** What the next insert answers, when a test wants something other than the table's own word. `lands` puts the row in first. */
const nextInsert: Array<{ lands: boolean; answer: Answer }> = []
const inserts: string[] = []
const NO_SIGNAL: Answer = { data: null, error: { message: 'TypeError: Failed to fetch', code: '' }, status: 0 }

function query(table: string) {
  let rows = [...(tables[table] ?? [])]
  const q = {
    select: () => q,
    eq: (col: string, v: unknown) => ((rows = rows.filter((r) => r[col] === v)), q),
    is: (col: string, v: unknown) => ((rows = rows.filter((r) => (r[col] ?? null) === v)), q),
    in: (col: string, vs: unknown[]) => ((rows = rows.filter((r) => vs.includes(r[col]))), q),
    order: () => q,
    range: (from: number, to: number) => ((rows = rows.slice(from, to + 1)), q),
    then: (resolve: (v: Answer) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
    insert: (row: Row) => {
      inserts.push(`${table}:${String(row.id)}`)
      const scripted = nextInsert.shift()
      const there = (tables[table] ?? []).some((r) => r.id === row.id)
      if (scripted) {
        if (scripted.lands && !there) tables[table] = [...(tables[table] ?? []), row]
        return Promise.resolve(scripted.answer)
      }
      if (there) return Promise.resolve({ data: null, error: { code: '23505', message: `duplicate key value violates unique constraint "${table}_pkey"` }, status: 409 })
      tables[table] = [...(tables[table] ?? []), row]
      return Promise.resolve({ data: null, error: null, status: 201 })
    },
    update: (patch: Row) => ({
      eq: (_col: string, id: unknown) => {
        tables[table] = (tables[table] ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r))
        return Promise.resolve({ data: null, error: null, status: 204 })
      },
    }),
  }
  return q
}

vi.mock('../supabase', () => ({ supabase: { from: (table: string) => query(table), rpc: () => Promise.resolve({ data: null, error: null }) } }))
// No IndexedDB in this bench, so the outbox is in memory alone, as it is on a browser with no phone store.

const signal = { online: true }
const box = { id: 'a1', job_id: 'j1', label: 'A1', kind: 'cage', where_note: '', place_id: null, lat: null, lng: null, retired_at: null, created_at: '2026-10-29T00:00:00.000Z' }
const use = (quantity: number) => ({ jobId: 'j1', partId: null, partName: 'ZZ test elbow', manufacturer: null, quantity, reason: 'used' as const, fromContainerId: 'a1', toContainerId: null, byUserId: 'u1', byName: 'Mateo' })
/** The sender of the bench in hand, so `settle` can ask it whether a press is still on its way. */
let sender: { inHand(): ReadonlyArray<unknown> } | null = null
/**
 * Let a send run to its end. A send loads its lander on first use (`landFieldPress` imports `onSiteWritesIo`), and how
 * long that takes is the machine's to say: this used to wait a fixed 30 ms, a loaded runner took longer, the write
 * landed in the next case, and both cases failed (the merge queue, 2026-11-13). So it waits on the sender's own word
 * that nothing is in hand, and only then gives what follows a send its few turns: the word to the person, the read
 * after a refusal, the store's answer to the outbox. None of those loads anything.
 */
const settle = async () => {
  await vi.waitFor(
    () => {
      if (sender && sender.inHand().length > 0) throw new Error('a press is still on its way')
    },
    { timeout: 10_000, interval: 5 },
  )
  for (let i = 0; i < 6; i += 1) await new Promise((r) => setTimeout(r, 5))
}

async function bench() {
  vi.resetModules()
  const [store, { outbox }, { replayOutbox }, { onSiteSender }] = await Promise.all([import('./onSiteStore'), import('../offline/outboxState'), import('../../hooks/useOutboxReplay'), import('./onSiteSend')])
  // The same sender the store sends through: both come from this bench's fresh modules.
  sender = onSiteSender()
  await outbox.load('u1', Date.now())
  const said: Array<{ message: string; tone: string }> = []
  store.setOnSiteErrorHandler((message, tone) => said.push({ message, tone }))
  await store.loadJob('j1')
  return { store, outbox, replay: () => replayOutbox({ store: outbox, online: () => signal.online }), said }
}

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k]
  tables.job_containers = [box]
  nextInsert.length = 0
  inserts.length = 0
  signal.online = true
  vi.stubGlobal('navigator', { get onLine() { return signal.online } })
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })
})
afterEach(async () => {
  // A case that failed part way may have left a press on its way: let it land here, never in the next case.
  await settle()
  sender = null
  vi.unstubAllGlobals()
})

describe('an on-site press through the store', () => {
  it('with a signal it is on the screen at once and at the office, and nothing waits', async () => {
    const b = await bench()
    const m = b.store.addMovement(use(4))
    expect(b.store.listMovements('j1').map((x) => x.id)).toEqual([m.id])
    await settle()
    expect(tables.job_material_movements).toHaveLength(1)
    expect(tables.job_material_movements![0]).toMatchObject({ id: m.id, job_id: 'j1', quantity: 4, reason: 'used', from_container_id: 'a1', by_name: 'Mateo' })
    expect(b.outbox.presses()).toEqual([])
    expect(b.said).toEqual([])
  })

  it('with no signal it is kept, said once, and still on the screen after a fresh read', async () => {
    signal.online = false
    const b = await bench()
    const first = b.store.addMovement(use(4))
    const second = b.store.addMovement(use(2))
    await settle()
    expect(inserts).toEqual([])
    expect(b.outbox.presses().map((p) => [p.kind, p.state])).toEqual([['on-site-press', 'waiting'], ['on-site-press', 'waiting']])
    expect(b.said).toEqual([{ message: b.store.ON_SITE_KEPT_WORDS, tone: 'info' }])
    // The read brings back a job with no such rows. Both presses are drawn over it, in order.
    await b.store.loadJob('j1', { force: true })
    expect(b.store.listMovements('j1').map((x) => x.id)).toEqual([first.id, second.id])

    // The signal is back: the replay lands both, once each, and the screen does not change.
    signal.online = true
    await b.replay()
    expect(tables.job_material_movements!.map((r) => r.id)).toEqual([first.id, second.id])
    expect(b.outbox.presses().map((p) => p.state)).toEqual(['sent', 'sent'])
    await b.store.loadJob('j1', { force: true })
    // Both, once each. (This stand-in does not sort, so the read's order is not the point here.)
    expect(b.store.listMovements('j1').map((x) => x.id).sort()).toEqual([first.id, second.id].sort())
  })

  it('a send that landed with its answer lost is sent again and counts once', async () => {
    const b = await bench()
    nextInsert.push({ lands: true, answer: NO_SIGNAL })
    const m = b.store.addMovement(use(4))
    await settle()
    // The row is at the office, and the phone does not know it: the press waits.
    expect(tables.job_material_movements).toHaveLength(1)
    expect(b.outbox.presses().map((p) => p.state)).toEqual(['waiting'])
    const waiting = b.outbox.presses()[0]!
    b.outbox.put({ ...waiting, attempts: 0, lastTriedAt: null })
    await b.replay()
    expect(inserts).toEqual([`job_material_movements:${m.id}`, `job_material_movements:${m.id}`])
    expect(tables.job_material_movements).toHaveLength(1)
    expect(b.outbox.presses().map((p) => p.state)).toEqual(['sent'])
    expect(b.said.filter((s) => s.tone === 'error')).toEqual([])
  })

  it('a new box and the part put in it go in that order', async () => {
    signal.online = false
    const b = await bench()
    const made = b.store.addContainer({ jobId: 'j1', label: 'B2', kind: 'box', where: '' })
    b.store.addMovement({ ...use(3), reason: 'delivered', fromContainerId: null, toContainerId: made.id })
    await settle()
    signal.online = true
    await b.replay()
    expect(inserts.map((i) => i.split(':')[0])).toEqual(['job_containers', 'job_material_movements'])
    expect(tables.job_containers!.map((r) => r.label)).toEqual(['A1', 'B2'])
  })

  it('the office saying no takes the press off the screen with its reason', async () => {
    const b = await bench()
    nextInsert.push({ lands: false, answer: { data: null, error: { code: '42501', message: 'new row violates row-level security policy for table "job_material_movements"' }, status: 403 } })
    b.store.addMovement(use(4))
    expect(b.store.listMovements('j1')).toHaveLength(1)
    await settle()
    expect(b.said).toHaveLength(1)
    expect(b.said[0]!.tone).toBe('error')
    expect(b.said[0]!.message.startsWith('4 ZZ test elbow did not save: ')).toBe(true)
    expect(b.store.listMovements('j1')).toEqual([])
    expect(b.outbox.presses()).toEqual([])
  })

  it('a kept press the office refuses later, or one the person drops, leaves the screen', async () => {
    signal.online = false
    const b = await bench()
    b.store.addMovement(use(4))
    b.store.addMovement(use(2))
    await settle()
    const [first, second] = b.outbox.presses()
    b.outbox.put({ ...first!, state: 'refused', refusal: { message: 'This job is closed.', code: null } })
    await settle()
    expect(b.store.listMovements('j1').map((x) => x.quantity)).toEqual([2])
    b.outbox.remove(second!.id)
    await settle()
    expect(b.store.listMovements('j1')).toEqual([])
  })

  it('a box move is one press of two rows, and a retire and its undo land as the last word', async () => {
    tables.job_places = [{ id: 'p1', job_id: 'j1', name: 'Level 2', created_at: '2026-10-29T00:00:00.000Z' }]
    signal.online = false
    const b = await bench()
    b.store.moveContainer('a1', 'p1', 'Mateo', 'u1')
    b.store.retireContainer('a1')
    b.store.unretireContainer('a1')
    await settle()
    expect(b.outbox.presses()).toHaveLength(3)
    expect(b.store.listContainers('j1')[0]).toMatchObject({ locationId: 'p1', retiredAt: null })
    expect(b.store.listContainerMoves('j1')).toHaveLength(1)
    signal.online = true
    await b.replay()
    expect(tables.job_containers![0]).toMatchObject({ place_id: 'p1', retired_at: null })
    expect(tables.job_container_moves).toHaveLength(1)
    expect(tables.job_container_moves![0]).toMatchObject({ container_id: 'a1', to_place_id: 'p1', by_name: 'Mateo' })
  })
})
