import { describe, expect, it } from 'vitest'
import { computeMaterialsByStage, scaleToContract, stageWeights } from '../bids/materialsByStage'
import {
  buildMaterialsByStageSectionLines,
  buildScheduleOfValuesHtml,
  buildScheduleOfValuesSectionLines,
  fixtureNamesByStage,
  fixtureStageText,
  materialsByStageLetterRows,
  scheduleOfValuesLetter,
} from './scheduleOfValues'

const summary = computeMaterialsByStage({
  countRows: [
    { id: 'wc', fixture: 'WC-1', count: 4 },
    { id: 'waste', fixture: 'ft of 4IN WASTE', count: 100 },
    { id: 'sk', fixture: 'SK-1', count: 1 },
    { id: 'travel', fixture: 'travel/rentals', count: 1 },
    { id: 'lost', fixture: 'HB-3', count: 2 },
  ],
  lines: [
    { id: 'a', countRowId: 'wc', partId: 'p', sourceTemplateId: null, quantity: 1, unitPrice: 100 },
    { id: 'b', countRowId: 'waste', partId: 'q', sourceTemplateId: null, quantity: 1, unitPrice: 4 },
    { id: 'c', countRowId: 'sk', partId: 'r', sourceTemplateId: null, quantity: 1, unitPrice: 300 },
    { id: 'd', countRowId: 'sk', partId: 's', sourceTemplateId: null, quantity: 1, unitPrice: 100 },
    { id: 'e', countRowId: 'lost', partId: 't', sourceTemplateId: null, quantity: 1, unitPrice: 50 },
  ],
  splits: [
    { countRowId: 'wc', lineId: null, partId: null, weights: stageWeights(0, 0, 1), source: 'rule' },
    { countRowId: 'waste', lineId: null, partId: null, weights: stageWeights(1, 1, 0), source: 'rule' },
    { countRowId: 'sk', lineId: null, partId: null, weights: stageWeights(0, 0, 1), source: 'hand' },
    { countRowId: 'sk', lineId: 'd', partId: null, weights: stageWeights(1, 0, 0), source: 'hand' },
  ],
  factor: 1.5,
})

describe('the letter section', () => {
  it('lists the factored stages in order, skipping an empty one', () => {
    const rows = materialsByStageLetterRows({ scaled: { rough_in: 450, top_out: 0, trim_set: 1050 } })
    expect(rows).toEqual([
      { label: 'Rough In', amountFormatted: '$450.00' },
      { label: 'Trim Set', amountFormatted: '$1,050.00' },
    ])
    expect(buildMaterialsByStageSectionLines(rows)).toEqual(['Materials by stage:', 'Rough In — $450.00', 'Trim Set — $1,050.00'])
    expect(buildMaterialsByStageSectionLines([])).toEqual([])
  })
})

describe('the schedule of values in the letter (v2.4066)', () => {
  it('spreads the amount by the stage shares and adds to it to the cent', () => {
    // 41.2 / 33.5 / 25.3 of $86,400: each stage a fraction of a cent off, reconciled by largest remainder.
    const letter = scheduleOfValuesLetter({ byStage: { rough_in: 412, top_out: 335, trim_set: 253 }, assignedRaw: 1000 }, 86400)!
    expect(letter.rows.map((r) => [r.label, r.amountFormatted, r.shareFormatted])).toEqual([
      ['Rough In', '$35,596.80', '41.2%'],
      ['Top Out', '$28,944.00', '33.5%'],
      ['Trim Set', '$21,859.20', '25.3%'],
    ])
    expect(letter.totalFormatted).toBe('$86,400.00')
    expect(letter.rows.reduce((a, r) => a + r.amount, 0)).toBeCloseTo(86400, 2)
  })

  it('puts the leftover cents on the rows with the largest remainders', () => {
    // A third each of $100.00 is 3,333.33… cents: two rows get 33.33, the first gets the extra cent.
    const letter = scheduleOfValuesLetter({ byStage: { rough_in: 1, top_out: 1, trim_set: 1 }, assignedRaw: 3 }, 100)!
    expect(letter.rows.map((r) => r.amountFormatted)).toEqual(['$33.34', '$33.33', '$33.33'])
    expect(letter.rows.reduce((a, r) => a + Math.round(r.amount * 100), 0)).toBe(10000)
    expect(letter.scaled).toEqual({ rough_in: 33.34, top_out: 33.33, trim_set: 33.33 })
  })

  it('skips a stage with nothing staged in it and keeps it at zero in the scaled money', () => {
    const letter = scheduleOfValuesLetter({ byStage: { rough_in: 300, top_out: 0, trim_set: 100 }, assignedRaw: 400 }, 1000)!
    expect(letter.rows.map((r) => r.label)).toEqual(['Rough In', 'Trim Set'])
    expect(letter.scaled).toEqual({ rough_in: 750, top_out: 0, trim_set: 250 })
  })

  it('is null when nothing is staged or the amount is not positive', () => {
    expect(scheduleOfValuesLetter({ byStage: { rough_in: 0, top_out: 0, trim_set: 0 }, assignedRaw: 0 }, 1000)).toBeNull()
    expect(scheduleOfValuesLetter({ byStage: { rough_in: 1, top_out: 0, trim_set: 0 }, assignedRaw: 1 }, 0)).toBeNull()
    expect(scheduleOfValuesLetter({ byStage: { rough_in: 1, top_out: 0, trim_set: 0 }, assignedRaw: 1 }, Number.NaN)).toBeNull()
  })

  it('words the section with the share beside each line and a total, or says nothing', () => {
    const letter = scheduleOfValuesLetter({ byStage: { rough_in: 412, top_out: 335, trim_set: 253 }, assignedRaw: 1000 }, 86400)
    expect(buildScheduleOfValuesSectionLines(letter)).toEqual([
      'Schedule of values:',
      'Rough In — $35,596.80 (41.2%)',
      'Top Out — $28,944.00 (33.5%)',
      'Trim Set — $21,859.20 (25.3%)',
      'Total — $86,400.00',
    ])
    expect(buildScheduleOfValuesSectionLines(null)).toEqual([])
  })
})

describe('the printed page', () => {
  it('names the fixtures under each stage, with ½ of / part of prefixes', () => {
    const names = fixtureNamesByStage(summary.fixtures)
    expect(names.rough_in).toEqual(['½ of ft of 4IN WASTE', 'part of SK-1'])
    expect(names.top_out).toEqual(['½ of ft of 4IN WASTE'])
    expect(names.trim_set).toEqual(['WC-1', 'part of SK-1'])
  })

  it('says each fixture’s stage in the margin words', () => {
    const by = new Map(summary.fixtures.map((f) => [f.countRowId, f]))
    expect(fixtureStageText(by.get('wc')!)).toBe('3')
    expect(fixtureStageText(by.get('waste')!)).toBe('1 + 2 (½ · ½)')
    expect(fixtureStageText(by.get('sk')!)).toBe('mixed')
    expect(fixtureStageText(by.get('lost')!)).toBe('—')
  })

  it('builds the two pages with the totals, the footer and the fixture rows', () => {
    const html = buildScheduleOfValuesHtml({
      title: 'PALMER WINERY — Schedule of values (materials)',
      subtitle: 'BP431 · takeoff materials by stage × 1.5',
      summary,
      unstagedNames: ['travel/rentals'],
      factorNote: 'Factor 1.5 is the company default.',
    })
    expect(html).toContain('<title>PALMER WINERY — Schedule of values (materials)</title>')
    expect(html).toContain('<strong>1 · Rough In</strong>')
    // rough: ½ × 400 + the sk line d (100) = 300 → × 1.5 = 450; trim: 400 + 300 = 700 → 1050; top: 200 → 300
    expect(html).toContain('<strong>$450.00</strong>')
    expect(html).toContain('<strong>$300.00</strong>')
    expect(html).toContain('<strong>$1,050.00</strong>')
    expect(html).toContain('$1,800.00')
    expect(html).toContain('$100.00 of material still has no stage (1 fixture).')
    expect(html).toContain('Not staged: travel/rentals.')
    expect(html).toContain('Factor 1.5 is the company default.')
    expect(html).toContain('Every fixture and its stage')
    expect(html).toContain('mixed')
    expect(html).not.toContain('Of contract')
  })

  it('adds the contract column when scaled to the contract', () => {
    const scaled = scaleToContract(summary, 12000)!
    const html = buildScheduleOfValuesHtml({ title: 't', subtitle: 's', summary, contract: { amount: 12000, scaled } })
    expect(html).toContain('Of contract')
    expect(html).toContain('$12,000.00')
    // rough share 300 / 1200 = 25 % of 12,000
    expect(html).toContain('<strong>$3,000.00</strong>')
  })
})
