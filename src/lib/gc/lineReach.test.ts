import { describe, expect, it } from 'vitest'
import { guessLineSheets } from './plans'
import { lineReads, lineReadsSpec, lineSheets, lineSpecs, linesLeftBehind, linesOnSheets, linesOnSpecs, packagesForSheets, packagesForSpecs, sheetAsIndexed, tradeSheets, type ReachProject } from './lineReach'

/** A clinic as the mapper gives it: the index and the manual as they stand, and three trades. */
const clinic: ReachProject = {
  sheets: [
    { id: 'C-201', title: 'Grading and drainage plan' },
    { id: 'E-101', title: 'Power plan' },
    { id: 'E-201', title: 'Lighting plan' },
    { id: 'M-101', title: 'HVAC plan' },
    { id: 'M-201', title: 'HVAC details' },
  ],
  specs: [
    { id: '23 05 00', title: 'HVAC' },
    { id: '26 05 00', title: 'Electrical' },
  ],
  trades: [
    { id: 'site', trade: 'Sitework', scope: [{ id: 's1', label: 'Clearing and grading', sheets: ['C-201'] }] },
    {
      id: 'elec',
      trade: 'Electrical',
      scope: [
        { id: 'e1', label: 'Service and gear', sheets: [] },
        { id: 'e2', label: 'Lighting', sheets: null },
        { id: 'e3', label: 'Site lighting', sheets: ['E-201'] },
      ],
    },
    { id: 'hvac', trade: 'HVAC', scope: [{ id: 'h1', label: 'Ductwork' }, { id: 'h2', label: 'Controls', specs: ['23 05 00'] }] },
  ],
}

describe('lineReach', () => {
  it('writes a sheet number as the index writes it', () => {
    expect(sheetAsIndexed(clinic, 'e101')).toBe('E-101')
    expect(sheetAsIndexed(clinic, 'P101')).toBe('P-101')
    expect(sheetAsIndexed(clinic, 'FP101', [{ id: 'FP-101', title: 'Fire protection plan' }])).toBe('FP-101')
  })

  it('reads a line’s sheets as said, or guesses them, and a line that names none reads its whole trade', () => {
    const elec = clinic.trades[1]!
    expect(tradeSheets(clinic, 'Electrical').map((s) => s.id)).toEqual(['E-101', 'E-201'])
    expect(lineSheets(clinic, elec, elec.scope[2]!)).toEqual({ sheets: ['E-201'], guessed: false })
    const guess = lineSheets(clinic, elec, elec.scope[1]!)
    expect(guess).toEqual({ sheets: guessLineSheets('Lighting', tradeSheets(clinic, 'Electrical')), guessed: true })
    expect(lineReads(clinic, elec, elec.scope[0]!)).toEqual({ sheets: ['E-101', 'E-201'], guessed: false, wholeTrade: true })
    expect(linesOnSheets(clinic, elec, ['E-101']).map((l) => l.label)).toContain('Service and gear')
    expect(linesOnSheets(clinic, elec, ['M-101'])).toEqual([])
    expect(packagesForSheets(clinic, ['E-101', 'C-201'])).toEqual(['site', 'elec'])
  })

  it('reads a line’s sections the same way', () => {
    const hvac = clinic.trades[2]!
    expect(lineSpecs(clinic, hvac, hvac.scope[1]!)).toEqual({ specs: ['23 05 00'], guessed: false })
    expect(lineReadsSpec(clinic, hvac, hvac.scope[0]!, '23 05 00')).toBe(true)
    expect(lineReadsSpec(clinic, hvac, hvac.scope[0]!, '26 05 00')).toBe(false)
    expect(linesOnSpecs(clinic, hvac, ['23 05 00']).map((l) => l.label)).toEqual(['Ductwork', 'Controls'])
    expect(packagesForSpecs(clinic, ['26 05 00'])).toEqual(['elec'])
  })

  it('finds the lines a set leaves with nothing to read, and not the ones that read the trade as a whole', () => {
    const left = linesLeftBehind(clinic, ['C-201'], [])
    expect(left.map((l) => l.item.label)).toEqual(['Clearing and grading'])
    expect(left[0]?.sheets).toEqual(['C-201'])
    expect(linesLeftBehind(clinic, ['E-101', 'E-201'], []).map((l) => l.item.label)).toEqual(['Lighting', 'Site lighting'])
    expect(linesLeftBehind(clinic, [], ['23 05 00']).map((l) => l.item.label)).toEqual(['Controls'])
    expect(linesLeftBehind(clinic, [], [])).toEqual([])
  })
})
