import { describe, expect, it } from 'vitest'
import { companyYmdOf, computeJobPctToday, parsePctCompleteNoteBody } from './jobPctDayDelta'

describe('parsePctCompleteNoteBody', () => {
  it('parses the stagesPctNote body forms', () => {
    expect(parsePctCompleteNoteBody('45% complete — hung fixtures')).toBe(45)
    expect(parsePctCompleteNoteBody('100% complete')).toBe(100)
    expect(parsePctCompleteNoteBody('  60% complete — t/m  ')).toBe(60)
  })

  it('rejects non-pct notes and out-of-range values', () => {
    expect(parsePctCompleteNoteBody('called the GC about 45% complete work')).toBeNull()
    expect(parsePctCompleteNoteBody('45%complete')).toBeNull()
    expect(parsePctCompleteNoteBody('145% complete')).toBeNull()
    expect(parsePctCompleteNoteBody('leaving job')).toBeNull()
  })
})

describe('companyYmdOf', () => {
  it('uses the company calendar day, not UTC', () => {
    // 2026-08-08T03:00Z is still Aug 7 in Chicago (CDT, UTC-5).
    expect(companyYmdOf('2026-08-08T03:00:00Z')).toBe('2026-08-07')
    expect(companyYmdOf('garbage')).toBeNull()
  })
})

describe('computeJobPctToday', () => {
  const TODAY = '2026-08-11'
  const note = (job_id: string, body: string, created_at: string) => ({ job_id, body, created_at })

  it('delta = current − latest note before today; today’s notes do not move the baseline', () => {
    const out = computeJobPctToday(
      new Map([['j1', { pct: 62, status: 'working' }]]),
      [
        note('j1', '35% complete — rough in', '2026-08-05T20:00:00Z'),
        note('j1', '49% complete', '2026-08-10T22:00:00Z'),
        note('j1', '55% complete — mid-day', '2026-08-11T16:00:00Z'),
      ],
      TODAY,
    )
    expect(out.get('j1')).toEqual({ pct: 62, delta: 13 })
  })

  it('first-ever note today baselines at 0; no notes at all leaves delta unknown', () => {
    const out = computeJobPctToday(
      new Map([
        ['fresh', { pct: 40, status: 'working' }],
        ['silent', { pct: 30, status: 'working' }],
      ]),
      [note('fresh', '40% complete', '2026-08-11T15:00:00Z')],
      TODAY,
    )
    expect(out.get('fresh')).toEqual({ pct: 40, delta: 40 })
    expect(out.get('silent')).toEqual({ pct: 30, delta: null })
  })

  it('downward corrections yield negative deltas; unchanged jobs read 0', () => {
    const out = computeJobPctToday(
      new Map([
        ['down', { pct: 20, status: 'working' }],
        ['flat', { pct: 75, status: 'working' }],
      ]),
      [
        note('down', '35% complete', '2026-08-09T12:00:00Z'),
        note('flat', '75% complete', '2026-08-01T12:00:00Z'),
      ],
      TODAY,
    )
    expect(out.get('down')).toEqual({ pct: 20, delta: -15 })
    expect(out.get('flat')).toEqual({ pct: 75, delta: 0 })
  })

  it('ignores unparseable or future notes', () => {
    const out = computeJobPctToday(
      new Map([['j2', { pct: 50, status: 'working' }]]),
      [
        note('j2', 'leaving job', '2026-08-10T12:00:00Z'),
        note('j2', '45% complete', '2026-08-12T12:00:00Z'), // after today — ignored
        note('j2', '30% complete', '2026-08-10T12:00:00Z'),
      ],
      TODAY,
    )
    expect(out.get('j2')).toEqual({ pct: 50, delta: 20 })
  })

  it('null pct falls back to 0 (100 when Paid in Full), always with no delta', () => {
    const out = computeJobPctToday(
      new Map([
        ['never-set', { pct: null, status: 'working' }],
        ['paid-null', { pct: null, status: 'paid' }],
        ['no-status', { pct: null, status: null }],
      ]),
      // A stray % note must not invent a delta for a synthesized value.
      [note('never-set', '30% complete', '2026-08-10T12:00:00Z')],
      TODAY,
    )
    expect(out.get('never-set')).toEqual({ pct: 0, delta: null })
    expect(out.get('paid-null')).toEqual({ pct: 100, delta: null })
    expect(out.get('no-status')).toEqual({ pct: 0, delta: null })
  })

  it('a recorded pct on a paid job wins over the fallback', () => {
    const out = computeJobPctToday(new Map([['paid-real', { pct: 90, status: 'paid' }]]), [], TODAY)
    expect(out.get('paid-real')).toEqual({ pct: 90, delta: null })
  })
})
