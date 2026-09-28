import { describe, expect, it } from 'vitest'

import { WORKBENCH_TOUR_STEPS, workbenchHelpFacts } from './workbenchHelp'

const v = (id: string, name: string, sort_order: number) => ({ id, name, sort_order })

describe('workbenchHelpFacts', () => {
  it('a bid with one price and one GC at most is solo, and names that price', () => {
    expect(workbenchHelpFacts({ priceBookVersions: [v('p1', 'Base', 0)], selectedPricingVersionId: 'p1', bidVersionCount: 1 })).toEqual({ solo: true, firstScenarioName: 'Base' })
    expect(workbenchHelpFacts({ priceBookVersions: [v('p1', 'Base', 0)], selectedPricingVersionId: 'p1', bidVersionCount: 0 }).solo).toBe(true)
  })

  it('a second price or a second GC ends solo', () => {
    expect(workbenchHelpFacts({ priceBookVersions: [v('p1', 'Base', 0), v('p2', 'Alternate 1', 1)], selectedPricingVersionId: 'p1', bidVersionCount: 1 }).solo).toBe(false)
    expect(workbenchHelpFacts({ priceBookVersions: [v('p1', 'Base', 0)], selectedPricingVersionId: 'p1', bidVersionCount: 2 }).solo).toBe(false)
  })

  it('names the first price by sort order, not by arrival', () => {
    expect(workbenchHelpFacts({ priceBookVersions: [v('p2', 'Alternate 1', 5), v('p1', 'Base', 1)], selectedPricingVersionId: 'p2', bidVersionCount: 1 }).firstScenarioName).toBe('Base')
  })

  it('with no price of its own the bid reads the shared book; with nothing at all, "your price"', () => {
    expect(workbenchHelpFacts({ priceBookVersions: [], selectedPricingVersionId: 'shared', bidVersionCount: 1 })).toEqual({ solo: true, firstScenarioName: 'Standard prices' })
    expect(workbenchHelpFacts({ priceBookVersions: [], selectedPricingVersionId: null, bidVersionCount: 1 })).toEqual({ solo: true, firstScenarioName: 'your price' })
  })

  it('does not reorder the list it was handed', () => {
    const list = [v('p2', 'Alternate 1', 5), v('p1', 'Base', 1)]
    workbenchHelpFacts({ priceBookVersions: list, selectedPricingVersionId: 'p2', bidVersionCount: 1 })
    expect(list.map((x) => x.id)).toEqual(['p2', 'p1'])
  })
})

describe('WORKBENCH_TOUR_STEPS', () => {
  it('walks the section top to bottom, each stop with an anchor of its own and words to say', () => {
    expect(WORKBENCH_TOUR_STEPS.map((s) => s.anchor)).toEqual(['send-to', 'workbench-scenarios', 'workbench-summary', 'workbench-solver', 'workbench-rows'])
    for (const s of WORKBENCH_TOUR_STEPS) {
      expect(s.title.length).toBeGreaterThan(0)
      expect(s.body.length).toBeGreaterThan(0)
    }
  })
})
