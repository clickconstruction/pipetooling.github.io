import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { keepWeekOpen, pickerLabel, readWeekOpen, TOP_BAR_WORDS, WEEK_STORAGE_KEY } from './topBar'

describe('the one-row header (punch list #151 PR 2)', () => {
  it('names the picker by the pill: All kinds, else the pill’s own label', () => {
    expect(pickerLabel('all')).toBe('All kinds')
    expect(pickerLabel('customer')).toBe('Customers')
    expect(pickerLabel('more')).toBe('Supply houses and candidates')
  })

  it('keeps The last 7 days as you left it on this browser, closed when nothing is kept', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    expect(readWeekOpen(storage)).toBe(false)
    keepWeekOpen(true, storage)
    expect(store.get(WEEK_STORAGE_KEY)).toBe('open')
    expect(readWeekOpen(storage)).toBe(true)
    keepWeekOpen(false, storage)
    expect(readWeekOpen(storage)).toBe(false)
    expect(readWeekOpen(null)).toBe(false)
    expect(() => keepWeekOpen(true, null)).not.toThrow()
  })

  it('starts closed on a browser that keeps nothing', () => {
    const broken = { getItem: () => { throw new Error('no storage') }, setItem: () => { throw new Error('no storage') } }
    expect(readWeekOpen(broken)).toBe(false)
    expect(() => keepWeekOpen(true, broken)).not.toThrow()
  })

  it('says its tips in plain words', () => {
    for (const words of [TOP_BAR_WORDS.pickerTip, TOP_BAR_WORDS.search, TOP_BAR_WORDS.searchClose, TOP_BAR_WORDS.weekTip, TOP_BAR_WORDS.weekCloseTip]) {
      expect(plainWordsFailures(words)).toEqual([])
    }
  })
})
