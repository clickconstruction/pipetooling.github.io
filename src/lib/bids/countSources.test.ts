import { describe, expect, it } from 'vitest'

import {
  INCOMING_SOURCE_KEY,
  countSourceLabel,
  decideCountsImportMode,
  isWhollyOf,
  legacyAdoptionPatches,
  parseSourceShares,
  resolveShareKeys,
  sharesForNewRow,
  sharesOrNull,
  unclaimedOf,
  withShare,
} from './countSources'

const T = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const U = '11111111-2222-3333-4444-555555555555'

describe('decideCountsImportMode (v2.5517)', () => {
  it('a hand paste or an empty sheet keeps today’s review', () => {
    expect(decideCountsImportMode({ token: null, sources: [{ id: 's1', token: T }], legacyToken: null, hasRows: true }).mode).toBe('replace')
    expect(decideCountsImportMode({ token: T, sources: [], legacyToken: null, hasRows: false })).toEqual({ mode: 'replace', incomingKey: INCOMING_SOURCE_KEY, recopySourceId: null, adoptLegacy: false })
  })

  it('a token the bid knows is a re-copy of that project, case aside', () => {
    expect(decideCountsImportMode({ token: T.toUpperCase(), sources: [{ id: 's1', token: T }], legacyToken: null, hasRows: true })).toEqual({ mode: 'recopy', incomingKey: 's1', recopySourceId: 's1', adoptLegacy: false })
  })

  it('a new token on a bid that already has a project combines; a legacy link with another token counts as that project and is adopted', () => {
    expect(decideCountsImportMode({ token: U, sources: [{ id: 's1', token: T }], legacyToken: null, hasRows: true })).toMatchObject({ mode: 'combine', incomingKey: INCOMING_SOURCE_KEY, adoptLegacy: false })
    expect(decideCountsImportMode({ token: U, sources: [], legacyToken: T, hasRows: true })).toMatchObject({ mode: 'combine', adoptLegacy: true })
  })

  it('the first copy onto a sheet with no project, or the same project as the legacy link, replaces; the legacy link is adopted', () => {
    expect(decideCountsImportMode({ token: T, sources: [], legacyToken: null, hasRows: true })).toMatchObject({ mode: 'replace', adoptLegacy: false })
    expect(decideCountsImportMode({ token: T, sources: [], legacyToken: T, hasRows: true })).toMatchObject({ mode: 'replace', adoptLegacy: true })
  })
})

describe('the share arithmetic', () => {
  it('parses the column defensively and keeps float dust out', () => {
    expect(parseSourceShares({ a: 1489.04, b: '3', c: -1, d: 2 })).toEqual({ a: 1489.04, d: 2 })
    expect(parseSourceShares([1])).toEqual({})
    expect(parseSourceShares(null)).toEqual({})
    expect(withShare({ a: 1489.04 }, 'b', 338.41)).toEqual({ a: 1489.04, b: 338.41 })
    expect(withShare({ a: 1, b: 2 }, 'b', 0)).toEqual({ a: 1 })
    expect(unclaimedOf(1827.45, { a: 1489.04, b: 338.41 })).toBe(0)
    expect(unclaimedOf(10, { a: 4 })).toBe(6)
    expect(isWhollyOf(10, { a: 10 }, 'a')).toBe(true)
    expect(isWhollyOf(10, { a: 4, b: 6 }, 'a')).toBe(false)
    expect(sharesOrNull({})).toBeNull()
  })

  it('the sentinel resolves to the real source id on Apply; new rows carry the arriving project’s share', () => {
    expect(resolveShareKeys({ [INCOMING_SOURCE_KEY]: 338.41, s1: 1489.04 }, 's2')).toEqual({ s2: 338.41, s1: 1489.04 })
    expect(resolveShareKeys(null, 's2')).toBeNull()
    expect(sharesForNewRow({ count: 68.02 }, INCOMING_SOURCE_KEY)).toEqual({ [INCOMING_SOURCE_KEY]: 68.02 })
    expect(sharesForNewRow({ count: 0 }, 's1')).toBeNull()
  })

  it('legacy adoption stamps only the share-less rows with a count', () => {
    const patches = legacyAdoptionPatches([{ id: 'a', count: 5 }, { id: 'b', count: 3, source_shares: { s9: 3 } }, { id: 'c', count: 0 }], 's1')
    expect(patches).toEqual([{ id: 'a', before: { source_shares: null }, patch: { source_shares: { s1: 5 } } }])
  })

  it('labels a source by its name and importer, falling back to the link’s host', () => {
    expect(countSourceLabel({ project_name: 'SpaceX BA', link: 'https://counttooling.com/app/?t=x' }, 'Robert')).toBe('SpaceX BA · Robert')
    expect(countSourceLabel({ project_name: null, link: 'https://counttooling.com/app/?t=x' }, null)).toBe('counttooling.com')
    expect(countSourceLabel({ project_name: '', link: 'not a url' }, 'Taunya')).toBe('CountTooling · Taunya')
  })
})
