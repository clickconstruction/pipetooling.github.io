import { describe, expect, it } from 'vitest'
import { buildLienTimeline } from './lienTimeline'
import { lienMonthLines } from './lienMonthLines'

const base = { isSub: true, propertyKind: 'residential', lastMonthFromCreation: false, noticeState: 'awaiting' as const, retainage: null, affidavit: null, originalContractCompletedOn: null, releasedAt: null, paid: false }

describe('lienMonthLines (v2.4707)', () => {
  it('one line per notice month, in the strip\'s words: closed not noted, closed noted, open, not yet open, sent', () => {
    const t = buildLienTimeline({
      ...base,
      todayYmd: '2026-10-06',
      lastMonth: '2026-10',
      months: [
        { key: '2026-06', deadline: '2026-08-17', fromCreation: false, outcome: 'sent', at: '2026-08-10T15:00:00Z' },
        { key: '2026-07', deadline: '2026-09-15', fromCreation: false, outcome: 'missed', at: '' },
        { key: '2026-08', deadline: '2026-10-15', fromCreation: false, outcome: 'open', at: '' },
        { key: '2026-09', deadline: '2026-11-16', fromCreation: false, outcome: 'open', at: '' },
        { key: '2026-10', deadline: '2026-12-15', fromCreation: false, outcome: 'open', at: '' },
      ],
    })
    const lines = lienMonthLines(t)
    expect(lines['2026-06']).toEqual({ words: '§ 53.056 notice sent Aug 10', tone: 'green' })
    expect(lines['2026-07']).toEqual({ words: '§ 53.056 window closed · not noted', tone: 'red' })
    expect(lines['2026-08']).toEqual({ words: '§ 53.056 open since Sep 1 · mail by Oct 15', tone: 'amber' })
    expect(lines['2026-09']).toEqual({ words: '§ 53.056 open since Oct 1 · mail by Nov 16', tone: 'amber' })
    expect(lines['2026-10']).toEqual({ words: '§ 53.056 opens Nov 1', tone: 'green' })
  })

  it('a noted closed month reads muted; inside a week the open month reads red; folded months each get a line', () => {
    const t = buildLienTimeline({
      ...base,
      todayYmd: '2026-10-10',
      lastMonth: '2026-08',
      months: [
        { key: '2026-04', deadline: '2026-06-15', fromCreation: false, outcome: 'missed', at: '2026-06-20T15:00:00Z' },
        { key: '2026-05', deadline: '2026-07-15', fromCreation: false, outcome: 'missed', at: '2026-07-20T15:00:00Z' },
        { key: '2026-06', deadline: '2026-08-17', fromCreation: false, outcome: 'missed', at: '' },
        { key: '2026-07', deadline: '2026-09-15', fromCreation: false, outcome: 'skipped', at: '2026-09-01T15:00:00Z' },
        { key: '2026-08', deadline: '2026-10-15', fromCreation: false, outcome: 'open', at: '' },
      ],
    })
    const lines = lienMonthLines(t)
    expect(lines['2026-04']).toEqual({ words: '§ 53.056 window closed · noted', tone: 'muted' })
    expect(lines['2026-05']!.tone).toBe('muted')
    expect(lines['2026-06']!.tone).toBe('red')
    expect(lines['2026-07']).toEqual({ words: '§ 53.056 skipped on purpose', tone: 'muted' })
    expect(lines['2026-08']).toEqual({ words: '§ 53.056 open since Sep 1 · mail by Oct 15', tone: 'red' })
  })

  it('a GC-direct job has no lines', () => {
    const t = buildLienTimeline({ ...base, isSub: false, todayYmd: '2026-10-06', lastMonth: '2026-08', months: [] })
    expect(lienMonthLines(t)).toEqual({})
  })
})
