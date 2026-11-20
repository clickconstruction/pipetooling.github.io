import { describe, expect, it } from 'vitest'
import { WAITING_FOR_OPEN_WORDS, waitingForFoldLine } from './checklistWaitingForFold'
import { buildWaitingForStripSummary } from './dashboardWaitingForStrip'

const group = (blockerTitle: string, blockerNames: string[], taskCount: number) => ({
  blockerTitle,
  blockerNames,
  tasks: Array.from({ length: taskCount }, (_, i) => i),
})

describe('waitingForFoldLine', () => {
  it('is null when nothing waits, so the section draws nothing', () => {
    expect(waitingForFoldLine([])).toBeNull()
  })

  it('counts the tasks and the steps they wait behind', () => {
    const line = waitingForFoldLine([
      group('get measurment of foam thickness so i know what wood to buy', [], 4),
      group('cut the trees on the straight', ['Michael'], 1),
    ])
    expect(line?.count).toBe(5)
    expect(line?.steps).toBe(2)
    expect(line?.countWords).toBe('5 tasks behind 2 steps')
  })

  it('says one task and one step in the singular', () => {
    expect(waitingForFoldLine([group('pour the slab', ['Robert'], 1)])?.countWords).toBe('1 task behind 1 step')
  })

  it('says several tasks behind one step', () => {
    expect(waitingForFoldLine([group('pour the slab', ['Robert'], 3)])?.countWords).toBe('3 tasks behind 1 step')
  })

  it('peeks at the first step in the Dashboard strip’s own words', () => {
    const groups = [group('get measurment of foam thickness so i know what wood to buy', [], 4), group('pour the slab', ['Robert'], 1)]
    const line = waitingForFoldLine(groups)
    expect(line?.peek).toBe('after "get measurment of foam thickness so i know w…" — not staffed yet')
    expect(line?.peek).toBe(buildWaitingForStripSummary(groups)?.peek)
  })

  it('does not count a step with no task behind it', () => {
    const line = waitingForFoldLine([group('an empty step', ['Grace'], 0), group('pour the slab', ['Robert'], 2)])
    expect(line?.countWords).toBe('2 tasks behind 1 step')
    expect(line?.peek).toBe('after "pour the slab" — Robert')
    expect(waitingForFoldLine([group('an empty step', ['Grace'], 0)])).toBeNull()
  })

  it('keeps the open row’s words the section has always carried', () => {
    expect(WAITING_FOR_OPEN_WORDS).toBe('yours, once the step ahead clears')
  })
})
