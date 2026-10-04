import { describe, expect, it } from 'vitest'
import { gcReducer } from './gcReducer'
import { initialGcState } from './gcFixture'
import { exclusionsFor } from './gcExclusions'
import {
  scopeBookExclusions,
  scopeBookExclusionWords,
  inScopeBook,
  lateWords,
  linesToAdd,
  oftenMissed,
  scopeBook,
  scopeBookDuplicates,
  scopeBookUseWords,
  scopeSetsFor,
  scopeWordKey,
  searchScopeBook,
} from './gcScopeBook'

describe('the scope book', () => {
  it('starts full: the usual lines, the finished jobs and every scope on the jobs in the app', () => {
    const book = scopeBook(initialGcState())
    const trades = new Set(book.map((l) => l.trade))
    expect(trades.has('Sitework')).toBe(true)
    expect(trades.has('Electrical')).toBe(true)
    const clearing = inScopeBook(book, 'Sitework', 'clearing & grading.')
    expect(clearing?.words).toBe('Clearing and grading')
    expect(clearing?.usedOn).toContain('Fair Oaks Shops, Building C')
    expect(clearing?.spec).toBe('31 10 00')
    // A usual line brings what its trade usually leaves out.
    expect(inScopeBook(book, 'Landscaping', 'Irrigation')?.leavesOut).toEqual({ label: 'Irrigation sleeves under paving', by: 'Sitework' })
    expect(scopeWordKey('Building pad to ±0.1 ft.')).toBe('building pad to ±0.1 ft')
  })

  it('searches this trade first, then the lines already here, then other trades, labeled', () => {
    const book = scopeBook(initialGcState())
    const hits = searchScopeBook(book, 'Sitework', 'curb', ['Curb and gutter'])
    expect(hits.slice(0, 2).map((h) => `${h.line.words}${h.here ? ' (here)' : ''}`)).toEqual(['Curb cuts and ramps (ADA)', 'Curb and gutter (here)'])
    expect(hits.slice(2).map((h) => `${h.line.trade}: ${h.line.words}`).sort()).toEqual(['Concrete: Sidewalks and curbs', 'Roofing: Roof curbs'])
    expect(hits.slice(2).every((h) => h.otherTrade)).toBe(true)
    // No words typed: only this trade.
    expect(searchScopeBook(book, 'Sitework', '', []).every((h) => h.line.trade === 'Sitework')).toBe(true)
  })

  it('warns about the lines we added late before, until the scope has them', () => {
    const book = scopeBook(initialGcState())
    const missed = oftenMissed(book, 'Sitework', ['Clearing and grading'])
    // Striping and signs: a quote on Boerne Retail Shell left it out.
    expect(missed.map((l) => l.words)).toEqual(['Striping and signs', 'Curb cuts and ramps (ADA)', 'Detention pond', 'Erosion control and SWPPP'])
    const pond = missed.find((l) => l.words === 'Detention pond')
    expect(pond && lateWords(pond.late[0]!)).toBe('came in with Bulletin 1 on Fair Oaks Shops, Building C. It cost a change order.')
    expect(lateWords({ job: 'Fair Oaks Shops, Building A', how: 'leftOut', quotes: 2 })).toBe('was left out by 2 quotes on Fair Oaks Shops, Building A.')
    expect(oftenMissed(book, 'Sitework', ['Detention pond', 'Curb cuts and ramps (ADA)', 'Erosion control and SWPPP', 'Striping and signs'])).toEqual([])
  })

  it('offers sets to start from, the same lines once, and adds only the lines a scope lacks', () => {
    const state = initialGcState()
    const sets = scopeSetsFor(state, 'Sitework')
    // Boerne Retail Shell's Sitework is the usual lines word for word, so it shows once, as the usual lines.
    expect(sets[sets.length - 1]?.name).toBe('Sitework, the usual lines')
    expect(sets.some((s) => s.name === 'Sitework as on Boerne Retail Shell')).toBe(false)
    expect(sets.some((s) => s.name === 'Sitework as on Fair Oaks Shops, Building C')).toBe(true)
    expect(new Set(sets.map((s) => s.lines.map(scopeWordKey).sort().join('|'))).size).toBe(sets.length)
    expect(linesToAdd(['Clearing and grading', 'Paving'], ['clearing & grading', 'Detention pond', 'Detention pond', ' '])).toEqual(['Detention pond'])
  })

  it('finds lines that say the same thing in other words', () => {
    const dupes = scopeBookDuplicates(scopeBook(initialGcState()))
    const clearing = dupes.find((d) => d.trade === 'Sitework')
    expect(clearing && [clearing.keep.words, clearing.fold.words]).toEqual(['Clearing and grading', 'Site clearing and grading'])
    // Site lighting is its own work in Electrical.
    expect(dupes.some((d) => d.trade === 'Electrical')).toBe(false)
  })

  it('keeps what the office saves, changes, folds together and saves as a set', () => {
    let state = initialGcState()
    state = gcReducer(state, { type: 'saveToScopeBook', trade: 'Sitework', words: 'Dumpster enclosure gates', spec: '32 31 13' })
    expect(inScopeBook(scopeBook(state), 'Sitework', 'Dumpster enclosure gates')?.source).toBe('saved')
    // Saving it again, or a line the book has, changes nothing.
    expect(gcReducer(state, { type: 'saveToScopeBook', trade: 'Sitework', words: 'dumpster enclosure gates' })).toBe(state)
    expect(gcReducer(state, { type: 'saveToScopeBook', trade: 'Sitework', words: 'Paving' })).toBe(state)

    state = gcReducer(state, { type: 'editScopeBookLine', trade: 'Sitework', words: 'Paving', to: { words: 'Asphalt paving', spec: '32 12 16' } })
    let book = scopeBook(state)
    expect(inScopeBook(book, 'Sitework', 'Paving')).toBeUndefined()
    expect(inScopeBook(book, 'Sitework', 'Asphalt paving')?.usedOn).toContain('Fair Oaks Shops, Building C')

    state = gcReducer(state, { type: 'mergeScopeBookLines', trade: 'Sitework', from: 'Site clearing and grading', into: 'Clearing and grading' })
    book = scopeBook(state)
    expect(inScopeBook(book, 'Sitework', 'Site clearing and grading')).toBeUndefined()
    expect(inScopeBook(book, 'Sitework', 'Clearing and grading')?.usedOn).toContain('Fair Oaks Shops, Building A')
    expect(scopeBookDuplicates(book).some((d) => d.trade === 'Sitework')).toBe(false)

    state = gcReducer(state, { type: 'saveScopeSet', trade: 'Sitework', name: 'Sitework for a retail pad', lines: ['Clearing and grading', 'Paving', 'Detention pond'] })
    const saved = scopeSetsFor(state, 'Sitework')[0]
    expect(saved?.name).toBe('Sitework for a retail pad')
    // A set follows the book's changes: Paving reads Asphalt paving now.
    expect(saved?.lines).toEqual(['Clearing and grading', 'Asphalt paving', 'Detention pond'])
    expect(saved?.note).toMatch(/^saved /)
    expect(state.log[0]?.text).toBe('Saved the set "Sitework for a retail pad" to the scope book: 3 Sitework lines.')
  })

  it('says how much a line is used', () => {
    const book = scopeBook(initialGcState())
    expect(scopeBookUseWords(inScopeBook(book, 'Sitework', 'Detention pond')!)).toBe('1 job · last Aug 30')
    expect(scopeBookUseWords(inScopeBook(book, 'Masonry', 'Block walls')!)).toBe('the usual lines')
  })
})

describe('each trade\'s exclusions in the scope book', () => {
  it('gathers the usual ones, the Known exclusions on jobs and the quotes\' own, each under its shared name', () => {
    const state = initialGcState()
    const plumbing = scopeBookExclusions(state).filter((x) => x.trade === 'Plumbing')
    const gas = plumbing.find((x) => x.name === 'Gas piping')
    expect(gas?.usual).toBe(true)
    expect(gas?.by).toBe('HVAC')
    // A quote that wrote "permits" in its own words, on whatever trade has a quote in.
    const pkg = state.projects.flatMap((p) => p.packages).find((p) => p.invites.some((i) => i.bid))
    const inv = pkg?.invites.find((i) => i.bid)
    if (!pkg || !inv?.bid) throw new Error('the made-up jobs have a quote in')
    inv.bid = { ...inv.bid, exclusions: [{ name: 'permits', said: 'permits' }] }
    const book = scopeBookExclusions(state)
    const mine = book.filter((x) => x.trade === pkg.trade)
    const permits = mine.find((x) => x.name === 'Permits and fees')
    expect(permits?.quotes).toBe(1)
    expect(permits && scopeBookExclusionWords(permits)).toMatch(/left out by 1 quote$/)
    // The form offers the book's names first, most named first, each once.
    const offered = exclusionsFor(pkg.trade, book)
    expect(offered[0]).toBe(mine[0]?.name)
    expect(offered).toContain('Permits and fees')
    expect(new Set(offered).size).toBe(offered.length)
    // Without the book, the form offers what it always did.
    expect(exclusionsFor('Plumbing')[0]).toBe('Gas piping')
  })
})
