import { describe, expect, it } from 'vitest'
import {
  alsoCountiesOf,
  alsoCovers,
  answerHeld,
  changedWords,
  countiesByFirm,
  countiesLine,
  countiesOf,
  countyChanges,
  countySavePayload,
  countyWords,
  coverageFromCountiesByFirm,
  coverageOf,
  firmHues,
  firmLegend,
  firstCalls,
  FIRM_HUES,
  heldChoices,
  heldDoneWords,
  heldQuestion,
  makeFirstCall,
  moveCounty,
  moveQuestion,
  pressCounty,
  pressWords,
  savedAssignments,
  savedCoverage,
  savedWords,
  type CountyCover,
  type LegalFirmCountyRow,
} from './firmCounties'

const A = { id: 'firm-a', name: 'Snell Law Firm', active: true, created_at: '2026-09-01' }
const B = { id: 'firm-b', name: 'Austin firm', active: true, created_at: '2026-10-22' }
const OLD = { id: 'firm-old', name: 'Retired firm', active: false, created_at: '2026-01-01' }

const row = (county: string, firm_id: string, until: string | null = null, extra: Partial<LegalFirmCountyRow> = {}): LegalFirmCountyRow => ({ id: `${county}-${firm_id}`, firm_id, county, since: '2026-10-22T00:00:00Z', until, set_by: null, ...extra })

const ROWS: LegalFirmCountyRow[] = [row('Bexar', 'firm-a'), row('Comal', 'firm-a'), row('Travis', 'firm-b'), row('Hays', 'firm-b', '2026-10-22T01:00:00Z'), row('Potter', 'firm-old')]

const cov = (entries: Array<[string, string, string[]?]>): Map<string, CountyCover> => new Map(entries.map(([county, first, also]) => [county, { first, also: also ?? [] }]))

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

describe('savedCoverage: shared counties and first call (v2.6227)', () => {
  it('a county two firms cover has one first call, the flagged row, and lists the other', () => {
    const rows = [
      row('Comal', 'firm-a', null, { since: '2026-10-01T00:00:00Z', first_call: false }),
      row('Comal', 'firm-b', null, { since: '2026-10-20T00:00:00Z', first_call: true }),
      row('Bexar', 'firm-a', null, { first_call: true }),
    ]
    const c = savedCoverage(rows, new Set(['firm-a', 'firm-b']))
    expect(c.get('Comal')).toEqual({ first: 'firm-b', also: ['firm-a'] })
    expect(c.get('Bexar')).toEqual({ first: 'firm-a', also: [] })
    expect(firstCalls(c).get('Comal')).toBe('firm-b')
    expect([...alsoCovers(c).entries()]).toEqual([['Comal', ['firm-a']]])
    // Both firms list Comal; the first-call map gives it to firm-b alone.
    const by = countiesByFirm(rows, [A, B])
    expect(by.get('firm-a')).toEqual(['Bexar', 'Comal'])
    expect(by.get('firm-b')).toEqual(['Comal'])
    expect([...alsoCountiesOf(c, 'firm-a')]).toEqual(['Comal'])
  })
  it('a row from before the migration has no flag and reads as first call', () => {
    expect(savedCoverage([row('Travis', 'firm-a')]).get('Travis')).toEqual({ first: 'firm-a', also: [] })
  })
  it('when the first call’s firm is retired, the longest-standing firm that stands leads', () => {
    const rows = [
      row('Comal', 'firm-old', null, { since: '2026-01-01T00:00:00Z', first_call: true }),
      row('Comal', 'firm-b', null, { since: '2026-10-20T00:00:00Z', first_call: false }),
      row('Comal', 'firm-a', null, { since: '2026-10-01T00:00:00Z', first_call: false }),
    ]
    expect(savedCoverage(rows, new Set(['firm-a', 'firm-b'])).get('Comal')).toEqual({ first: 'firm-a', also: ['firm-b'] })
  })
  it('the portal’s counts-only shape: the oldest firm leads a shared county', () => {
    const by = new Map<string, string[]>([['firm-b', ['Comal', 'Travis']], ['firm-a', ['Bexar', 'Comal']]])
    const c = coverageFromCountiesByFirm(by, ['firm-a', 'firm-b'])
    expect(c.get('Comal')).toEqual({ first: 'firm-a', also: ['firm-b'] })
    expect(c.get('Travis')).toEqual({ first: 'firm-b', also: [] })
    expect(coverageOf(new Map([['Bell', 'firm-a']])).get('Bell')).toEqual({ first: 'firm-a', also: [] })
  })
})

describe('pressCounty and the held answers', () => {
  const draft = cov([['Bexar', 'firm-a'], ['Travis', 'firm-b'], ['Comal', 'firm-b', ['firm-a']]])
  it('colors a free county for the picked firm, first call', () => {
    const { next, press } = pressCounty(draft, 'Hays', 'firm-a')
    expect(press).toEqual({ kind: 'colored' })
    expect(next.get('Hays')).toEqual({ first: 'firm-a', also: [] })
    expect(draft.has('Hays')).toBe(false)
  })
  it('clears the picked firm’s own county', () => {
    const { next, press } = pressCounty(draft, 'Bexar', 'firm-a')
    expect(press).toEqual({ kind: 'cleared' })
    expect(next.has('Bexar')).toBe(false)
  })
  it('clears a county the picked firm also covers, and the first call stays', () => {
    const { next, press } = pressCounty(draft, 'Comal', 'firm-a')
    expect(press).toEqual({ kind: 'cleared' })
    expect(next.get('Comal')).toEqual({ first: 'firm-b', also: [] })
  })
  it('clearing the first call of a shared county hands first call to the firm that also covers it', () => {
    const { next } = pressCounty(draft, 'Comal', 'firm-b')
    expect(next.get('Comal')).toEqual({ first: 'firm-a', also: [] })
  })
  it('leaves another firm’s county alone and says whose it is', () => {
    const { next, press } = pressCounty(draft, 'Travis', 'firm-a')
    expect(press).toEqual({ kind: 'held', byFirmId: 'firm-b' })
    expect(next.get('Travis')).toEqual({ first: 'firm-b', also: [] })
  })
  it('the three answers: share, take first call, or move', () => {
    expect(answerHeld(draft, 'Travis', 'firm-a', 'share').get('Travis')).toEqual({ first: 'firm-b', also: ['firm-a'] })
    expect(answerHeld(draft, 'Travis', 'firm-a', 'first_call').get('Travis')).toEqual({ first: 'firm-a', also: ['firm-b'] })
    expect(answerHeld(draft, 'Travis', 'firm-a', 'move').get('Travis')).toEqual({ first: 'firm-a', also: [] })
    expect(moveCounty(draft, 'Travis', 'firm-a').get('Travis')).toEqual({ first: 'firm-a', also: [] })
    // A firm that also covers takes first call; a firm that does not is left alone by makeFirstCall.
    expect(makeFirstCall(draft, 'Comal', 'firm-a').get('Comal')).toEqual({ first: 'firm-a', also: ['firm-b'] })
    expect(makeFirstCall(draft, 'Travis', 'firm-a').get('Travis')).toEqual({ first: 'firm-b', also: [] })
  })
  it('the held words', () => {
    expect(moveQuestion('Travis', 'Austin firm', 'Snell Law Firm')).toBe('Travis is Austin firm’s. Move it to Snell Law Firm? Matters already with Austin firm stay there.')
    expect(heldQuestion('Comal', 'Alamo', 'Snell')).toBe('Comal is Alamo’s. How should Snell cover it? Matters already with Alamo stay there.')
    expect(heldChoices('Comal', 'Alamo', 'Snell').map((c) => c.label)).toEqual(['Share it', 'Make Snell first call', 'Move it to Snell'])
    expect(heldChoices('Comal', 'Alamo', 'Snell')[0]!.detail).toBe('Both cover Comal. Alamo stays first call, and the office can switch a release to Snell.')
    expect(heldDoneWords('share', 'Comal', 'Snell', 'Alamo')).toBe('Snell covers Comal too once you save. Alamo stays first call.')
    expect(heldDoneWords('first_call', 'Comal', 'Snell', 'Alamo')).toBe('Snell is first call in Comal once you save. Alamo still covers it.')
    expect(heldDoneWords('move', 'Comal', 'Snell', 'Alamo')).toBe('Comal moved to Snell. New releases there go to them.')
  })
})

describe('countyChanges / countySavePayload', () => {
  const saved = cov([['Bexar', 'firm-a'], ['Comal', 'firm-a'], ['Travis', 'firm-b']])
  it('is empty when the draft is the saved coverage, whatever the order of the also list', () => {
    expect(countyChanges(saved, new Map(saved))).toEqual([])
    expect(countyChanges(cov([['Comal', 'firm-a', ['firm-b', 'firm-c']]]), cov([['Comal', 'firm-a', ['firm-c', 'firm-b']]]))).toEqual([])
    expect(changedWords(0)).toBe('Nothing to save.')
  })
  it('names every county that clears, colors, moves, gains a firm or changes first call, sorted', () => {
    const draft = cov([['Bexar', 'firm-a', ['firm-b']], ['Travis', 'firm-a'], ['Hays', 'firm-b']])
    const changes = countyChanges(saved, draft)
    expect(changes.map((c) => c.county)).toEqual(['Bexar', 'Comal', 'Hays', 'Travis'])
    expect(changedWords(changes.length)).toBe('4 counties changed. Save to make it so.')
    expect(changedWords(1)).toBe('1 county changed. Save to make it so.')
    expect(countySavePayload(changes)).toEqual([
      { county: 'Bexar', firms: ['firm-a', 'firm-b'], first_call: 'firm-a', was: ['firm-a'] },
      { county: 'Comal', firms: [], first_call: null, was: ['firm-a'] },
      { county: 'Hays', firms: ['firm-b'], first_call: 'firm-b', was: [] },
      { county: 'Travis', firms: ['firm-a'], first_call: 'firm-a', was: ['firm-b'] },
    ])
    // A first call moving within the same two firms is a change too.
    expect(countyChanges(cov([['Comal', 'firm-a', ['firm-b']]]), cov([['Comal', 'firm-b', ['firm-a']]])).length).toBe(1)
    expect(savedWords(3)).toBe('3 counties saved. The Legal desk reads them now.')
  })
})

describe('words', () => {
  it('writes the card line, the county, and each press', () => {
    expect(countiesLine([])).toBe('No counties yet')
    expect(countiesLine(['Bexar'])).toBe('1 county · Bexar')
    expect(countiesLine(['Bexar', 'Comal', 'Guadalupe'])).toBe('3 counties · Bexar, Comal, Guadalupe')
    expect(countiesLine(['Bexar', 'Comal'], new Set(['Comal']))).toBe('2 counties · Bexar, Comal (also)')
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
