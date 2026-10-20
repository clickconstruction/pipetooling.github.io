import { describe, expect, it } from 'vitest'
import type { ReachProject } from './lineReach'
import { setTouches, type PlanSetSendRow, type SetChanges } from './setTouches'

/** A clinic as the mapper gives it: the index and the manual as they stand, and three trades. */
const clinic: ReachProject = {
  sheets: [
    { id: 'C-201', title: 'Grading and drainage plan' },
    { id: 'E-101', title: 'Power plan' },
    { id: 'E-201', title: 'Lighting plan' },
    { id: 'M-101', title: 'HVAC plan' },
  ],
  specs: [
    { id: '23 05 00', title: 'HVAC' },
    { id: '26 05 00', title: 'Electrical' },
  ],
  trades: [
    { id: 'site', trade: 'Sitework', scope: [{ id: 's1', label: 'Clearing and grading', sheets: ['C-201'] }] },
    { id: 'elec', trade: 'Electrical', scope: [{ id: 'e1', label: 'Service and gear', sheets: [] }] },
    { id: 'hvac', trade: 'HVAC', scope: [{ id: 'h1', label: 'Ductwork' }] },
  ],
}

const invites = [
  { package_id: 'site', company_id: 'grade' },
  { package_id: 'elec', company_id: 'volt' },
  { package_id: 'hvac', company_id: 'cool' },
  { package_id: 'site', company_id: 'multi' },
  { package_id: 'elec', company_id: 'multi' },
]

const set = (over: Partial<SetChanges> = {}): SetChanges => ({ id: 'set1', changedSheets: [], addedSheets: [], changedSpecs: [], addedLines: [], ...over })
const sent = (company: string, touched: boolean, setId = 'set1'): PlanSetSendRow => ({ set_id: setId, company_id: company, touched })

describe('which trades a set touches (the Board’s B2b-vi-b)', () => {
  it('takes the office’s word where the set went out, over the guess both ways', () => {
    // The power plan changed, so the guess would take Electrical; the office said it does not, and that HVAC does.
    const s = set({ changedSheets: ['E-101'] })
    expect(setTouches(clinic, s, [sent('volt', false), sent('cool', true), sent('grade', false)], invites)).toEqual(['hvac'])
  })

  it('marks every trade of a company that got the set as touched, as its portal reads it', () => {
    expect(setTouches(clinic, set(), [sent('multi', true)], invites)).toEqual(['site', 'elec'])
  })

  it('guesses for a set not sent yet: its sheets, its sections and the trades it added lines to, in trade order', () => {
    expect(setTouches(clinic, set({ changedSheets: ['E-201'] }), [], invites)).toEqual(['elec'])
    expect(setTouches(clinic, set({ changedSpecs: ['23 05 00'] }), [], invites)).toEqual(['hvac'])
    expect(setTouches(clinic, set({ addedLines: [{ packageId: 'site', scopeId: 's9' }] }), [], invites)).toEqual(['site'])
    expect(setTouches(clinic, set({ changedSheets: ['M-101'], addedLines: [{ packageId: 'site', scopeId: 's9' }], changedSpecs: ['26 05 00'] }), [], invites)).toEqual(['site', 'elec', 'hvac'])
  })

  it('reads a sheet the set adds by its own number and title', () => {
    expect(setTouches(clinic, set({ changedSheets: ['M-301'], addedSheets: [{ id: 'M-301', title: 'Rooftop units' }] }), [], invites)).toEqual(['hvac'])
  })

  it('guesses when the sends on file are another set’s, and touches nothing when a sent set changed no one’s trade', () => {
    expect(setTouches(clinic, set({ changedSheets: ['C-201'] }), [sent('grade', true, 'set2')], invites)).toEqual(['site'])
    expect(setTouches(clinic, set({ changedSheets: ['C-201'] }), [sent('grade', false)], invites)).toEqual([])
  })
})
