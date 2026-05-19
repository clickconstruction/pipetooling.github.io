import { describe, it, expect } from 'vitest'
import {
  ALIGN_EDITOR_ROLES,
  buildAlignmentPlan,
  canAlignStages,
  type AlignStageInput,
} from './projectsForecastAlignStages'

const TODAY = '2026-05-19'

function stage(partial: Partial<AlignStageInput> & { id: string }): AlignStageInput {
  return {
    sequence_order: 1,
    name: 'Stage',
    status: 'pending',
    scheduled_start_date: null,
    scheduled_end_date: null,
    started_at: null,
    ...partial,
  }
}

describe('buildAlignmentPlan', () => {
  it('returns an empty plan for no stages', () => {
    const plan = buildAlignmentPlan([], TODAY)
    expect(plan.rows).toEqual([])
    expect(plan.changedRows).toEqual([])
    expect(plan.anchorSource).toBe('none')
    expect(plan.anchorYmd).toBe('')
  })

  it('marks a single stage as unchanged when its scheduled_* dates are intact', () => {
    const plan = buildAlignmentPlan(
      [
        stage({
          id: 'a',
          sequence_order: 1,
          name: 'Rough-in',
          scheduled_start_date: '2026-08-01',
          scheduled_end_date: '2026-08-06',
        }),
      ],
      TODAY,
    )
    expect(plan.anchorSource).toBe('scheduled_start_date')
    expect(plan.anchorYmd).toBe('2026-08-01')
    expect(plan.rows).toHaveLength(1)
    expect(plan.rows[0]).toMatchObject({
      stageId: 'a',
      newStartYmd: '2026-08-01',
      newEndYmd: '2026-08-06',
      lengthDays: 5,
      change: 'unchanged',
    })
    expect(plan.changedRows).toEqual([])
  })

  it('keeps an already-chained two-stage plan unchanged', () => {
    const plan = buildAlignmentPlan(
      [
        stage({
          id: 'a',
          sequence_order: 1,
          scheduled_start_date: '2026-08-01',
          scheduled_end_date: '2026-08-06',
        }),
        stage({
          id: 'b',
          sequence_order: 2,
          scheduled_start_date: '2026-08-06',
          scheduled_end_date: '2026-08-10',
        }),
      ],
      TODAY,
    )
    expect(plan.changedRows).toEqual([])
    expect(plan.rows.map((r) => r.change)).toEqual(['unchanged', 'unchanged'])
  })

  it('shifts a gapped second stage to start at the first stage end, preserving length', () => {
    const plan = buildAlignmentPlan(
      [
        stage({
          id: 'a',
          sequence_order: 1,
          scheduled_start_date: '2026-08-01',
          scheduled_end_date: '2026-08-06',
        }),
        stage({
          id: 'b',
          sequence_order: 2,
          scheduled_start_date: '2026-08-15',
          scheduled_end_date: '2026-08-21',
        }),
      ],
      TODAY,
    )
    expect(plan.rows[0]?.change).toBe('unchanged')
    expect(plan.rows[1]).toMatchObject({
      stageId: 'b',
      oldStartYmd: '2026-08-15',
      oldEndYmd: '2026-08-21',
      newStartYmd: '2026-08-06',
      newEndYmd: '2026-08-12',
      lengthDays: 6,
      change: 'shifted',
    })
    expect(plan.changedRows.map((r) => r.stageId)).toEqual(['b'])
  })

  it('fills a stage with neither scheduled date as a 1-day placeholder', () => {
    const plan = buildAlignmentPlan(
      [
        stage({
          id: 'a',
          sequence_order: 1,
          scheduled_start_date: '2026-08-01',
          scheduled_end_date: '2026-08-06',
        }),
        stage({ id: 'b', sequence_order: 2 }),
      ],
      TODAY,
    )
    expect(plan.rows[1]).toMatchObject({
      stageId: 'b',
      oldStartYmd: null,
      oldEndYmd: null,
      newStartYmd: '2026-08-06',
      newEndYmd: '2026-08-07',
      lengthDays: 1,
      change: 'filled',
    })
  })

  it('fills a stage with only a start set as 1-day (length defaults to 1)', () => {
    const plan = buildAlignmentPlan(
      [
        stage({
          id: 'a',
          sequence_order: 1,
          scheduled_start_date: '2026-08-01',
          scheduled_end_date: '2026-08-06',
        }),
        stage({
          id: 'b',
          sequence_order: 2,
          scheduled_start_date: '2026-08-20',
        }),
      ],
      TODAY,
    )
    expect(plan.rows[1]).toMatchObject({
      stageId: 'b',
      newStartYmd: '2026-08-06',
      newEndYmd: '2026-08-07',
      lengthDays: 1,
      change: 'filled',
    })
  })

  it('repairs a stage whose scheduled_end_date is before its scheduled_start_date', () => {
    const plan = buildAlignmentPlan(
      [
        stage({
          id: 'a',
          sequence_order: 1,
          scheduled_start_date: '2026-08-01',
          scheduled_end_date: '2026-08-06',
        }),
        stage({
          id: 'b',
          sequence_order: 2,
          scheduled_start_date: '2026-08-15',
          scheduled_end_date: '2026-08-10',
        }),
      ],
      TODAY,
    )
    expect(plan.rows[1]).toMatchObject({
      stageId: 'b',
      newStartYmd: '2026-08-06',
      newEndYmd: '2026-08-07',
      lengthDays: 1,
      change: 'repaired',
    })
  })

  it('falls back to started_at when the first stage has no scheduled_start_date', () => {
    const plan = buildAlignmentPlan(
      [
        stage({
          id: 'a',
          sequence_order: 1,
          scheduled_start_date: null,
          scheduled_end_date: null,
          started_at: '2026-09-01T15:00:00Z',
        }),
        stage({
          id: 'b',
          sequence_order: 2,
          scheduled_start_date: '2026-09-20',
          scheduled_end_date: '2026-09-25',
        }),
      ],
      TODAY,
    )
    expect(plan.anchorSource).toBe('started_at')
    expect(plan.anchorYmd).toBe('2026-09-01')
    expect(plan.rows[0]?.newStartYmd).toBe('2026-09-01')
    // Stage 0 has no scheduled dates → length 1 → end is 2026-09-02.
    expect(plan.rows[0]?.newEndYmd).toBe('2026-09-02')
    expect(plan.rows[1]?.newStartYmd).toBe('2026-09-02')
    expect(plan.rows[1]?.lengthDays).toBe(5)
    expect(plan.rows[1]?.newEndYmd).toBe('2026-09-07')
  })

  it('falls back to todayYmd when the first stage has neither a scheduled_start nor started_at', () => {
    const plan = buildAlignmentPlan(
      [
        stage({ id: 'a', sequence_order: 1 }),
        stage({ id: 'b', sequence_order: 2 }),
      ],
      TODAY,
    )
    expect(plan.anchorSource).toBe('today')
    expect(plan.anchorYmd).toBe(TODAY)
    expect(plan.rows[0]?.newStartYmd).toBe(TODAY)
    expect(plan.rows[1]?.newStartYmd).toBe('2026-05-20')
  })

  it('flags historical stages but still chains them', () => {
    const plan = buildAlignmentPlan(
      [
        stage({
          id: 'a',
          sequence_order: 1,
          status: 'completed',
          scheduled_start_date: '2026-04-01',
          scheduled_end_date: '2026-04-08',
        }),
        stage({
          id: 'b',
          sequence_order: 2,
          status: 'approved',
          scheduled_start_date: '2026-04-30',
          scheduled_end_date: '2026-05-02',
        }),
        stage({
          id: 'c',
          sequence_order: 3,
          status: 'skipped',
          scheduled_start_date: '2026-05-10',
          scheduled_end_date: '2026-05-13',
        }),
        stage({
          id: 'd',
          sequence_order: 4,
          status: 'pending',
          scheduled_start_date: null,
          scheduled_end_date: null,
        }),
      ],
      TODAY,
    )
    expect(plan.rows.map((r) => r.isHistorical)).toEqual([true, true, true, false])
    // Lengths preserved (7 / 2 / 3 / 1) and chained from stage 0's start.
    expect(plan.rows.map((r) => `${r.newStartYmd} → ${r.newEndYmd}`)).toEqual([
      '2026-04-01 → 2026-04-08',
      '2026-04-08 → 2026-04-10',
      '2026-04-10 → 2026-04-13',
      '2026-04-13 → 2026-04-14',
    ])
  })

  it('resolves sequence_order ties by input order', () => {
    const plan = buildAlignmentPlan(
      [
        stage({
          id: 'first',
          sequence_order: 1,
          scheduled_start_date: '2026-01-01',
          scheduled_end_date: '2026-01-04',
        }),
        stage({
          id: 'tieA',
          sequence_order: 2,
          scheduled_start_date: '2026-01-04',
          scheduled_end_date: '2026-01-06',
        }),
        stage({
          id: 'tieB',
          sequence_order: 2,
          scheduled_start_date: '2026-01-06',
          scheduled_end_date: '2026-01-09',
        }),
      ],
      TODAY,
    )
    expect(plan.rows.map((r) => r.stageId)).toEqual(['first', 'tieA', 'tieB'])
    expect(plan.changedRows).toEqual([])
  })

  it('preserves length without drift over many stages', () => {
    const stages: AlignStageInput[] = []
    for (let i = 0; i < 12; i++) {
      stages.push(
        stage({
          id: `s${i}`,
          sequence_order: i + 1,
          scheduled_start_date: i === 0 ? '2026-01-01' : null,
          scheduled_end_date: i === 0 ? '2026-01-04' : null,
        }),
      )
    }
    const plan = buildAlignmentPlan(stages, TODAY)
    // First stage 3-day, all other stages default to 1-day; chain ends 11 days after Jan 4.
    expect(plan.rows[0]?.newEndYmd).toBe('2026-01-04')
    expect(plan.rows[plan.rows.length - 1]?.newEndYmd).toBe('2026-01-15')
    // No drift: every subsequent row's start equals the previous row's end.
    for (let i = 1; i < plan.rows.length; i++) {
      expect(plan.rows[i]?.newStartYmd).toBe(plan.rows[i - 1]?.newEndYmd)
    }
  })

  it('treats malformed YMD strings as missing for length derivation', () => {
    const plan = buildAlignmentPlan(
      [
        stage({
          id: 'a',
          sequence_order: 1,
          scheduled_start_date: 'not-a-date',
          scheduled_end_date: '2026-08-08',
        }),
      ],
      TODAY,
    )
    expect(plan.rows[0]).toMatchObject({
      oldStartYmd: null,
      oldEndYmd: '2026-08-08',
      change: 'filled',
      lengthDays: 1,
    })
    // Anchor falls back to today since scheduled_start was malformed.
    expect(plan.anchorSource).toBe('today')
  })
})

describe('canAlignStages / ALIGN_EDITOR_ROLES', () => {
  it('allows the four editor roles', () => {
    for (const r of ['dev', 'master_technician', 'assistant', 'superintendent']) {
      expect(ALIGN_EDITOR_ROLES.has(r)).toBe(true)
      expect(canAlignStages(r)).toBe(true)
    }
  })
  it('rejects everyone else', () => {
    for (const r of ['subcontractor', 'helpers', 'estimator', 'primary', '', null, undefined]) {
      expect(canAlignStages(r as string | null | undefined)).toBe(false)
    }
  })
})
