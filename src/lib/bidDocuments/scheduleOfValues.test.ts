import { describe, expect, it } from 'vitest'
import { computeMaterialsByStage, scaleToContract, stageWeights } from '../bids/materialsByStage'
import {
  buildMaterialsByStageSectionLines,
  buildScheduleOfValuesHtml,
  fixtureNamesByStage,
  fixtureStageText,
  materialsByStageLetterRows,
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
