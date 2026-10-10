/**
 * The tests of `gcCompanyFile.test.ts` on branch spike/gc-mode that read only B2b-i's kernels and the made-up data, moved word for word
 * (the Board's B2b-i), beside the ones earlier lifts moved. The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { partnerActivity, partnerWork } from './companyFile'
import { partnerById } from './lookups'
import { initialGcState } from './schedule/testState'
import type { GcState, Partner } from './types'

function partner(state: GcState, id: string): Partner {
  const p = partnerById(state, id)
  if (!p) throw new Error(`no ${id}`)
  return p
}

describe("a company's window (the owner, 2026-10-04)", () => {
  it('About counts their work and money with us', () => {
    const state = initialGcState()
    const work = partnerWork(state, partner(state, 'pecanvalley'))
    expect(work.jobs.map((j) => j.pkg.id)).toEqual(['felec'])
    expect(work).toMatchObject({ underContract: 248_000, paid: 80_100, held: 8_900 })
    expect(partnerWork(state, partner(state, 'hillside')).jobs).toEqual([])
  })
})

describe("a trade's Activity also carries the award, pay applications sent back, and change orders", () => {
  it('a pay application we sent back, with our reason', () => {
    const state = initialGcState()
    const back = partnerActivity(state, partner(state, 'summit')).find((e) => e.text.startsWith('Pay application 1 sent back'))
    expect(back?.kind).toBe('money')
    expect(back?.text).toContain('The membrane is down on the east half only.')
  })
})

describe("a trade's Activity carries what it did on the job (Building, 2026-10-04)", () => {
  it('its submittals, punch items and inspections, under On the job', () => {
    const state = initialGcState()
    const work = (id: string) => partnerActivity(state, partner(state, id)).filter((e) => e.kind === 'work').map((e) => e.text)
    expect(work('pecanvalley')).toEqual(
      expect.arrayContaining([
        'Asked them for submittal 26 24 16-01, Panelboards.',
        'Submittal 26 24 16-01 came back to revise: Show the 22kA rating on each panel.',
        'Sent submittal 26 24 16-01, Panelboards, round 2.',
        'Submittal 26 24 16-01 approved as noted: Label the spare breakers.',
        'Electrical service inspection failed on their work: The main bonding jumper is missing at the service panel. Re-inspection Oct 2.',
      ]),
    )
    expect(work('guadalupe')).toEqual(
      expect.arrayContaining([
        'Punch item: Patch the spalled corner on the column footing, Grid C-4.',
        'Said a punch item is fixed: Seal the control joints in the stockroom slab.',
        'Punch item checked fixed: Clean the curb paint off the sidewalk.',
      ]),
    )
    // A trade we did not award has none of it.
    expect(work('alamo')).toEqual([])
  })
})
