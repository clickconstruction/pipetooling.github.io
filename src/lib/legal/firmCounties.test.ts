import { describe, expect, it } from 'vitest'
import {
  changedWords,
  countiesByFirm,
  countiesLine,
  countiesOf,
  countyChanges,
  countyWords,
  countyWritePlan,
  firmHues,
  firmLegend,
  FIRM_HUES,
  moveCounty,
  moveQuestion,
  pressCounty,
  pressWords,
  savedAssignments,
  savedWords,
  type LegalFirmCountyRow,
} from './firmCounties'

const A = { id: 'firm-a', name: 'Snell Law Firm', active: true, created_at: '2026-09-01' }
const B = { id: 'firm-b', name: 'Austin firm', active: true, created_at: '2026-10-22' }
const OLD = { id: 'firm-old', name: 'Retired firm', active: false, created_at: '2026-01-01' }

const row = (county: string, firm_id: string, until: string | null = null): LegalFirmCountyRow => ({ id: `${county}-${firm_id}`, firm_id, county, since: '2026-10-22T00:00:00Z', until, set_by: null })

const ROWS: LegalFirmCountyRow[] = [row('Bexar', 'firm-a'), row('Comal', 'firm-a'), row('Travis', 'firm-b'), row('Hays', 'firm-b', '2026-10-22T01:00:00Z'), row('Potter', 'firm-old')]

describe('savedAssignments / countiesByFirm', () => {
  it('reads the live rows only, and only for the firms that stand', () => {
    const saved = savedAssignments(ROWS, new Set(['firm-a', 'firm-b']))
    expect([...saved.entries()]).toEqual([
      ['Bexar', 'firm-a'],
      ['Comal', 'firm-a'],
      ['Travis', 'firm-b'],
    ])
    expect(savedAssignments(ROWS).get('Potter')).toBe('firm-old')
  })
  it('lists each active firm’s counties sorted, an empty list for a firm with none', () => {
    const by = countiesByFirm([...ROWS, row('Atascosa', 'firm-a')], [A, B, OLD, { id: 'firm-c', name: 'C', active: true }])
    expect(by.get('firm-a')).toEqual(['Atascosa', 'Bexar', 'Comal'])
    expect(by.get('firm-b')).toEqual(['Travis'])
    expect(by.get('firm-c')).toEqual([])
    expect(by.has('firm-old')).toBe(false)
  })
})

describe('pressCounty', () => {
  const draft = new Map([
    ['Bexar', 'firm-a'],
    ['Travis', 'firm-b'],
  ])
  it('colors a free county for the picked firm', () => {
    const { next, press } = pressCounty(draft, 'Comal', 'firm-a')
    expect(press).toEqual({ kind: 'colored' })
    expect(next.get('Comal')).toBe('firm-a')
    expect(draft.has('Comal')).toBe(false)
  })
  it('clears the picked firm’s own county', () => {
    const { next, press } = pressCounty(draft, 'Bexar', 'firm-a')
    expect(press).toEqual({ kind: 'cleared' })
    expect(next.has('Bexar')).toBe(false)
  })
  it('leaves another firm’s county alone and says whose it is', () => {
    const { next, press } = pressCounty(draft, 'Travis', 'firm-a')
    expect(press).toEqual({ kind: 'held', byFirmId: 'firm-b' })
    expect(next.get('Travis')).toBe('firm-b')
  })
  it('moves it only through moveCounty', () => {
    expect(moveCounty(draft, 'Travis', 'firm-a').get('Travis')).toBe('firm-a')
    expect(moveQuestion('Travis', 'Austin firm', 'Snell Law Firm')).toBe('Travis is Austin firm’s. Move it to Snell Law Firm? Matters already with Austin firm stay there.')
  })
})

describe('countyChanges / countyWritePlan', () => {
  const saved = new Map([
    ['Bexar', 'firm-a'],
    ['Comal', 'firm-a'],
    ['Travis', 'firm-b'],
  ])
  it('is empty when the draft is the saved map', () => {
    expect(countyChanges(saved, new Map(saved))).toEqual([])
    expect(changedWords(0)).toBe('Nothing to save.')
  })
  it('names every county that clears, colors or moves, sorted', () => {
    const draft = new Map([
      ['Bexar', 'firm-a'],
      ['Travis', 'firm-a'],
      ['Hays', 'firm-b'],
    ])
    const changes = countyChanges(saved, draft)
    expect(changes).toEqual([
      { county: 'Comal', from: 'firm-a', to: null },
      { county: 'Hays', from: null, to: 'firm-b' },
      { county: 'Travis', from: 'firm-b', to: 'firm-a' },
    ])
    expect(changedWords(changes.length)).toBe('3 counties changed. Save to make it so.')
    expect(changedWords(1)).toBe('1 county changed. Save to make it so.')
    const plan = countyWritePlan(changes, 'dev-1')
    expect(plan.close).toEqual(['Comal', 'Travis'])
    expect(plan.insert).toEqual([
      { firm_id: 'firm-b', county: 'Hays', set_by: 'dev-1' },
      { firm_id: 'firm-a', county: 'Travis', set_by: 'dev-1' },
    ])
    expect(savedWords(3)).toBe('3 counties saved. The Legal desk reads them now.')
  })
})

describe('words', () => {
  it('writes the card line, the county, and each press', () => {
    expect(countiesLine([])).toBe('No counties yet')
    expect(countiesLine(['Bexar'])).toBe('1 county · Bexar')
    expect(countiesLine(['Bexar', 'Comal', 'Guadalupe'])).toBe('3 counties · Bexar, Comal, Guadalupe')
    expect(countyWords('Bexar')).toBe('Bexar County')
    expect(countyWords('Bexar County')).toBe('Bexar County')
    expect(pressWords({ kind: 'colored' }, 'Comal', 'Snell Law Firm')).toBe('Comal is Snell Law Firm’s once you save.')
    expect(pressWords({ kind: 'cleared' }, 'Comal', 'Snell Law Firm')).toBe('Comal cleared. No firm covers it until you pick one.')
    expect(pressWords({ kind: 'held', byFirmId: 'firm-b' }, 'Travis', 'Snell Law Firm', 'Austin firm')).toBe('Travis is Austin firm’s. Open that firm to clear it, or move it.')
  })
})

describe('firmHues / firmLegend', () => {
  it('gives the oldest active firm the first hue and skips retired firms', () => {
    const hues = firmHues([B, OLD, A])
    expect(hues.get('firm-a')).toBe(FIRM_HUES[0])
    expect(hues.get('firm-b')).toBe(FIRM_HUES[1])
    expect(hues.has('firm-old')).toBe(false)
  })
  it('repeats past six firms', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ id: `f${i}`, name: `F${i}`, active: true, created_at: `2026-01-0${i + 1}` }))
    expect(firmHues(many).get('f6')).toBe(FIRM_HUES[0])
  })
  it('lists each firm with its counties, then No firm yet', () => {
    const legend = firmLegend([A, B], new Map([['Bexar', 'firm-a'], ['Comal', 'firm-a'], ['Travis', 'firm-b']]))
    expect(legend.map((r) => [r.name, r.counties])).toEqual([
      ['Snell Law Firm', ['Bexar', 'Comal']],
      ['Austin firm', ['Travis']],
      ['No firm yet', []],
    ])
    expect(countiesOf(new Map([['Comal', 'firm-a'], ['Bexar', 'firm-a']]), 'firm-a')).toEqual(['Bexar', 'Comal'])
  })
})
