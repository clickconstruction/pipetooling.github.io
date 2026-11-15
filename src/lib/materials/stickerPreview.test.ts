import { describe, expect, it } from 'vitest'
import { STICKER_TEST_STRIP, stickerStrip } from './stickerRun'
import {
  previewCappedWords,
  previewHeadWords,
  previewMoreWords,
  previewNumbers,
  previewStrip,
  showAllLabel,
  STICKER_PREVIEW_CODE_WORDS,
  STICKER_PREVIEW_FIRST_STRIPS,
  STICKER_PREVIEW_MAX_STICKERS,
  STICKER_SAMPLE_CODE,
  stickerPreview,
} from './stickerPreview'

describe('previewNumbers', () => {
  it('starts after the last run, as the foot line reads it', () => {
    expect(previewNumbers(2, 4)).toEqual([3, 4, 5, 6])
  })
  it('the first run starts at 0001', () => {
    expect(previewNumbers(null, 3)).toEqual([1, 2, 3])
  })
  it('a count of zero or less is no numbers', () => {
    expect(previewNumbers(10, 0)).toEqual([])
    expect(previewNumbers(10, -2)).toEqual([])
  })
})

describe('previewStrip', () => {
  it('is the strip a minted sticker prints, with the sample code where the sticker’s own will go', () => {
    const minted = stickerStrip({ id: 'x', number: 147, code: STICKER_SAMPLE_CODE })
    expect(previewStrip(147)).toEqual({ ...minted, id: 'preview-0147' })
    expect(previewStrip(147).address).toBe('PRTS.CO/B/0000-0000')
    expect(previewStrip(147).value).toBe('HTTPS://PRTS.CO/B/00000000')
    expect(previewStrip(147).stencil).toBe('0147')
  })
  it('the sample code is eight characters, as a sticker’s code is, so the QR and the address take the same room', () => {
    expect(STICKER_SAMPLE_CODE).toHaveLength(8)
    expect(STICKER_TEST_STRIP.value.length).toBeLessThan(previewStrip(1).value.length)
  })
})

describe('stickerPreview', () => {
  it('draws the first six strips of a run of 200 after a last of 2, then says the rest', () => {
    const p = stickerPreview({ lastNumber: 2, count: 200, copies: 1, all: false })
    expect(p.first).toBe(3)
    expect(p.last).toBe(202)
    expect(p.head.map((r) => r.strip.stencil)).toEqual(['0003', '0004', '0005', '0006', '0007', '0008'])
    expect(p.head.every((r) => r.copy === 0)).toBe(true)
    expect(p.rest).toEqual([])
    expect(p.more).toBe(194)
    expect(p.moreWords).toBe('and 194 more, to 0202')
    expect(p.showAllLabel).toBe('Show all 200')
    expect(p.cappedWords).toBeNull()
  })

  it('two copies of each draw 1 1 2 2 3 3 in the first six, and the rest counts stickers', () => {
    const p = stickerPreview({ lastNumber: 2, count: 200, copies: 2, all: false })
    expect(p.head.map((r) => `${r.strip.stencil}:${r.copy}`)).toEqual(['0003:0', '0003:1', '0004:0', '0004:1', '0005:0', '0005:1'])
    expect(p.more).toBe(197)
    expect(p.moreWords).toBe('and 197 more, to 0202')
  })

  it('six copies of each fill the head with one sticker', () => {
    const p = stickerPreview({ lastNumber: null, count: 30, copies: 6, all: false })
    expect(p.head).toHaveLength(STICKER_PREVIEW_FIRST_STRIPS)
    expect(p.head.every((r) => r.number === 1)).toBe(true)
    expect(p.more).toBe(29)
  })

  it('a run the head holds whole has no more and no Show all', () => {
    const p = stickerPreview({ lastNumber: 100, count: 4, copies: 1, all: false })
    expect(p.head).toHaveLength(4)
    expect(p.more).toBe(0)
    expect(p.moreWords).toBeNull()
    expect(p.showAllLabel).toBeNull()
    expect(stickerPreview({ lastNumber: 100, count: 3, copies: 2, all: false }).more).toBe(0)
  })

  it('one more reads as its number alone', () => {
    const p = stickerPreview({ lastNumber: 0, count: 7, copies: 1, all: false })
    expect(p.moreWords).toBe('and 1 more, 0007')
  })

  it('Show all draws the rest once each, every number real, and nothing is left', () => {
    const p = stickerPreview({ lastNumber: 2, count: 200, copies: 2, all: true })
    expect(p.head).toHaveLength(6)
    expect(p.rest).toHaveLength(197)
    expect(p.rest[0]!.strip.stencil).toBe('0006')
    expect(p.rest[196]!.strip.stencil).toBe('0202')
    expect(p.rest.every((r) => r.copy === 0)).toBe(true)
    expect(p.more).toBe(0)
    expect(p.moreWords).toBeNull()
    expect(p.showAllLabel).toBeNull()
    expect(p.cappedWords).toBeNull()
  })

  it('a run past the cap draws 200 and says so', () => {
    const p = stickerPreview({ lastNumber: null, count: 500, copies: 1, all: true })
    expect(p.head.length + p.rest.length).toBe(STICKER_PREVIEW_MAX_STICKERS)
    expect(p.more).toBe(300)
    expect(p.cappedWords).toBe('The first 200 of 500 are drawn. The rest print the same way.')
    expect(p.moreWords).toBeNull()
  })

  it('a count of zero draws nothing', () => {
    const p = stickerPreview({ lastNumber: 5, count: 0, copies: 1, all: false })
    expect(p.head).toEqual([])
    expect(p.rest).toEqual([])
    expect(p.more).toBe(0)
    expect(p.showAllLabel).toBeNull()
  })
})

describe('the words', () => {
  it('read plainly', () => {
    expect(previewMoreWords(194, 202)).toBe('and 194 more, to 0202')
    expect(showAllLabel(60)).toBe('Show all 60')
    expect(previewCappedWords(200, 300)).toBe('The first 200 of 300 are drawn. The rest print the same way.')
    expect(STICKER_PREVIEW_CODE_WORDS).toBe('The numbers are the run’s. Each sticker’s code is given when the run prints.')
  })
  it('the head’s line counts strips and stickers', () => {
    const p = stickerPreview({ lastNumber: 2, count: 200, copies: 2, all: false })
    expect(previewHeadWords(p.head, 200)).toBe('6 strips of 200 stickers, 0003 to 0005.')
    const one = stickerPreview({ lastNumber: null, count: 1, copies: 1, all: false })
    expect(previewHeadWords(one.head, 1)).toBe('1 strip of 1 sticker, 0001.')
    expect(previewHeadWords([], 0)).toBe('')
  })
})
