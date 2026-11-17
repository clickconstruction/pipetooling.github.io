import { describe, expect, it } from 'vitest'
import { ALL_LABELLED_WORDS, LABEL_MARK_SINCE, boxesWhoseLabelWent, everyBoxLabelled, labelPrinted, labelWaits, markAsLabelledLabel, markedWords, newlyMarkedIds, notPrintedChipWords, notPrintedDoorLabel, notPrintedIds, takeMarkOffLabel, unmarkedWords } from './labelMark'

const box = (id: string, createdAt: string, labelPrintedAt: string | null = null) => ({ id, createdAt, labelPrintedAt })
const BEFORE = '2026-11-16T23:00:00Z'
const AFTER = '2026-11-17T14:00:00Z'

describe('which boxes wait for a label', () => {
  it('a box is printed once the app holds a time for its label', () => {
    expect(labelPrinted({ labelPrintedAt: '2026-11-17T15:00:00Z' })).toBe(true)
    expect(labelPrinted({ labelPrintedAt: null })).toBe(false)
    expect(labelPrinted({})).toBe(false)
    expect(labelPrinted({ labelPrintedAt: '' })).toBe(false)
  })

  it('only a box made since the mark began waits: an older one cannot be told from a labelled one', () => {
    expect(labelWaits(box('a', AFTER))).toBe(true)
    expect(labelWaits(box('a', LABEL_MARK_SINCE))).toBe(true)
    expect(labelWaits(box('a', BEFORE))).toBe(false)
    expect(labelWaits(box('a', AFTER, '2026-11-17T15:00:00Z'))).toBe(false)
    // A day that cannot be read is not counted.
    expect(labelWaits(box('a', ''))).toBe(false)
  })

  it('a sticker is a label: a box that wears one waits for nothing', () => {
    const boxes = [box('a', AFTER), box('b', AFTER), box('c', AFTER, '2026-11-17T15:00:00Z'), box('old', BEFORE)]
    expect(notPrintedIds(boxes, new Set(['b']))).toEqual(['a'])
    expect(notPrintedIds(boxes, new Set())).toEqual(['a', 'b'])
  })

  it('every box is labelled only when each has a mark or a sticker, and never for an older box with neither', () => {
    expect(everyBoxLabelled([box('a', AFTER, AFTER), box('b', AFTER)], new Set(['b']))).toBe(true)
    expect(everyBoxLabelled([box('a', AFTER, AFTER), box('old', BEFORE)], new Set())).toBe(false)
    expect(everyBoxLabelled([], new Set())).toBe(false)
  })
})

describe('what a run marks', () => {
  const strips = [{ id: 'a' }, { id: 'a' }, { id: 'b' }, { id: 'b' }, { id: 'c' }, { id: 'c' }]

  it('a box counts once the last of its strips is out', () => {
    expect(boxesWhoseLabelWent(strips, 6)).toEqual(['a', 'b', 'c'])
    expect(boxesWhoseLabelWent(strips, 4)).toEqual(['a', 'b'])
    // Part way through its copies, a box is not labelled on every side yet.
    expect(boxesWhoseLabelWent(strips, 3)).toEqual(['a'])
    expect(boxesWhoseLabelWent(strips, 1)).toEqual([])
    expect(boxesWhoseLabelWent(strips, 0)).toEqual([])
  })

  it('the line counts the boxes that had no mark before, and its press takes those alone back', () => {
    const boxes = [{ id: 'a', labelPrintedAt: '2026-11-17T15:00:00Z' }, { id: 'b', labelPrintedAt: null }, { id: 'c' }]
    expect(newlyMarkedIds(['a', 'b', 'c'], boxes)).toEqual(['b', 'c'])
    expect(newlyMarkedIds(['a'], boxes)).toEqual([])
  })
})

describe('the words', () => {
  it('count what they speak of', () => {
    expect(markedWords(1)).toBe('1 box is now marked as labelled.')
    expect(markedWords(12)).toBe('12 boxes are now marked as labelled.')
    expect(unmarkedWords(1)).toBe('The mark is off 1 box.')
    expect(unmarkedWords(12)).toBe('The mark is off 12 boxes.')
    expect(takeMarkOffLabel(1)).toBe('Take the mark off 1 box')
    expect(takeMarkOffLabel(12)).toBe('Take the mark off 12 boxes')
    expect(markAsLabelledLabel(1)).toBe('Mark 1 box as labelled')
    expect(markAsLabelledLabel(12)).toBe('Mark 12 boxes as labelled')
    expect(notPrintedDoorLabel(1)).toBe('The 1 not printed yet')
    expect(notPrintedDoorLabel(5)).toBe('The 5 not printed yet')
    expect(notPrintedChipWords(5)).toBe('5 not printed yet')
    expect(ALL_LABELLED_WORDS).toBe('Every box is labelled')
  })
})
