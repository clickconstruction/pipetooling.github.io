/**
 * The range parser's cases are the rule table of `to-dos/stickers-before-boxes/mockup-named-runs.html`, section 4,
 * row for row, plus the twins and the shorthand ends.
 */
import { describe, expect, it } from 'vitest'
import { blankNamesNotice, liveNamesNotice, namesSpanWords, nextTwinName, normalizeStickerRange, readStickerRange, stickerNamesAsk, stickerRangeSetsCount, stickerRangeWords, type StickerRange } from './stickerNames'

const names = (r: StickerRange) => (r.kind === 'names' ? r.names : null)
const refused = (r: StickerRange) => (r.kind === 'refused' ? r.words : null)

describe('readStickerRange · the mock-up’s rule table', () => {
  it('G78-300: the number steps', () => {
    const r = readStickerRange('G78-300', 200)
    expect(r.kind).toBe('names')
    if (r.kind !== 'names') return
    expect(r.first).toBe('G78')
    expect(r.last).toBe('G300')
    expect(r.names).toHaveLength(223)
    expect(r.names[0]).toBe('G78')
    expect(r.names[222]).toBe('G300')
    expect(r.rows).toBe(1)
    expect(r.why).toBe('The number steps.')
  })
  it('G78 alone: How many says how far', () => {
    const r = readStickerRange('G78', 200)
    expect(names(r)).toHaveLength(200)
    expect(names(r)?.[199]).toBe('G277')
    expect(r.kind === 'names' && r.why).toBe('From G78, How many says how far.')
  })
  it('G1-200', () => {
    expect(names(readStickerRange('G1-200', 200))).toHaveLength(200)
  })
  it('A1-D50: the letter and the number step, four rows of fifty, row by row', () => {
    const r = readStickerRange('A1-D50', 200)
    expect(r.kind).toBe('names')
    if (r.kind !== 'names') return
    expect(r.names).toHaveLength(200)
    expect(r.names.slice(0, 2)).toEqual(['A1', 'A2'])
    expect(r.names[50]).toBe('B1')
    expect(r.names[199]).toBe('D50')
    expect(r.rows).toBe(4)
    expect(r.why).toBe('4 rows of 50, A to D, row by row.')
  })
  it('G78B-D: twins at one spot', () => {
    const r = readStickerRange('G78B-D', 200)
    expect(names(r)).toEqual(['G78B', 'G78C', 'G78D'])
    expect(r.kind === 'names' && r.why).toBe('The letter after the number steps: a set of twins at one spot.')
  })
  it('G1B-200B: a back row, every name a B twin', () => {
    const r = readStickerRange('G1B-200B', 200)
    expect(names(r)).toHaveLength(200)
    expect(names(r)?.[0]).toBe('G1B')
    expect(names(r)?.[199]).toBe('G200B')
    expect(r.kind === 'names' && r.why).toBe('The number steps.')
  })
  it('G1-100C: every spot plain, then B, then C, the letter after innermost', () => {
    const r = readStickerRange('G1-100C', 200)
    expect(r.kind).toBe('names')
    if (r.kind !== 'names') return
    expect(r.names).toHaveLength(300)
    expect(r.names.slice(0, 7)).toEqual(['G1', 'G1B', 'G1C', 'G2', 'G2B', 'G2C', 'G3'])
    expect(r.names[299]).toBe('G100C')
    expect(r.why).toBe('Each spot gets the plain name, then B to C: the twins behind it.')
    const b = readStickerRange('G1-100B', 200)
    expect(b.kind === 'names' && b.why).toBe('Each spot gets the plain name, then B: the twins behind it.')
  })
  it('G78B alone: a run that starts at a twin', () => {
    const r = readStickerRange('G78B', 200)
    expect(names(r)?.[0]).toBe('G78B')
    expect(names(r)?.[199]).toBe('G277B')
  })
  it('g78 to g300 reads as G78-300, as do the long dashes and spaces', () => {
    expect(names(readStickerRange('g78 to g300', 200))).toHaveLength(223)
    expect(names(readStickerRange(' G78 – 300 ', 200))).toHaveLength(223)
    expect(names(readStickerRange('G78—G300', 200))).toHaveLength(223)
    expect(normalizeStickerRange(' g78 to g300 ')).toBe('G78-G300')
  })
  it('R7 alone', () => {
    expect(names(readStickerRange('R7', 200))?.[199]).toBe('R206')
  })
  it('G900-1100 is refused: a name is 1 to 999', () => {
    expect(refused(readStickerRange('G900-1100', 200))).toBe('A name is one to three letters and a number from 1 to 999, like R76.')
  })
  it('A1-D200 is refused: a run is 1 to 500 stickers, with its count', () => {
    expect(refused(readStickerRange('A1-D200', 200))).toBe('A run is 1 to 500 stickers. A1 to D200 is 800.')
  })
  it('A1A-D50B is refused: not all three', () => {
    expect(refused(readStickerRange('A1A-D50B', 200))).toBe('A range steps the number, the letter or both. Not all three.')
  })
  it('G300-78 is refused: the range runs upward', () => {
    expect(refused(readStickerRange('G300-78', 200))).toBe('The range runs upward: G78 to G300.')
    expect(refused(readStickerRange('G78C-B', 200))).toBe('The range runs upward: G78B to G78C.')
    expect(refused(readStickerRange('G78B-G78', 200))).toBe('The range runs upward: G78 to G78B.')
  })
  it('GATE1-GATE9 and G0-10 are refused by the rule', () => {
    expect(refused(readStickerRange('GATE1-GATE9', 200))).toBe('A name is one to three letters and a number from 1 to 999, like R76.')
    expect(refused(readStickerRange('G0-10', 200))).toBe('A name is one to three letters and a number from 1 to 999, like R76.')
  })
  it('GA1-GD12: two-letter rows step on the last letter', () => {
    const r = readStickerRange('GA1-GD12', 200)
    expect(names(r)).toHaveLength(48)
    expect(r.kind === 'names' && r.why).toBe('4 rows of 12, GA to GD, row by row.')
  })
  it('letters that cannot step are refused: AB1-C5, D1-A5', () => {
    expect(refused(readStickerRange('AB1-C5', 200))).toBe('The letters step on the last letter only, A to D or GA to GD, upward.')
    expect(refused(readStickerRange('D1-A5', 200))).toBe('The letters step on the last letter only, A to D or GA to GD, upward.')
  })
  it('three parts are refused with the shape', () => {
    expect(refused(readStickerRange('G1-2-3', 200))).toBe('A range is two names with one dash between, like G78-300.')
  })
  it('nothing typed is a numbered-only run', () => {
    expect(readStickerRange('', 200)).toEqual({ kind: 'numbered' })
    expect(readStickerRange('   ', 200)).toEqual({ kind: 'numbered' })
  })
  it('a start alone past 999 stops at 999 with its words', () => {
    const r = readStickerRange('G900', 200)
    expect(names(r)).toHaveLength(100)
    expect(names(r)?.[99]).toBe('G999')
    expect(r.kind === 'names' && r.why).toBe('Names stop at G999, so the run is 100.')
  })
  it('How many out of range is held to 1 and 500', () => {
    expect(names(readStickerRange('G1', 0))).toHaveLength(1)
    expect(names(readStickerRange('G1', 900))).toHaveLength(500)
    expect(names(readStickerRange('G1', Number.NaN))).toHaveLength(1)
  })
  it('a name is one of a kind in the list it makes', () => {
    const r = readStickerRange('G1-100C', 200)
    expect(new Set(names(r)).size).toBe(300)
  })
})

describe('the words', () => {
  it('read the range, the refusal or the numbered line', () => {
    expect(stickerRangeWords(readStickerRange('G78-300', 200))).toBe('G78 to G300 · 223 stickers. The number steps.')
    expect(stickerRangeWords(readStickerRange('R7-7', 200))).toBe('R7 to R7 · 1 sticker. The number steps.')
    expect(stickerRangeWords(readStickerRange('G0', 200))).toBe('A name is one to three letters and a number from 1 to 999, like R76.')
    expect(stickerRangeWords(readStickerRange('', 200))).toBe('Nothing typed: the stickers carry their number only. A leftover works on any site.')
  })
  it('a dash sets the count, a start alone does not', () => {
    expect(stickerRangeSetsCount('G78-300')).toBe(true)
    expect(stickerRangeSetsCount('g78 to g300')).toBe(true)
    expect(stickerRangeSetsCount('G78')).toBe(false)
  })
})

describe('nextTwinName', () => {
  const boxes = [
    { label: 'G78', kind: 'cage', retiredAt: null },
    { label: 'G79', kind: 'cage', retiredAt: null },
    { label: 'G79B', kind: 'cage', retiredAt: null },
    { label: 'G80', kind: 'cage', retiredAt: '2026-11-01T00:00:00Z' },
  ]
  it('G78B when G78 is live and no twin stands; G79C when G79B stands', () => {
    expect(nextTwinName(boxes, 'G78')).toBe('G78B')
    expect(nextTwinName(boxes, 'g79')).toBe('G79C')
    expect(nextTwinName(boxes, 'G79B')).toBe('G79C')
  })
  it('null when the plain name is not a live box, or the name is off the rule', () => {
    expect(nextTwinName(boxes, 'G80')).toBeNull()
    expect(nextTwinName(boxes, 'G81')).toBeNull()
    expect(nextTwinName(boxes, 'TOILETS')).toBeNull()
  })
  it('null past Z', () => {
    const full = [{ label: 'R1', kind: 'cage', retiredAt: null }].concat(Array.from({ length: 25 }, (_, i) => ({ label: `R1${String.fromCharCode(66 + i)}`, kind: 'cage', retiredAt: null })))
    expect(nextTwinName(full, 'R1')).toBeNull()
  })
})

describe('the window’s Names field (PR 8, v2.7391)', () => {
  it('a start alone takes How many, and the offered name says it was offered', () => {
    const ask = stickerNamesAsk('G78', 200, 'G78')
    expect(ask.count).toBe(200)
    expect(ask.countFollows).toBe(false)
    expect(ask.tone).toBe('ok')
    expect(ask.words).toBe('G78 to G277 · 200 stickers. G78 is the site’s next free name. Type a range to set the end, like G78-177.')
    // typed by hand, or another name than the offer: the parser's own line
    expect(stickerNamesAsk('G90', 30, 'G78').words).toBe('G90 to G119 · 30 stickers. From G90, How many says how far.')
    expect(stickerNamesAsk('g78', 200, null).words).toBe('G78 to G277 · 200 stickers. From G78, How many says how far.')
  })

  it('a typed range sets the count, and How many follows it', () => {
    const ask = stickerNamesAsk('G78-300', 200, 'G78')
    expect(ask.count).toBe(223)
    expect(ask.countFollows).toBe(true)
    expect(ask.words).toBe('G78 to G300 · 223 stickers. The number steps.')
    expect(stickerNamesAsk('g78 to 300', 30).count).toBe(223)
    expect(stickerNamesAsk('A1-D50', 30).count).toBe(200)
  })

  it('a refusal is said in the parser’s words and counts nothing', () => {
    const ask = stickerNamesAsk('G300-78', 200)
    expect(ask.tone).toBe('refused')
    expect(ask.count).toBe(0)
    expect(ask.countFollows).toBe(false)
    expect(ask.words).toBe('The range runs upward: G78 to G300.')
    expect(stickerNamesAsk('G1-600', 200).words).toBe('A run is 1 to 500 stickers. G1 to G600 is 600.')
    expect(stickerNamesAsk('78', 200).tone).toBe('refused')
  })

  it('cleared, the run is numbered only and How many is the count', () => {
    const ask = stickerNamesAsk('  ', 60, 'G78')
    expect(ask.range.kind).toBe('numbered')
    expect(ask.count).toBe(60)
    expect(ask.words).toBe('Nothing typed: the stickers carry their number only. A leftover works on any site.')
  })

  it('names that stop at 999 say so even when the start is the offer', () => {
    const ask = stickerNamesAsk('G990', 200, 'G990')
    expect(ask.count).toBe(10)
    expect(ask.words).toBe('G990 to G999 · 10 stickers. Names stop at G999, so the run is 10.')
  })

  it('some of a run’s names read as a stretch, a pair, or the first two and how many more', () => {
    const run = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6']
    expect(namesSpanWords([], run)).toBe('')
    expect(namesSpanWords(['G3'], run)).toBe('G3')
    expect(namesSpanWords(['G2', 'G3', 'G4'], run)).toBe('G2 to G4')
    expect(namesSpanWords(['G2', 'G5'], run)).toBe('G2 and G5')
    expect(namesSpanWords(['G1', 'G3', 'G5', 'G6'], run)).toBe('G1, G3 and 2 more')
  })

  const box = (label: string, over: Partial<{ retiredAt: string | null; kind: string }> = {}) => ({ label, kind: over.kind ?? 'cage', retiredAt: over.retiredAt ?? null })

  it('names that are live boxes on the site are a notice: their stickers go on those boxes', () => {
    const names = readStickerRange('G1-200', 0)
    const run = names.kind === 'names' ? names.names : []
    const site = [...Array.from({ length: 77 }, (_, i) => box(`G${i + 1}`)), box('R1'), box('G150', { retiredAt: '2026-11-01T00:00:00Z' })]
    const notice = liveNamesNotice(run, site)!
    expect(notice.names).toHaveLength(77)
    expect(notice.words).toBe('77 of these are boxes on this site already, G1 to G77. Their stickers go on those boxes.')
    // one, in the singular; a retired box and Unsorted are not live names
    expect(liveNamesNotice(['G77', 'G78'], site)!.words).toBe('1 of these is a box on this site already, G77. Its sticker goes on that box.')
    expect(liveNamesNotice(['G150'], site)).toBeNull()
    expect(liveNamesNotice(['G78', 'G79'], [...site, box('g78 ', { kind: 'unsorted' })])).toBeNull()
    // a name saved in small letters still counts
    expect(liveNamesNotice(['G78'], [box(' g78')])!.names).toEqual(['G78'])
  })

  it('names an earlier run printed and that are on no box yet hold the press', () => {
    const names = readStickerRange('G150-200', 0)
    const run = names.kind === 'names' ? names.names : []
    const blank = Array.from({ length: 23 }, (_, i) => `G${178 + i}`)
    const notice = blankNamesNotice(run, blank)!
    expect(notice.names).toHaveLength(23)
    expect(notice.words).toBe('23 of these were printed on an earlier run and are not on a box yet, G178 to G200. Printing them again makes two stickers for each name.')
    expect(notice.anywayLabel).toBe('Print them anyway')
    const one = blankNamesNotice(['G178', 'G300'], ['g178'])!
    expect(one.words).toBe('1 of these was printed on an earlier run and is not on a box yet, G178. Printing it again makes two stickers for one name.')
    expect(one.anywayLabel).toBe('Print it anyway')
    expect(blankNamesNotice(['G1', 'G2'], blank)).toBeNull()
    expect(blankNamesNotice(run, [])).toBeNull()
  })
})
