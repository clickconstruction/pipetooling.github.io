import { describe, expect, it } from 'vitest'
import { appTzWallTimeMs } from '../../utils/dateUtils'
import type { LandOutcome } from './landFieldPress'
import type { OutboxPress } from './outbox'
import { createOutboxState } from './outboxState'
import { mintPressId, pressThroughOutbox } from './pressThroughOutbox'

const T = appTzWallTimeMs('2026-10-29', 7, 58)

function store() {
  return createOutboxState({ readAll: async () => [], write: async () => {}, del: async () => {}, clear: async () => {} })
}

const clockIn = {
  kind: 'clock-in' as const,
  userId: 'u1',
  pressedAt: T,
  payload: { jobLedgerId: 'j1', bidId: null, notes: 'Rough in', travel: 'on-site' as const },
  about: 'Ridgeway Builders',
  door: '/dashboard',
}

describe('pressThroughOutbox', () => {
  it('mints an id once per press, in the uuid shape', () => {
    const a = mintPressId()
    const b = mintPressId()
    expect(a).toMatch(/^[0-9a-f-]{36}$/)
    expect(a).not.toBe(b)
  })

  it('offline: kept at once, without a try', async () => {
    const s = store()
    let tries = 0
    const land = async (): Promise<LandOutcome> => {
      tries += 1
      return { kind: 'landed', result: {} }
    }
    const out = await pressThroughOutbox(clockIn, { store: s, land, online: () => false, now: () => T })
    expect(out.kind).toBe('queued')
    expect(tries).toBe(0)
    expect(s.presses()).toHaveLength(1)
    expect(s.presses()[0]?.state).toBe('waiting')
    expect(s.presses()[0]?.pressedAt).toBe(T)
    expect(s.presses()[0]?.attempts).toBe(0)
  })

  it('online and the send lands: the answer comes back and nothing is kept', async () => {
    const s = store()
    const seen: OutboxPress[] = []
    const land = async (p: OutboxPress): Promise<LandOutcome> => {
      seen.push(p)
      return { kind: 'landed', result: { session_id: 's1' } }
    }
    const out = await pressThroughOutbox(clockIn, { store: s, land, online: () => true, now: () => T })
    expect(out).toEqual({ kind: 'landed', result: { session_id: 's1' } })
    expect(s.presses()).toEqual([])
    expect(seen[0]?.state).toBe('sending')
    expect(seen[0]?.attempts).toBe(1)
  })

  it('online and the send fails at the fetch layer: kept with one try counted, the same id for the next', async () => {
    const s = store()
    const seen: OutboxPress[] = []
    const land = async (p: OutboxPress): Promise<LandOutcome> => {
      seen.push(p)
      return { kind: 'failed', error: new TypeError('Load failed') }
    }
    const out = await pressThroughOutbox(clockIn, { store: s, land, online: () => true, now: () => T + 1000 })
    expect(out.kind).toBe('queued')
    const kept = s.presses()[0]
    expect(kept?.id).toBe(seen[0]?.id)
    expect(kept?.state).toBe('waiting')
    expect(kept?.attempts).toBe(1)
    expect(kept?.lastTriedAt).toBe(T + 1000)
  })

  it('the server refuses: the reason comes back and nothing is kept', async () => {
    const s = store()
    const land = async (): Promise<LandOutcome> => ({ kind: 'refused', refusal: { message: 'You were already clocked in at 7:30 AM.', code: 'P0001' } })
    const out = await pressThroughOutbox(clockIn, { store: s, land, online: () => true, now: () => T })
    expect(out).toEqual({ kind: 'refused', message: 'You were already clocked in at 7:30 AM.', code: 'P0001' })
    expect(s.presses()).toEqual([])
  })

  it('forceQueue keeps the press behind one already waiting, with no try', async () => {
    const s = store()
    let tries = 0
    const land = async (): Promise<LandOutcome> => {
      tries += 1
      return { kind: 'landed', result: {} }
    }
    await pressThroughOutbox(clockIn, { store: s, land, online: () => false, now: () => T })
    const first = s.presses()[0]!
    const out = await pressThroughOutbox(
      { kind: 'clock-out', userId: 'u1', pressedAt: T + 60_000, payload: { sessionId: null, sessionPressId: first.id, jobLedgerId: 'j1', bidId: null, notes: '' }, dependsOn: first.id },
      { store: s, land, online: () => true, now: () => T + 60_000, forceQueue: true },
    )
    expect(out.kind).toBe('queued')
    expect(tries).toBe(0)
    expect(s.presses().map((p) => p.kind)).toEqual(['clock-in', 'clock-out'])
    expect(s.presses()[1]?.seq).toBe(2)
  })

  it('with the queue off for the session (impersonation), a failed send is handed back and nothing is kept', async () => {
    const s = store()
    const error = new TypeError('Load failed')
    const land = async (): Promise<LandOutcome> => ({ kind: 'failed', error })
    const out = await pressThroughOutbox(clockIn, { store: s, land, online: () => false, now: () => T, allowed: false })
    expect(out).toEqual({ kind: 'failed', error })
    expect(s.presses()).toEqual([])
  })
})
