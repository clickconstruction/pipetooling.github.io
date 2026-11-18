import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { ASK_MORE_PRESS, PART_HINT, PART_PRESS_WORDS, addTileFact, boxTiles, countTileFact, countTileTitle, moreRows, moreTitle, noneLeftWords, partPresses, partRowNote, partsCaption, partsOpenByThemselves, photoTileFact, whereTileFact } from './boxScreen'

// Noon on the company's calendar, Wednesday Nov 18 2026. Every name, part and box here is made up.
const NOW = new Date('2026-11-18T18:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()

describe('the tiles a box draws', () => {
  it('draws Count, Photo, Add a part and Where is it? on a box with a line to walk', () => {
    expect(boxTiles({ kind: 'cage', walkable: 1 })).toEqual(['count', 'photo', 'add', 'where'])
  })
  it('leaves Count off a box with nothing to count', () => {
    expect(boxTiles({ kind: 'box', walkable: 0 })).toEqual(['photo', 'add', 'where'])
  })
  it('keeps Add a part alone on Unsorted, the app’s own row', () => {
    expect(boxTiles({ kind: 'unsorted', walkable: 3 })).toEqual(['add'])
  })
})

describe('the Count tile', () => {
  it('names the box', () => {
    expect(countTileTitle('G12')).toBe('Count G12')
  })
  it('says when it was counted and by whom, and is not due', () => {
    expect(countTileFact({ at: daysAgo(1), byName: 'Mateo' }, NOW)).toEqual({ words: 'Counted yesterday by Mateo', due: false })
    expect(countTileFact({ at: daysAgo(0), byName: 'Mateo' }, NOW)).toEqual({ words: 'Counted today by Mateo', due: false })
  })
  it('is due after two weeks and says how long ago', () => {
    expect(countTileFact({ at: daysAgo(13), byName: 'Mateo' }, NOW).due).toBe(false)
    expect(countTileFact({ at: daysAgo(14), byName: 'Mateo' }, NOW)).toEqual({ words: 'Due. Last counted 14 days ago', due: true })
    expect(countTileFact({ at: daysAgo(16), byName: 'Mateo' }, NOW)).toEqual({ words: 'Due. Last counted 16 days ago', due: true })
  })
  it('is due when nobody ever counted it', () => {
    expect(countTileFact(null, NOW)).toEqual({ words: 'Never counted', due: true })
  })
})

describe('the Photo tile', () => {
  it('says how many and the newest one’s day', () => {
    expect(photoTileFact({ label: 'G12', photos: [{ at: '2026-11-12T16:00:00Z' }, { at: '2026-11-17T16:00:00Z' }], after: null, now: NOW })).toEqual({ words: '2 so far, Nov 17', fresh: false })
    expect(photoTileFact({ label: 'G12', photos: [{ at: '2026-11-18T15:00:00Z' }], after: null, now: NOW })).toEqual({ words: '1 so far, today', fresh: false })
  })
  it('says none yet on a box with no photo', () => {
    expect(photoTileFact({ label: 'G12', photos: [], after: null, now: NOW })).toEqual({ words: 'None yet', fresh: false })
  })
  it('says what a photo taken now would be of, in the minutes after a press', () => {
    expect(photoTileFact({ label: 'G12', photos: [], after: 'Count', now: NOW })).toEqual({ words: 'Of G12 as you counted it', fresh: true })
    expect(photoTileFact({ label: 'G12', photos: [], after: 'Add a part', now: NOW }).words).toBe('Of G12 with the part you added')
    expect(photoTileFact({ label: 'G12', photos: [], after: 'Put in', now: NOW }).words).toBe('Of G12 with what went in')
    expect(photoTileFact({ label: 'G12', photos: [], after: 'Move', now: NOW }).words).toBe('Of G12 with what went in')
  })
})

describe('the Add a part and Where is it? tiles', () => {
  it('counts the kinds of part, one or many, and names the first', () => {
    expect(addTileFact('G12', 1)).toBe('1 kind in G12 now')
    expect(addTileFact('G12', 5)).toBe('5 kinds in G12 now')
    expect(addTileFact('G12', 0)).toBe('The first part in G12')
  })
  it('names the place, the where line and the pin', () => {
    expect(whereTileFact({ place: 'Level 2', where: 'by the north stair', pin: 'pinned Nov 12' })).toBe('Level 2, by the north stair, pinned Nov 12')
    expect(whereTileFact({ place: 'Laydown yard', where: '', pin: null })).toBe('Laydown yard, no pin yet')
  })
  it('says a box has no place yet', () => {
    expect(whereTileFact({ place: null, where: '', pin: null })).toBe('No place yet')
    expect(whereTileFact({ place: null, where: ' ', pin: 'pinned today' })).toBe('No place yet, pinned today')
  })
})

describe('a part’s row', () => {
  it('shows today’s four presses in today’s order, with Short renamed', () => {
    expect(partPresses({ unsorted: false, onHand: 8 }).map((p) => PART_PRESS_WORDS[p])).toEqual(['Used', 'Move to…', "Can't find", 'Ask for more'])
    expect(ASK_MORE_PRESS).toBe('Ask for more')
  })
  it('leads with Put in… on Unsorted, which has no Move to…', () => {
    expect(partPresses({ unsorted: true, onHand: 4 })).toEqual(['put-in', 'used', 'cannot_find', 'short'])
    expect(partsOpenByThemselves('unsorted')).toBe(true)
    expect(partsOpenByThemselves('cage')).toBe(false)
  })
  it('keeps only the ask for more on a part with none left', () => {
    expect(partPresses({ unsorted: false, onHand: 0 })).toEqual(['short'])
    expect(noneLeftWords('G12')).toBe('G12 has none left.')
  })
  it('says what is wrong with a part, and nothing when nothing is', () => {
    expect(partRowNote({ cannotFindSinceCount: 0, lastCountDiff: 0 })).toBe('')
    expect(partRowNote({ cannotFindSinceCount: 0, lastCountDiff: null })).toBe('')
    expect(partRowNote({ cannotFindSinceCount: 0, lastCountDiff: 3 })).toBe('')
    expect(partRowNote({ cannotFindSinceCount: 0, lastCountDiff: -2 })).toBe('2 missing at the last count')
    expect(partRowNote({ cannotFindSinceCount: 1, lastCountDiff: -2 })).toBe("1 can't find, 2 missing at the last count")
  })
})

describe('More', () => {
  const rows = moreRows({ label: 'G12', kind: 'cage' }, { text: 'PVC 90 elbow · 14', by: 'app' })
  it('holds the seven rare presses, each with a line that says what it does', () => {
    expect(rows.map((r) => r.title)).toEqual(['Edit G12', 'Say it better', 'Move G12', 'Print the label', 'Print the manifest', 'Copy the label code', 'Retire G12'])
    expect(rows.every((r) => r.sub.length > 0)).toBe(true)
    expect(moreTitle('G12')).toBe('More for G12')
  })
  it('keeps Retire apart, and alone', () => {
    expect(rows.filter((r) => r.apart).map((r) => r.key)).toEqual(['retire'])
    expect(rows[rows.length - 1]!.sub).toBe('When the cage leaves the job')
    expect(moreRows({ label: 'P3', kind: 'loose' }, { text: '', by: 'none' })[6]!.sub).toBe('When the loose pile leaves the job')
  })
  it('says what the line reads now and who wrote it', () => {
    expect(rows[1]!.sub).toBe('Now: PVC 90 elbow · 14, from its parts')
    expect(moreRows({ label: 'G12', kind: 'cage' }, { text: 'PVC fittings, mixed', by: 'person' })[1]!.sub).toBe('Now: PVC fittings, mixed, in a person’s words')
    const none = moreRows({ label: 'G12', kind: 'cage' }, { text: '', by: 'none' })[1]!
    expect(none.title).toBe('Say what is in it')
    expect(none.sub).toBe('Nothing says what is in it yet')
  })
})

describe('plain words', () => {
  it('holds every sentence a first-timer reads to the rules', () => {
    const read = [PART_HINT, partsCaption('G12'), noneLeftWords('G12'), countTileFact({ at: daysAgo(16), byName: 'Mateo' }, NOW).words, photoTileFact({ label: 'G12', photos: [], after: 'Count', now: NOW }).words, addTileFact('G12', 5), ...moreRows({ label: 'G12', kind: 'cage' }, { text: '', by: 'none' }).map((r) => r.sub)]
    for (const words of read) expect(plainWordsFailures(words), words).toEqual([])
  })
})
