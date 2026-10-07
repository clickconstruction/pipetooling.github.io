/**
 * Main's own tests for what a trade did on the job, for its company's Activity (the Building lane's
 * U2), run on the test data: Fair Oaks D's concrete punch list, and the electrical submittals and the
 * service inspection that failed on its work.
 */
import { describe, expect, it } from 'vitest'
import { buildingActivity } from './buildingActivity'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const fairOaks = (s: GcState) => s.projects.find((p) => p.id === 'fairoaksd')!
const trade = (s: GcState, id: string) => fairOaks(s).packages.find((k) => k.id === id)!

describe('a trade’s Activity on the job', () => {
  it('lists its punch items added, said fixed and checked', () => {
    const s = initialGcState()
    expect(buildingActivity(fairOaks(s), trade(s, 'fconc')).map((e) => [e.on, e.text])).toEqual([
      ['2026-09-28', 'Punch item: Patch the spalled corner on the column footing, Grid C-4.'],
      ['2026-09-28', 'Punch item: Seal the control joints in the stockroom slab, Stockroom.'],
      ['2026-10-01', 'Said a punch item is fixed: Seal the control joints in the stockroom slab.'],
      ['2026-09-28', 'Punch item: Clean the curb paint off the sidewalk, East entry.'],
      ['2026-09-30', 'Said a punch item is fixed: Clean the curb paint off the sidewalk.'],
      ['2026-10-01', 'Punch item checked fixed: Clean the curb paint off the sidewalk.'],
    ])
  })

  it('lists its submittals round by round, and an inspection that failed on its work', () => {
    const s = initialGcState()
    const texts = buildingActivity(fairOaks(s), trade(s, 'felec')).map((e) => e.text)
    expect(texts.slice(0, 5)).toEqual([
      'Asked them for submittal 26 24 16-01, Panelboards.',
      'Sent submittal 26 24 16-01, Panelboards.',
      'Submittal 26 24 16-01 came back to revise: Show the 22kA rating on each panel.',
      'Sent submittal 26 24 16-01, Panelboards, round 2.',
      'Submittal 26 24 16-01 approved as noted: Label the spare breakers.',
    ])
    expect(texts[texts.length - 1]).toBe('Electrical service inspection failed on their work: The main bonding jumper is missing at the service panel. Re-inspection Oct 2.')
  })
})
