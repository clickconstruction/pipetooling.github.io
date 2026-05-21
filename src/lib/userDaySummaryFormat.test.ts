import { describe, it, expect } from 'vitest'
import {
  associationLabel,
  type ClockSessionForDispatchBand,
} from './clockSessionsToDispatchSecondaryBands'
import {
  computeSessionDurationMs,
  formatSessionDuration,
  formatSessionTimeRange,
} from './userDaySummaryFormat'

/**
 * America/Chicago is UTC-5 (CDT) on 2026-05-21. Pinning UTC inputs here so the
 * Intl-formatted output in tests stays deterministic regardless of the host's
 * local timezone.
 */
const TODAY_YMD = '2026-05-21'
// 2026-05-21T13:00:00Z = 2026-05-21 08:00 America/Chicago (CDT). Used as `nowMs`
// only for duration math; the `todayYmd` string is passed in directly to keep
// the helpers deterministic across Intl/ICU environments.
const NOW_MS_TODAY = Date.UTC(2026, 4, 21, 13, 0, 0)

function makeSession(
  overrides: Partial<ClockSessionForDispatchBand>,
): ClockSessionForDispatchBand {
  return {
    id: 'sess-1',
    user_id: 'user-1',
    clocked_in_at: '2026-05-21T13:00:00Z',
    clocked_out_at: null,
    job_ledger_id: null,
    bid_id: null,
    notes: null,
    ...overrides,
  }
}

describe('formatSessionTimeRange', () => {
  it('formats a closed session start/end in APP_CALENDAR_TZ', () => {
    // 13:00Z = 8:00 AM Central, 17:11Z = 12:11 PM Central
    const out = formatSessionTimeRange(
      '2026-05-21T13:00:00Z',
      '2026-05-21T17:11:00Z',
      TODAY_YMD,
      TODAY_YMD,
    )
    expect(out).toBe('8:00 AM–12:11 PM')
  })

  it('open punch on today renders as `…–now`', () => {
    const out = formatSessionTimeRange('2026-05-21T13:00:00Z', null, TODAY_YMD, TODAY_YMD)
    expect(out).toBe('8:00 AM–now')
  })

  it('open punch on a past day renders as `…–no clock out`', () => {
    const out = formatSessionTimeRange(
      '2026-05-19T13:00:00Z',
      null,
      '2026-05-19',
      TODAY_YMD,
    )
    expect(out).toBe('8:00 AM–no clock out')
  })

  it('crosses midnight in zone (clock-out next civil day)', () => {
    // 2026-05-22T04:30:00Z = 2026-05-21 11:30 PM Central
    const out = formatSessionTimeRange(
      '2026-05-21T23:00:00Z',
      '2026-05-22T04:30:00Z',
      TODAY_YMD,
      TODAY_YMD,
    )
    expect(out).toBe('6:00 PM–11:30 PM')
  })
})

describe('formatSessionDuration', () => {
  it('renders hours + minutes for >= 1h', () => {
    expect(formatSessionDuration(4 * 3_600_000 + 8 * 60_000)).toBe('4h 8m')
  })

  it('renders minutes only for sub-hour spans', () => {
    expect(formatSessionDuration(45 * 60_000)).toBe('45m')
  })

  it('returns `0m` for zero / negative / NaN inputs', () => {
    expect(formatSessionDuration(0)).toBe('0m')
    expect(formatSessionDuration(-1_000)).toBe('0m')
    expect(formatSessionDuration(Number.NaN)).toBe('0m')
  })

  it('floors sub-minute remainders', () => {
    expect(formatSessionDuration(7 * 60_000 + 59_000)).toBe('7m')
  })
})

describe('computeSessionDurationMs', () => {
  it('returns the diff for closed sessions', () => {
    const ms = computeSessionDurationMs(
      '2026-05-21T13:00:00Z',
      '2026-05-21T17:11:00Z',
      NOW_MS_TODAY,
      TODAY_YMD,
      TODAY_YMD,
    )
    expect(ms).toBe(4 * 3_600_000 + 11 * 60_000)
  })

  it('returns now - start for an open punch on today', () => {
    const ms = computeSessionDurationMs(
      '2026-05-21T12:00:00Z',
      null,
      NOW_MS_TODAY,
      TODAY_YMD,
      TODAY_YMD,
    )
    expect(ms).toBe(60 * 60_000)
  })

  it('returns null for an open punch on a past day (caller decides)', () => {
    expect(
      computeSessionDurationMs(
        '2026-05-19T13:00:00Z',
        null,
        NOW_MS_TODAY,
        '2026-05-19',
        TODAY_YMD,
      ),
    ).toBeNull()
  })

  it('returns null for invalid timestamps', () => {
    expect(
      computeSessionDurationMs(
        'not-a-date',
        '2026-05-21T17:00:00Z',
        NOW_MS_TODAY,
        TODAY_YMD,
        TODAY_YMD,
      ),
    ).toBeNull()
  })
})

describe('associationLabel (re-exported smoke)', () => {
  const jobs = new Map([['job-a', 'JP740 · San Marcos Demo']])
  const bids = new Map([['bid-x', 'B249 · Diamondback Rough-In']])

  it('returns the job title when job_ledger_id resolves', () => {
    expect(
      associationLabel(makeSession({ job_ledger_id: 'job-a' }), jobs, bids),
    ).toBe('JP740 · San Marcos Demo')
  })

  it('falls back to the bid title when bid_id resolves and no job', () => {
    expect(
      associationLabel(makeSession({ bid_id: 'bid-x' }), jobs, bids),
    ).toBe('B249 · Diamondback Rough-In')
  })

  it('returns `No job` when neither id resolves', () => {
    expect(associationLabel(makeSession({}), jobs, bids)).toBe('No job')
    expect(
      associationLabel(makeSession({ job_ledger_id: 'missing', bid_id: 'missing' }), jobs, bids),
    ).toBe('No job')
  })
})
