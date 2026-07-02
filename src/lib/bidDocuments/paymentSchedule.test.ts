import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PAYMENT_SCHEDULE_ROWS,
  PAYMENT_SCHEDULE_TIMINGS,
  PAYMENT_SCHEDULE_TIMING_LABELS,
  buildPaymentScheduleSectionLines,
  computePaymentScheduleLines,
  formatPaymentSchedulePercent,
  paymentSchedulePercentTotal,
  paymentScheduleTimingLabel,
} from './paymentSchedule'

describe('DEFAULT_PAYMENT_SCHEDULE_ROWS', () => {
  it('is the 30/30/30/10 preset and sums to 100', () => {
    expect(DEFAULT_PAYMENT_SCHEDULE_ROWS).toEqual([
      { timing: 'before_rough_in', percent: 30 },
      { timing: 'before_top_out', percent: 30 },
      { timing: 'before_trim_set', percent: 30 },
      { timing: 'after_trim_set', percent: 10 },
    ])
    expect(paymentSchedulePercentTotal(DEFAULT_PAYMENT_SCHEDULE_ROWS)).toBe(100)
  })
})

describe('paymentSchedulePercentTotal', () => {
  it('sums decimals and treats non-finite percents as 0', () => {
    expect(
      paymentSchedulePercentTotal([
        { timing: 'before_rough_in', percent: 33.3 },
        { timing: 'before_top_out', percent: 33.3 },
        { timing: 'before_trim_set', percent: 33.4 },
      ]),
    ).toBeCloseTo(100)
    expect(paymentSchedulePercentTotal([{ timing: 'before_start', percent: NaN }])).toBe(0)
    expect(paymentSchedulePercentTotal([])).toBe(0)
  })
})

describe('formatPaymentSchedulePercent', () => {
  it('trims trailing zeros and keeps meaningful decimals', () => {
    expect(formatPaymentSchedulePercent(30)).toBe('30%')
    expect(formatPaymentSchedulePercent(12.5)).toBe('12.5%')
    expect(formatPaymentSchedulePercent(33.333)).toBe('33.33%')
    expect(formatPaymentSchedulePercent(NaN)).toBe('0%')
  })
})

describe('paymentScheduleTimingLabel', () => {
  it('maps every known timing to a label', () => {
    for (const t of PAYMENT_SCHEDULE_TIMINGS) {
      expect(paymentScheduleTimingLabel(t)).toBe(PAYMENT_SCHEDULE_TIMING_LABELS[t])
    }
  })

  it('falls back to the raw string for unknown timings', () => {
    expect(paymentScheduleTimingLabel('before_final_inspection')).toBe('before_final_inspection')
  })
})

describe('computePaymentScheduleLines', () => {
  it('computes dollar amounts from percent of the contract amount', () => {
    const lines = computePaymentScheduleLines(DEFAULT_PAYMENT_SCHEDULE_ROWS, 150000)
    expect(lines).toHaveLength(4)
    expect(lines[0]).toEqual({
      label: 'before Rough In',
      percent: 30,
      amountFormatted: '$45,000.00',
      line: 'Due before Rough In: 30% — $45,000.00',
    })
    expect(lines[3]?.line).toBe('Due after Trim Set: 10% — $15,000.00')
  })

  it('preserves row order and handles decimal percents with cents rounding', () => {
    const lines = computePaymentScheduleLines(
      [
        { timing: 'after_top_out', percent: 12.5 },
        { timing: 'before_start', percent: 50 },
      ],
      1000.1,
    )
    expect(lines.map((l) => l.label)).toEqual(['after Top Out', 'before start'])
    expect(lines[0]?.amountFormatted).toBe('$125.01')
    expect(lines[1]?.amountFormatted).toBe('$500.05')
  })

  it('does not throw on an unknown timing', () => {
    const lines = computePaymentScheduleLines([{ timing: 'mystery_phase', percent: 10 }], 100)
    expect(lines[0]?.line).toBe('Due mystery_phase: 10% — $10.00')
  })
})

describe('buildPaymentScheduleSectionLines', () => {
  it('returns [] for empty rows', () => {
    expect(buildPaymentScheduleSectionLines([], 100000)).toEqual([])
  })

  it('prepends the Schedule of Values heading', () => {
    const lines = buildPaymentScheduleSectionLines(DEFAULT_PAYMENT_SCHEDULE_ROWS, 100000)
    expect(lines[0]).toBe('Schedule of Values:')
    expect(lines).toHaveLength(5)
    expect(lines[1]).toBe('Due before Rough In: 30% — $30,000.00')
  })
})
