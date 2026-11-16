import { describe, expect, it } from 'vitest'
import type { NeedsWorkOrderRosterPerson } from './rosterSub'
import { buildSheetPartiesLookup, sheetParties } from './sheetParties'
import { sheetAmountsShown, sheetAmountsView, sheetNamedNotPaidWords, sheetsForViewer } from './sheetAmountsView'

// Made-up people.
const ROSTER: NeedsWorkOrderRosterPerson[] = [
  { id: 'marlow', name: 'Marlow Tile', kind: 'sub', accountRole: 'subcontractor' },
  { id: 'ridgeline', name: 'Ridgeline Coring LLC', kind: 'sub', accountRole: null },
  { id: 'dana', name: 'Dana Whitlock', kind: 'sub', accountRole: 'superintendent' },
  { id: 'owen', name: 'Owen Farris', kind: 'helper', accountRole: 'helpers' },
]
const lookup = buildSheetPartiesLookup(ROSTER)
const sheet = (...ids: string[]) => sheetParties({ assigned_to_name: null }, ids.map((id) => ({ personId: id, personName: null })), lookup)

const office = { role: 'assistant', personId: null }
const marlow = { role: 'subcontractor', personId: 'marlow' }
const dana = { role: 'superintendent', personId: 'dana' }
const owen = { role: 'helpers', personId: 'owen' }

describe('sheetAmountsView — office sees all the amounts, field sees their own', () => {
  it('the office reads every sheet, whoever it pays', () => {
    for (const p of [sheet('marlow'), sheet('dana'), sheet('marlow', 'ridgeline'), sheet('marlow', 'dana')]) expect(sheetAmountsView(office, p)).toBe('office')
  })
  it("a sub reads their own sheet's amounts", () => {
    expect(sheetAmountsView(marlow, sheet('marlow', 'dana'))).toBe('own')
  })
  it("a teammate named on a sub's sheet sees the sheet and no figure", () => {
    const v = sheetAmountsView(dana, sheet('marlow', 'dana'))
    expect(v).toBe('named')
    expect(sheetAmountsShown(v)).toBe(false)
    expect(sheetNamedNotPaidWords('Marlow Tile')).toBe('You are named on this sheet. It is paid to Marlow Tile, so its amounts are not shown.')
  })
  it('a teammate reads the amounts of a sheet that is theirs: sub labor paid to someone on payroll', () => {
    expect(sheetAmountsView(dana, sheet('dana'))).toBe('own')
    // Before her pick the sheet was owed to nobody, so nobody in the field read it.
    expect(sheetAmountsView(dana, sheet('dana'), 'payroll')).toBe('named')
  })
  it('a shared sheet shows its figures to the office alone', () => {
    expect(sheetAmountsView(marlow, sheet('marlow', 'ridgeline'))).toBe('named')
    expect(sheetAmountsView(dana, sheet('dana', 'owen'))).toBe('named')
    expect(sheetNamedNotPaidWords('')).toContain('does not name one person to pay yet')
  })
  it('someone not on the sheet is not shown it', () => {
    expect(sheetAmountsView(owen, sheet('marlow', 'dana'))).toBe('hidden')
  })
  it('falls back to the name when a sheet names people by words alone', () => {
    const byWords = sheetParties({ assigned_to_name: 'Marlow Tile | Dana Whitlock' }, undefined, lookup)
    expect(sheetAmountsView({ role: 'subcontractor', personId: null, name: 'marlow tile' }, byWords)).toBe('own')
  })
  it('sorts a person\'s sheets into the ones with figures and the ones that only name them', () => {
    const mine = [{ id: 'a', parties: sheet('dana') }, { id: 'b', parties: sheet('marlow', 'dana') }, { id: 'c', parties: sheet('marlow') }]
    const got = sheetsForViewer(dana, mine)
    expect(got.withAmounts.map((s) => s.id)).toEqual(['a'])
    expect(got.namedOnly.map((s) => s.id)).toEqual(['b'])
  })
})
