import { describe, expect, it } from 'vitest'
import { percentSourceOptions, type PercentGridRow } from './percentRow'
import { liveTapeNumbers, parseTapeLine, serializeTapeLine, tapeLineForGroup, tapeLineForRow, tapeSourceFor } from './tapeDrag'

const row = (over: Partial<PercentGridRow> & { id: string; name: string }): PercentGridRow => ({ kind: 'fixture', tags: [], count: 1, revenue: 0, cost: 0, unitPrice: 0, priced: false, isFixedPrice: false, rule: null, ...over })
const pipe = (id: string, name: string, count: number, unit: number): PercentGridRow => row({ id, name, kind: 'pipe', count, unitPrice: unit, revenue: count * unit, priced: true })

const BID: PercentGridRow[] = [
  row({ id: 'wc', name: 'WC', count: 2, unitPrice: 2500, revenue: 5000, cost: 620, priced: true }),
  row({ id: 'lav', name: 'LAV', count: 2, unitPrice: 2000, revenue: 4000, cost: 1680, priced: true }),
  pipe('w34', 'ft of 3/4IN WATER', 60, 30),
  pipe('w12', 'ft of 1/2IN WATER', 80.5, 15),
  // A rule row of the same kind: a rule would not read it, so the drag does not carry it.
  row({ id: 'conn', name: 'Connections', kind: 'pipe', count: 1, unitPrice: 999, revenue: 999, priced: true, rule: { pct: 40, basis: 'revenue', source: { kind: 'fixture' } } }),
]
const option = (key: string) => percentSourceOptions(BID, null).find((o) => o.key === key)!

describe('a Kind breakdown line dragged onto the calculator', () => {
  it('carries the group’s revenue, count and cost as a rule would read them', () => {
    const line = tapeLineForGroup(option('kind:pipe'), BID, 'ft')
    expect(line).toMatchObject({ label: 'Pipe', sub: '2 rows', sourceKey: 'kind:pipe' })
    expect(line.numbers.map((n) => [n.key, n.label, n.value, n.display, n.hold])).toEqual([
      ['revenue', 'Revenue', 3007.5, '$3,007.50', null],
      ['count', 'Count', 140.5, '140.5 ft', null],
      ['cost', 'Cost', null, 'none on these rows', 'These rows carry no takeoff cost yet'],
    ])
    expect(liveTapeNumbers(line).map((n) => n.key)).toEqual(['revenue', 'count'])
  })

  it('gives a group with cost a live Cost', () => {
    const line = tapeLineForGroup(option('kind:fixture'), BID, 'ea')
    expect(line.numbers.find((n) => n.key === 'cost')).toEqual({ key: 'cost', label: 'Cost', value: 2300, display: '$2,300.00', hold: null })
    expect(line.sub).toBe('2 rows')
  })

  it('names the picked number, and keeps the group only where a rule can follow it', () => {
    const line = tapeLineForGroup(option('kind:pipe'), BID, 'ft')
    expect(tapeSourceFor(line, line.numbers[0]!)).toEqual({ words: 'Pipe revenue', basis: 'revenue', sourceKey: 'kind:pipe' })
    expect(tapeSourceFor(line, line.numbers[1]!)).toEqual({ words: 'Pipe count', basis: 'count', sourceKey: null })
    const fixtures = tapeLineForGroup(option('kind:fixture'), BID, 'ea')
    expect(tapeSourceFor(fixtures, fixtures.numbers[2]!)).toEqual({ words: 'Fixtures cost', basis: 'cost', sourceKey: 'kind:fixture' })
  })
})

describe('a grid row dragged onto the calculator', () => {
  it('carries its revenue, its price per unit, its count and its cost, with no group', () => {
    const line = tapeLineForRow(BID[0]!)
    expect(line).toMatchObject({ label: 'WC', sub: 'a row', sourceKey: null })
    expect(line.numbers.map((n) => [n.key, n.value, n.display])).toEqual([
      ['revenue', 5000, '$5,000.00'],
      ['unit-price', 2500, '$2,500.00'],
      ['count', 2, '2'],
      ['cost', 620, '$620.00'],
    ])
    expect(tapeSourceFor(line, line.numbers[0]!)).toEqual({ words: 'WC revenue', basis: 'revenue', sourceKey: null })
    expect(tapeSourceFor(line, line.numbers[1]!)).toEqual({ words: 'WC price per unit', basis: 'other', sourceKey: null })
  })

  it('holds the numbers a row does not have yet, each with its reason', () => {
    const line = tapeLineForRow(row({ id: 'fd', name: 'Floor drain', count: 3 }))
    expect(line.numbers.map((n) => [n.key, n.value, n.hold])).toEqual([
      ['revenue', null, 'This row has no price yet'],
      ['unit-price', null, 'This row has no price yet'],
      ['count', 3, null],
      ['cost', null, 'This row carries no takeoff cost yet'],
    ])
    expect(liveTapeNumbers(line).map((n) => n.key)).toEqual(['count'])
  })
})

describe('what is dropped', () => {
  it('reads back as it was dragged', () => {
    const line = tapeLineForGroup(option('kind:pipe'), BID, 'ft')
    expect(parseTapeLine(serializeTapeLine(line))).toEqual(line)
  })

  it.each([null, '', 'not json', '42', '{"label":"Pipe"}', '{"label":"Pipe","sub":"2 rows","numbers":[]}', '{"label":"Pipe","sub":"2 rows","numbers":[{"key":"margin","label":"Margin","value":1,"display":"1","hold":null}]}'])('takes %j as nothing', (text) => {
    expect(parseTapeLine(text)).toBeNull()
  })

  it('drops a number it cannot read and keeps the rest', () => {
    const text = JSON.stringify({ label: 'Pipe', sub: '2 rows', sourceKey: 7, numbers: [{ key: 'revenue', label: 'Revenue', value: 'lots', display: '$1', hold: null }, { key: 'count', label: 'Count', value: 3, display: '3 ft', hold: null }] })
    expect(parseTapeLine(text)).toEqual({ label: 'Pipe', sub: '2 rows', sourceKey: null, numbers: [{ key: 'count', label: 'Count', value: 3, display: '3 ft', hold: null }] })
  })
})
