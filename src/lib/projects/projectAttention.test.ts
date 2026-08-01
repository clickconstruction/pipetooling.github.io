import { describe, expect, it } from 'vitest'
import { buildProjectAttention, WAITING_DAYS_THRESHOLD } from './projectAttention'
import type { AttentionStepInput } from './projectAttention'

const TODAY = '2026-08-01'
const toYmd = (iso: string) => iso.slice(0, 10)

function step(overrides: Partial<AttentionStepInput> & { name: string; sequence_order: number }): AttentionStepInput {
  return { status: 'pending', assigned_to_name: null, started_at: null, scheduled_start_date: null, scheduled_end_date: null, ...overrides }
}

describe('buildProjectAttention current-step resolution', () => {
  it('picks the first rejected step over in_progress and pending, matching the legacy memo', () => {
    const result = buildProjectAttention(
      [
        step({ name: 'A', sequence_order: 1, status: 'completed' }),
        step({ name: 'B', sequence_order: 2, status: 'in_progress' }),
        step({ name: 'C', sequence_order: 3, status: 'rejected' }),
      ],
      TODAY,
      toYmd,
    )
    expect(result.current).toEqual({ name: 'C', position: 3, assignee: null, daysInStep: null })
    expect(result.flags).toEqual([{ kind: 'rejected', stepName: 'C' }])
    expect(result.attentionScore).toBe(4)
  })

  it('falls back to first in_progress, then first pending, sorted by sequence_order', () => {
    const result = buildProjectAttention(
      [
        step({ name: 'C', sequence_order: 3 }),
        step({ name: 'A', sequence_order: 1, status: 'completed' }),
        step({ name: 'B', sequence_order: 2 }),
      ],
      TODAY,
      toYmd,
    )
    expect(result.current?.name).toBe('B')
    expect(result.current?.position).toBe(2)
    expect(result.total).toBe(3)
  })

  it('returns no current step when every step is finished', () => {
    const result = buildProjectAttention(
      [step({ name: 'A', sequence_order: 1, status: 'approved' }), step({ name: 'B', sequence_order: 2, status: 'skipped' })],
      TODAY,
      toYmd,
    )
    expect(result.current).toBeNull()
    expect(result.flags).toEqual([])
    expect(result.attentionScore).toBe(0)
  })
})

describe('buildProjectAttention flags', () => {
  it('flags an assigned in_progress step as waiting once it crosses the threshold', () => {
    const result = buildProjectAttention(
      [
        step({
          name: 'Rough In Walk',
          sequence_order: 1,
          status: 'in_progress',
          assigned_to_name: 'Robert',
          started_at: '2026-07-28T14:00:00.000Z',
          scheduled_start_date: '2026-07-28',
        }),
      ],
      TODAY,
      toYmd,
    )
    expect(result.current?.daysInStep).toBe(4)
    expect(result.flags).toEqual([{ kind: 'waiting', stepName: 'Rough In Walk', assignee: 'Robert', days: 4 }])
  })

  it('does not flag waiting below the threshold', () => {
    const startedYmd = '2026-07-30'
    const result = buildProjectAttention(
      [
        step({
          name: 'A',
          sequence_order: 1,
          status: 'in_progress',
          assigned_to_name: 'Robert',
          started_at: `${startedYmd}T14:00:00.000Z`,
          scheduled_start_date: startedYmd,
        }),
      ],
      TODAY,
      toYmd,
    )
    expect(result.current?.daysInStep).toBeLessThan(WAITING_DAYS_THRESHOLD)
    expect(result.flags).toEqual([])
  })

  it('flags an unassigned current step plus missing schedule together', () => {
    const result = buildProjectAttention([step({ name: 'Rough In Bunker', sequence_order: 1 })], TODAY, toYmd)
    expect(result.flags).toEqual([
      { kind: 'unassigned-current', stepName: 'Rough In Bunker' },
      { kind: 'no-schedule', stepName: 'Rough In Bunker' },
    ])
    expect(result.attentionScore).toBe(2)
  })

  it('suppresses the schedule flag when either expected date is set', () => {
    const result = buildProjectAttention(
      [step({ name: 'A', sequence_order: 1, assigned_to_name: 'Behar Kraja', scheduled_end_date: '2026-08-05' })],
      TODAY,
      toYmd,
    )
    expect(result.flags).toEqual([])
  })

  it('a whitespace-only assignee counts as unassigned', () => {
    const result = buildProjectAttention(
      [step({ name: 'A', sequence_order: 1, assigned_to_name: '   ', scheduled_start_date: '2026-08-02' })],
      TODAY,
      toYmd,
    )
    expect(result.flags).toEqual([{ kind: 'unassigned-current', stepName: 'A' }])
  })
})
