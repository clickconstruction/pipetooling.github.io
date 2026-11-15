import { describe, expect, it } from 'vitest'
import { DIFFICULTY_PRICE_V1 } from './difficultyPrice'
import {
  difficultyCapWords,
  difficultyLineWords,
  difficultyLines,
  difficultyLinesToStore,
  difficultyOnPriceWords,
  difficultyPayingDays,
  difficultyRowDescription,
  difficultySkippedWords,
  difficultyStripWords,
  type DifficultyLinesInput,
} from './difficultyLines'

/** The canvas's bid: 480 field hours at $80, $172,400 on the price, rated field 2, office 1, paying 1 at 62 days. */
const canvas = (over: Partial<DifficultyLinesInput> = {}): DifficultyLinesInput => ({
  scales: [
    { key: 'paying', name: 'Paying', points: 1, sentence: 'They pay slow. Read from their bills against the price list’s rule.' },
    { key: 'field', name: 'Field and superintendent', points: 2, sentence: 'The order of work changes after we mobilize, or the site is not ready when they call us out.' },
    { key: 'office', name: 'Their office', points: 1, sentence: 'Pay apps come back for paperwork, lien waivers are asked for twice, a question waits a week.' },
  ],
  price: DIFFICULTY_PRICE_V1,
  fieldHours: 480,
  laborRate: 80,
  ownCost: 114266,
  carried: 172400,
  payingMedianDays: 62,
  payingReason: 'Read from their bills: Paid in 62 days, the median of 7 bills.',
  ...over,
})

describe('difficultyLines (punch list #357, PR 4)', () => {
  it('the canvas’s three lines: a percent of field hours, office hours at the office rate, the carry on the price', () => {
    const d = difficultyLines(canvas())
    expect(d.points).toBe(4)
    expect(d.lines.map((l) => [l.key, l.hours, l.rate, l.amount])).toEqual([
      ['paying', 0, 0, 1465.4], // 172,400 × 1.5% × 17/30
      ['field', 48, 80, 3840], // 10% of 480 at $80
      ['office', 12, 80, 960],
    ])
    expect(d.total).toBe(6265.4)
    expect(d.capped).toBeNull()
    expect(d.skipped).toEqual([])
    expect(d.lines[1]!.words).toBe('10% of 480 field hours at $80')
    expect(d.lines[2]!.words).toBe('12 office hours at $80')
    expect(d.lines[0]!.words).toBe('carrying $172k for 17 days past 45, at 1.5% a month. Read from their bills.')
  })

  it('a by-hand paying point carries one threshold’s worth of days and says so', () => {
    expect(difficultyPayingDays(DIFFICULTY_PRICE_V1, null)).toBe(45)
    expect(difficultyPayingDays(DIFFICULTY_PRICE_V1, 40)).toBe(0)
    const d = difficultyLines(canvas({ payingMedianDays: null, payingReason: 'By hand: their bills are on another system' }))
    const paying = d.lines.find((l) => l.key === 'paying')!
    expect(paying.amount).toBe(3879) // 172,400 × 1.5% × 45/30
    expect(paying.words).toBe('carrying $172k for 45 days past 45, at 1.5% a month. Set by hand: their bills are on another system')
  })

  it('a scale the list has no rule for, and a line that prices to nothing, are named and add nothing', () => {
    const d = difficultyLines(canvas({ scales: [...canvas().scales, { key: 'weather', name: 'Weather', points: 2, sentence: 'Rain.' }], fieldHours: 0 }))
    expect(d.lines.map((l) => l.key)).toEqual(['paying', 'office'])
    expect(d.skipped).toEqual([
      { key: 'field', name: 'Field and superintendent', why: 'the bid has no field hours yet' },
      { key: 'weather', name: 'Weather', why: 'the price list has no rule for it' },
    ])
    expect(difficultySkippedWords(d.skipped[1]!)).toBe('Weather adds nothing: the price list has no rule for it.')
    const slow = difficultyLines(canvas({ payingMedianDays: 40 }))
    expect(slow.skipped[0]).toEqual({ key: 'paying', name: 'Paying', why: 'their median is not past 45 days' })
  })

  it('a zero-point scale adds no line and no points', () => {
    const d = difficultyLines(canvas({ scales: [{ key: 'field', name: 'Field', points: 0, sentence: 'Fine.' }] }))
    expect(d.lines).toEqual([])
    expect(d.points).toBe(0)
    expect(d.total).toBe(0)
  })

  it('the cap holds every line by the same share', () => {
    const d = difficultyLines(canvas({ ownCost: 20000 })) // cap $2,000 on $6,265.40
    expect(d.capped).toEqual({ before: 6265.4, cap: 2000 })
    expect(d.total).toBe(2000)
    expect(d.lines.map((l) => l.amount)).toEqual([467.78, 1225.78, 306.44])
    expect(d.lines[1]!.hours).toBe(15.32)
    expect(difficultyCapWords(d)).toBe('The lines came to $6,265; the price list holds them to $2,000, 31.9% of that, so each shrank by the same share.')
    expect(difficultyCapWords(difficultyLines(canvas()))).toBeNull()
  })

  it('the strip, the fold and the row read the same numbers', () => {
    const d = difficultyLines(canvas())
    expect(difficultyStripWords(d)).toBe('Difficulty · 4 points · +$6,265 in cost')
    expect(difficultyStripWords({ points: 1, total: 960 })).toBe('Difficulty · 1 point · +$960 in cost')
    expect(difficultyOnPriceWords(d.total, 30)).toBe('about +$8,951 on the price at 30%')
    expect(difficultyOnPriceWords(d.total, null)).toBeNull()
    expect(difficultyLineWords(d.lines[1]!)).toBe('Field and superintendent 2 · $3,840 · 10% of 480 field hours at $80: the order of work changes after we mobilize, or the site is not ready when they call us out.')
    expect(difficultyRowDescription(d.lines[2]!)).toBe('Difficulty · Their office 1 · 12 office hours at $80')
    expect(difficultyLinesToStore(d)[2]).toEqual({ key: 'office', name: 'Their office', points: 1, hours: 12, rate: 80, amount: 960, sentence: d.lines[2]!.sentence, words: '12 office hours at $80' })
  })
})
