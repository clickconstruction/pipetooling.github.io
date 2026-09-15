import { describe, expect, it } from 'vitest'
import { assignPage, conflicts, describeFooter, keptPages, pagesForTag, remapAfterTrim, tagsWithoutSheets, unassignPage, unusedPages } from './sheetAssignment'
import type { SheetAssignment, SheetState } from './sheetAssignment'

const a = (fileIndex: number, page: number, tag: string): SheetAssignment => ({ fileIndex, page, tag })

describe('sheetAssignment', () => {
  it('assignPage adds a triple and ignores an exact duplicate', () => {
    let state: SheetState = []
    state = assignPage(state, 0, 3, 'WC-1')
    state = assignPage(state, 0, 3, 'WC-1')
    state = assignPage(state, 0, 4, 'WC-1')
    expect(state).toEqual([a(0, 3, 'WC-1'), a(0, 4, 'WC-1')])
  })

  it('assignPage does not mutate the given state', () => {
    const state: SheetAssignment[] = [a(0, 1, 'WC-1')]
    const next = assignPage(state, 0, 2, 'WC-1')
    expect(state).toHaveLength(1)
    expect(next).toHaveLength(2)
  })

  it('unassignPage with a tag removes only that tag; without one, every tag on the page', () => {
    const state: SheetState = [a(0, 3, 'WC-1'), a(0, 3, 'WC-2'), a(0, 4, 'WC-1'), a(1, 3, 'LAV-1')]
    expect(unassignPage(state, 0, 3, 'WC-1')).toEqual([a(0, 3, 'WC-2'), a(0, 4, 'WC-1'), a(1, 3, 'LAV-1')])
    expect(unassignPage(state, 0, 3)).toEqual([a(0, 4, 'WC-1'), a(1, 3, 'LAV-1')])
  })

  it('pagesForTag groups by file with ascending pages', () => {
    const state: SheetState = [a(1, 9, 'WC-1'), a(0, 4, 'WC-1'), a(0, 2, 'WC-1'), a(0, 5, 'LAV-1'), a(0, 2, 'WC-1')]
    expect(pagesForTag(state, 'WC-1')).toEqual([
      { fileIndex: 0, pages: [2, 4] },
      { fileIndex: 1, pages: [9] },
    ])
    expect(pagesForTag(state, 'PRV-1')).toEqual([])
  })

  it('conflicts lists pages on two or more tags', () => {
    const state: SheetState = [a(0, 3, 'WC-1'), a(0, 3, 'WC-2'), a(0, 4, 'WC-1'), a(1, 1, 'A-1'), a(1, 1, 'B-1'), a(1, 1, 'C-1')]
    expect(conflicts(state)).toEqual([
      { fileIndex: 0, page: 3, tags: ['WC-1', 'WC-2'] },
      { fileIndex: 1, page: 1, tags: ['A-1', 'B-1', 'C-1'] },
    ])
    expect(conflicts([a(0, 1, 'WC-1'), a(0, 2, 'WC-1')])).toEqual([])
  })

  it('keptPages is ascending and unique per file', () => {
    const state: SheetState = [a(0, 7, 'WC-1'), a(0, 2, 'WC-2'), a(0, 7, 'WC-2'), a(1, 1, 'LAV-1')]
    expect(keptPages(state, 0)).toEqual([2, 7])
    expect(keptPages(state, 1)).toEqual([1])
    expect(keptPages(state, 2)).toEqual([])
  })

  it('unusedPages is the complement within the page count', () => {
    const state: SheetState = [a(0, 2, 'WC-1'), a(0, 5, 'WC-2')]
    expect(unusedPages(state, 0, 6)).toEqual([1, 3, 4, 6])
    expect(unusedPages(state, 0, 0)).toEqual([])
    expect(unusedPages([], 0, 3)).toEqual([1, 2, 3])
  })

  it('tagsWithoutSheets keeps the given order', () => {
    const state: SheetState = [a(0, 2, 'WC-1'), a(1, 1, 'LAV-1')]
    expect(tagsWithoutSheets(['DWH-1', 'LAV-1', 'PRV-1', 'WC-1'], state)).toEqual(['DWH-1', 'PRV-1'])
    expect(tagsWithoutSheets([], state)).toEqual([])
  })

  it('remapAfterTrim renumbers the trimmed file and drops pages not in the map', () => {
    const state: SheetState = [a(0, 4, 'WC-1'), a(0, 2, 'LAV-1'), a(0, 9, 'DWH-1'), a(1, 4, 'PRV-1')]
    expect(remapAfterTrim(state, 0, { 2: 1, 4: 2 })).toEqual([a(0, 2, 'WC-1'), a(0, 1, 'LAV-1'), a(1, 4, 'PRV-1')])
  })

  it('describeFooter reads like the modal footer', () => {
    const state: SheetState = [a(0, 1, 'WC-1'), a(0, 1, 'WC-2'), a(0, 5, 'LAV-1'), a(0, 6, 'LAV-1'), a(0, 12, 'DWH-1'), a(0, 20, 'DWH-1'), a(0, 21, 'DWH-1')]
    expect(describeFooter(state, 0, 31)).toBe('6 of 31 pages on rows · 25 not used')
    expect(describeFooter([], 0, 31)).toBe('31 pages · none on rows yet')
    expect(describeFooter([a(0, 1, 'WC-1')], 0, 1)).toBe('1 of 1 page on rows · all used')
  })

  it('a round trip: assign, trim, remap keeps the rows pointing at their pages', () => {
    let state: SheetState = []
    state = assignPage(state, 0, 12, 'WC-1')
    state = assignPage(state, 0, 3, 'LAV-1')
    state = assignPage(state, 0, 28, 'DWH-1')
    const kept = keptPages(state, 0)
    expect(kept).toEqual([3, 12, 28])
    const map = Object.fromEntries(kept.map((p, i) => [p, i + 1]))
    state = remapAfterTrim(state, 0, map)
    expect(pagesForTag(state, 'DWH-1')).toEqual([{ fileIndex: 0, pages: [3] }])
    expect(describeFooter(state, 0, 3)).toBe('3 of 3 pages on rows · all used')
  })
})
