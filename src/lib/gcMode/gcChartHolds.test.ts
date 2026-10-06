import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { scheduleMeasures } from './gcBuildingSchedule'
import { ganttBars, ganttCounts } from './gcGantt'
import { chartHolds } from './gcChartHolds'

describe('the chart’s holds, in one place (moved unchanged out of the Schedule tab for G-118)', () => {
  it('are what the Schedule tab drew on Fair Oaks D before the move', () => {
    const state = initialGcState()
    const project = state.projects.find((p) => p.id === 'fairoaksd')!
    const holds = chartHolds(state, project)
    // Every hold, line by line: the RFIs, the submittals, and G-77's papers over Pecan Valley's two bars not started.
    expect([...holds].sort(([a], [b]) => a.localeCompare(b))).toEqual([
      ['felec-4', { kind: 'paperwork', words: 'current insurance and submittal 28 31 11-01', late: false }],
      ['felec-5', { kind: 'paperwork', words: 'current insurance, theirs ran out Sep 15', late: false }],
      ['fhvac-1', { kind: 'rfi', words: 'RFI-003, with the architect', late: false }],
      ['fhvac-3', { kind: 'submittal', words: 'submittal 23 09 23-01', late: false }],
      ['froof-3', { kind: 'submittal', words: 'submittal 07 62 00-01', late: false }],
      ['froof-4', { kind: 'rfi', words: 'RFI-004, waiting on us', late: false }],
    ])
    // The chart's Held filter read 6 since G-77, with these words on Site lighting and Fire alarm.
    const m = scheduleMeasures(state, project)
    expect(ganttCounts(ganttBars(m.items, m.float, holds, state.today, true)).held).toBe(6)
    expect(holds.get('felec-5')?.words).toBe('current insurance, theirs ran out Sep 15')
    expect(holds.get('felec-4')?.words).toBe('current insurance and submittal 28 31 11-01')
  })
})
