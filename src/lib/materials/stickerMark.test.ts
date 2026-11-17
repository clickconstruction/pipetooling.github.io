import { describe, expect, it } from 'vitest'
import {
  MARK_NOT_KEPT,
  NO_MARK,
  STICKER_MARK_SINCE,
  didNotPrintAsk,
  markCountsWords,
  markNotKeptWords,
  newlyMarkedStickerIds,
  notPrintedTitle,
  printNotPrintedLabel,
  reservedMarkOf,
  runKeepsMark,
  stickerPrinted,
  stickersMarkedWords,
  stickersUnmarkedWords,
  stickersWhoseStripsWent,
  takeStickerMarkOffLabel,
  waitingStickersOf,
} from './stickerMark'

/** A run made after the mark began, and one made before it. */
const NEW_RUN = { printedAt: '2026-11-17T15:00:00Z' }
const OLD_RUN = { printedAt: '2026-11-16T22:00:00Z' }
const PRINTED = '2026-11-17T15:05:00Z'

const sticker = (number: number, over: { containerId?: string | null; lostAt?: string | null; printedAt?: string | null } = {}) => ({ id: `s-${number}`, number, containerId: null, lostAt: null, ...over })

describe('whether a sticker printed', () => {
  it('a sticker with a time printed, and one with none or an empty one did not', () => {
    expect(stickerPrinted({ printedAt: PRINTED })).toBe(true)
    expect(stickerPrinted({ printedAt: null })).toBe(false)
    expect(stickerPrinted({ printedAt: '' })).toBe(false)
    expect(stickerPrinted({})).toBe(false)
  })

  it('the mark began at midnight of 2026-11-17 in the app’s time zone', () => {
    expect(STICKER_MARK_SINCE).toBe('2026-11-17T06:00:00Z')
  })
})

describe('which runs the app keeps the record for', () => {
  it('a run made since the mark began is watched, with no sticker marked yet', () => {
    expect(runKeepsMark(NEW_RUN, [sticker(1), sticker(2)])).toBe(true)
    expect(runKeepsMark({ printedAt: STICKER_MARK_SINCE }, [])).toBe(true)
  })

  it('a run made before it is not watched until one of its stickers carries a mark', () => {
    expect(runKeepsMark(OLD_RUN, [sticker(1), sticker(2)])).toBe(false)
    expect(runKeepsMark(OLD_RUN, [sticker(1, { printedAt: PRINTED }), sticker(2)])).toBe(true)
  })

  it('a run with no readable day is watched only by a mark', () => {
    expect(runKeepsMark({}, [sticker(1)])).toBe(false)
    expect(runKeepsMark({ printedAt: 'not a day' }, [sticker(1)])).toBe(false)
    expect(runKeepsMark({ printedAt: '' }, [sticker(1, { printedAt: PRINTED })])).toBe(true)
  })
})

describe('the reserved stickers, counted by the mark', () => {
  it('a new run with none printed waits whole', () => {
    expect(reservedMarkOf([{ run: NEW_RUN, stickers: [sticker(1), sticker(2), sticker(3)] }])).toEqual({ printed: 0, waiting: 3, unknown: 0 })
  })

  it('a run stopped part way counts what went and what did not', () => {
    const stickers = [sticker(1, { printedAt: PRINTED }), sticker(2), sticker(3)]
    expect(reservedMarkOf([{ run: NEW_RUN, stickers }])).toEqual({ printed: 1, waiting: 2, unknown: 0 })
  })

  it('a sticker on a box or lost is not counted: the line is about the reserved ones', () => {
    const stickers = [sticker(1, { containerId: 'box-1', printedAt: PRINTED }), sticker(2, { lostAt: PRINTED }), sticker(3)]
    expect(reservedMarkOf([{ run: NEW_RUN, stickers }])).toEqual({ printed: 0, waiting: 1, unknown: 0 })
  })

  it('an old run with no mark is unknown, and nothing is said of it', () => {
    expect(reservedMarkOf([{ run: OLD_RUN, stickers: [sticker(1), sticker(2)] }])).toEqual({ printed: 0, waiting: 0, unknown: 2 })
  })

  it('an old run that the app has seen print is watched from then on: the rest have not printed yet', () => {
    const stickers = [sticker(1, { printedAt: PRINTED }), sticker(2, { printedAt: PRINTED }), sticker(3)]
    expect(reservedMarkOf([{ run: OLD_RUN, stickers }])).toEqual({ printed: 2, waiting: 1, unknown: 0 })
  })

  it('a mark on a sticker that is on a box still tells the app the run was seen to print', () => {
    const stickers = [sticker(1, { containerId: 'box-1', printedAt: PRINTED }), sticker(2)]
    expect(reservedMarkOf([{ run: OLD_RUN, stickers }])).toEqual({ printed: 0, waiting: 1, unknown: 0 })
  })

  it('runs are added up, and with no reserved sticker the answer is the one empty count', () => {
    expect(reservedMarkOf([
      { run: NEW_RUN, stickers: [sticker(1, { printedAt: PRINTED }), sticker(2)] },
      { run: OLD_RUN, stickers: [sticker(3), sticker(4)] },
    ])).toEqual({ printed: 1, waiting: 1, unknown: 2 })
    expect(reservedMarkOf([])).toBe(NO_MARK)
    expect(reservedMarkOf([{ run: NEW_RUN, stickers: [sticker(1, { containerId: 'box-1' })] }])).toBe(NO_MARK)
  })
})

describe('the stickers a press prints when only what never came out is wanted', () => {
  it('the reserved ones with no mark, lowest first', () => {
    const stickers = [sticker(3), sticker(1, { printedAt: PRINTED }), sticker(2), sticker(4, { containerId: 'box-4' }), sticker(5, { lostAt: PRINTED })]
    expect(waitingStickersOf(NEW_RUN, stickers).map((s) => s.number)).toEqual([2, 3])
  })

  it('none for a run the app was not watching', () => {
    expect(waitingStickersOf(OLD_RUN, [sticker(1), sticker(2)])).toEqual([])
  })
})

describe('the words after the count', () => {
  it('none printed, some printed, all printed', () => {
    expect(markCountsWords({ printed: 0, waiting: 58, unknown: 0 })).toBe('None printed yet.')
    expect(markCountsWords({ printed: 40, waiting: 18, unknown: 0 })).toBe('40 printed, 18 not printed yet.')
    expect(markCountsWords({ printed: 58, waiting: 0, unknown: 0 })).toBe('All printed.')
  })

  it('beside stickers of a run the app was not watching, it says only what it knows', () => {
    expect(markCountsWords({ printed: 0, waiting: 18, unknown: 30 })).toBe('18 not printed yet.')
    expect(markCountsWords({ printed: 40, waiting: 0, unknown: 30 })).toBe('40 printed.')
    expect(markCountsWords({ printed: 40, waiting: 18, unknown: 30 })).toBe('40 printed, 18 not printed yet.')
  })

  it('with nothing known it says nothing', () => {
    expect(markCountsWords({ printed: 0, waiting: 0, unknown: 58 })).toBe('')
    expect(markCountsWords(NO_MARK)).toBe('')
  })
})

describe('which stickers a print marks', () => {
  const printing = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('one strip a sticker: a sticker a strip', () => {
    expect(stickersWhoseStripsWent(printing, 2, 1)).toEqual(['a', 'b'])
    expect(stickersWhoseStripsWent(printing, 3, 1)).toEqual(['a', 'b', 'c'])
  })

  it('with copies a sticker counts once its last copy is out, and one part way through does not', () => {
    // a run of 30 at two of each, stopped after four strips: two stickers whole
    expect(stickersWhoseStripsWent(Array.from({ length: 30 }, (_, i) => ({ id: `s-${i}` })), 4, 2)).toEqual(['s-0', 's-1'])
    // three strips of two each: the second sticker is half out
    expect(stickersWhoseStripsWent(printing, 3, 2)).toEqual(['a'])
    expect(stickersWhoseStripsWent(printing, 9, 5)).toEqual(['a'])
  })

  it('nothing out marks nothing, and more strips than the run never marks past it', () => {
    expect(stickersWhoseStripsWent(printing, 0, 1)).toEqual([])
    expect(stickersWhoseStripsWent(printing, 99, 1)).toEqual(['a', 'b', 'c'])
  })

  it('the take-back counts only the stickers that had no mark before', () => {
    expect(newlyMarkedStickerIds(['a', 'b', 'c'], new Set(['b']))).toEqual(['a', 'c'])
    expect(newlyMarkedStickerIds(['a'], new Set(['a']))).toEqual([])
  })
})

describe('the words of the mark', () => {
  it('says what the print window marked, and asks before the press that takes it back', () => {
    expect(stickersMarkedWords(58)).toBe('58 stickers are now marked as printed.')
    expect(stickersMarkedWords(1)).toBe('1 sticker is now marked as printed.')
    expect(didNotPrintAsk(58)).toBe('Did they not print?')
    expect(didNotPrintAsk(1)).toBe('Did it not print?')
    expect(takeStickerMarkOffLabel(58)).toBe('Take the mark off 58 stickers')
    expect(takeStickerMarkOffLabel(1)).toBe('Take the mark off 1 sticker')
    expect(stickersUnmarkedWords(58)).toBe('The mark is off 58 stickers.')
    expect(stickersUnmarkedWords(1)).toBe('The mark is off 1 sticker.')
  })

  it('the press counts what never came out, with its names when it has them', () => {
    expect(printNotPrintedLabel(18, 'G133 to G150')).toBe('Print the 18 not printed yet, G133 to G150')
    expect(printNotPrintedLabel(1, 'G150')).toBe('Print the 1 not printed yet, G150')
    expect(printNotPrintedLabel(28)).toBe('Print the 28 not printed yet')
    expect(notPrintedTitle(18, 'G133 to G150')).toBe('Not printed yet, G133 to G150')
    expect(notPrintedTitle(28)).toBe('28 stickers not printed yet')
    expect(notPrintedTitle(1)).toBe('1 sticker not printed yet')
  })

  it('a mark that was not kept says why, and never claims a print failed', () => {
    // a refusal comes back already led by the sentence
    expect(markNotKeptWords('The app did not record that these printed: Read-only (training) mode: changes are blocked.')).toBe('The app did not record that these printed: Read-only (training) mode: changes are blocked.')
    // a lost signal comes back alone, and the sentence is put first
    expect(markNotKeptWords('No signal. Try again when you are back online.')).toBe('The app did not record that these printed. No signal. Try again when you are back online.')
    expect(markNotKeptWords('  ')).toBe(MARK_NOT_KEPT)
    expect(MARK_NOT_KEPT).toBe('The app did not record that these printed.')
  })
})
