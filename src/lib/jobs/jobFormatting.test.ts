import { describe, expect, it } from 'vitest'
import {
  addDaysToDate,
  calendarDaysSinceDateUtc,
  filterLaborCrewNames,
  formatCurrency,
  formatCurrencyNoCents,
  formatEstimatedCompletionDisplay,
  formatJobNameTwoLines,
  formatJobSummaryDurationMinutes,
  formatJobSummaryInvoiceDate,
  formatJobSummarySessionDateTime,
  formatJobSummarySessionTimeOnly,
  formatPrintDaysSince,
  formatTimeSince,
  formatUsdNoCents,
  formatYmdOrIsoDateForPrintDisplay,
  jobSummaryPartsCostIsZero,
  personMatchesJobSummaryBreakdownFilter,
} from './jobFormatting'

describe('personMatchesJobSummaryBreakdownFilter', () => {
  it('matches everything for empty/whitespace query', () => {
    expect(personMatchesJobSummaryBreakdownFilter('Alice', '')).toBe(true)
    expect(personMatchesJobSummaryBreakdownFilter('Alice', '   ')).toBe(true)
    expect(personMatchesJobSummaryBreakdownFilter(null, '')).toBe(true)
  })
  it('is case-insensitive substring match', () => {
    expect(personMatchesJobSummaryBreakdownFilter('Bob Smith', 'smi')).toBe(true)
    expect(personMatchesJobSummaryBreakdownFilter('Bob Smith', 'xyz')).toBe(false)
    expect(personMatchesJobSummaryBreakdownFilter(null, 'bob')).toBe(false)
  })
})

describe('currency formatters', () => {
  it('formatCurrency keeps two fraction digits with grouping', () => {
    expect(formatCurrency(1234.5)).toBe('1,234.50')
    expect(formatCurrency(0)).toBe('0.00')
  })
  it('formatCurrencyNoCents rounds to whole dollars', () => {
    expect(formatCurrencyNoCents(1234.5)).toBe('1,235')
    expect(formatCurrencyNoCents(1234.4)).toBe('1,234')
  })
  it('formatUsdNoCents prepends a dollar sign', () => {
    expect(formatUsdNoCents(1234.5)).toBe('$1,235')
    expect(formatUsdNoCents(0)).toBe('$0')
  })
  it('jobSummaryPartsCostIsZero treats sub-epsilon and zero as zero', () => {
    expect(jobSummaryPartsCostIsZero(0)).toBe(true)
    expect(jobSummaryPartsCostIsZero(1e-7)).toBe(true)
    expect(jobSummaryPartsCostIsZero(0.01)).toBe(false)
    expect(jobSummaryPartsCostIsZero(NaN)).toBe(false)
  })
})

describe('formatJobSummaryDurationMinutes', () => {
  it('returns em dash for non-positive or non-finite', () => {
    expect(formatJobSummaryDurationMinutes(0)).toBe('—')
    expect(formatJobSummaryDurationMinutes(-1)).toBe('—')
    expect(formatJobSummaryDurationMinutes(NaN)).toBe('—')
  })
  it('renders minutes only under an hour', () => {
    expect(formatJobSummaryDurationMinutes(90000)).toBe('2m') // 1.5 min rounds to 2
  })
  it('renders hours and minutes past an hour', () => {
    expect(formatJobSummaryDurationMinutes(3_720_000)).toBe('1h 2m') // 62 min
  })
})

describe('calendarDaysSinceDateUtc', () => {
  it('returns -1 for an unparseable date', () => {
    expect(calendarDaysSinceDateUtc('not-a-date')).toBe(-1)
  })
  it('counts whole UTC calendar days', () => {
    const now = new Date('2026-01-11T08:00:00Z')
    expect(calendarDaysSinceDateUtc('2026-01-01', now)).toBe(10)
    expect(calendarDaysSinceDateUtc('2026-01-11', now)).toBe(0)
  })
})

describe('formatTimeSince', () => {
  const now = new Date('2026-05-31T12:00:00Z')
  it('returns em dash for null', () => {
    expect(formatTimeSince(null, now)).toBe('—')
  })
  it('buckets recent durations', () => {
    expect(formatTimeSince(new Date(now.getTime() - 30_000).toISOString(), now)).toBe('just now')
    expect(formatTimeSince(new Date(now.getTime() - 5 * 60_000).toISOString(), now)).toBe('5 minutes')
    expect(formatTimeSince(new Date(now.getTime() - 60_000).toISOString(), now)).toBe('1 minute')
    expect(formatTimeSince(new Date(now.getTime() - 2 * 3_600_000).toISOString(), now)).toBe('2 hours')
    expect(formatTimeSince(new Date(now.getTime() - 3 * 86_400_000).toISOString(), now)).toBe('3 days')
    expect(formatTimeSince(new Date(now.getTime() - 14 * 86_400_000).toISOString(), now)).toBe('2 weeks')
    expect(formatTimeSince(new Date(now.getTime() - 60 * 86_400_000).toISOString(), now)).toBe('2 months')
    expect(formatTimeSince(new Date(now.getTime() - 400 * 86_400_000).toISOString(), now)).toBe('1 year')
  })
})

describe('formatEstimatedCompletionDisplay', () => {
  const now = new Date('2026-05-31T12:00:00')
  it('returns null for blank input', () => {
    expect(formatEstimatedCompletionDisplay(null, now)).toBe(null)
    expect(formatEstimatedCompletionDisplay('   ', now)).toBe(null)
  })
  it('renders T-minus for future, T-plus for past, Today for same day', () => {
    expect(formatEstimatedCompletionDisplay('2026-06-05', now)).toMatch(/^T-5 \(/)
    expect(formatEstimatedCompletionDisplay('2026-05-28', now)).toMatch(/^T\+3 \(/)
    expect(formatEstimatedCompletionDisplay('2026-05-31', now)).toMatch(/^Today \(/)
  })
})

describe('addDaysToDate', () => {
  it('adds/subtracts whole days against a YMD string', () => {
    expect(addDaysToDate('2026-01-01', 5)).toBe('2026-01-06')
    expect(addDaysToDate('2026-01-01', -1)).toBe('2025-12-31')
  })
})

describe('print date helpers', () => {
  it('formatYmdOrIsoDateForPrintDisplay renders en-US short date', () => {
    expect(formatYmdOrIsoDateForPrintDisplay('2026-01-15')).toBe('Jan 15, 2026')
    expect(formatYmdOrIsoDateForPrintDisplay('2026-01-15T08:30:00Z')).toBe('Jan 15, 2026')
    expect(formatYmdOrIsoDateForPrintDisplay('garbage')).toBe('—')
  })
  it('formatPrintDaysSince pluralizes', () => {
    expect(formatPrintDaysSince(null)).toBe('—')
    expect(formatPrintDaysSince(1)).toBe('1 day')
    expect(formatPrintDaysSince(3)).toBe('3 days')
  })
})

describe('session date formatters', () => {
  it('return em dash for null', () => {
    expect(formatJobSummarySessionDateTime(null)).toBe('—')
    expect(formatJobSummarySessionTimeOnly(null)).toBe('—')
  })
})

describe('formatJobSummaryInvoiceDate', () => {
  it('formats a bare YMD via noon to a short date', () => {
    expect(formatJobSummaryInvoiceDate('2026-01-15')).toBe('Jan 15, 2026')
  })
})

describe('filterLaborCrewNames', () => {
  it('returns the list unchanged for an empty query', () => {
    const names = ['Alice', 'Bob']
    expect(filterLaborCrewNames(names, '')).toBe(names)
  })
  it('case-insensitively filters by substring', () => {
    expect(filterLaborCrewNames(['Alice', 'Bob', 'alfred'], 'al')).toEqual(['Alice', 'alfred'])
  })
})

describe('formatJobNameTwoLines', () => {
  it('returns null for blank', () => {
    expect(formatJobNameTwoLines(null)).toBe(null)
    expect(formatJobNameTwoLines('   ')).toBe(null)
  })
  it('splits on the first comma', () => {
    expect(formatJobNameTwoLines('Smith, 123 Main')).toEqual({ line1: 'Smith', line2: '123 Main' })
  })
  it('returns single line when no comma', () => {
    expect(formatJobNameTwoLines('Smith Job')).toEqual({ line1: 'Smith Job' })
  })
})
