import { describe, expect, it } from 'vitest'
import {
  SITE_BOX_COUNT_FRESH_MS,
  SITE_BOX_COUNT_KEPT,
  SITE_BOX_DOOR_LABEL,
  SITE_BOX_DOOR_TITLE,
  keepSiteDoorFacts,
  keptSiteDoorFacts,
  siteBoxCountIsStale,
  siteBoxCountSentence,
  siteBoxDoorHref,
  siteBoxDoorWords,
  siteDoorFactsFromCount,
  siteDoorFactsOf,
  siteDoorNews,
  siteJobIdChunks,
} from './siteBoxCount'
import { plainSentence, sentenceParts } from '../valuesInPlace'

describe('siteBoxDoorHref', () => {
  it('opens the On site tab on the job the card names', () => {
    expect(siteBoxDoorHref('job-1')).toBe('/tally?tab=on-site&job=job-1')
  })
  it('opens the tab alone with no job', () => {
    expect(siteBoxDoorHref(null)).toBe('/tally?tab=on-site')
    expect(siteBoxDoorHref('  ')).toBe('/tally?tab=on-site')
  })
})

describe('siteBoxDoorWords', () => {
  it('is the bare label where nothing is on site or nothing is read yet', () => {
    for (const count of [0, null, undefined, Number.NaN, -3]) {
      expect(siteBoxDoorWords(count)).toEqual({ label: SITE_BOX_DOOR_LABEL, count: null, aria: SITE_BOX_DOOR_LABEL, title: SITE_BOX_DOOR_TITLE })
    }
  })
  it('carries the count and says what it counts', () => {
    const w = siteBoxDoorWords(14)
    expect(w.count).toBe('14')
    expect(w.aria).toBe('Materials on site, 14 cages and boxes on this site')
    expect(w.title).toBe('14 cages and boxes on this site. Open them to take, count or move material.')
  })
  it('says one box in the singular', () => {
    expect(siteBoxCountSentence(1)).toBe('1 cage or box on this site')
    expect(siteBoxDoorWords(1).aria).toBe('Materials on site, 1 cage or box on this site')
  })
})

describe('siteJobIdChunks', () => {
  it('cuts a site into runs and drops repeats and blanks', () => {
    expect(siteJobIdChunks(['a', 'b', 'a', ' ', 'c'], 2)).toEqual([['a', 'b'], ['c']])
    expect(siteJobIdChunks([])).toEqual([])
  })
})

describe('siteDoorFactsOf', () => {
  it('reads the database’s answer', () => {
    expect(siteDoorFactsOf({ boxes: 14, due: 2, stickers: 6 })).toEqual({ boxes: 14, due: 2, stickers: 6 })
  })
  it('reads a missing due or stickers as none, and never more due than boxes', () => {
    expect(siteDoorFactsOf({ boxes: 3 })).toEqual({ boxes: 3, due: 0, stickers: 0 })
    expect(siteDoorFactsOf({ boxes: 3, due: 9, stickers: 1 })).toEqual({ boxes: 3, due: 3, stickers: 1 })
  })
  it('is null for an answer that is not one', () => {
    for (const raw of [null, undefined, 14, 'x', [], {}, { boxes: '14' }, { boxes: -1 }]) expect(siteDoorFactsOf(raw)).toBeNull()
  })
  it('makes facts of a bare head count', () => {
    expect(siteDoorFactsFromCount(14)).toEqual({ boxes: 14, due: 0, stickers: 0 })
  })
})

describe('siteDoorNews', () => {
  it('is null where nothing wants a hand', () => {
    expect(siteDoorNews(null)).toBeNull()
    expect(siteDoorNews({ boxes: 14, due: 0, stickers: 0 })).toBeNull()
    expect(siteDoorNews({ boxes: 0, due: 0, stickers: 0 })).toBeNull()
  })
  it('says the boxes due a count, the number marked as a value', () => {
    const news = siteDoorNews({ boxes: 14, due: 2, stickers: 0 })!
    expect(plainSentence(news.due!)).toBe('2 due a count')
    expect(sentenceParts(news.due!)).toEqual([{ kind: 'due', text: '2' }, ' due a count'])
    expect(news.stickers).toBeNull()
    expect(news.plain).toBe('2 due a count')
  })
  it('says the stickers waiting, on a site with no box yet too', () => {
    const news = siteDoorNews({ boxes: 0, due: 0, stickers: 6 })!
    expect(news.due).toBeNull()
    expect(plainSentence(news.stickers!)).toBe('6 stickers ready for a box')
    expect(plainSentence(siteDoorNews({ boxes: 0, due: 0, stickers: 1 })!.stickers!)).toBe('1 sticker ready for a box')
  })
  it('says both', () => {
    expect(siteDoorNews({ boxes: 14, due: 2, stickers: 6 })!.plain).toBe('2 due a count, 6 stickers ready for a box')
  })
})

describe('the facts kept on the phone', () => {
  const F = (boxes: number, due = 0, stickers = 0) => ({ boxes, due, stickers })
  it('keeps a job’s facts and reads them back', () => {
    const raw = keepSiteDoorFacts(null, 'job-1', F(14, 2, 6), 1000)
    expect(keptSiteDoorFacts(raw, 'job-1')).toEqual({ facts: F(14, 2, 6), at: 1000 })
    expect(keptSiteDoorFacts(raw, 'job-2')).toBeNull()
  })
  it('replaces a job’s facts and leaves the others', () => {
    let raw = keepSiteDoorFacts(null, 'job-1', F(14), 1000)
    raw = keepSiteDoorFacts(raw, 'job-2', F(0), 2000)
    raw = keepSiteDoorFacts(raw, 'job-1', F(12, 1), 3000)
    expect(keptSiteDoorFacts(raw, 'job-1')).toEqual({ facts: F(12, 1), at: 3000 })
    expect(keptSiteDoorFacts(raw, 'job-2')).toEqual({ facts: F(0), at: 2000 })
  })
  it('reads a count the first build kept as boxes with nothing due and no stickers', () => {
    expect(keptSiteDoorFacts('{"job-1":{"n":14,"at":1000}}', 'job-1')).toEqual({ facts: F(14), at: 1000 })
  })
  it('drops the oldest past the cap', () => {
    let raw: string | null = null
    for (let i = 0; i < SITE_BOX_COUNT_KEPT + 5; i++) raw = keepSiteDoorFacts(raw, `job-${i}`, F(i), i)
    expect(keptSiteDoorFacts(raw, 'job-0')).toBeNull()
    expect(keptSiteDoorFacts(raw, 'job-4')).toBeNull()
    expect(keptSiteDoorFacts(raw, 'job-5')).toEqual({ facts: F(5), at: 5 })
    expect(Object.keys(JSON.parse(raw as string) as object)).toHaveLength(SITE_BOX_COUNT_KEPT)
  })
  it('reads text it did not write as nothing kept', () => {
    for (const raw of ['', 'not json', '[]', '{"job-1":{"n":"14","at":1}}', '{"job-1":null}']) {
      expect(keptSiteDoorFacts(raw, 'job-1')).toBeNull()
    }
  })
  it('asks for another read once facts are five minutes old', () => {
    expect(siteBoxCountIsStale(null, 0)).toBe(true)
    expect(siteBoxCountIsStale(1000, 1000 + SITE_BOX_COUNT_FRESH_MS - 1)).toBe(false)
    expect(siteBoxCountIsStale(1000, 1000 + SITE_BOX_COUNT_FRESH_MS)).toBe(true)
  })
})
