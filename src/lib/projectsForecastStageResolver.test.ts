import { describe, it, expect } from 'vitest'
import {
  resolveForecastStages,
  resolvedStagesEnvelope,
  type ForecastStageInput,
} from './projectsForecastStageResolver'

const TODAY = '2026-05-18'

function stage(overrides: Partial<ForecastStageInput> & { id: string; sequence_order: number; name: string }): ForecastStageInput {
  return {
    status: 'pending',
    assigned_to_name: null,
    scheduled_start_date: null,
    scheduled_end_date: null,
    started_at: null,
    ended_at: null,
    skipped_reason: null,
    ...overrides,
  }
}

describe('resolveForecastStages', () => {
  it('returns an empty array when given no stages', () => {
    expect(resolveForecastStages([], TODAY)).toEqual([])
  })

  it('uses the literal scheduled dates when both are set', () => {
    const out = resolveForecastStages(
      [
        stage({
          id: 's1',
          sequence_order: 1,
          name: 'Rough-in',
          scheduled_start_date: '2026-05-20',
          scheduled_end_date: '2026-05-25',
        }),
      ],
      TODAY,
    )
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      stageId: 's1',
      startYmd: '2026-05-20',
      endYmd: '2026-05-25',
      isInferred: false,
      isUnscheduled: false,
      colorKey: 'pending',
    })
  })

  it('chains the next stage start off the prior resolved end when scheduled_start_date is missing', () => {
    const out = resolveForecastStages(
      [
        stage({
          id: 's1',
          sequence_order: 1,
          name: 'A',
          scheduled_start_date: '2026-05-20',
          scheduled_end_date: '2026-05-25',
        }),
        stage({
          id: 's2',
          sequence_order: 2,
          name: 'B',
          scheduled_end_date: '2026-05-30',
        }),
      ],
      TODAY,
    )
    expect(out[1]?.startYmd).toBe('2026-05-25')
    expect(out[1]?.endYmd).toBe('2026-05-30')
    expect(out[1]?.isInferred).toBe(true)
  })

  it('anchors a completely unscheduled first stage at today and emits a 1-day unscheduled bar', () => {
    const out = resolveForecastStages(
      [stage({ id: 's1', sequence_order: 1, name: 'A' })],
      TODAY,
    )
    expect(out[0]?.startYmd).toBe(TODAY)
    expect(out[0]?.endYmd).toBe('2026-05-19')
    expect(out[0]?.isUnscheduled).toBe(true)
    expect(out[0]?.colorKey).toBe('unscheduled')
  })

  it('chains successive unscheduled stages off each prior 1-day bar', () => {
    const out = resolveForecastStages(
      [
        stage({ id: 's1', sequence_order: 1, name: 'A' }),
        stage({ id: 's2', sequence_order: 2, name: 'B' }),
        stage({ id: 's3', sequence_order: 3, name: 'C' }),
      ],
      TODAY,
    )
    expect(out[0]?.startYmd).toBe(TODAY)
    expect(out[0]?.endYmd).toBe('2026-05-19')
    expect(out[1]?.startYmd).toBe('2026-05-19')
    expect(out[1]?.endYmd).toBe('2026-05-20')
    expect(out[2]?.startYmd).toBe('2026-05-20')
    expect(out[2]?.endYmd).toBe('2026-05-21')
    for (const r of out) {
      expect(r.isUnscheduled).toBe(true)
      expect(r.colorKey).toBe('unscheduled')
    }
  })

  it('falls back to started_at calendar day when scheduled_start_date is missing and there is no prior stage', () => {
    const out = resolveForecastStages(
      [
        stage({
          id: 's1',
          sequence_order: 1,
          name: 'A',
          status: 'in_progress',
          started_at: '2026-05-10 14:00:00+00',
        }),
      ],
      TODAY,
    )
    // 14:00 UTC on 2026-05-10 is 09:00 CDT on 2026-05-10 — same Chicago day.
    expect(out[0]?.startYmd).toBe('2026-05-10')
    expect(out[0]?.endYmd).toBe('2026-05-11')
    expect(out[0]?.isUnscheduled).toBe(false)
    expect(out[0]?.colorKey).toBe('in_progress')
  })

  it('uses ended_at calendar day when scheduled_end_date is missing', () => {
    const out = resolveForecastStages(
      [
        stage({
          id: 's1',
          sequence_order: 1,
          name: 'A',
          status: 'completed',
          scheduled_start_date: '2026-05-10',
          ended_at: '2026-05-13 22:00:00+00',
        }),
      ],
      TODAY,
    )
    expect(out[0]?.startYmd).toBe('2026-05-10')
    expect(out[0]?.endYmd).toBe('2026-05-13')
  })

  it('treats only-start (no scheduled_end_date, no ended_at) as inferred 1-day window', () => {
    const out = resolveForecastStages(
      [
        stage({
          id: 's1',
          sequence_order: 1,
          name: 'A',
          scheduled_start_date: '2026-05-20',
        }),
      ],
      TODAY,
    )
    expect(out[0]?.startYmd).toBe('2026-05-20')
    expect(out[0]?.endYmd).toBe('2026-05-21')
    expect(out[0]?.isInferred).toBe(true)
    expect(out[0]?.isUnscheduled).toBe(false)
  })

  it('treats only-end (no scheduled_start_date, no actuals) as chained-or-today start with literal end', () => {
    const out = resolveForecastStages(
      [
        stage({
          id: 's1',
          sequence_order: 1,
          name: 'A',
          scheduled_end_date: '2026-05-25',
        }),
      ],
      TODAY,
    )
    expect(out[0]?.startYmd).toBe(TODAY)
    expect(out[0]?.endYmd).toBe('2026-05-25')
    expect(out[0]?.isInferred).toBe(true)
    expect(out[0]?.isUnscheduled).toBe(false)
  })

  it('renders skipped stages at the chained position with the skipped color', () => {
    const out = resolveForecastStages(
      [
        stage({
          id: 's1',
          sequence_order: 1,
          name: 'A',
          scheduled_start_date: '2026-05-10',
          scheduled_end_date: '2026-05-12',
        }),
        stage({
          id: 's2',
          sequence_order: 2,
          name: 'Skipped',
          status: 'skipped',
          skipped_reason: 'not needed',
        }),
        stage({
          id: 's3',
          sequence_order: 3,
          name: 'C',
          scheduled_end_date: '2026-05-20',
        }),
      ],
      TODAY,
    )
    expect(out[1]?.colorKey).toBe('skipped')
    expect(out[1]?.startYmd).toBe('2026-05-12')
    expect(out[1]?.endYmd).toBe('2026-05-13')
    // Stage 3 should chain off the skipped stage's inferred end.
    expect(out[2]?.startYmd).toBe('2026-05-13')
    expect(out[2]?.endYmd).toBe('2026-05-20')
  })

  it('renders rejected stages with the rejected color', () => {
    const out = resolveForecastStages(
      [
        stage({
          id: 's1',
          sequence_order: 1,
          name: 'A',
          status: 'rejected',
          scheduled_start_date: '2026-05-10',
          scheduled_end_date: '2026-05-12',
        }),
      ],
      TODAY,
    )
    expect(out[0]?.colorKey).toBe('rejected')
  })

  it('keeps completed past stages on their actual dates rather than chaining', () => {
    const out = resolveForecastStages(
      [
        stage({
          id: 's1',
          sequence_order: 1,
          name: 'Done',
          status: 'completed',
          started_at: '2026-05-01 12:00:00+00',
          ended_at: '2026-05-05 12:00:00+00',
        }),
        stage({
          id: 's2',
          sequence_order: 2,
          name: 'Next',
          status: 'pending',
        }),
      ],
      TODAY,
    )
    expect(out[0]?.startYmd).toBe('2026-05-01')
    expect(out[0]?.endYmd).toBe('2026-05-05')
    // Next stage chains off the actual end day, not today.
    expect(out[1]?.startYmd).toBe('2026-05-05')
    expect(out[1]?.endYmd).toBe('2026-05-06')
  })

  it('preserves input order when two stages share the same sequence_order', () => {
    const out = resolveForecastStages(
      [
        stage({
          id: 'first',
          sequence_order: 5,
          name: 'First',
          scheduled_start_date: '2026-05-10',
          scheduled_end_date: '2026-05-12',
        }),
        stage({
          id: 'second',
          sequence_order: 5,
          name: 'Second',
          scheduled_start_date: '2026-05-15',
          scheduled_end_date: '2026-05-18',
        }),
      ],
      TODAY,
    )
    expect(out.map((r) => r.stageId)).toEqual(['first', 'second'])
  })

  it('sorts by sequence_order when input is out-of-order', () => {
    const out = resolveForecastStages(
      [
        stage({
          id: 's2',
          sequence_order: 2,
          name: 'B',
          scheduled_start_date: '2026-06-01',
          scheduled_end_date: '2026-06-05',
        }),
        stage({
          id: 's1',
          sequence_order: 1,
          name: 'A',
          scheduled_start_date: '2026-05-01',
          scheduled_end_date: '2026-05-05',
        }),
      ],
      TODAY,
    )
    expect(out.map((r) => r.stageId)).toEqual(['s1', 's2'])
  })

  it('passes the assignee name through to the resolved bar', () => {
    const out = resolveForecastStages(
      [
        stage({
          id: 's1',
          sequence_order: 1,
          name: 'A',
          assigned_to_name: 'Abe Lincoln',
          scheduled_start_date: '2026-05-10',
        }),
      ],
      TODAY,
    )
    expect(out[0]?.assignee).toBe('Abe Lincoln')
  })

  it('leaves end before start when scheduled data is contradictory (no silent clamp)', () => {
    const out = resolveForecastStages(
      [
        stage({
          id: 's1',
          sequence_order: 1,
          name: 'Broken',
          scheduled_start_date: '2026-05-20',
          scheduled_end_date: '2026-05-15',
        }),
      ],
      TODAY,
    )
    expect(out[0]?.startYmd).toBe('2026-05-20')
    expect(out[0]?.endYmd).toBe('2026-05-15')
  })

  it('marks isInferred when a YMD comes from a fallback (actual day) but isUnscheduled stays false', () => {
    const out = resolveForecastStages(
      [
        stage({
          id: 's1',
          sequence_order: 1,
          name: 'A',
          status: 'in_progress',
          started_at: '2026-05-10 14:00:00+00',
        }),
      ],
      TODAY,
    )
    expect(out[0]?.isUnscheduled).toBe(false)
    // start = actual day (NOT inferred), end = +1 day (inferred) → isInferred = true.
    expect(out[0]?.isInferred).toBe(true)
  })
})

describe('resolvedStagesEnvelope', () => {
  it('returns null for an empty list', () => {
    expect(resolvedStagesEnvelope([])).toBeNull()
  })

  it('returns [min(start), max(end)] across the bars', () => {
    const out = resolveForecastStages(
      [
        stage({
          id: 's1',
          sequence_order: 1,
          name: 'A',
          scheduled_start_date: '2026-05-10',
          scheduled_end_date: '2026-05-15',
        }),
        stage({
          id: 's2',
          sequence_order: 2,
          name: 'B',
          scheduled_start_date: '2026-05-05',
          scheduled_end_date: '2026-05-20',
        }),
      ],
      TODAY,
    )
    expect(resolvedStagesEnvelope(out)).toEqual({ startYmd: '2026-05-05', endYmd: '2026-05-20' })
  })
})
