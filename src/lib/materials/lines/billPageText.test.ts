import { describe, expect, it } from 'vitest'
import { PAGE_TEXT_MAX_CHARS, pageTextWords, paperPageText } from './billSweep'

const PAGES = ['HARLOW SUPPLY\nShip to: 2201 HILLSIDE RD', 'BRIGHTWATER\nOrdered by: Dana', 'CEDAR FORK\nNet 30']

describe('paperPageText (punch list #431): a paper keeps the words of its own pages', () => {
  it('one bill of a file that holds several takes its page alone', () => {
    expect(paperPageText(PAGES, 2, 2)).toBe('BRIGHTWATER\nOrdered by: Dana')
    expect(paperPageText(PAGES, 1, 1)).toBe('HARLOW SUPPLY\nShip to: 2201 HILLSIDE RD')
  })
  it('a bill of two pages takes both, joined', () => {
    expect(paperPageText(PAGES, 2, 3)).toBe('BRIGHTWATER\nOrdered by: Dana\nCEDAR FORK\nNet 30')
  })
  it('a first page with no last is that page', () => {
    expect(paperPageText(PAGES, 3, null)).toBe('CEDAR FORK\nNet 30')
    expect(paperPageText(PAGES, 2, 1)).toBe('BRIGHTWATER\nOrdered by: Dana')
  })
  it('no pages on record, or pages the file does not have, is the whole file', () => {
    const whole = PAGES.join('\n')
    expect(paperPageText(PAGES, null, null)).toBe(whole)
    expect(paperPageText(PAGES, 9, 10)).toBe(whole)
    expect(paperPageText(PAGES, 0, 1)).toBe(whole)
  })
  it('a last page past the end stops at the end', () => {
    expect(paperPageText(PAGES, 3, 99)).toBe('CEDAR FORK\nNet 30')
  })
  it('a file whose text was not read keeps no words, and pages with none keep an empty string', () => {
    expect(paperPageText(null, 1, 1)).toBeNull()
    expect(paperPageText(undefined, null, null)).toBeNull()
    expect(paperPageText(['', '  '], 1, 2)).toBe('')
    expect(paperPageText([], null, null)).toBe('')
  })
  it('drops a NUL, which a text column cannot hold, and keeps no more than the cap', () => {
    expect(paperPageText(['A\u0000B'], null, null)).toBe('AB')
    expect(paperPageText(['x'.repeat(PAGE_TEXT_MAX_CHARS + 500)], null, null)).toHaveLength(PAGE_TEXT_MAX_CHARS)
  })
})

describe('pageTextWords', () => {
  it('says what a run filled, and nothing when it filled nothing', () => {
    expect(pageTextWords(0, 0)).toBe('')
    expect(pageTextWords(1, 1)).toBe('The words of 1 paper were kept from 1 file.')
    expect(pageTextWords(19, 1)).toBe('The words of 19 papers were kept from 1 file.')
    expect(pageTextWords(24, 6)).toBe('The words of 24 papers were kept from 6 files.')
  })
})
