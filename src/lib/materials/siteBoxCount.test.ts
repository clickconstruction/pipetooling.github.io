import { describe, expect, it } from 'vitest'
import {
  SITE_BOX_COUNT_FRESH_MS,
  SITE_BOX_COUNT_KEPT,
  SITE_BOX_DOOR_LABEL,
  SITE_BOX_DOOR_TITLE,
  keepSiteBoxCount,
  keptSiteBoxCount,
  siteBoxCountIsStale,
  siteBoxCountSentence,
  siteBoxDoorHref,
  siteBoxDoorWords,
  siteJobIdChunks,
} from './siteBoxCount'

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

describe('the counts kept on the phone', () => {
  it('keeps a count and reads it back', () => {
    const raw = keepSiteBoxCount(null, 'job-1', 14, 1000)
    expect(keptSiteBoxCount(raw, 'job-1')).toEqual({ n: 14, at: 1000 })
    expect(keptSiteBoxCount(raw, 'job-2')).toBeNull()
  })
  it('replaces a job’s count and leaves the others', () => {
    let raw = keepSiteBoxCount(null, 'job-1', 14, 1000)
    raw = keepSiteBoxCount(raw, 'job-2', 0, 2000)
    raw = keepSiteBoxCount(raw, 'job-1', 12, 3000)
    expect(keptSiteBoxCount(raw, 'job-1')).toEqual({ n: 12, at: 3000 })
    expect(keptSiteBoxCount(raw, 'job-2')).toEqual({ n: 0, at: 2000 })
  })
  it('drops the oldest past the cap', () => {
    let raw: string | null = null
    for (let i = 0; i < SITE_BOX_COUNT_KEPT + 5; i++) raw = keepSiteBoxCount(raw, `job-${i}`, i, i)
    expect(keptSiteBoxCount(raw, 'job-0')).toBeNull()
    expect(keptSiteBoxCount(raw, 'job-4')).toBeNull()
    expect(keptSiteBoxCount(raw, 'job-5')).toEqual({ n: 5, at: 5 })
    expect(Object.keys(JSON.parse(raw as string) as object)).toHaveLength(SITE_BOX_COUNT_KEPT)
  })
  it('reads text it did not write as nothing kept', () => {
    for (const raw of ['', 'not json', '[]', '{"job-1":{"n":"14","at":1}}', '{"job-1":null}']) {
      expect(keptSiteBoxCount(raw, 'job-1')).toBeNull()
    }
  })
  it('asks for another read once a count is five minutes old', () => {
    expect(siteBoxCountIsStale(null, 0)).toBe(true)
    expect(siteBoxCountIsStale(1000, 1000 + SITE_BOX_COUNT_FRESH_MS - 1)).toBe(false)
    expect(siteBoxCountIsStale(1000, 1000 + SITE_BOX_COUNT_FRESH_MS)).toBe(true)
  })
})
