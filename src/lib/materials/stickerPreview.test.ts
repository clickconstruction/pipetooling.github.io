import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { STICKER_TEST_STRIP, stickerStrip } from './stickerRun'
import {
  previewCappedWords,
  previewHeadWords,
  previewMoreWords,
  previewStrip,
  showAllLabel,
  STICKER_PREVIEW_CODE_WORDS,
  STICKER_PREVIEW_FIRST_STRIPS,
  STICKER_PREVIEW_MAX_STICKERS,
  STICKER_PREVIEW_NAMED_CODE_WORDS,
  STICKER_PREVIEW_NO_COUNT_WORDS,
  STICKER_PREVIEW_TEST_WORDS,
  STICKER_SAMPLE_CODE,
  stickerPreview,
} from './stickerPreview'

const names = (first: number, n: number) => Array.from({ length: n }, (_, i) => `G${first + i}`)

describe('previewStrip', () => {
  it('is the strip a minted sticker prints, with the sample code where the sticker’s own will go', () => {
    const minted = stickerStrip({ id: 'x', number: 1, code: STICKER_SAMPLE_CODE, boxName: 'G78' })
    expect(previewStrip(0, 'G78')).toEqual({ ...minted, id: 'preview-0' })
    expect(previewStrip(0, 'G78').address).toBe('PRTS.CO/B/0000-0000')
    expect(previewStrip(0, 'G78').value).toBe('HTTPS://PRTS.CO/B/00000000')
    expect(previewStrip(0, 'G78').stencil).toBe('G78')
    // with no name the strip has no stencil: its code is drawn larger in the name's place
    expect(previewStrip(4).stencil).toBe('')
    expect(previewStrip(4).id).toBe('preview-4')
    // the sample is a code's own length, so the QR and the address are the size they will print
    expect(STICKER_SAMPLE_CODE).toHaveLength(8)
    expect(STICKER_TEST_STRIP.value.length).toBeLessThan(previewStrip(0).value.length)
  })
})

describe('stickerPreview · a run that names its boxes', () => {
  it('draws the first six strips by name, in print order, then says the rest', () => {
    const p = stickerPreview({ count: 223, copies: 1, all: false, names: names(78, 223) })
    expect(p.head.map((r) => r.strip.stencil)).toEqual(['G78', 'G79', 'G80', 'G81', 'G82', 'G83'])
    expect(p.head).toHaveLength(STICKER_PREVIEW_FIRST_STRIPS)
    expect(previewHeadWords(p.head, 223)).toBe('6 strips of 223 stickers, G78 to G83.')
    expect(p.more).toBe(217)
    expect(p.moreWords).toBe('and 217 more, to G300')
    expect(p.showAllLabel).toBe('Show all 223')
    expect(p.rest).toEqual([])
    expect(p.cappedWords).toBeNull()
    expect(p.head[0]!.strip.address).toBe('PRTS.CO/B/0000-0000')
  })

  it('two copies of each draw 1 1 2 2 3 3 in the first six, and the rest counts stickers', () => {
    const p = stickerPreview({ count: 60, copies: 2, all: false, names: names(1, 60) })
    expect(p.head.map((r) => [r.strip.stencil, r.copy])).toEqual([['G1', 0], ['G1', 1], ['G2', 0], ['G2', 1], ['G3', 0], ['G3', 1]])
    expect(p.more).toBe(57)
    expect(p.moreWords).toBe('and 57 more, to G60')
  })

  it('six copies of each fill the head with one sticker', () => {
    const p = stickerPreview({ count: 30, copies: 6, all: false, names: names(1, 30) })
    expect(p.head.every((r) => r.strip.stencil === 'G1')).toBe(true)
    expect(p.more).toBe(29)
  })

  it('a run the head holds whole has no more and no Show all, and one more reads as its name alone', () => {
    const whole = stickerPreview({ count: 4, copies: 1, all: false, names: names(1, 4) })
    expect(whole.more).toBe(0)
    expect(whole.moreWords).toBeNull()
    expect(whole.showAllLabel).toBeNull()
    expect(stickerPreview({ count: 7, copies: 1, all: false, names: names(1, 7) }).moreWords).toBe('and 1 more, G7')
  })

  it('the names set how many, whatever count is handed', () => {
    const p = stickerPreview({ count: 999, copies: 2, all: true, names: ['A1', 'A2'] })
    expect(p.head.map((r) => r.strip.stencil)).toEqual(['A1', 'A1', 'A2', 'A2'])
    expect(p.more).toBe(0)
  })

  it('Show all draws the rest once each, every name real, and nothing is left', () => {
    const p = stickerPreview({ count: 60, copies: 2, all: true, names: names(1, 60) })
    expect(p.rest).toHaveLength(57)
    expect(p.rest[0]!.strip.stencil).toBe('G4')
    expect(p.rest[56]!.strip.stencil).toBe('G60')
    expect(p.more).toBe(0)
    expect(p.showAllLabel).toBeNull()
    expect(p.moreWords).toBeNull()
  })

  it('a run past the cap draws 200 and says so', () => {
    const p = stickerPreview({ count: 300, copies: 1, all: true, names: names(1, 300) })
    expect(p.head.length + p.rest.length).toBe(STICKER_PREVIEW_MAX_STICKERS)
    expect(p.more).toBe(100)
    expect(p.cappedWords).toBe('The first 200 of 300 are drawn. The rest print the same way.')
    expect(p.moreWords).toBeNull()
  })

  it('a long name is marked for the smaller size', () => {
    const p = stickerPreview({ count: 2, copies: 1, all: false, names: ['AB298', 'AB299'] })
    expect(p.head.every((r) => r.strip.small)).toBe(true)
  })
})

describe('stickerPreview · a run with no names', () => {
  it('draws one sticker, since every other differs only by its code', () => {
    const p = stickerPreview({ count: 200, copies: 1, all: false, names: null })
    expect(p.head).toHaveLength(1)
    expect(p.head[0]!.strip.stencil).toBe('')
    expect(previewHeadWords(p.head, 200)).toBe('1 sticker of 200, with a sample code.')
    expect(p.more).toBe(199)
    expect(p.moreWords).toBe('and 199 more, each with its own code')
    // nothing more to show: no Show all, and pressing it would draw nothing
    expect(p.showAllLabel).toBeNull()
    expect(stickerPreview({ count: 200, copies: 1, all: true }).rest).toEqual([])
    expect(stickerPreview({ count: 200, copies: 1, all: true }).cappedWords).toBeNull()
  })

  it('its copies come together, and one sticker alone has no more', () => {
    const p = stickerPreview({ count: 30, copies: 3, all: false, names: [] })
    expect(p.head.map((r) => r.copy)).toEqual([0, 1, 2])
    const one = stickerPreview({ count: 1, copies: 1, all: false })
    expect(one.more).toBe(0)
    expect(one.moreWords).toBeNull()
    expect(previewHeadWords(one.head, 1)).toBe('1 sticker, with a sample code.')
  })

  it('a count of zero draws nothing', () => {
    const p = stickerPreview({ count: 0, copies: 1, all: false })
    expect(p.head).toEqual([])
    expect(previewHeadWords(p.head, 0)).toBe('')
  })
})

describe('the words', () => {
  it('read plainly', () => {
    expect(previewMoreWords(217, 'G300')).toBe('and 217 more, to G300')
    expect(previewMoreWords(1, 'G300')).toBe('and 1 more, G300')
    expect(previewMoreWords(199, '')).toBe('and 199 more, each with its own code')
    expect(showAllLabel(60)).toBe('Show all 60')
    expect(previewCappedWords(200, 300)).toBe('The first 200 of 300 are drawn. The rest print the same way.')
    expect(STICKER_PREVIEW_NAMED_CODE_WORDS).toContain('The names are the run’s.')
    for (const w of [STICKER_PREVIEW_CODE_WORDS, STICKER_PREVIEW_NAMED_CODE_WORDS, STICKER_PREVIEW_TEST_WORDS, STICKER_PREVIEW_NO_COUNT_WORDS, previewCappedWords(200, 300)]) expect(plainWordsFailures(w), w).toEqual([])
    // no line of the preview says a running number
    for (const w of [STICKER_PREVIEW_CODE_WORDS, STICKER_PREVIEW_NAMED_CODE_WORDS]) expect(w).not.toMatch(/number/i)
  })
})
