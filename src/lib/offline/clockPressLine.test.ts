import { describe, expect, it } from 'vitest'
import { appTzWallTimeMs, formatDenverTimeOnly } from '../../utils/dateUtils'
import { clockPressLineWords } from './clockPressLine'
import { markRefused, markSending, markSent, newPress } from './outbox'
import { pendingOpenSession, pressIdOfSession, pressSessionId } from './pendingSession'

const DAY = '2026-10-29'
const at = (h: number, m: number) => appTzWallTimeMs(DAY, h, m)
const fmt = formatDenverTimeOnly

const clockIn = newPress({ id: 'p-in', seq: 1, kind: 'clock-in' as const, userId: 'u1', pressedAt: at(7, 58), payload: { jobLedgerId: 'j1', bidId: null, notes: 'Rough in', travel: 'on-site' as const } })
const note = newPress({ id: 'p-note', seq: 2, kind: 'job-note' as const, userId: 'u1', pressedAt: at(8, 12), payload: { jobId: 'j1', body: 'x' } })

describe('clockPressLineWords · the line beside the clock', () => {
  it('is nothing when no clock press went through the queue', () => {
    expect(clockPressLineWords([], at(9, 0))).toBeNull()
    expect(clockPressLineWords([note], at(9, 0))).toBeNull()
  })

  it('amber while waiting, then sending', () => {
    expect(clockPressLineWords([clockIn], at(8, 0))).toEqual({ tone: 'amber', text: `Clock in pressed at ${fmt(at(7, 58))} · waiting to send`, fix: false, pressId: 'p-in' })
    expect(clockPressLineWords([markSending(clockIn, at(8, 0))], at(8, 0))?.text).toBe(`Clock in pressed at ${fmt(at(7, 58))} · sending…`)
  })

  it('green once it landed, for the day', () => {
    const words = clockPressLineWords([markSent(clockIn, {}, at(8, 11))], at(15, 0))
    expect(words).toEqual({ tone: 'green', text: `Clock in ${fmt(at(7, 58))} · sent ${fmt(at(8, 11))} ✓`, fix: false, pressId: 'p-in' })
  })

  it('red with Fix when the office refused it or it waited past the morning', () => {
    const refused = clockPressLineWords([markRefused(clockIn, { message: 'No.', code: null })], at(9, 0))
    expect(refused?.tone).toBe('red')
    expect(refused?.fix).toBe(true)
    expect(refused?.text).toBe(`Clock in ${fmt(at(7, 58))} · could not be sent`)
    expect(clockPressLineWords([clockIn], appTzWallTimeMs('2026-10-30', 6, 30))?.tone).toBe('red')
  })

  it('speaks for the newest clock press', () => {
    const out = newPress({ id: 'p-out', seq: 3, kind: 'clock-out' as const, userId: 'u1', pressedAt: at(16, 6), payload: { sessionId: 's1', sessionPressId: null, jobLedgerId: 'j1', bidId: null, notes: '' } })
    expect(clockPressLineWords([markSent(clockIn, {}, at(8, 11)), out], at(16, 7))?.text).toBe(`Clock out pressed at ${fmt(at(16, 6))} · waiting to send`)
  })
})

describe('pendingSession · a clock-in still on the phone, as the clock draws it', () => {
  it('carries the press id under a prefix the clock-out reads back', () => {
    expect(pressSessionId('p-in')).toBe('press:p-in')
    expect(pressIdOfSession('press:p-in')).toBe('p-in')
    expect(pressIdOfSession('a-real-uuid')).toBeNull()
    expect(pressIdOfSession(null)).toBeNull()
  })

  it('draws the pressed moment as the start, with the press’s job and notes', () => {
    const row = pendingOpenSession(clockIn)
    expect(row.id).toBe('press:p-in')
    expect(row.clocked_in_at).toBe(new Date(at(7, 58)).toISOString())
    expect(row.clocked_out_at).toBeNull()
    expect(row.work_date).toBe(DAY)
    expect(row.job_ledger_id).toBe('j1')
    expect(row.notes).toBe('Rough in')
  })
})
