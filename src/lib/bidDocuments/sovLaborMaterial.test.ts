import { describe, expect, it } from 'vitest'
import { scheduleOfValuesLetter, buildScheduleOfValuesSectionLines } from './scheduleOfValues'
import { laborCostByStage, parseSovLaborSharePct, sovSplitLineText, sovSplitTotals, splitStageValues } from './sovLaborMaterial'

// The mock-up's bid: $86,400 across 41.2 / 33.5 / 25.3; 130 / 160 / 120 h at $85; material × 1.5.
const letter = scheduleOfValuesLetter({ byStage: { rough_in: 412, top_out: 335, trim_set: 253 }, assignedRaw: 1000 }, 86400)!
const costs = {
  labor: laborCostByStage({ hoursByStage: { rough_in: 130, top_out: 160, trim_set: 120 }, laborRate: 85, subByStage: { rough_in: 0, top_out: 0, trim_set: 0 } }),
  material: { rough_in: 21340.5, top_out: 17352, trim_set: 13104.75 },
}

describe('the split (v2.4075)', () => {
  it('reads the company labor share as 0–100, else the default', () => {
    expect(parseSovLaborSharePct(45)).toBe(45)
    expect(parseSovLaborSharePct('60')).toBe(60)
    expect(parseSovLaborSharePct(101)).toBe(45)
    expect(parseSovLaborSharePct(null)).toBe(45)
    expect(parseSovLaborSharePct('x', 50)).toBe(50)
  })

  it('counts a sub’s dollars as labor for its stage', () => {
    const l = laborCostByStage({ hoursByStage: { rough_in: 10, top_out: 0, trim_set: 0 }, laborRate: 85, subByStage: { rough_in: 0, top_out: 2500, trim_set: 0 } })
    expect(l).toEqual({ rough_in: 850, top_out: 2500, trim_set: 0 })
  })

  it('divides each stage by the ratio of its two costs and the line always adds up', () => {
    const split = splitStageValues(letter, { costs, ruleLaborPct: 45 })
    expect(split.map((s) => [s.label, s.labor, s.material, s.source])).toEqual([
      ['Rough In', 12143.83, 23452.97, 'costs'],
      ['Top Out', 12717.7, 16226.3, 'costs'],
      ['Trim Set', 9567.31, 12291.89, 'costs'],
    ])
    for (const s of split) expect(Math.round((s.labor + s.material) * 100)).toBe(Math.round(s.value * 100))
    expect(sovSplitTotals(split)).toEqual({ labor: 34428.84, material: 51971.16 })
  })

  it('uses the company rule for a stage with no cost on either side, and says so', () => {
    const split = splitStageValues(letter, { costs: { labor: { ...costs.labor, top_out: 0 }, material: { ...costs.material, top_out: 0 } }, ruleLaborPct: 45 })
    const top = split[1]!
    expect(top.source).toBe('rule')
    expect(top.labor).toBe(13024.8)
    expect(top.material).toBe(15919.2)
  })

  it('a typed labor figure wins, clamped to the stage, and remembers what the costs said', () => {
    const split = splitStageValues(letter, { costs, ruleLaborPct: 45, overrides: new Map([['trim_set', { labor: 8000, note: ' Water heater billed on delivery ' }]]) })
    const trim = split[2]!
    expect(trim).toMatchObject({ source: 'typed', labor: 8000, material: 13859.2, derivedLabor: 9567.31, note: 'Water heater billed on delivery' })
    const over = splitStageValues(letter, { costs, ruleLaborPct: 45, overrides: { trim_set: { labor: 99999 } } })[2]!
    expect(over.labor).toBe(21859.2)
    expect(over.material).toBe(0)
    const nul = splitStageValues(letter, { costs, ruleLaborPct: 45, overrides: { trim_set: { labor: null, note: 'kept' } } })[2]!
    expect(nul.source).toBe('costs')
    expect(nul.note).toBe('kept')
  })

  it('words a line and the letter section with the split, notes under their line, and a total-only form', () => {
    const split = splitStageValues(letter, { costs, ruleLaborPct: 45, overrides: { top_out: { note: 'Gas piping to the meter is in this stage' } } })
    expect(sovSplitLineText(split[0]!)).toBe('Rough In — $35,596.80 (labor $12,143.83 · material $23,452.97)')
    expect(buildScheduleOfValuesSectionLines(letter, { split })).toEqual([
      'Schedule of values:',
      'Rough In — $35,596.80 (labor $12,143.83 · material $23,452.97)',
      'Top Out — $28,944.00 (labor $12,717.70 · material $16,226.30)',
      '     Gas piping to the meter is in this stage',
      'Trim Set — $21,859.20 (labor $9,567.31 · material $12,291.89)',
      'Total — $86,400.00 (labor $34,428.84 · material $51,971.16)',
    ])
    expect(buildScheduleOfValuesSectionLines(letter, { totalOnly: true })).toEqual(['Schedule of values:', 'See the attached schedule — $86,400.00'])
    expect(buildScheduleOfValuesSectionLines(letter)).toEqual(['Schedule of values:', 'Rough In — $35,596.80 (41.2%)', 'Top Out — $28,944.00 (33.5%)', 'Trim Set — $21,859.20 (25.3%)', 'Total — $86,400.00'])
  })
})
