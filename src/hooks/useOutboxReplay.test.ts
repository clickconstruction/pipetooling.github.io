import { describe, expect, it } from 'vitest'
import { appTzWallTimeMs } from '../utils/dateUtils'
import type { LandOutcome } from '../lib/offline/landFieldPress'
import { DEPENDENCY_REFUSED_MESSAGE, markTryFailed, markSending, newPress, type OutboxPress } from '../lib/offline/outbox'
import { createOutboxState } from '../lib/offline/outboxState'
import { replayOutbox } from './useOutboxReplay'

const DAY = '2026-10-29'
const at = (h: number, m: number) => appTzWallTimeMs(DAY, h, m)

function store(presses: OutboxPress[] = []) {
  const s = createOutboxState({ readAll: async () => [], write: async () => {}, del: async () => {}, clear: async () => {} })
  for (const p of presses) s.put(p)
  return s
}

const clockIn = newPress({ id: 'p-in', seq: 1, kind: 'clock-in', userId: 'u1', pressedAt: at(7, 58), payload: { jobLedgerId: 'j1', bidId: null, notes: '', travel: null } })
const note = newPress({ id: 'p-note', seq: 2, kind: 'job-note', userId: 'u1', pressedAt: at(8, 12), payload: { jobId: 'j1', body: 'Slab is poured.' } })
const clockOut = newPress({
  id: 'p-out',
  seq: 3,
  kind: 'clock-out',
  userId: 'u1',
  pressedAt: at(9, 0),
  payload: { sessionId: null, sessionPressId: 'p-in', jobLedgerId: 'j1', bidId: null, notes: '' },
  dependsOn: 'p-in',
})

describe('replayOutbox', () => {
  it('sends what waits in order, one at a time, and marks each sent with the server’s answer', async () => {
    const s = store([note, clockIn, clockOut])
    const sent: string[] = []
    const land = async (p: OutboxPress): Promise<LandOutcome> => {
      sent.push(p.id)
      expect(p.state).toBe('sending')
      return { kind: 'landed', result: { id: p.id } }
    }
    await replayOutbox({ store: s, land, online: () => true, now: () => at(9, 42) })
    expect(sent).toEqual(['p-in', 'p-note', 'p-out'])
    expect(s.presses().map((p) => [p.id, p.state, p.sentAt])).toEqual([
      ['p-in', 'sent', at(9, 42)],
      ['p-note', 'sent', at(9, 42)],
      ['p-out', 'sent', at(9, 42)],
    ])
  })

  it('a failed try stops the run: the rest wait with it, and the press counts its try', async () => {
    const s = store([clockIn, note])
    const sent: string[] = []
    const land = async (p: OutboxPress): Promise<LandOutcome> => {
      sent.push(p.id)
      return { kind: 'failed', error: new TypeError('Load failed') }
    }
    await replayOutbox({ store: s, land, online: () => true, now: () => at(9, 42) })
    expect(sent).toEqual(['p-in'])
    const first = s.presses()[0]!
    expect(first.state).toBe('waiting')
    expect(first.attempts).toBe(1)
    expect(first.lastTriedAt).toBe(at(9, 42))
    expect(s.presses()[1]?.attempts).toBe(0)
  })

  it('a refusal keeps the press with the reason and the run goes on; a clock-out behind a refused clock-in is refused with it', async () => {
    const s = store([clockIn, note, clockOut])
    const sent: string[] = []
    const land = async (p: OutboxPress): Promise<LandOutcome> => {
      sent.push(p.id)
      if (p.id === 'p-in') return { kind: 'refused', refusal: { message: 'You were already clocked in at 7:30 AM.', code: 'P0001' } }
      return { kind: 'landed', result: {} }
    }
    await replayOutbox({ store: s, land, online: () => true, now: () => at(9, 42) })
    expect(sent).toEqual(['p-in', 'p-note'])
    const byId = new Map(s.presses().map((p) => [p.id, p]))
    expect(byId.get('p-in')?.state).toBe('refused')
    expect(byId.get('p-in')?.refusal?.message).toBe('You were already clocked in at 7:30 AM.')
    expect(byId.get('p-note')?.state).toBe('sent')
    expect(byId.get('p-out')?.state).toBe('refused')
    expect(byId.get('p-out')?.refusal?.message).toBe(DEPENDENCY_REFUSED_MESSAGE)
  })

  it('does nothing offline, and nothing before a failed press’s next try is due', async () => {
    let tries = 0
    const land = async (): Promise<LandOutcome> => {
      tries += 1
      return { kind: 'landed', result: {} }
    }
    await replayOutbox({ store: store([clockIn]), land, online: () => false, now: () => at(9, 42) })
    expect(tries).toBe(0)
    const tried = markTryFailed(markSending(clockIn, at(9, 42)), at(9, 42))
    await replayOutbox({ store: store([tried]), land, online: () => true, now: () => at(9, 42) + 2_000 })
    expect(tries).toBe(0)
    await replayOutbox({ store: store([tried]), land, online: () => true, now: () => at(9, 42) + 5_000 })
    expect(tries).toBe(1)
  })

  it('a press dropped while in flight (a sign-out) records nothing', async () => {
    const s = store([clockIn])
    const land = async (): Promise<LandOutcome> => {
      await s.clear()
      return { kind: 'landed', result: {} }
    }
    await replayOutbox({ store: s, land, online: () => true, now: () => at(9, 42) })
    expect(s.presses()).toEqual([])
  })
})
