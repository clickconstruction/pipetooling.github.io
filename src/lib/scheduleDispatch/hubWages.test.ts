import { describe, expect, it } from 'vitest'
import { buildHourlyWageByUserId, hubWageLookupNames, type HubPayConfigWageRow } from './hubWages'

/** The wages behind Expected Manpower's payroll estimate: pay rows are keyed by name, the hub by user id. */
const names = (pairs: Record<string, string>) => new Map(Object.entries(pairs))
const row = (person_name: string | null, hourly_wage: unknown): HubPayConfigWageRow => ({
  person_name,
  hourly_wage: hourly_wage as number | null,
})

describe('hubWageLookupNames', () => {
  it('lists the roster names, trimmed, in roster order', () => {
    expect(hubWageLookupNames(['b', 'a'], names({ a: ' Abraham ', b: 'Bo' }))).toEqual(['Bo', 'Abraham'])
  })

  it('asks once for a name two people share', () => {
    expect(hubWageLookupNames(['a', 'b', 'c'], names({ a: 'Sam', b: 'Sam ', c: 'Cruz' }))).toEqual(['Sam', 'Cruz'])
  })

  it('skips a person with no name, a blank name, or the name "Unknown"', () => {
    expect(hubWageLookupNames(['a', 'b', 'c', 'd'], names({ a: 'Abraham', b: '  ', c: 'Unknown' }))).toEqual([
      'Abraham',
    ])
  })

  it('keeps "Unnamed" and a differently-cased "unknown" — only the exact word is skipped', () => {
    expect(hubWageLookupNames(['a', 'b'], names({ a: 'Unnamed', b: 'unknown' }))).toEqual(['Unnamed', 'unknown'])
  })

  it('reads only the roster, not everyone who has a name', () => {
    expect(hubWageLookupNames(['a'], names({ a: 'Abraham', z: 'Zed' }))).toEqual(['Abraham'])
  })

  it('returns nothing for an empty roster', () => {
    expect(hubWageLookupNames([], names({ a: 'Abraham' }))).toEqual([])
  })
})

describe('buildHourlyWageByUserId', () => {
  it('hands each roster id the wage on its name', () => {
    const m = buildHourlyWageByUserId(
      [row('Abraham', 32.5), row('Bo', 24)],
      ['a', 'b'],
      names({ a: 'Abraham', b: 'Bo' }),
    )
    expect([...m]).toEqual([
      ['a', 32.5],
      ['b', 24],
    ])
  })

  it('matches through whitespace on either side', () => {
    const m = buildHourlyWageByUserId([row('  Abraham ', 32.5)], ['a'], names({ a: ' Abraham  ' }))
    expect(m.get('a')).toBe(32.5)
  })

  it('does not match through a change of case', () => {
    const m = buildHourlyWageByUserId([row('abraham', 32.5)], ['a'], names({ a: 'Abraham' }))
    expect(m.get('a')).toBe(0)
  })

  it('gives every roster id an entry — 0 for no pay row, no name or a blank name', () => {
    const m = buildHourlyWageByUserId([row('Abraham', 32.5)], ['a', 'b', 'c', 'd'], names({ a: 'Abraham', b: 'Bo', c: '  ' }))
    expect([...m]).toEqual([
      ['a', 32.5],
      ['b', 0],
      ['c', 0],
      ['d', 0],
    ])
  })

  it('reads a wage that is not a finite number as 0', () => {
    const m = buildHourlyWageByUserId(
      [row('A', null), row('B', Number.NaN), row('C', Number.POSITIVE_INFINITY), row('D', '32.50'), row('E', undefined)],
      ['a', 'b', 'c', 'd', 'e'],
      names({ a: 'A', b: 'B', c: 'C', d: 'D', e: 'E' }),
    )
    expect([...m.values()]).toEqual([0, 0, 0, 0, 0])
  })

  it('keeps a wage of 0 and passes a negative one through', () => {
    const m = buildHourlyWageByUserId([row('A', 0), row('B', -5)], ['a', 'b'], names({ a: 'A', b: 'B' }))
    expect(m.get('a')).toBe(0)
    expect(m.get('b')).toBe(-5)
  })

  it('takes the later pay row when two share a name', () => {
    const m = buildHourlyWageByUserId([row('Abraham', 30), row(' Abraham', 35)], ['a'], names({ a: 'Abraham' }))
    expect(m.get('a')).toBe(35)
  })

  it('lets a later row with no wage zero an earlier one', () => {
    const m = buildHourlyWageByUserId([row('Abraham', 30), row('Abraham', null)], ['a'], names({ a: 'Abraham' }))
    expect(m.get('a')).toBe(0)
  })

  it('gives two people who share a name the same wage', () => {
    const m = buildHourlyWageByUserId([row('Sam', 28)], ['a', 'b'], names({ a: 'Sam', b: 'Sam' }))
    expect(m.get('a')).toBe(28)
    expect(m.get('b')).toBe(28)
  })

  it('skips a pay row with no name and ignores people who are not on the roster', () => {
    const m = buildHourlyWageByUserId(
      [row(null, 40), row('  ', 41), row('Zed', 42), row('Abraham', 32.5)],
      ['a'],
      names({ a: 'Abraham', z: 'Zed' }),
    )
    expect([...m]).toEqual([['a', 32.5]])
  })

  it('leaves "Unknown" to the lookup names — handed a row for it, the mapping uses it', () => {
    const roster = ['a']
    const nameById = names({ a: 'Unknown' })
    expect(hubWageLookupNames(roster, nameById)).toEqual([])
    expect(buildHourlyWageByUserId([], roster, nameById).get('a')).toBe(0)
    expect(buildHourlyWageByUserId([row('Unknown', 19)], roster, nameById).get('a')).toBe(19)
  })

  it('returns an empty map for an empty roster', () => {
    expect(buildHourlyWageByUserId([row('Abraham', 32.5)], [], names({ a: 'Abraham' })).size).toBe(0)
  })
})
