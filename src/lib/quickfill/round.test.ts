import { describe, expect, it } from 'vitest'
import { describeRoundRow, nextInRound, roundHeadline, roundQueue, roundRows, roundState, sectionRhythmDays } from './round'

const now = new Date('2026-09-23T15:00:00Z')
const daysAgo = (d: number, h = 0) => new Date(now.getTime() - d * 86_400_000 - h * 3_600_000).toISOString()

describe('sectionRhythmDays', () => {
  it('is the median gap of the last five marks, whole days, at least one', () => {
    expect(sectionRhythmDays([daysAgo(0), daysAgo(7), daysAgo(14), daysAgo(22), daysAgo(28)])).toBe(7)
    expect(sectionRhythmDays([daysAgo(0, 1), daysAgo(0, 9), daysAgo(1, 2)])).toBe(1)
    expect(sectionRhythmDays([daysAgo(0), daysAgo(1), daysAgo(2), daysAgo(3), daysAgo(4), daysAgo(40), daysAgo(80)])).toBe(1)
  })
  it('needs three marks', () => {
    expect(sectionRhythmDays([daysAgo(0), daysAgo(7)])).toBeNull()
    expect(sectionRhythmDays([])).toBeNull()
  })
})

describe('roundState', () => {
  it('fresh within 12 hours whatever the rhythm', () => {
    expect(roundState(daysAgo(0, 3), 7, now).state).toBe('fresh')
    expect(roundState(daysAgo(0, 3), null, now).state).toBe('fresh')
  })
  it('measures against the rhythm: not yet · due today · due with days over', () => {
    expect(roundState(daysAgo(3), 7, now)).toMatchObject({ state: 'not_yet' })
    expect(roundState(daysAgo(7, 1), 7, now).state).toBe('due_today')
    expect(roundState(daysAgo(19), 7, now)).toMatchObject({ state: 'due', overDays: 12 })
  })
  it('falls back to the flat rule without a rhythm', () => {
    expect(roundState(daysAgo(0, 20), null, now).state).toBe('due_today')
    expect(roundState(daysAgo(2), null, now).state).toBe('due')
    expect(roundState(null, 7, now).state).toBe('never')
  })
})

const sections = [
  { sectionId: 'office-arriving', label: 'Office Arriving', personal: false, needsNote: false },
  { sectionId: 'my-inbox', label: 'My Inbox', personal: true, needsNote: false },
  { sectionId: 'accounts-payable', label: 'Accounts payable', personal: false, needsNote: false },
  { sectionId: 'texts', label: 'Texts', personal: false, needsNote: true },
  { sectionId: 'missing', label: 'Missing job info', personal: false, needsNote: false },
]
const marks = {
  'office-arriving': { marked_at: daysAgo(0, 2), marked_by_name: 'Taunya' },
  'accounts-payable': { marked_at: daysAgo(19), marked_by_name: 'Taunya' },
  texts: { marked_at: daysAgo(1, 1), marked_by_name: null },
  missing: { marked_at: daysAgo(3), marked_by_name: 'Taunya' },
}
const events = [
  ...[0, 1, 2, 3, 4].map((d) => ({ section_id: 'office-arriving', marked_at: daysAgo(d, 2), outstanding_count: 0 })),
  ...[19, 26, 33, 40].map((d) => ({ section_id: 'accounts-payable', marked_at: daysAgo(d), outstanding_count: 6 })),
  ...[1, 2, 3].map((d) => ({ section_id: 'texts', marked_at: daysAgo(d, 1), outstanding_count: null })),
  { section_id: 'missing', marked_at: daysAgo(3), outstanding_count: 12 },
]

describe('roundRows', () => {
  const rows = roundRows(sections, marks, events, (id) => (id === 'missing' ? 14 : null), now)
  it('sorts due → due today → not yet → fresh, personal doors last', () => {
    expect(rows.map((r) => r.sectionId)).toEqual(['accounts-payable', 'missing', 'texts', 'office-arriving', 'my-inbox'])
    expect(rows.map((r) => r.state)).toEqual(['due', 'due', 'due_today', 'fresh', 'never'])
  })
  it('reads the rhythm, the count and its source', () => {
    const ap = rows[0]!
    expect(ap.rhythmDays).toBe(7)
    expect(ap.overDays).toBe(12)
    expect(ap.count).toBe(6)
    expect(ap.countSource).toBe('last_look')
    const missing = rows[1]!
    expect(missing.rhythmDays).toBeNull()
    expect(missing.count).toBe(14)
    expect(missing.countSource).toBe('open')
    expect(rows[2]!.countSource).toBe('none')
  })
  it('describes each row', () => {
    expect(describeRoundRow(rows[0]!, now)).toBe('every 7 d · 12 d over · Taunya')
    expect(describeRoundRow(rows[2]!, now)).toBe('every day · due today · needs a note')
    expect(describeRoundRow(rows[3]!, now)).toMatch(/^every day · marked \d{1,2}:\d{2} [AP]M · Taunya$/)
    expect(describeRoundRow(rows[4]!, now)).toBe('no mark · opens the page')
  })
  it('the round is the due rows, the headline counts them, next walks them', () => {
    expect(roundQueue(rows)).toEqual(['accounts-payable', 'missing', 'texts'])
    expect(roundHeadline(rows)).toBe('2 due · 1 due today · 1 fresh')
    expect(nextInRound(rows, null)).toBe('accounts-payable')
    expect(nextInRound(rows, 'accounts-payable')).toBe('missing')
    expect(nextInRound(rows, 'texts')).toBeNull()
    expect(nextInRound(rows, 'office-arriving')).toBe('accounts-payable')
  })
})
