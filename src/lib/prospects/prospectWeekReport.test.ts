import { describe, expect, it } from 'vitest'
import { buildProspectWeekReport, formatWeekHours, weekRange } from './prospectWeekReport'

// Local-time ISO builder so tests hold in any runner timezone.
function localIso(y: number, m: number, d: number, hh = 12): string {
  return new Date(y, m - 1, d, hh).toISOString()
}

describe('weekRange', () => {
  // Fri 2026-08-28 local noon.
  const NOW = new Date(2026, 7, 28, 12).getTime()

  it('starts on the Monday of the current week and ends the next Monday', () => {
    const r = weekRange(NOW, 0)
    expect(new Date(r.startMs).getDay()).toBe(1)
    expect(r.startMs <= NOW && NOW < r.endMs).toBe(true)
    expect((r.endMs - r.startMs) / 86_400_000).toBe(7)
  })

  it('offset walks back whole weeks', () => {
    const r0 = weekRange(NOW, 0)
    const r1 = weekRange(NOW, 1)
    expect(r1.endMs).toBe(r0.startMs)
    expect((r0.startMs - r1.startMs) / 86_400_000).toBe(7)
  })

  it('handles a Sunday as the last day of the week', () => {
    const sunday = new Date(2026, 7, 30, 12).getTime() // Sun 2026-08-30
    const r = weekRange(sunday, 0)
    expect(r.startMs).toBe(new Date(2026, 7, 24).getTime()) // Mon 08-24
  })
})

describe('buildProspectWeekReport', () => {
  const users = [
    { id: 'u1', name: 'Taunya' },
    { id: 'u2', name: 'Grace' },
  ]

  it('aggregates calls, answers, time, callbacks, and conversions per user', () => {
    const calls = [
      { created_by: 'u1', interaction_type: 'didnt_answer', created_at: localIso(2026, 8, 24) },
      { created_by: 'u1', interaction_type: 'answered', created_at: localIso(2026, 8, 25) },
      { created_by: 'u1', interaction_type: 'converted', created_at: localIso(2026, 8, 25) },
      { created_by: 'u2', interaction_type: 'didnt_answer', created_at: localIso(2026, 8, 25) },
    ]
    const timers = [
      { user_id: 'u1', timer_seconds: 120, created_at: localIso(2026, 8, 24) },
      { user_id: 'u1', timer_seconds: 60, created_at: localIso(2026, 8, 25) },
    ]
    const callbacks = [{ user_id: 'u2', created_at: localIso(2026, 8, 25) }]

    const r = buildProspectWeekReport(calls, timers, callbacks, users)
    expect(r.perUser.map((s) => s.name)).toEqual(['Taunya', 'Grace'])
    const taunya = r.perUser[0]!
    expect(taunya).toMatchObject({ calls: 2, answered: 1, timerSeconds: 180, callbacks: 0, conversions: 1 })
    expect(taunya.answerRate).toBeCloseTo(0.5)
    const grace = r.perUser[1]!
    expect(grace).toMatchObject({ calls: 1, answered: 0, callbacks: 1, conversions: 0 })
    expect(grace.answerRate).toBe(0)
  })

  it('conversions do not count as calls', () => {
    const r = buildProspectWeekReport(
      [{ created_by: 'u1', interaction_type: 'converted', created_at: localIso(2026, 8, 25) }],
      [],
      [],
      users,
    )
    expect(r.perUser[0]).toMatchObject({ calls: 0, conversions: 1, answerRate: null })
  })

  it('totals the team row', () => {
    const r = buildProspectWeekReport(
      [
        { created_by: 'u1', interaction_type: 'answered', created_at: localIso(2026, 8, 25) },
        { created_by: 'u2', interaction_type: 'didnt_answer', created_at: localIso(2026, 8, 26) },
      ],
      [{ user_id: 'u2', timer_seconds: 30, created_at: localIso(2026, 8, 26) }],
      [],
      users,
    )
    expect(r.team).toMatchObject({ name: 'Team', calls: 2, answered: 1, timerSeconds: 30 })
    expect(r.team.answerRate).toBeCloseTo(0.5)
  })

  it('builds daily rows newest day first, names A→Z within a day', () => {
    const r = buildProspectWeekReport(
      [
        { created_by: 'u2', interaction_type: 'answered', created_at: localIso(2026, 8, 24) },
        { created_by: 'u1', interaction_type: 'answered', created_at: localIso(2026, 8, 25) },
        { created_by: 'u2', interaction_type: 'didnt_answer', created_at: localIso(2026, 8, 25) },
      ],
      [],
      [],
      users,
    )
    expect(r.daily.map((d) => `${d.dateKey} ${d.name}`)).toEqual([
      '2026-08-25 Grace',
      '2026-08-25 Taunya',
      '2026-08-24 Grace',
    ])
  })

  it('labels unknown users', () => {
    const r = buildProspectWeekReport(
      [{ created_by: 'ghost', interaction_type: 'answered', created_at: localIso(2026, 8, 25) }],
      [],
      [],
      users,
    )
    expect(r.perUser[0]?.name).toBe('Unknown')
  })
})

describe('formatWeekHours', () => {
  it('formats minutes-only and hours+minutes', () => {
    expect(formatWeekHours(0)).toBe('0m')
    expect(formatWeekHours(59)).toBe('0m')
    expect(formatWeekHours(60)).toBe('1m')
    expect(formatWeekHours(3600)).toBe('1h 00m')
    expect(formatWeekHours(14_700)).toBe('4h 05m')
  })
})
