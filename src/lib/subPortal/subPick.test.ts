import { describe, expect, it } from 'vitest'
// Deno edge module (supabase/functions/_shared) — dependency-free, tested here.
import { canChangePick, evaluatePick, pickChangeDeadline, pickEndFromStart, pickProblemMessage, pickWindowFor, pickableStarts } from '../../../supabase/functions/_shared/subPick'

const WIN = { start: '2026-09-22', end: '2026-10-02' } // Tue → Fri the next week

describe('subPick', () => {
  it('derives the end from a start and working days, skipping weekends', () => {
    expect(pickEndFromStart('2026-09-22', 2)).toBe('2026-09-23')
    expect(pickEndFromStart('2026-09-25', 2)).toBe('2026-09-28') // Fri + Mon
    expect(pickEndFromStart('2026-09-22', 1)).toBe('2026-09-22')
    expect(pickEndFromStart('2026-09-22', null)).toBe('2026-09-22')
  })

  it('takes the stage window first, the order span second, nothing third', () => {
    expect(pickWindowFor({ window_start: '2026-09-22', window_end: '2026-10-02', proposed_start: '2026-09-01', proposed_end: '2026-09-05' })).toEqual(WIN)
    expect(pickWindowFor({ proposed_start: '2026-09-01', proposed_end: '2026-09-05' })).toEqual({ start: '2026-09-01', end: '2026-09-05' })
    expect(pickWindowFor({ proposed_start: '2026-09-05', proposed_end: '2026-09-01' })).toBeNull()
    expect(pickWindowFor({})).toBeNull()
  })

  it('accepts a weekday start inside the window and refuses the rest', () => {
    expect(evaluatePick({ window: WIN, start: '2026-09-22', end: '2026-09-23', todayYmd: '2026-09-05' })).toEqual({ ok: true, start: '2026-09-22', end: '2026-09-23' })
    expect(evaluatePick({ window: WIN, start: '2026-09-21', end: '2026-09-22', todayYmd: '2026-09-05' })).toEqual({ ok: false, reason: 'outside' })
    expect(evaluatePick({ window: WIN, start: '2026-10-01', end: '2026-10-05', todayYmd: '2026-09-05' })).toEqual({ ok: false, reason: 'outside' })
    expect(evaluatePick({ window: WIN, start: '2026-09-26', end: '2026-09-28', todayYmd: '2026-09-05' })).toEqual({ ok: false, reason: 'weekend' })
    expect(evaluatePick({ window: WIN, start: '2026-09-23', end: '2026-09-22', todayYmd: '2026-09-05' })).toEqual({ ok: false, reason: 'order' })
    expect(evaluatePick({ window: WIN, start: '2026-09-22', end: '2026-09-23', todayYmd: '2026-09-23' })).toEqual({ ok: false, reason: 'past' })
    expect(evaluatePick({ window: WIN, start: '9/22', end: '2026-09-23', todayYmd: '2026-09-05' })).toEqual({ ok: false, reason: 'malformed' })
    // no window: any weekday from today on
    expect(evaluatePick({ window: null, start: '2026-11-02', end: '2026-11-03', todayYmd: '2026-09-05' })).toEqual({ ok: true, start: '2026-11-02', end: '2026-11-03' })
  })

  it('lets the sub move their pick until the day before it starts', () => {
    expect(pickChangeDeadline('2026-09-22')).toBe('2026-09-21')
    expect(canChangePick('2026-09-22', '2026-09-21')).toBe(true)
    expect(canChangePick('2026-09-22', '2026-09-22')).toBe(false)
    expect(canChangePick(null, '2026-09-01')).toBe(false)
  })

  it('lists the start days a window really offers for a job of N days', () => {
    // 2-day job: Fri Oct 2 can't start (would end Mon Oct 5, outside); Thu Oct 1 can.
    const starts = pickableStarts(WIN, 2, '2026-09-05')
    expect(starts[0]).toBe('2026-09-22')
    expect(starts).toContain('2026-10-01')
    expect(starts).not.toContain('2026-10-02')
    expect(starts).not.toContain('2026-09-26')
    // today inside the window trims the front
    expect(pickableStarts(WIN, 1, '2026-09-30')[0]).toBe('2026-09-30')
  })

  it('has a sentence for every refusal', () => {
    for (const r of ['outside', 'past', 'weekend', 'order', 'malformed'] as const) expect(pickProblemMessage(r).length).toBeGreaterThan(10)
  })
})
