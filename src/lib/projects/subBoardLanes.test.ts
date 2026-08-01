import { describe, expect, it } from 'vitest'
import { buildSubBoardLanes } from './subBoardLanes'
import type { SubBoardCommitmentInput } from './subBoardLanes'

const WIN = ['2026-08-11', '2026-08-24'] as const

function wo(overrides: Partial<SubBoardCommitmentInput> & { id: string; person_id: string; display_name: string }): SubBoardCommitmentInput {
  return {
    status: 'accepted',
    amount: 1000,
    proposed_start: null,
    proposed_end: null,
    stepStart: null,
    stepEnd: null,
    stepName: 'Top Out',
    projectName: 'Dudley Mason',
    projectId: 'proj-1',
    ...overrides,
  }
}

describe('buildSubBoardLanes', () => {
  it('prefers step expected dates over the proposed window and positions within the window', () => {
    const { lanes, undatedCount } = buildSubBoardLanes(
      [wo({ id: 'c1', person_id: 'p1', display_name: 'Behar Kraja', stepStart: '2026-08-12', stepEnd: '2026-08-19', proposed_start: '2026-08-01', proposed_end: '2026-08-05' })],
      WIN[0],
      WIN[1],
    )
    expect(undatedCount).toBe(0)
    expect(lanes).toHaveLength(1)
    const bar = lanes[0]!.bars[0]!
    expect(bar.startYmd).toBe('2026-08-12')
    expect(bar.endYmd).toBe('2026-08-19')
    expect(bar.ghost).toBe(false)
    expect(bar.startPct).toBeCloseTo((1 / 14) * 100, 5)
    expect(bar.widthPct).toBeCloseTo((8 / 14) * 100, 5)
  })

  it('offered orders render as ghosts; draft/declined/settled do not bar; undated are counted', () => {
    const { lanes, undatedCount } = buildSubBoardLanes(
      [
        wo({ id: 'c1', person_id: 'p1', display_name: 'Texas R & A', status: 'offered', proposed_start: '2026-08-14', proposed_end: '2026-08-18' }),
        wo({ id: 'c2', person_id: 'p1', display_name: 'Texas R & A', status: 'declined', proposed_start: '2026-08-14', proposed_end: '2026-08-18' }),
        wo({ id: 'c3', person_id: 'p2', display_name: 'Kyle', status: 'accepted' }),
      ],
      WIN[0],
      WIN[1],
    )
    expect(lanes).toHaveLength(1)
    expect(lanes[0]!.bars[0]!.ghost).toBe(true)
    expect(lanes[0]!.bars[0]!.title).toContain('awaiting answer')
    expect(undatedCount).toBe(1)
  })

  it('flags overlapping bars within a lane, sorts lanes by name, clamps to the window', () => {
    const { lanes } = buildSubBoardLanes(
      [
        wo({ id: 'c1', person_id: 'p-kyle', display_name: 'Kyle', stepStart: '2026-08-10', stepEnd: '2026-08-15', stepName: 'Bunker', projectName: 'Gun Dog' }),
        wo({ id: 'c2', person_id: 'p-kyle', display_name: 'Kyle', stepStart: '2026-08-14', stepEnd: '2026-08-20', stepName: 'Walk', projectName: 'SVP' }),
        wo({ id: 'c3', person_id: 'p-behar', display_name: 'Behar Kraja', stepStart: '2026-08-12', stepEnd: '2026-08-13' }),
      ],
      WIN[0],
      WIN[1],
    )
    expect(lanes.map((l) => l.name)).toEqual(['Behar Kraja', 'Kyle'])
    const kyle = lanes[1]!
    expect(kyle.bars.every((b) => b.overlapping)).toBe(true)
    expect(kyle.bars[0]!.startPct).toBe(0)
    expect(lanes[0]!.bars[0]!.overlapping).toBe(false)
  })
})
