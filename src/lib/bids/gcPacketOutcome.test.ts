import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A recording, chainable Supabase stand-in (same shape as teamFeedback.test.ts): every builder
// method records itself; awaiting hands the chain to the per-test handler. The decision kernels
// (wonCascade, gcPackets, updateGuard) are real — this file pins the WRITE SEQUENCE around them.
type Step = { method: string; args: unknown[] }
type Result = { data: unknown; error: { message: string } | null }
type Call = { table: string; steps: Step[] }
type Handler = (call: Call) => Result

const calls: Call[] = []
let handler: Handler = () => ({ data: null, error: null })
let insertThrows = false

function builder(table: string): unknown {
  const steps: Step[] = []
  const p: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') {
          return (resolve: (v: Result) => void, reject: (e: unknown) => void) => {
            const call = { table, steps }
            calls.push(call)
            if (insertThrows && steps[0]?.method === 'insert') return reject(new Error('insert blocked'))
            resolve(handler(call))
          }
        }
        return (...args: unknown[]) => {
          steps.push({ method: String(prop), args })
          return p
        }
      },
    },
  )
  return p
}

const recordNavClick = vi.fn()
vi.mock('../supabase', () => ({ supabase: { from: (table: string) => builder(table) } }))
vi.mock('../navClickTelemetry', () => ({ recordNavClick: (...a: unknown[]) => recordNavClick(...a) }))

import { BID_UPDATE_NOT_APPLIED_MESSAGE } from './updateGuard'
import { peekWonCascadeSnapshot, setGcPacketLossCategory, setGcPacketOutcome, type PacketAfter } from './gcPacketOutcome'

const first = (c: Call) => c.steps[0]!
const method = (c: Call) => first(c).method
const arg = (c: Call, m: string) => c.steps.find((s) => s.method === m)?.args
const writes = () => calls.filter((c) => method(c) !== 'select').map((c) => `${c.table}:${method(c)}`)

/** Default routing: reads return the rows we set; updates succeed; `.select('id')` after an update returns one row. */
let versionRows: Array<{ id: string; outcome: string | null; outcome_at: string | null; loss_category: string | null }> = []
let bidUpdateApplies = true
const defaultHandler: Handler = (c) => {
  if (method(c) === 'select') return { data: versionRows.filter((r) => ((arg(c, 'in')?.[1] as string[] | undefined) ?? []).includes(r.id)), error: null }
  if (c.table === 'bids' && c.steps.some((s) => s.method === 'select')) return { data: bidUpdateApplies ? [{ id: 'bid-1' }] : [], error: null }
  return { data: null, error: null }
}

const A: PacketAfter = { key: 'gc-a', name: 'Acme', outcome: null, sentOn: '2026-09-01', versionIds: ['va'] }
const B: PacketAfter = { key: 'gc-b', name: 'Burd', outcome: null, sentOn: '2026-09-02', versionIds: ['vb'] }
const C: PacketAfter = { key: 'gc-c', name: 'Cortez', outcome: null, sentOn: null, versionIds: ['vc'] } // never sent
const S: PacketAfter = { key: 'shared:1', name: 'Shared', outcome: null, sentOn: '2026-09-01', versionIds: ['va'], sharedLetter: true }
const ACTOR = { userId: 'u-1', role: 'estimator', path: 'board' as const }
const TODAY = '2026-09-06'

beforeEach(() => {
  calls.length = 0
  insertThrows = false
  bidUpdateApplies = true
  versionRows = [
    { id: 'va', outcome: null, outcome_at: null, loss_category: null },
    { id: 'vb', outcome: null, outcome_at: null, loss_category: null },
    { id: 'vc', outcome: null, outcome_at: null, loss_category: null },
  ]
  handler = defaultHandler
  recordNavClick.mockClear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-06T17:00:00Z')) // noon in Chicago
})
afterEach(() => vi.useRealTimers())

describe('marking a packet lost', () => {
  it('writes the packet, leaves the bid alone while another packet is still waiting, records telemetry, no note', async () => {
    const res = await setGcPacketOutcome({ bidId: 'bid-1', bidOutcome: null, versionIds: ['va'], outcome: 'lost', packetsAfter: [{ ...A, outcome: 'lost' }, B], actor: ACTOR })
    expect(res).toEqual({ error: null, bidOutcomeSet: null, autoLost: [] })
    expect(writes()).toEqual(['bid_versions:update'])
    expect(first(calls[0]!).args).toEqual([{ outcome: 'lost', outcome_at: TODAY }]) // loss keeps any loss_category
    expect(arg(calls[0]!, 'in')).toEqual(['id', ['va']])
    expect(recordNavClick).toHaveBeenCalledWith('u-1', 'estimator', 'bid_outcome_set', '#board:lost')
    expect(peekWonCascadeSnapshot('bid-1')).toBeNull()
  })

  it('the last sent packet lost rolls the bid to Lost — unless the bid was already decided by hand', async () => {
    const res = await setGcPacketOutcome({ bidId: 'bid-1', bidOutcome: null, versionIds: ['vb'], outcome: 'lost', packetsAfter: [{ ...A, outcome: 'lost' }, { ...B, outcome: 'lost' }, C] })
    expect(res.bidOutcomeSet).toBe('lost')
    expect(writes()).toEqual(['bid_versions:update', 'bids:update'])
    expect(first(calls[1]!).args).toEqual([{ outcome: 'lost' }])
    expect(arg(calls[1]!, 'eq')).toEqual(['id', 'bid-1'])
    expect(recordNavClick).not.toHaveBeenCalled() // no actor → no telemetry

    calls.length = 0
    const decided = await setGcPacketOutcome({ bidId: 'bid-1', bidOutcome: 'started_or_complete', versionIds: ['vb'], outcome: 'lost', packetsAfter: [{ ...A, outcome: 'lost' }, { ...B, outcome: 'lost' }] })
    expect(decided.bidOutcomeSet).toBeNull()
    expect(writes()).toEqual(['bid_versions:update'])
  })

  it('clearing a lost packet back to waiting resets its date and reason, with no cascade', async () => {
    const res = await setGcPacketOutcome({ bidId: 'bid-1', bidOutcome: null, versionIds: ['va'], outcome: null, previousOutcome: 'lost', packetsAfter: [A, B], actor: ACTOR })
    expect(res).toEqual({ error: null, bidOutcomeSet: null, autoLost: [] })
    expect(writes()).toEqual(['bid_versions:update'])
    expect(first(calls[0]!).args).toEqual([{ outcome: null, outcome_at: null, loss_category: null }])
    expect(recordNavClick).toHaveBeenCalledWith('u-1', 'estimator', 'bid_outcome_set', '#board:waiting')
  })

  it('a failed packet write returns the message and stops', async () => {
    handler = () => ({ data: null, error: { message: 'row fenced' } })
    const res = await setGcPacketOutcome({ bidId: 'bid-1', bidOutcome: null, versionIds: ['va'], outcome: 'lost', packetsAfter: [{ ...A, outcome: 'lost' }] })
    expect(res).toEqual({ error: 'row fenced', bidOutcomeSet: null, autoLost: [] })
    expect(calls).toHaveLength(1)
  })
})

describe('marking a packet won — the cascade', () => {
  it('snapshots first, writes the winner, auto-loses the sent unanswered siblings, rolls the bid, notes it, and keeps the snapshot for undo', async () => {
    const res = await setGcPacketOutcome({ bidId: 'bid-1', bidOutcome: null, versionIds: ['va'], outcome: 'won', packetsAfter: [{ ...A, outcome: 'won' }, B, C, S], actor: ACTOR })
    expect(res).toEqual({ error: null, bidOutcomeSet: 'won', autoLost: ['Burd'] })

    // 1. read the rows the cascade will touch — the winner and the auto-lost sibling, not the unsent or shared ones
    expect(method(calls[0]!)).toBe('select')
    expect(arg(calls[0]!, 'in')).toEqual(['id', ['va', 'vb']])
    // 2. winner, 3. sibling, 4. bid, 5. note
    expect(writes()).toEqual(['bid_versions:update', 'bid_versions:update', 'bids:update', 'bids_submission_entries:insert'])
    expect(first(calls[1]!).args).toEqual([{ outcome: 'won', outcome_at: TODAY, loss_category: null }])
    expect(arg(calls[1]!, 'in')).toEqual(['id', ['va']])
    expect(first(calls[2]!).args).toEqual([{ outcome: 'lost', outcome_at: TODAY }]) // no loss_category: inferred "GC lost the project"
    expect(arg(calls[2]!, 'in')).toEqual(['id', ['vb']])
    expect(first(calls[3]!).args).toEqual([{ outcome: 'won' }])
    const note = first(calls[4]!).args[0] as Record<string, unknown>
    expect(note).toMatchObject({ bid_id: 'bid-1', gc_customer_id: 'gc-a', created_by: 'u-1', contact_method: null })
    expect(note.notes).toBe('Marked Won via packet — Acme · siblings marked Lost: Burd (GC lost the project) · bid marked Won.')
    expect(recordNavClick).toHaveBeenCalledWith('u-1', 'estimator', 'bid_outcome_set', '#board:won')

    const snap = peekWonCascadeSnapshot('bid-1')
    expect(snap).toMatchObject({ bidId: 'bid-1', targetKey: 'gc-a', targetVersionIds: ['va'], autoLostNames: ['Burd'], bidOutcomeBefore: null, bidOutcomeWritten: true, source: 'session' })
    expect(snap?.versions.map((v) => v.id)).toEqual(['va', 'vb'])
  })

  it('a win over a hand-set Lost overrides it and says so in the note', async () => {
    await setGcPacketOutcome({ bidId: 'bid-1', bidOutcome: 'lost', versionIds: ['va'], outcome: 'won', packetsAfter: [{ ...A, outcome: 'won' }], actor: ACTOR })
    const note = calls.find((c) => c.table === 'bids_submission_entries')!
    expect((first(note).args[0] as { notes: string }).notes).toBe('Marked Won via packet — Acme · bid Lost → Won.')
    expect(peekWonCascadeSnapshot('bid-1')?.bidOutcomeBefore).toBe('lost')
  })

  it('a bid already Won or Started is not rolled again; the packet still records', async () => {
    const res = await setGcPacketOutcome({ bidId: 'bid-1', bidOutcome: 'started_or_complete', versionIds: ['va'], outcome: 'won', packetsAfter: [{ ...A, outcome: 'won' }, B] })
    expect(res).toEqual({ error: null, bidOutcomeSet: null, autoLost: ['Burd'] })
    expect(writes()).toEqual(['bid_versions:update', 'bid_versions:update'])
    expect(peekWonCascadeSnapshot('bid-1')?.bidOutcomeWritten).toBe(false)
  })

  it('a bid update that touches no rows (RLS) is reported, after the packets were already written', async () => {
    bidUpdateApplies = false
    const res = await setGcPacketOutcome({ bidId: 'bid-1', bidOutcome: null, versionIds: ['va'], outcome: 'won', packetsAfter: [{ ...A, outcome: 'won' }, B], actor: ACTOR })
    expect(res).toEqual({ error: BID_UPDATE_NOT_APPLIED_MESSAGE, bidOutcomeSet: null, autoLost: ['Burd'] })
    expect(writes()).toEqual(['bid_versions:update', 'bid_versions:update', 'bids:update'])
    expect(recordNavClick).not.toHaveBeenCalled()
  })

  it('a note that fails to land costs only the note; a shared-letter target gets no gc_customer_id', async () => {
    insertThrows = true
    const res = await setGcPacketOutcome({ bidId: 'bid-1', bidOutcome: null, versionIds: ['va'], outcome: 'won', packetsAfter: [{ ...S, outcome: 'won' }], actor: ACTOR })
    expect(res).toEqual({ error: null, bidOutcomeSet: 'won', autoLost: [] })
    expect(recordNavClick).toHaveBeenCalledWith('u-1', 'estimator', 'bid_outcome_set', '#board:won')
    insertThrows = false
    calls.length = 0
    await setGcPacketOutcome({ bidId: 'bid-2', bidOutcome: null, versionIds: ['va'], outcome: 'won', packetsAfter: [{ ...S, outcome: 'won' }], actor: ACTOR })
    const note = calls.find((c) => c.table === 'bids_submission_entries')!
    expect((first(note).args[0] as { gc_customer_id: unknown }).gc_customer_id).toBeNull()
  })
})

describe('undoing a win ("↩ waiting" on the winner)', () => {
  it('with this session\'s snapshot: clears the winner, restores the siblings in one write per prior state, un-rolls the bid, notes and clears the snapshot', async () => {
    await setGcPacketOutcome({ bidId: 'bid-1', bidOutcome: null, versionIds: ['va'], outcome: 'won', packetsAfter: [{ ...A, outcome: 'won' }, B], actor: ACTOR })
    calls.length = 0
    recordNavClick.mockClear()

    const res = await setGcPacketOutcome({ bidId: 'bid-1', bidOutcome: 'won', versionIds: ['va'], outcome: null, previousOutcome: 'won', packetsAfter: [A, { ...B, outcome: 'lost' }], actor: ACTOR })
    expect(res).toEqual({ error: null, bidOutcomeSet: null, autoLost: [], undone: { restoredSiblings: ['Burd'], bidOutcomeRestoredTo: null } })
    expect(writes()).toEqual(['bid_versions:update', 'bid_versions:update', 'bids:update', 'bids_submission_entries:insert'])
    expect(first(calls[0]!).args).toEqual([{ outcome: null, outcome_at: null, loss_category: null }])
    expect(arg(calls[0]!, 'in')).toEqual(['id', ['va']])
    expect(first(calls[1]!).args).toEqual([{ outcome: null, outcome_at: null, loss_category: null }]) // Burd back to what it was
    expect(arg(calls[1]!, 'in')).toEqual(['id', ['vb']])
    expect(first(calls[2]!).args).toEqual([{ outcome: null }])
    expect(calls[2]!.steps.filter((s) => s.method === 'eq').map((s) => s.args)).toEqual([['id', 'bid-1'], ['outcome', 'won']]) // only un-roll a bid that still reads won
    expect((first(calls[3]!).args[0] as { notes: string }).notes).toBe('Won undone via packet — Acme back to waiting · Burd back to waiting · bid back to Not set.')
    expect(recordNavClick).toHaveBeenCalledWith('u-1', 'estimator', 'bid_outcome_set', '#board:undone')
    expect(peekWonCascadeSnapshot('bid-1')).toBeNull()
  })

  it('a bid changed by hand since the win is left alone (zero rows → restoredTo undefined)', async () => {
    await setGcPacketOutcome({ bidId: 'bid-1', bidOutcome: null, versionIds: ['va'], outcome: 'won', packetsAfter: [{ ...A, outcome: 'won' }] })
    bidUpdateApplies = false
    const res = await setGcPacketOutcome({ bidId: 'bid-1', bidOutcome: 'lost', versionIds: ['va'], outcome: null, previousOutcome: 'won', packetsAfter: [A] })
    expect(res.undone).toEqual({ restoredSiblings: [], bidOutcomeRestoredTo: undefined })
  })

  it('without a snapshot (a reload) it reads the rows BEFORE clearing the winner and infers the cascade', async () => {
    versionRows = [
      { id: 'va', outcome: 'won', outcome_at: TODAY, loss_category: null },
      { id: 'vb', outcome: 'lost', outcome_at: TODAY, loss_category: null },
    ]
    const res = await setGcPacketOutcome({ bidId: 'bid-9', bidOutcome: 'won', versionIds: ['va'], outcome: null, previousOutcome: 'won', packetsAfter: [{ ...A, outcome: 'won' }, { ...B, outcome: 'lost' }] })
    expect(res.error).toBeNull()
    expect(res.undone).toBeDefined()
    expect(method(calls[0]!)).toBe('select')
    expect(arg(calls[0]!, 'in')).toEqual(['id', ['va', 'vb']])
    expect(method(calls[1]!)).toBe('update') // the winner is cleared only after the read
  })

  it('a snapshot taken for a different packet of the same bid is not reused', async () => {
    await setGcPacketOutcome({ bidId: 'bid-1', bidOutcome: null, versionIds: ['va'], outcome: 'won', packetsAfter: [{ ...A, outcome: 'won' }, B] })
    calls.length = 0
    await setGcPacketOutcome({ bidId: 'bid-1', bidOutcome: 'won', versionIds: ['vb'], outcome: null, previousOutcome: 'won', packetsAfter: [A, { ...B, outcome: 'won' }] })
    expect(method(calls[0]!)).toBe('select') // fell back to inference instead of trusting the stale snapshot
  })
})

describe('setGcPacketLossCategory', () => {
  it('refuses an empty packet, writes the category (and note when given), and passes errors through', async () => {
    expect(await setGcPacketLossCategory({ versionIds: [], category: 'price' })).toEqual({ error: 'No packet to write to.' })
    expect(calls).toHaveLength(0)
    expect(await setGcPacketLossCategory({ versionIds: ['va', 'vb'], category: 'price' })).toEqual({ error: null })
    expect(first(calls[0]!).args).toEqual([{ loss_category: 'price' }])
    expect(arg(calls[0]!, 'in')).toEqual(['id', ['va', 'vb']])
    await setGcPacketLossCategory({ versionIds: ['va'], category: 'scope', note: 'went with a bigger shop' })
    expect(first(calls[1]!).args).toEqual([{ loss_category: 'scope', outcome_note: 'went with a bigger shop' }])
    handler = () => ({ data: null, error: { message: 'nope' } })
    expect(await setGcPacketLossCategory({ versionIds: ['va'], category: 'price' })).toEqual({ error: 'nope' })
  })
})
