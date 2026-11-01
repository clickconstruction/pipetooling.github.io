import { describe, expect, it } from 'vitest'
import { appTzWallTimeMs } from '../utils/dateUtils'
import type { LandOutcome } from '../lib/offline/landFieldPress'
import { DEPENDENCY_REFUSED_MESSAGE, markTryFailed, markSending, newPress, type FieldReportPayload, type OutboxPress } from '../lib/offline/outbox'
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

// Punch list #229, PR 6: a kept report's photos go out before the report.
describe('replayOutbox, a report with photos', () => {
  const photo = (id: string, sent = false) => ({ id, sent, fixtureId: null, stageName: null, caption: 'Photo', questionId: null, questionWords: null, takenAt: '2026-11-01T13:00:00Z', bytes: 1, originalBytes: 1, width: 1, height: 1, byName: '' })
  const report = (photos: ReturnType<typeof photo>[]) =>
    newPress({ id: 'p-rep', seq: 1, kind: 'field-report', userId: 'u1', pressedAt: at(8, 30), payload: { templateId: 't', fieldValues: {}, jobLedgerId: 'j1', projectId: null, bidId: null, lat: null, lng: null, photos } })

  it('sends the kept photos first, then lands the report with its photos marked sent', async () => {
    const s = store([report([photo('a'), photo('b', true)])])
    const order: string[] = []
    const sendKept = async (p: OutboxPress, st: typeof s) => {
      order.push('photos')
      const fresh: OutboxPress = { ...p, payload: { ...(p.payload as FieldReportPayload), photos: [photo('a', true), photo('b', true)] } }
      st.put(fresh)
      return { ok: true as const }
    }
    const land = async (p: OutboxPress): Promise<LandOutcome> => {
      order.push(`land:${(p.payload as { photos: { sent: boolean }[] }).photos.map((x) => x.sent).join(',')}`)
      return { kind: 'landed', result: { report_id: 'r1' } }
    }
    const after = { invokeFunction: async () => {}, stampMovedLines: async () => {}, propagateReportPct: async () => {} }
    await replayOutbox({ store: s, land, sendKept, after, online: () => true, now: () => at(9, 42) })
    expect(order).toEqual(['photos', 'land:true,true'])
    expect(s.presses()[0]?.state).toBe('sent')
  })

  it('a photo that does not send counts as the press’s failed try, and the report is not landed', async () => {
    const s = store([report([photo('a')])])
    let landed = 0
    const land = async (): Promise<LandOutcome> => {
      landed++
      return { kind: 'landed', result: {} }
    }
    await replayOutbox({ store: s, land, sendKept: async () => ({ ok: false as const, error: new TypeError('Failed to fetch') }), online: () => true, now: () => at(9, 42) })
    expect(landed).toBe(0)
    expect(s.presses()[0]?.state).toBe('waiting')
    expect(s.presses()[0]?.attempts).toBe(1)
  })

  it('a report whose photos all sent already goes straight to the server', async () => {
    const s = store([report([photo('a', true)])])
    let kept = 0
    const land = async (): Promise<LandOutcome> => ({ kind: 'landed', result: { report_id: 'r1' } })
    const after = { invokeFunction: async () => {}, stampMovedLines: async () => {}, propagateReportPct: async () => {} }
    await replayOutbox({ store: s, land, after, sendKept: async () => { kept++; return { ok: true as const } }, online: () => true, now: () => at(9, 42) })
    expect(kept).toBe(0)
    expect(s.presses()[0]?.state).toBe('sent')
  })
})
