import { describe, expect, it } from 'vitest'
import {
  buildJobChargeEvents,
  buildJobChargesTimelineChartData,
  buildJobValueEvents,
  formatJobChargesDateLabel,
  JOB_CHARGES_UNKNOWN_DATE_KEY,
  reportCompletionPercent,
  tallyPartEventAmount,
  ymdFromDateOnlyOrIso,
  type JobChargeEvent,
  type JobValueEvent,
} from './jobChargesTimeline'
import {
  REPORT_FIELD_LABEL_JOB_COMPLETION,
  REPORT_FIELD_LABEL_LEGACY_WHO,
} from './reportTemplateFieldDisplay'

const isoToYmdStub = (iso: string) => (iso.startsWith('2026-06-12T') ? '2026-06-12' : '')

function charge(partial: Partial<JobChargeEvent>): JobChargeEvent {
  return { source: 'team_labor', dateKey: '2026-06-01', amount: 0, label: 'x', ...partial }
}

function valueEvent(partial: Partial<JobValueEvent>): JobValueEvent {
  return { dateKey: '2026-06-01', percent: null, label: 'Report by A', ...partial }
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
