import { describe, expect, it } from 'vitest'
import type { ScopeBookStore } from './types'
import { exclusionsFor } from './exclusions'
import {
  EMPTY_SCOPE_BOOK,
  inScopeBook,
  lateWords,
  linesToAdd,
  oftenMissed,
  scopeBook,
  scopeBookDuplicates,
  scopeBookExclusionWords,
  scopeBookExclusions,
  scopeBookUseWords,
  scopeSetsFor,
  scopeWordKey,
  searchScopeBook,
  type PastJobLines,
  type ScopeBookInput,
  type ScopeBookProject,
} from './scopeBook'

/** Two finished jobs, as the prototype made them up, and one job in the app whose sitework is the usual lines. */
const PAST: PastJobLines[] = [
  {
    job: 'Fair Oaks Shops, Building C',
    on: '2025-08-30',
    lines: [
      { trade: 'Sitework', words: 'Clearing and grading', spec: '31 10 00' },
      { trade: 'Sitework', words: 'Utilities to 5 ft of the building', spec: '33 10 00', leavesOut: { label: 'Building connections', by: 'Plumbing' } },
      { trade: 'Sitework', words: 'Paving', spec: '32 12 16' },
      { trade: 'Sitework', words: 'Detention pond', spec: '33 40 00', late: { how: 'set', set: 'Bulletin 1', changeOrder: true } },
      { trade: 'Sitework', words: 'Curb cuts and ramps (ADA)', spec: '32 16 00', late: { how: 'set', set: 'Addendum 2' } },
      { trade: 'Concrete', words: 'Foundations', spec: '03 30 00' },
      { trade: 'Plumbing', words: 'Rough in', leavesOut: { label: 'Gas piping', by: 'HVAC' } },
      { trade: 'Electrical', words: 'Site lighting poles and bases', spec: '26 56 00', late: { how: 'leftOut', quotes: 2 } },
    ],
  },
  {
    job: 'Fair Oaks Shops, Building A',
    on: '2024-06-14',
    lines: [
      { trade: 'Sitework', words: 'Site clearing and grading' },
      { trade: 'Sitework', words: 'Erosion control and SWPPP', spec: '31 25 00', late: { how: 'leftOut', quotes: 2 } },
      { trade: 'Sitework', words: 'Curb and gutter', spec: '32 16 13' },
      { trade: 'Concrete', words: 'Sidewalks and curbs' },
      { trade: 'Electrical', words: 'Site lighting poles and bases', spec: '26 56 00', late: { how: 'leftOut', quotes: 1 } },
    ],
  },
]
const BOERNE: ScopeBookProject = {
  id: 'boerne',
  name: 'Boerne Retail Shell',
  planSets: [{ label: 'Bid set', issuedOn: '2026-09-18' }, { label: 'Addendum 1', issuedOn: '2026-09-29', addedLines: [{ packageId: 'site', scopeId: 'site-5' }] }],
  packages: [
    {
      id: 'site',
      trade: 'Sitework',
      scope: [
        { id: 'site-1', label: 'Clearing and grading', specs: ['31 10 00'] },
        { id: 'site-2', label: 'Utilities to 5 ft of the building' },
        { id: 'site-3', label: 'Paving' },
        { id: 'site-4', label: 'Striping and signs' },
        { id: 'site-5', label: 'Detention pond' },
      ],
      invites: [{ bid: { includes: { 'site-1': 'yes', 'site-2': 'yes', 'site-3': 'yes', 'site-4': 'no', 'site-5': 'yes' }, exclusions: [{ name: 'permits' }] } }, { bid: null }],
      excludes: [{ label: 'Rock excavation', by: 'the owner' }],
    },
  ],
  changeOrders: [{ packageId: 'site', description: 'Addendum 1: the detention pond' }],
}
const input = (store: ScopeBookStore = EMPTY_SCOPE_BOOK): ScopeBookInput => ({ projects: [BOERNE], store, pastJobs: PAST, today: '2026-10-06' })

describe('the scope book', () => {
  it('starts full: the usual lines, the finished jobs and every scope on the jobs in the app', () => {
    const book = scopeBook(input())
    expect(new Set(book.map((l) => l.trade)).has('Electrical')).toBe(true)
    const clearing = inScopeBook(book, 'Sitework', 'clearing & grading.')
    expect(clearing?.words).toBe('Clearing and grading')
    expect(clearing?.usedOn).toEqual(['Fair Oaks Shops, Building C', 'Boerne Retail Shell'])
    expect(clearing?.spec).toBe('31 10 00')
    expect(clearing?.lastUsed).toBe('2026-09-18')
    // A usual line brings what its trade usually leaves out.
    expect(inScopeBook(book, 'Landscaping', 'Irrigation')?.leavesOut).toEqual({ label: 'Irrigation sleeves under paving', by: 'Sitework' })
    // A line a later set added came in late, and cost a change order; one a quote left out came in late too.
    expect(inScopeBook(book, 'Sitework', 'Detention pond')?.late).toEqual([
      { job: 'Fair Oaks Shops, Building C', how: 'set', set: 'Bulletin 1', changeOrder: true },
      { job: 'Boerne Retail Shell', how: 'set', set: 'Addendum 1', changeOrder: true },
    ])
    expect(inScopeBook(book, 'Sitework', 'Striping and signs')?.late).toEqual([{ job: 'Boerne Retail Shell', how: 'leftOut', quotes: 1 }])
    expect(scopeWordKey('Building pad to ±0.1 ft.')).toBe('building pad to ±0.1 ft')
  })

  it('searches this trade first, then the lines already here, then other trades, labeled', () => {
    const book = scopeBook(input())
    const hits = searchScopeBook(book, 'Sitework', 'curb', ['Curb and gutter'])
    expect(hits.slice(0, 2).map((h) => `${h.line.words}${h.here ? ' (here)' : ''}`)).toEqual(['Curb cuts and ramps (ADA)', 'Curb and gutter (here)'])
    expect(hits.slice(2).map((h) => `${h.line.trade}: ${h.line.words}`).sort()).toEqual(['Concrete: Sidewalks and curbs', 'Roofing: Roof curbs'])
    expect(hits.slice(2).every((h) => h.otherTrade)).toBe(true)
    expect(searchScopeBook(book, 'Sitework', '', []).every((h) => h.line.trade === 'Sitework')).toBe(true)
  })

  it('warns about the lines we added late before, until the scope has them', () => {
    const book = scopeBook(input())
    const missed = oftenMissed(book, 'Sitework', ['Clearing and grading'])
    expect(missed.map((l) => l.words).sort()).toEqual(['Curb cuts and ramps (ADA)', 'Detention pond', 'Erosion control and SWPPP', 'Striping and signs'])
    expect(missed[0]?.words).toBe('Detention pond')
    const pond = missed.find((l) => l.words === 'Detention pond')
    expect(pond && lateWords(pond.late[0]!)).toBe('came in with Bulletin 1 on Fair Oaks Shops, Building C. It cost a change order.')
    expect(lateWords({ job: 'Fair Oaks Shops, Building A', how: 'leftOut', quotes: 2 })).toBe('was left out by 2 quotes on Fair Oaks Shops, Building A.')
    expect(oftenMissed(book, 'Sitework', ['Detention pond', 'Curb cuts and ramps (ADA)', 'Erosion control and SWPPP', 'Striping and signs'])).toEqual([])
  })

  it('offers sets to start from, the same lines once, and adds only the lines a scope lacks', () => {
    const sets = scopeSetsFor(input(), 'Sitework')
    expect(sets[sets.length - 1]?.name).toBe('Sitework, the usual lines')
    expect(sets.some((s) => s.name === 'Sitework as on Boerne Retail Shell')).toBe(true)
    expect(sets.some((s) => s.name === 'Sitework as on Fair Oaks Shops, Building C')).toBe(true)
    expect(scopeSetsFor(input(), 'Sitework', 'boerne').some((s) => s.name === 'Sitework as on Boerne Retail Shell')).toBe(false)
    expect(new Set(sets.map((s) => s.lines.map(scopeWordKey).sort().join('|'))).size).toBe(sets.length)
    expect(linesToAdd(['Clearing and grading', 'Paving'], ['clearing & grading', 'Detention pond', 'Detention pond', ' '])).toEqual(['Detention pond'])
  })

  it('finds lines that say the same thing in other words', () => {
    const dupes = scopeBookDuplicates(scopeBook(input()))
    const clearing = dupes.find((d) => d.trade === 'Sitework')
    expect(clearing && [clearing.keep.words, clearing.fold.words]).toEqual(['Clearing and grading', 'Site clearing and grading'])
    expect(dupes.some((d) => d.trade === 'Electrical')).toBe(false)
  })

  it('keeps what the office saved, changed, folded together and saved as a set', () => {
    const store: ScopeBookStore = {
      saved: [{ trade: 'Sitework', words: 'Dumpster enclosure gates', spec: '32 31 13', savedOn: '2026-10-04' }],
      edits: [{ trade: 'Sitework', words: 'Paving', to: { words: 'Asphalt paving', spec: '32 12 16' } }],
      merges: [{ trade: 'Sitework', from: 'Site clearing and grading', into: 'Clearing and grading' }],
      sets: [{ id: 'set-1', trade: 'Sitework', name: 'Sitework for a retail pad', lines: ['Clearing and grading', 'Paving', 'Detention pond'], savedOn: '2026-10-04' }],
    }
    const book = scopeBook(input(store))
    expect(inScopeBook(book, 'Sitework', 'Dumpster enclosure gates')?.source).toBe('saved')
    expect(inScopeBook(book, 'Sitework', 'Paving')).toBeUndefined()
    expect(inScopeBook(book, 'Sitework', 'Asphalt paving')?.usedOn).toContain('Fair Oaks Shops, Building C')
    expect(inScopeBook(book, 'Sitework', 'Site clearing and grading')).toBeUndefined()
    expect(inScopeBook(book, 'Sitework', 'Clearing and grading')?.usedOn).toContain('Fair Oaks Shops, Building A')
    expect(scopeBookDuplicates(book).some((d) => d.trade === 'Sitework')).toBe(false)
    const saved = scopeSetsFor(input(store), 'Sitework')[0]
    expect(saved?.name).toBe('Sitework for a retail pad')
    // A set follows the book's changes: Paving reads Asphalt paving now.
    expect(saved?.lines).toEqual(['Clearing and grading', 'Asphalt paving', 'Detention pond'])
    expect(saved?.note).toBe('saved Oct 4')
  })

  it('says how much a line is used', () => {
    const book = scopeBook(input())
    expect(scopeBookUseWords(inScopeBook(book, 'Sitework', 'Detention pond')!)).toBe('2 jobs · last Sep 18')
    expect(scopeBookUseWords(inScopeBook(book, 'Masonry', 'Block walls')!)).toBe('the usual lines')
  })
})

describe('each trade’s exclusions in the scope book', () => {
  it('gathers the usual ones, the Known exclusions on jobs and the quotes’ own, each under its shared name', () => {
    const book = scopeBookExclusions(input())
    const gas = book.find((x) => x.trade === 'Plumbing' && x.name === 'Gas piping')
    expect(gas?.usual).toBe(true)
    expect(gas?.by).toBe('HVAC')
    const site = book.filter((x) => x.trade === 'Sitework')
    const permits = site.find((x) => x.name === 'Permits and fees')
    expect(permits?.quotes).toBe(1)
    expect(permits && scopeBookExclusionWords(permits)).toBe('left out by 1 quote')
    const rock = site.find((x) => x.name === 'Rock excavation')
    expect(rock).toMatchObject({ usual: true, onJobs: ['Boerne Retail Shell'], by: 'the owner' })
    expect(rock && scopeBookExclusionWords(rock)).toBe('usual · on 1 job')
    // The form offers the book's names first, most named first, each once.
    const offered = exclusionsFor('Sitework', book)
    expect(offered[0]).toBe(site[0]?.name)
    expect(new Set(offered).size).toBe(offered.length)
  })
})
