import { describe, expect, it } from 'vitest'
import {
  buildJobChargeEvents,
  buildJobChargesTimelineChartData,
  buildJobPaymentEvents,
  buildJobValueEvents,
  buildJobManualPercentEvents,
  newestPercentEvent,
  computeChargesTimelineAxisDomains,
  formatJobChargesDateLabel,
  JOB_CHARGES_UNKNOWN_DATE_KEY,
  reportCompletionPercent,
  tallyPartEventAmount,
  ymdFromDateOnlyOrIso,
  type JobChargeEvent,
  type JobPaymentEvent,
  type JobValueEvent,
} from './jobChargesTimeline'
import {
  REPORT_FIELD_LABEL_JOB_COMPLETION,
  REPORT_FIELD_LABEL_LEGACY_WHO,
} from './reportTemplateFieldDisplay'
import { resolveJobCurrentPercentFallback } from './jobSummaryPercentComplete'

const isoToYmdStub = (iso: string) => (iso.startsWith('2026-06-12T') ? '2026-06-12' : '')

function charge(partial: Partial<JobChargeEvent>): JobChargeEvent {
  return { source: 'team_labor', dateKey: '2026-06-01', amount: 0, label: 'x', ...partial }
}

function valueEvent(partial: Partial<JobValueEvent>): JobValueEvent {
  return { dateKey: '2026-06-01', percent: null, label: 'Report by A', ...partial }
}

function payment(partial: Partial<JobPaymentEvent>): JobPaymentEvent {
  return { dateKey: '2026-06-01', amount: 0, label: 'Payment', ...partial }
}

describe('ymdFromDateOnlyOrIso', () => {
  it('passes date-only strings through (first 10 chars)', () => {
    expect(ymdFromDateOnlyOrIso('2026-06-12', isoToYmdStub)).toBe('2026-06-12')
    expect(ymdFromDateOnlyOrIso('2026-06-12 08:00:00', isoToYmdStub)).toBe('2026-06-12')
    expect(ymdFromDateOnlyOrIso('2026-06-12T05:00:00Z', isoToYmdStub)).toBe('2026-06-12')
  })
  it('delegates non-date-leading strings to the injected converter', () => {
    expect(ymdFromDateOnlyOrIso('June 12', () => '2026-06-12')).toBe('2026-06-12')
  })
  it('returns null for empty, null, and converter failures', () => {
    expect(ymdFromDateOnlyOrIso(null, isoToYmdStub)).toBeNull()
    expect(ymdFromDateOnlyOrIso('', isoToYmdStub)).toBeNull()
    expect(ymdFromDateOnlyOrIso('   ', isoToYmdStub)).toBeNull()
    expect(ymdFromDateOnlyOrIso('garbage', () => '')).toBeNull()
  })
})

describe('tallyPartEventAmount', () => {
  it('uses fixture_cost × qty for fixture-only rows (part_id null) — parity with jobSummaryData', () => {
    expect(
      tallyPartEventAmount({ part_id: null, quantity: 3, price_at_time: 99, fixture_cost: 10 }),
    ).toBe(30)
  })
  it('uses price_at_time × qty for priced parts', () => {
    expect(
      tallyPartEventAmount({ part_id: 'p1', quantity: 2, price_at_time: 12.5, fixture_cost: 99 }),
    ).toBe(25)
  })
  it('treats null costs as zero', () => {
    expect(
      tallyPartEventAmount({ part_id: null, quantity: 2, price_at_time: null, fixture_cost: null }),
    ).toBe(0)
    expect(
      tallyPartEventAmount({ part_id: 'p1', quantity: 2, price_at_time: null, fixture_cost: 5 }),
    ).toBe(0)
  })
})

describe('buildJobChargeEvents', () => {
  it('merges all six streams with the right source, amount, and label', () => {
    const events = buildJobChargeEvents({
      teamLaborBreakdown: [
        {
          personName: 'Alice',
          byWorkDate: [{ workDate: '2026-06-01', hours: 6.5, cost: 234 }],
        },
      ],
      subLabor: [{ dateKey: '2026-06-02', amount: 400, assignedToName: 'Bob Sub' }],
      mercury: [
        {
          dateKey: '2026-06-03',
          amount: 55.25,
          counterpartyName: 'Home Depot',
          attributionDisplayName: 'Carl',
        },
      ],
      supplyHouse: [
        {
          dateKey: '2026-06-04',
          allocatedAmount: 120,
          supplyHouseName: 'Ferguson',
          invoiceNumber: 'INV-9',
        },
      ],
      tallyParts: [
        { dateKey: '2026-06-05', amount: 30, fixtureOrPartName: 'Lav faucet', createdByName: 'Dan' },
      ],
      billedMaterials: [{ dateKey: '2026-06-06', amount: 75, description: 'Rented core drill' }],
    })
    expect(events).toHaveLength(6)
    expect(events.map((e) => e.source)).toEqual([
      'team_labor',
      'sub_labor',
      'mercury_card',
      'supply_house',
      'tally_part',
      'billed_material',
    ])
    expect(events[0]).toMatchObject({ amount: 234, label: 'Alice — team labor (6.5h)' })
    expect(events[1]).toMatchObject({ amount: 400, label: 'Bob Sub — sub labor' })
    expect(events[2]).toMatchObject({ amount: 55.25, label: 'Home Depot (Carl)' })
    expect(events[3]).toMatchObject({ amount: 120, label: 'Ferguson — invoice INV-9' })
    expect(events[4]).toMatchObject({ amount: 30, label: 'Lav faucet (Dan)' })
    expect(events[5]).toMatchObject({ amount: 75, label: 'Rented core drill' })
  })

  it('falls back to generic labels when names are missing', () => {
    const events = buildJobChargeEvents({
      teamLaborBreakdown: [],
      subLabor: [],
      mercury: [{ dateKey: null, amount: 5, counterpartyName: null, attributionDisplayName: null }],
      supplyHouse: [],
      tallyParts: [],
      billedMaterials: [{ dateKey: null, amount: 1, description: null }],
    })
    expect(events[0]?.label).toBe('Card charge')
    expect(events[1]?.label).toBe('Other job charge')
  })
})

describe('reportCompletionPercent / buildJobValueEvents', () => {
  it('reads the new field key', () => {
    expect(reportCompletionPercent({ [REPORT_FIELD_LABEL_JOB_COMPLETION]: '60' })).toBe(60)
  })
  it('falls back to the legacy key and prefers the new key when both exist', () => {
    expect(reportCompletionPercent({ [REPORT_FIELD_LABEL_LEGACY_WHO]: '40' })).toBe(40)
    expect(
      reportCompletionPercent({
        [REPORT_FIELD_LABEL_JOB_COMPLETION]: '80',
        [REPORT_FIELD_LABEL_LEGACY_WHO]: '40',
      }),
    ).toBe(80)
  })
  it('returns null for missing/invalid values and null field_values', () => {
    expect(reportCompletionPercent(null)).toBeNull()
    expect(reportCompletionPercent({})).toBeNull()
    expect(reportCompletionPercent({ [REPORT_FIELD_LABEL_JOB_COMPLETION]: 'abc' })).toBeNull()
    expect(reportCompletionPercent({ [REPORT_FIELD_LABEL_JOB_COMPLETION]: '150' })).toBeNull()
  })
  it('builds value events with percent and reporter label', () => {
    const events = buildJobValueEvents([
      {
        dateKey: '2026-06-02',
        createdByName: 'Bob',
        fieldValues: { [REPORT_FIELD_LABEL_JOB_COMPLETION]: '60' },
      },
      { dateKey: '2026-06-03', createdByName: null, fieldValues: {} },
    ])
    expect(events[0]).toMatchObject({ percent: 60, label: 'Report by Bob' })
    expect(events[1]).toMatchObject({ percent: null, label: 'Report by someone' })
  })
})

describe('overhead band (v2.3271)', () => {
  const charges = [
    charge({ dateKey: '2026-06-01', amount: 100, source: 'team_labor' }),
    charge({ dateKey: '2026-06-10', amount: 50, source: 'mercury_card' }),
  ]

  it('without overhead days every row reads zero and the series is unavailable', () => {
    const data = buildJobChargesTimelineChartData(charges, [], null)
    expect(data.overheadSeriesAvailable).toBe(false)
    expect(data.endOverhead).toBe(0)
    expect(data.endTrueCost).toBe(150)
    expect(data.chartRows.map((r) => r.overheadToDate)).toEqual([0, 0])
    expect(data.chartRows.map((r) => r.trueCost)).toEqual([100, 150])
    expect(data.chartRows.every((r) => !r.overheadOnlyBucket)).toBe(true)
  })

  it('folds overhead landed between events into the next event bucket, on-or-before an event into that bucket', () => {
    const data = buildJobChargesTimelineChartData(charges, [], null, [], null, [
      { dateKey: '2026-05-28', amount: 4, activityUsd: 4, carryUsd: 0 }, // before the first charge → first bucket
      { dateKey: '2026-06-01', amount: 10, activityUsd: 8, carryUsd: 2 },
      { dateKey: '2026-06-04', amount: 6, activityUsd: 0, carryUsd: 6 }, // between → the Jun 10 bucket
      { dateKey: '2026-06-10', amount: 12.5, activityUsd: 12.5, carryUsd: 0 },
    ])
    expect(data.overheadSeriesAvailable).toBe(true)
    expect(data.chartRows.map((r) => r.dateKey)).toEqual(['2026-06-01', '2026-06-10'])
    expect(data.chartRows.map((r) => r.overheadToDate)).toEqual([14, 32.5])
    expect(data.chartRows.map((r) => r.overheadActivityToDate)).toEqual([12, 24.5])
    expect(data.chartRows.map((r) => r.overheadCarryToDate)).toEqual([2, 8])
    expect(data.chartRows.map((r) => r.trueCost)).toEqual([114, 182.5])
    expect(data.chartRows.map((r) => r.overheadBand)).toEqual([[100, 114], [150, 182.5]])
    expect(data.endOverhead).toBe(32.5)
    expect(data.endTrueCost).toBe(182.5)
    // The cost and cash lines are untouched by the band.
    expect(data.chartRows.map((r) => r.expense)).toEqual([100, 150])
    expect(data.endExpense).toBe(150)
  })

  it('overhead landed after the last event makes one trailing bucket at the last landing, lines flat', () => {
    const data = buildJobChargesTimelineChartData(charges, [], null, [payment({ dateKey: '2026-06-10', amount: 500 })], null, [
      { dateKey: '2026-06-10', amount: 5 },
      { dateKey: '2026-06-15', amount: 3 },
      { dateKey: '2026-06-20', amount: 2 },
    ])
    expect(data.chartRows.map((r) => r.dateKey)).toEqual(['2026-06-01', '2026-06-10', '2026-06-20'])
    const tail = data.chartRows[2]!
    expect(tail.overheadOnlyBucket).toBe(true)
    expect(tail.chargeSources).toEqual([])
    expect(tail.expense).toBe(150)
    expect(tail.paymentsToDate).toBe(500)
    expect(tail.profit).toBe(350)
    expect(tail.overheadToDate).toBe(10)
    expect(tail.trueCost).toBe(160)
    expect(tail.dateLabel).toBe('Jun 20')
    // A trailing bucket adds no payment rise and does not disturb the earlier rows.
    expect(data.paymentRiseSegments).toEqual([{ from: 0, to: 1 }])
    expect(data.chartRows[1]!.overheadOnlyBucket).toBe(false)
  })

  it('ignores non-positive and undated overhead, and never puts overhead in the unknown-date bucket', () => {
    const data = buildJobChargesTimelineChartData(
      [charge({ dateKey: null, amount: 20 }), ...charges],
      [],
      null,
      [],
      null,
      [
        { dateKey: '2026-06-01', amount: 0 },
        { dateKey: '2026-06-01', amount: -3 },
        { dateKey: 'unknown', amount: 9 },
        { dateKey: '2026-06-02', amount: 7 },
      ],
    )
    expect(data.chartRows.map((r) => r.dateKey)).toEqual([JOB_CHARGES_UNKNOWN_DATE_KEY, '2026-06-01', '2026-06-10'])
    expect(data.chartRows.map((r) => r.overheadToDate)).toEqual([0, 0, 7])
    expect(data.endOverhead).toBe(7)
  })

  it('overhead with no dated events at all makes a single trailing bucket', () => {
    const data = buildJobChargesTimelineChartData([], [], null, [], null, [{ dateKey: '2026-06-03', amount: 5 }])
    expect(data.chartRows.map((r) => r.dateKey)).toEqual(['2026-06-03'])
    expect(data.chartRows[0]!.overheadOnlyBucket).toBe(true)
    expect(data.chartRows[0]!.trueCost).toBe(5)
  })

  it('the left axis domain reaches the true-cost top edge', () => {
    const d = computeChargesTimelineAxisDomains([
      { expense: 100, profit: -100, value: null, trueCost: 400 },
      { expense: 150, profit: 350, value: null, trueCost: 420 },
    ])
    expect(d.left[1]).toBeGreaterThanOrEqual(420)
    const plain = computeChargesTimelineAxisDomains([{ expense: 100, profit: -100, value: null }])
    expect(plain.left[1]).toBeGreaterThanOrEqual(100)
  })
})

describe('buildJobChargesTimelineChartData', () => {
  it('returns empty rows for empty input', () => {
    const data = buildJobChargesTimelineChartData([], [], 1000)
    expect(data.chartRows).toEqual([])
    expect(data.endExpense).toBe(0)
    expect(data.valueSeriesAvailable).toBe(false)
    expect(data.hasUnknownDateBucket).toBe(false)
  })

  it('accumulates expense in date order and endExpense reconciles with the stream total', () => {
    const data = buildJobChargesTimelineChartData(
      [
        charge({ dateKey: '2026-06-03', amount: 100, source: 'mercury_card' }),
        charge({ dateKey: '2026-06-01', amount: 50, source: 'team_labor' }),
        charge({ dateKey: '2026-06-02', amount: 25.5, source: 'supply_house' }),
      ],
      [],
      null,
    )
    expect(data.chartRows.map((r) => r.dateKey)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
    expect(data.chartRows.map((r) => r.expense)).toEqual([50, 75.5, 175.5])
    expect(data.endExpense).toBe(175.5)
  })

  it('aggregates same-day events into one row and dedupes chargeSources', () => {
    const data = buildJobChargesTimelineChartData(
      [
        charge({ dateKey: '2026-06-01', amount: 10, source: 'team_labor', label: 'a' }),
        charge({ dateKey: '2026-06-01', amount: 20, source: 'team_labor', label: 'b' }),
        charge({ dateKey: '2026-06-01', amount: 5, source: 'tally_part', label: 'c' }),
      ],
      [],
      null,
    )
    expect(data.chartRows).toHaveLength(1)
    expect(data.chartRows[0]?.chargeEvents).toHaveLength(3)
    expect(data.chartRows[0]?.chargeSources).toEqual(['team_labor', 'tally_part'])
    expect(data.chartRows[0]?.expense).toBe(35)
  })

  it('puts null-date events in a leading unknown bucket that still counts toward endExpense', () => {
    const data = buildJobChargesTimelineChartData(
      [
        charge({ dateKey: null, amount: 40, source: 'billed_material' }),
        charge({ dateKey: '2026-06-01', amount: 10 }),
      ],
      [],
      null,
    )
    expect(data.hasUnknownDateBucket).toBe(true)
    expect(data.chartRows[0]?.dateKey).toBe(JOB_CHARGES_UNKNOWN_DATE_KEY)
    expect(data.chartRows[0]?.dateLabel).toBe('No date')
    expect(data.chartRows[0]?.expense).toBe(40)
    expect(data.chartRows[1]?.expense).toBe(50)
    expect(data.endExpense).toBe(50)
  })

  it('keeps zero-cost events visible (sources/tooltip) without moving the line', () => {
    const data = buildJobChargesTimelineChartData(
      [
        charge({ dateKey: '2026-06-01', amount: 10 }),
        charge({ dateKey: '2026-06-02', amount: 0, source: 'tally_part' }),
      ],
      [],
      null,
    )
    expect(data.chartRows[1]?.expense).toBe(10)
    expect(data.chartRows[1]?.chargeSources).toEqual(['tally_part'])
  })

  it('steps the value line at percent reports and forward-fills across expense-only days', () => {
    const data = buildJobChargesTimelineChartData(
      [
        charge({ dateKey: '2026-06-01', amount: 10 }),
        charge({ dateKey: '2026-06-03', amount: 10 }),
      ],
      [
        valueEvent({ dateKey: '2026-06-02', percent: 40 }),
        valueEvent({ dateKey: '2026-06-04', percent: 100 }),
      ],
      10_000,
    )
    expect(data.valueSeriesAvailable).toBe(true)
    expect(data.chartRows.map((r) => r.dateKey)).toEqual([
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
      '2026-06-04',
    ])
    expect(data.chartRows.map((r) => r.value)).toEqual([null, 4000, 4000, 10_000])
    // expense forward-fills onto value-only days too
    expect(data.chartRows.map((r) => r.expense)).toEqual([10, 10, 20, 20])
  })

  it('marks reports without a percent but does not move the value line', () => {
    const data = buildJobChargesTimelineChartData(
      [],
      [
        valueEvent({ dateKey: '2026-06-01', percent: 50 }),
        valueEvent({ dateKey: '2026-06-02', percent: null }),
      ],
      1000,
    )
    expect(data.chartRows[1]?.hasReportMarker).toBe(true)
    expect(data.chartRows[1]?.value).toBe(500)
  })

  it('disables the value series when revenue is null or zero, but keeps report markers', () => {
    for (const revenue of [null, 0]) {
      const data = buildJobChargesTimelineChartData(
        [charge({ dateKey: '2026-06-01', amount: 10 })],
        [valueEvent({ dateKey: '2026-06-01', percent: 60 })],
        revenue,
      )
      expect(data.valueSeriesAvailable).toBe(false)
      expect(data.chartRows[0]?.value).toBeNull()
      expect(data.chartRows[0]?.hasReportMarker).toBe(true)
    }
  })

  it('uses the last percent report of a day when several land on the same date', () => {
    const data = buildJobChargesTimelineChartData(
      [],
      [
        valueEvent({ dateKey: '2026-06-01', percent: 30 }),
        valueEvent({ dateKey: '2026-06-01', percent: 70 }),
      ],
      1000,
    )
    expect(data.chartRows[0]?.value).toBe(700)
    expect(data.chartRows[0]?.valueEvents).toHaveLength(2)
  })

  it('interleaves charge and report dates into one ordered x-domain', () => {
    const data = buildJobChargesTimelineChartData(
      [
        charge({ dateKey: '2026-06-05', amount: 10 }),
        charge({ dateKey: '2026-06-01', amount: 10 }),
      ],
      [valueEvent({ dateKey: '2026-06-03', percent: 10 })],
      1000,
    )
    expect(data.chartRows.map((r) => r.dateKey)).toEqual(['2026-06-01', '2026-06-03', '2026-06-05'])
  })
})

describe('formatJobChargesDateLabel', () => {
  it('formats as short month + day within the last year', () => {
    expect(formatJobChargesDateLabel('2026-06-12', 2026)).toBe('Jun 12')
  })
  it('appends the two-digit year when the row year differs from the last row year', () => {
    expect(formatJobChargesDateLabel('2025-12-30', 2026)).toBe('Dec 30 ’25')
  })
  it('labels the unknown bucket', () => {
    expect(formatJobChargesDateLabel(JOB_CHARGES_UNKNOWN_DATE_KEY, 2026)).toBe('No date')
  })
})

describe('buildJobPaymentEvents', () => {
  it('maps payments with note winning over payment_type for the label', () => {
    expect(
      buildJobPaymentEvents([
        { dateKey: '2026-06-10', amount: 500, paymentType: 'stripe', note: 'Deposit check' },
        { dateKey: '2026-06-12', amount: 250, paymentType: 'mercury', note: '  ' },
        { dateKey: null, amount: 100, paymentType: null, note: null },
      ]),
    ).toEqual([
      { dateKey: '2026-06-10', amount: 500, label: 'Payment — Deposit check' },
      { dateKey: '2026-06-12', amount: 250, label: 'Payment — mercury' },
      { dateKey: null, amount: 100, label: 'Payment' },
    ])
  })
  it('drops zero and negative amounts', () => {
    expect(
      buildJobPaymentEvents([
        { dateKey: '2026-06-10', amount: 0, paymentType: null, note: null },
        { dateKey: '2026-06-11', amount: -50, paymentType: null, note: null },
      ]),
    ).toEqual([])
  })
})

describe('buildJobChargesTimelineChartData — payments / profit line', () => {
  it('nets payments against expense and marks payment days', () => {
    const data = buildJobChargesTimelineChartData(
      [
        charge({ dateKey: '2026-06-01', amount: 100 }),
        charge({ dateKey: '2026-06-03', amount: 50 }),
      ],
      [],
      1000,
      [payment({ dateKey: '2026-06-02', amount: 60 })],
    )
    expect(data.chartRows.map((r) => [r.dateKey, r.expense, r.paymentsToDate, r.profit])).toEqual([
      ['2026-06-01', 100, 0, -100],
      ['2026-06-02', 100, 60, -40],
      ['2026-06-03', 150, 60, -90],
    ])
    expect(data.chartRows.map((r) => r.hasPaymentMarker)).toEqual([false, true, false])
    expect(data.endExpense).toBe(150)
    expect(data.endPayments).toBe(60)
    expect(data.endProfit).toBe(-90)
    expect(data.paymentRiseSegments).toEqual([{ from: 0, to: 1 }])
  })

  it('keeps rows indexed and endProfit consistent with endPayments − endExpense', () => {
    const data = buildJobChargesTimelineChartData(
      [charge({ dateKey: '2026-06-01', amount: 10.11 })],
      [],
      null,
      [payment({ dateKey: '2026-06-02', amount: 3.03 })],
    )
    expect(data.chartRows.map((r) => r.index)).toEqual([0, 1])
    expect(data.endProfit).toBeCloseTo(data.endPayments - data.endExpense, 2)
  })

  it('goes positive when payments exceed charges', () => {
    const data = buildJobChargesTimelineChartData(
      [charge({ dateKey: '2026-06-01', amount: 100 })],
      [],
      null,
      [payment({ dateKey: '2026-06-05', amount: 300 })],
    )
    expect(data.chartRows[1]?.profit).toBe(200)
    expect(data.endProfit).toBe(200)
    expect(data.paymentRiseSegments).toEqual([{ from: 0, to: 1 }])
  })

  it('same-day charge outweighing the payment stays a red (non-rise) transition but keeps the marker', () => {
    const data = buildJobChargesTimelineChartData(
      [
        charge({ dateKey: '2026-06-01', amount: 100 }),
        charge({ dateKey: '2026-06-02', amount: 80 }),
      ],
      [],
      null,
      [payment({ dateKey: '2026-06-02', amount: 30 })],
    )
    expect(data.chartRows[1]?.profit).toBe(-150)
    expect(data.chartRows[1]?.hasPaymentMarker).toBe(true)
    expect(data.paymentRiseSegments).toEqual([])
  })

  it('merges consecutive payment rises into one segment (no intervening event rows)', () => {
    const data = buildJobChargesTimelineChartData(
      [charge({ dateKey: '2026-06-01', amount: 100 })],
      [],
      null,
      [
        payment({ dateKey: '2026-06-02', amount: 20 }),
        payment({ dateKey: '2026-06-03', amount: 20 }),
        payment({ dateKey: '2026-06-05', amount: 20 }),
      ],
    )
    expect(data.paymentRiseSegments).toEqual([{ from: 0, to: 3 }])
  })

  it('keeps separated rises as separate segments across a fall', () => {
    const data = buildJobChargesTimelineChartData(
      [
        charge({ dateKey: '2026-06-01', amount: 100 }),
        charge({ dateKey: '2026-06-03', amount: 50 }),
      ],
      [],
      null,
      [
        payment({ dateKey: '2026-06-02', amount: 20 }),
        payment({ dateKey: '2026-06-04', amount: 20 }),
      ],
    )
    expect(data.paymentRiseSegments).toEqual([
      { from: 0, to: 1 },
      { from: 2, to: 3 },
    ])
  })

  it('buckets no-date payments into the leading unknown bucket', () => {
    const data = buildJobChargesTimelineChartData(
      [charge({ dateKey: '2026-06-01', amount: 100 })],
      [],
      null,
      [payment({ dateKey: null, amount: 40 })],
    )
    expect(data.hasUnknownDateBucket).toBe(true)
    expect(data.chartRows[0]?.dateKey).toBe(JOB_CHARGES_UNKNOWN_DATE_KEY)
    expect(data.chartRows[0]?.profit).toBe(40)
    expect(data.chartRows[1]?.profit).toBe(-60)
    // First row has no predecessor — no rise segment despite the payment.
    expect(data.paymentRiseSegments).toEqual([])
  })

  it('payment-only job still charts', () => {
    const data = buildJobChargesTimelineChartData([], [], null, [
      payment({ dateKey: '2026-06-02', amount: 25 }),
    ])
    expect(data.chartRows).toHaveLength(1)
    expect(data.chartRows[0]?.profit).toBe(25)
    expect(data.endExpense).toBe(0)
  })

  it('omitting the payments argument yields profit === −expense', () => {
    const data = buildJobChargesTimelineChartData(
      [charge({ dateKey: '2026-06-01', amount: 42 })],
      [],
      null,
    )
    expect(data.chartRows[0]?.profit).toBe(-42)
    expect(data.endPayments).toBe(0)
    expect(data.paymentRiseSegments).toEqual([])
  })
})

describe('buildJobChargesTimelineChartData — fallbackPercent', () => {
  it('no %-report + fallback → single value point on the last bucket, series available', () => {
    const data = buildJobChargesTimelineChartData(
      [charge({ dateKey: '2026-06-01', amount: 100 }), charge({ dateKey: '2026-06-03', amount: 50 })],
      [],
      1000,
      [],
      100,
    )
    expect(data.valueSeriesAvailable).toBe(true)
    expect(data.valueFromFallbackPercent).toBe(true)
    expect(data.chartRows[0]?.value).toBeNull()
    expect(data.chartRows[1]?.value).toBe(1000) // 100% × $1,000 on the last bucket only
  })

  it('a report with a % wins — fallback ignored', () => {
    const data = buildJobChargesTimelineChartData(
      [charge({ dateKey: '2026-06-01', amount: 100 })],
      [valueEvent({ dateKey: '2026-06-01', percent: 60 })],
      1000,
      [],
      100,
    )
    expect(data.valueFromFallbackPercent).toBe(false)
    expect(data.chartRows[0]?.value).toBe(600)
  })

  it('fallback needs a usable revenue and at least one bucket', () => {
    const noRevenue = buildJobChargesTimelineChartData(
      [charge({ dateKey: '2026-06-01', amount: 100 })],
      [],
      null,
      [],
      100,
    )
    expect(noRevenue.valueSeriesAvailable).toBe(false)
    expect(noRevenue.valueFromFallbackPercent).toBe(false)
    const noRows = buildJobChargesTimelineChartData([], [], 1000, [], 100)
    expect(noRows.valueFromFallbackPercent).toBe(false)
  })

  it('invalid fallback percents are ignored', () => {
    const data = buildJobChargesTimelineChartData(
      [charge({ dateKey: '2026-06-01', amount: 100 })],
      [],
      1000,
      [],
      150,
    )
    expect(data.valueFromFallbackPercent).toBe(false)
    expect(data.chartRows[0]?.value).toBeNull()
  })
})

describe('resolveJobCurrentPercentFallback', () => {
  it('paid invoices → 100; else pct_complete; else null', () => {
    expect(
      resolveJobCurrentPercentFallback({
        pct_complete: null,
        invoices: [{ status: 'paid', amount: 500 }],
      }),
    ).toBe(100)
    expect(
      resolveJobCurrentPercentFallback({
        pct_complete: 40,
        invoices: [{ status: 'billed', amount: 500 }],
      }),
    ).toBe(40)
    expect(resolveJobCurrentPercentFallback({ pct_complete: null, invoices: [] })).toBeNull()
  })
})

describe('computeChargesTimelineAxisDomains', () => {
  /** Fraction of an axis domain sitting below zero. */
  const belowZeroFrac = ([lo, hi]: [number, number]) => -lo / (hi - lo)

  it('cost and profit share the left axis; value gets the right, $0 aligned', () => {
    const d = computeChargesTimelineAxisDomains([
      { expense: 4000, profit: -2000, value: null },
      { expense: 10000, profit: 5000, value: 8000 },
    ])
    expect(belowZeroFrac(d.left)).toBeCloseTo(belowZeroFrac(d.right), 10)
    expect(d.left[1]).toBeCloseTo(10000 * 1.15 + 5) // max of expense/profit drives the left top
    expect(d.left[0]).toBeCloseTo(-2000 * 1.15 - 5) // min profit drives the left bottom
    expect(d.right[1]).toBeCloseTo(8000 * 1.15 + 5) // max value drives the right top
  })

  it('profit above expense can drive the left top', () => {
    const d = computeChargesTimelineAxisDomains([
      { expense: 1000, profit: 6000, value: null },
    ])
    expect(d.left[1]).toBeCloseTo(6000 * 1.15 + 5)
  })

  it('all-cost job renders symmetric-ish on the left; right still zero-aligned', () => {
    const d = computeChargesTimelineAxisDomains([
      { expense: 10000, profit: -10000, value: 3000 },
    ])
    expect(d.left[1]).toBeCloseTo(10000 * 1.15 + 5)
    expect(d.left[0]).toBeCloseTo(-(10000 * 1.15 + 5))
    expect(belowZeroFrac(d.left)).toBeCloseTo(belowZeroFrac(d.right), 10)
  })

  it('degenerate empty/zero data still returns sane non-zero domains', () => {
    const d = computeChargesTimelineAxisDomains([])
    expect(d.left).toEqual([-5, 5])
    expect(d.right).toEqual([-5, 5])
  })
})

describe('newestPercentEvent / buildJobManualPercentEvents (v2.3372)', () => {
  const report = (dateKey: string | null, percent: number | null): JobValueEvent => ({ dateKey, percent, label: 'Report by A' })
  it('picks the newest dated % whoever set it; a hand-set beats a report on the same day', () => {
    const manual = buildJobManualPercentEvents([
      { dateKey: '2026-09-03', pct: 90, changedByName: 'Taunya' },
      { dateKey: '2026-09-03', pct: 120, changedByName: 'x' },
      { dateKey: null, pct: 50, changedByName: null },
    ])
    expect(manual).toEqual([
      { dateKey: '2026-09-03', percent: 90, label: 'Set on the job by Taunya', kind: 'manual' },
      { dateKey: null, percent: 50, label: 'Set on the job by the office', kind: 'manual' },
    ])
    expect(newestPercentEvent([report('2026-05-15', 77), ...manual])?.percent).toBe(90)
    expect(newestPercentEvent([report('2026-09-04', 95), ...manual])?.percent).toBe(95)
    expect(newestPercentEvent([report('2026-09-03', 95), ...manual])?.kind).toBe('manual')
    expect(newestPercentEvent([...manual, report('2026-09-03', 95)])?.kind).toBe('manual')
    expect(newestPercentEvent([report('2026-05-15', 77), ...manual], '2026-06-01')?.percent).toBe(77)
    expect(newestPercentEvent([report('2026-05-15', null), report(null, 40)])).toBeNull()
  })
  it('a hand-set steps the value line without a report flag', () => {
    const data = buildJobChargesTimelineChartData(
      [{ source: 'team_labor', dateKey: '2026-05-15', amount: 100, label: 'x' }],
      [report('2026-05-15', 77), ...buildJobManualPercentEvents([{ dateKey: '2026-09-03', pct: 90, changedByName: 'Taunya' }])],
      1000,
    )
    const may = data.chartRows.find((r) => r.dateKey === '2026-05-15')!
    const sep = data.chartRows.find((r) => r.dateKey === '2026-09-03')!
    expect(may.value).toBe(770)
    expect(may.hasReportMarker).toBe(true)
    expect(sep.value).toBe(900)
    expect(sep.hasReportMarker).toBe(false)
  })
})
