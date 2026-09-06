import { describe, expect, it } from 'vitest'
import {
  ageChipStyle,
  ageDays,
  ageLabel,
  ageState,
  ageStateForDays,
  agingItemOpenedTarget,
  compareOldestFirst,
  describeAge,
  DISPATCH_REQUEST_AGE,
  dueState,
  FIELD_APPROVAL_WAIT_AGE,
  HR_PENDING_REPORT_AGE,
  ONE_OFF_TASK_AGE,
  shouldRecordAgingOpen,
  ymdAgeDays,
} from './ageState'

const NOW = Date.parse('2026-09-05T15:00:00Z')
const daysAgo = (n: number, extraMs = 0) => new Date(NOW - n * 86_400_000 - extraMs).toISOString()

describe('ageDays', () => {
  it('whole days, floored, never negative; null on missing or garbage', () => {
    expect(ageDays(daysAgo(0), NOW)).toBe(0)
    expect(ageDays(daysAgo(0, 3_600_000), NOW)).toBe(0)
    expect(ageDays(daysAgo(1), NOW)).toBe(1)
    expect(ageDays(daysAgo(2, -1), NOW)).toBe(1) // one ms short of two days
    expect(ageDays(daysAgo(46), NOW)).toBe(46)
    expect(ageDays(new Date(NOW + 86_400_000).toISOString(), NOW)).toBe(0)
    expect(ageDays(null, NOW)).toBeNull()
    expect(ageDays('', NOW)).toBeNull()
    expect(ageDays('not a date', NOW)).toBeNull()
  })

  it('accepts a Date for now', () => {
    expect(ageDays(daysAgo(3), new Date(NOW))).toBe(3)
  })
})

describe('ymdAgeDays', () => {
  it('calendar days between two YYYY-MM-DD strings, clamped at zero', () => {
    expect(ymdAgeDays('2026-09-01', '2026-09-05')).toBe(4)
    expect(ymdAgeDays('2026-09-05', '2026-09-05')).toBe(0)
    expect(ymdAgeDays('2026-09-09', '2026-09-05')).toBe(0)
    expect(ymdAgeDays('2026-05-10T12:00:00Z', '2026-09-05')).toBe(118)
    expect(ymdAgeDays('', '2026-09-05')).toBeNull()
    expect(ymdAgeDays('nope', '2026-09-05')).toBeNull()
  })
})

describe('ageState matrix', () => {
  it.each([
    ['dispatch', DISPATCH_REQUEST_AGE, [0, 2], [3, 6], [7, 46]],
    ['hr report', HR_PENDING_REPORT_AGE, [0, 2], [3, 6], [7, 11]],
    ['one-off', ONE_OFF_TASK_AGE, [0, 6], [7, 30], [31, 128]],
    ['field approval', FIELD_APPROVAL_WAIT_AGE, [0, 0], [1, 2], [3, 12]],
  ] as const)('%s thresholds are inclusive at the boundary', (_name, t, fresh, amber, red) => {
    for (const d of fresh) expect(ageStateForDays(d, t)).toBe('fresh')
    for (const d of amber) expect(ageStateForDays(d, t)).toBe('amber')
    for (const d of red) expect(ageStateForDays(d, t)).toBe('red')
  })

  it('null days are fresh — an unstamped row is never shouted about', () => {
    expect(ageStateForDays(null, DISPATCH_REQUEST_AGE)).toBe('fresh')
    expect(ageState(null, NOW, DISPATCH_REQUEST_AGE)).toBe('fresh')
    expect(ageState('garbage', NOW, DISPATCH_REQUEST_AGE)).toBe('fresh')
  })

  it('ageState reads the timestamp through the same table', () => {
    expect(ageState(daysAgo(4), NOW, DISPATCH_REQUEST_AGE)).toBe('amber')
    expect(ageState(daysAgo(46), NOW, DISPATCH_REQUEST_AGE)).toBe('red')
    expect(ageState(daysAgo(4), NOW, ONE_OFF_TASK_AGE)).toBe('fresh')
  })
})

describe('ageLabel / describeAge', () => {
  it('"today", then singular/plural days with the noun', () => {
    expect(ageLabel(0)).toBe('today')
    expect(ageLabel(1)).toBe('1 day waiting')
    expect(ageLabel(3)).toBe('3 days waiting')
    expect(ageLabel(43, 'late')).toBe('43 days late')
  })

  it('describeAge bundles days, state and label; null when the stamp is missing', () => {
    expect(describeAge(daysAgo(11), NOW, HR_PENDING_REPORT_AGE)).toEqual({ days: 11, state: 'red', label: '11 days waiting' })
    expect(describeAge(daysAgo(0), NOW, HR_PENDING_REPORT_AGE)).toEqual({ days: 0, state: 'fresh', label: 'today' })
    expect(describeAge(null, NOW, HR_PENDING_REPORT_AGE)).toBeNull()
  })
})

describe('compareOldestFirst', () => {
  it('sorts ISO strings ascending with missing stamps last', () => {
    const rows = [
      { id: 'new', at: '2026-09-05T10:00:00Z' },
      { id: 'none', at: null },
      { id: 'old', at: '2026-07-21T10:00:00Z' },
      { id: 'mid', at: '2026-09-01T10:00:00Z' },
    ]
    expect([...rows].sort((a, b) => compareOldestFirst(a.at, b.at)).map((r) => r.id)).toEqual(['old', 'mid', 'new', 'none'])
    expect(compareOldestFirst('a', 'a')).toBe(0)
    expect(compareOldestFirst(undefined, null)).toBe(0)
  })
})

describe('dueState', () => {
  const today = '2026-09-05'
  it('past the expected end is red "N days late"', () => {
    expect(dueState('2026-07-24', today)).toEqual({ state: 'red', daysLate: 43, label: '43 days late' })
    expect(dueState('2026-09-04', today)).toEqual({ state: 'red', daysLate: 1, label: '1 day late' })
  })
  it('ending today is amber "due today"; a future end is fresh and silent', () => {
    expect(dueState('2026-09-05', today)).toEqual({ state: 'amber', daysLate: 0, label: 'due today' })
    expect(dueState('2026-09-20', today)).toEqual({ state: 'fresh', daysLate: 0, label: '' })
  })
  it('a pending step whose start has slipped is amber; once started, only the end matters', () => {
    expect(dueState('2026-09-20', today, { startYmd: '2026-09-01', started: false })).toEqual({ state: 'amber', daysLate: 0, label: 'start 4 days past' })
    expect(dueState('2026-09-20', today, { startYmd: '2026-09-04', started: false }).label).toBe('start 1 day past')
    expect(dueState('2026-09-20', today, { startYmd: '2026-09-01', started: true }).state).toBe('fresh')
    expect(dueState(null, today, { startYmd: '2026-09-01', started: false }).state).toBe('amber')
  })
  it('no dates → fresh; timestamps are sliced to the day', () => {
    expect(dueState(null, today).state).toBe('fresh')
    expect(dueState('2026-08-30T00:00:00', today).daysLate).toBe(6)
  })
})

describe('telemetry + chip', () => {
  it('target names surface, whole days and state', () => {
    expect(agingItemOpenedTarget('dispatch-request', 12, 'red')).toBe('#surface=dispatch-request&age_days=12&state=red')
    expect(agingItemOpenedTarget('one-off-task', 7.9, 'amber')).toBe('#surface=one-off-task&age_days=7&state=amber')
    expect(agingItemOpenedTarget('hr-pending-report', Number.NaN, 'amber')).toBe('#surface=hr-pending-report&age_days=0&state=amber')
  })
  it('only amber/red opens are recorded', () => {
    expect(shouldRecordAgingOpen('fresh')).toBe(false)
    expect(shouldRecordAgingOpen('amber')).toBe(true)
    expect(shouldRecordAgingOpen('red')).toBe(true)
  })
  it('chip palettes use tokens for neutrals and literal status colours for amber/red borders', () => {
    expect(ageChipStyle('fresh').background).toBe('var(--bg-muted)')
    expect(ageChipStyle('amber').border).toContain('#d97706')
    expect(ageChipStyle('red').border).toContain('#dc2626')
    expect(ageChipStyle('red').color).toBe('var(--text-red-700)')
  })
})
