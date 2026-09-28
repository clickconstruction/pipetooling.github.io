import { describe, expect, it } from 'vitest'
import { scheduleOfValuesLetter } from './scheduleOfValues'
import { splitStageValues } from './sovLaborMaterial'
import {
  buildSovLinesSectionLines,
  buildSovLinesSheetHtml,
  lineSplit,
  parsePastedLineNames,
  reconcileLines,
  scaleLinesToContract,
  seedLinesFromStages,
  sovLinesTotals,
  type SovLine,
} from './sovLines'

const letter = scheduleOfValuesLetter({ byStage: { rough_in: 412, top_out: 335, trim_set: 253 }, assignedRaw: 1000 }, 86400)!
const costs = { labor: { rough_in: 11050, top_out: 13600, trim_set: 10200 }, material: { rough_in: 21340.5, top_out: 17352, trim_set: 13104.75 } }

const line = (p: Partial<SovLine> & { label: string; value: number }): SovLine => ({ id: p.label, sortOrder: 0, labor: null, note: '', stage: null, ...p })

describe('My lines (v2.4070)', () => {
  it('seeds the three stage lines from the letter, carrying the split’s labor and notes', () => {
    const plain = seedLinesFromStages(letter)
    expect(plain.map((l) => [l.label, l.value, l.labor, l.stage])).toEqual([
      ['Rough In', 35596.8, null, 'rough_in'],
      ['Top Out', 28944, null, 'top_out'],
      ['Trim Set', 21859.2, null, 'trim_set'],
    ])
    const split = splitStageValues(letter, { costs, ruleLaborPct: 45, overrides: { trim_set: { labor: 8000, note: 'Water heater on delivery' } } })
    const seeded = seedLinesFromStages(letter, split)
    expect(seeded[0]!.labor).toBe(12143.83)
    expect(seeded[2]).toMatchObject({ labor: 8000, note: 'Water heater on delivery' })
  })

  it('splits a line by its typed labor, else the company share, and the line always adds up', () => {
    expect(lineSplit({ value: 4500, labor: 600 }, 45)).toEqual({ labor: 600, material: 3900, source: 'typed' })
    expect(lineSplit({ value: 4500, labor: null }, 45)).toEqual({ labor: 2025, material: 2475, source: 'rule' })
    expect(lineSplit({ value: 100, labor: 999 }, 45)).toEqual({ labor: 100, material: 0, source: 'typed' })
    expect(sovLinesTotals([{ value: 4500, labor: 600 }, { value: 100, labor: null }], 45)).toEqual({ value: 4600, labor: 645, material: 3955 })
  })

  it('reconciles the lines against the contract', () => {
    expect(reconcileLines([{ value: 2400 }, { value: 83500 }], 86400)).toEqual({ total: 85900, gap: 500, balanced: false })
    expect(reconcileLines([{ value: 86400 }], 86400)).toEqual({ total: 86400, gap: 0, balanced: true })
  })

  it('scales every line to the contract to the cent, labor with its line', () => {
    const scaled = scaleLinesToContract([line({ label: 'a', value: 1000, labor: 400 }), line({ label: 'b', value: 1000 }), line({ label: 'c', value: 1000 })], 1000.01)!
    expect(scaled.map((l) => l.value)).toEqual([333.34, 333.34, 333.33])
    expect(scaled.reduce((a, l) => a + Math.round(l.value * 100), 0)).toBe(100001)
    expect(scaled[0]!.labor).toBeCloseTo(133.34, 2)
    expect(scaled[1]!.labor).toBeNull()
    expect(scaleLinesToContract([line({ label: 'a', value: 0 })], 1000)).toBeNull()
  })

  it('reads the GC’s pasted line names, dropping numbers and bullets', () => {
    expect(parsePastedLineNames('1. Mobilization\n2) Underground rough-in\n\n- Gas piping\n• Water heater\n  (5) Trim & fixtures  \n')).toEqual([
      'Mobilization',
      'Underground rough-in',
      'Gas piping',
      'Water heater',
      'Trim & fixtures',
    ])
  })

  it('words the letter section, with the split and notes, or the total only', () => {
    const lines = [line({ label: 'Mobilization & permits', value: 2400, labor: 1500 }), line({ label: 'Water heater', value: 4500, note: 'Material billed on delivery' }), line({ label: '', value: 0 })]
    expect(buildSovLinesSectionLines(lines)).toEqual(['Schedule of values:', 'Mobilization & permits — $2,400.00', 'Water heater — $4,500.00', '     Material billed on delivery', 'Total — $6,900.00'])
    expect(buildSovLinesSectionLines(lines, { split: true, ruleLaborPct: 45 })).toEqual([
      'Schedule of values:',
      'Mobilization & permits — $2,400.00 (labor $1,500.00 · material $900.00)',
      'Water heater — $4,500.00 (labor $2,025.00 · material $2,475.00)',
      '     Material billed on delivery',
      'Total — $6,900.00 (labor $3,525.00 · material $3,375.00)',
    ])
    expect(buildSovLinesSectionLines(lines, { totalOnly: true })).toEqual(['Schedule of values:', 'See the attached schedule — $6,900.00'])
    expect(buildSovLinesSectionLines([])).toEqual([])
  })

  it('prints the sheet in the pay-application form and says when the lines miss the contract', () => {
    const html = buildSovLinesSheetHtml({ title: 'B482 — Schedule of values', subtitle: 'contract $86,400.00', lines: [line({ label: 'Gas piping', value: 4200, labor: 1900, note: 'To the meter' })], contractAmount: 86400, split: true, ruleLaborPct: 45 })
    expect(html).toContain('Description of work')
    expect(html).toContain('Gas piping')
    expect(html).toContain('$1,900.00')
    expect(html).toContain('$2,300.00')
    expect(html).toContain('To the meter')
    expect(html).toContain('The lines add to $4,200.00; the contract is $86,400.00.')
    expect(html).toContain('for progress billing only')
  })
})
