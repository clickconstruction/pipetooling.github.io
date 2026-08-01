import { describe, expect, it } from 'vitest'
import { buildProjectSubRoster } from './projectSubRoster'
import type { SubRosterStepInput } from './projectSubRoster'

function step(overrides: Partial<SubRosterStepInput> & { name: string; sequence_order: number }): SubRosterStepInput {
  return { status: 'pending', assigned_to_name: null, assigned_person_id: null, ...overrides }
}

const BEHAR_ID = 'p-behar'

describe('buildProjectSubRoster', () => {
  it('groups by person id first, tallying active vs total steps in sequence order', () => {
    const roster = buildProjectSubRoster(
      [
        step({ name: 'Rough In', sequence_order: 1, status: 'completed', assigned_to_name: 'Behar Kraja', assigned_person_id: BEHAR_ID }),
        step({ name: 'Top Out', sequence_order: 2, status: 'in_progress', assigned_to_name: 'Behar Kraja', assigned_person_id: BEHAR_ID }),
        step({ name: 'Trim Set', sequence_order: 3, assigned_to_name: 'Behar Kraja', assigned_person_id: BEHAR_ID }),
      ],
      new Set([BEHAR_ID]),
      new Set(),
    )
    expect(roster).toEqual([
      {
        key: BEHAR_ID,
        name: 'Behar Kraja',
        personId: BEHAR_ID,
        activeStepCount: 2,
        totalStepCount: 3,
        currentStepName: 'Top Out',
      },
    ])
  })

  it('falls back to name identity for unresolved assignments (the "(Rough In)" variant case)', () => {
    const roster = buildProjectSubRoster(
      [step({ name: 'Rough In', sequence_order: 1, assigned_to_name: 'Behar Kraja (Rough In)' })],
      new Set(),
      new Set(['behar kraja (rough in)']),
    )
    expect(roster).toHaveLength(1)
    expect(roster[0]?.key).toBe('name:behar kraja (rough in)')
    expect(roster[0]?.personId).toBeNull()
  })

  it('excludes non-sub assignees and unassigned steps', () => {
    const roster = buildProjectSubRoster(
      [
        step({ name: 'Walk', sequence_order: 1, assigned_to_name: 'Robert' }),
        step({ name: 'Bill Out', sequence_order: 2, assigned_to_name: null }),
      ],
      new Set(),
      new Set(),
    )
    expect(roster).toEqual([])
  })

  it('a rejected step counts as active and names the current step', () => {
    const roster = buildProjectSubRoster(
      [step({ name: 'Top Out', sequence_order: 1, status: 'rejected', assigned_to_name: 'Texas R & A', assigned_person_id: 'p-txra' })],
      new Set(['p-txra']),
      new Set(),
    )
    expect(roster[0]?.activeStepCount).toBe(1)
    expect(roster[0]?.currentStepName).toBe('Top Out')
  })
})
