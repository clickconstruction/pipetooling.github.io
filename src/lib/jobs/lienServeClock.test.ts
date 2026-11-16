import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { lienServeClock, lienServeRowWords } from './lienServeClock'

const TODAY = '2026-11-16'

describe('lienServeRowWords', () => {
  const row = (serveDue: string | null) => lienServeRowWords(lienServeClock(serveDue, TODAY))

  it('says what is owed and by when', () => {
    expect(row('2026-11-18')).toBe('Lien filed · mail its copies by Nov 18')
    expect(row('2026-11-16')).toBe('Lien filed · mail its copies today')
  })

  it('says the day a late copy was due, and to mail it today', () => {
    expect(row('2026-11-11')).toBe('Lien filed · its copies were due Nov 11. Mail them today.')
  })

  it('still asks for the copies when the filing keeps no day', () => {
    expect(row(null)).toBe('Lien filed · mail its copies')
  })

  it('keeps each sentence plain', () => {
    for (const due of ['2026-11-18', '2026-11-16', '2026-11-11']) {
      for (const sentence of row(due).split('. ')) expect(plainWordsFailures(sentence.replace('Lien filed · ', ''))).toEqual([])
    }
  })
})
