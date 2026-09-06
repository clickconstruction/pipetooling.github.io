import { describe, expect, it } from 'vitest'
import { buildSheetPartiesLookup, sheetParties } from './sheetParties'

const roster = [
  { id: 'behar', name: 'Behar Kraja', kind: 'sub', accountRole: 'subcontractor' },
  { id: 'malachi', name: 'Malachi', kind: 'sub', accountRole: 'superintendent' },
  { id: 'abraham', name: 'Abraham', kind: 'sub', accountRole: 'superintendent' },
  { id: 'michael', name: 'Michael A', kind: 'employee', accountRole: null },
  { id: 'texas', name: 'Texas R & A Electrical LLC', kind: 'sub', accountRole: null },
]
const lookup = buildSheetPartiesLookup(roster)

describe('sheetParties', () => {
  it('names a mixed sheet for its roster sub and lists the teammates as "with …"', () => {
    const p = sheetParties(
      { assigned_to_name: 'Malachi | Abraham | Michael A | Behar Kraja' },
      [
        { personId: 'malachi', personName: 'Malachi' },
        { personId: 'abraham', personName: 'Abraham' },
        { personId: 'michael', personName: 'Michael A' },
        { personId: 'behar', personName: 'Behar Kraja' },
      ],
      lookup,
    )
    expect(p.label).toBe('Behar Kraja')
    expect(p.withLabel).toBe('with Malachi, Abraham, Michael A')
    expect(p.crew).toBe(false)
    expect(p.key).toBe('id:behar')
  })

  it('falls back to the delimited name column when the junction is empty', () => {
    const p = sheetParties({ assigned_to_name: 'Behar | Malachi | Abraham | Bryan | Behar Kraja' }, undefined, lookup)
    // "Behar" and "Bryan" are not on the roster: unknown names stay contractors, like the ledger always treated them.
    expect(p.label).toBe('Behar | Bryan | Behar Kraja')
    expect(p.withLabel).toBe('with Malachi, Abraham')
    expect(p.key).toBe('behar | bryan | behar kraja')
  })

  it('a lone sub is just the sub, under the id key and the CURRENT roster name', () => {
    const p = sheetParties({ assigned_to_name: 'Texas R&A' }, [{ personId: 'texas', personName: null }], lookup)
    expect(p).toMatchObject({ label: 'Texas R & A Electrical LLC', withLabel: null, crew: false, key: 'id:texas' })
  })

  it('a crew-only sheet keeps every name as the label and nobody is "with"', () => {
    const p = sheetParties(
      { assigned_to_name: 'Malachi | Abraham' },
      [
        { personId: 'malachi', personName: 'Malachi' },
        { personId: 'abraham', personName: 'Abraham' },
      ],
      lookup,
    )
    expect(p).toMatchObject({ label: 'Malachi | Abraham', withLabel: null, crew: true, key: 'malachi | abraham' })
    expect(p.teammates).toEqual([])
  })

  it('a blank sheet is blank', () => {
    expect(sheetParties({ assigned_to_name: '' }, [], lookup)).toMatchObject({ label: '', key: '', crew: true, withLabel: null })
  })
})
