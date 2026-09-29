import { describe, expect, it } from 'vitest'
import { fileStanding } from './sheetStripModel'
import type { SheetAssignment } from './sheetAssignment'

const file = { pages: 75, trimmedAt: null, droppedPages: null, namesRows: null }
const on = (pages: number[], fileIndex = 0): SheetAssignment[] => pages.map((page) => ({ fileIndex, page, tag: 'row' }))

describe('fileStanding', () => {
  it('a fresh file, a file with nothing on rows, one the reader could not place at all', () => {
    expect(fileStanding(file, [], 0, 0)).toEqual({ text: 'none on rows yet', ratio: 0, tone: 'none', hint: null })
    expect(fileStanding({ ...file, namesRows: 0, pages: 11 }, [], 0, 0)).toEqual({ text: 'none on rows yet', ratio: 0, tone: 'odd', hint: 'no page names a row · not a vendor submittal?' })
    // pages on another file do not count
    expect(fileStanding({ ...file, namesRows: 0 }, on([1, 2], 1), 0, 0).tone).toBe('odd')
  })

  it('counts the pages on rows, names a clash, and reads all used', () => {
    const s = fileStanding(file, on([5, 6, 7, 19, 20]), 0, 0)
    expect(s).toEqual({ text: '5 of 75 on rows · 70 not used', ratio: 5 / 75, tone: 'some', hint: null })
    expect(fileStanding(file, on([5, 6]), 0, 1)).toMatchObject({ text: '2 of 75 on rows · 73 not used · 1 page on two rows', tone: 'clash' })
    expect(fileStanding({ ...file, pages: 2 }, on([1, 2]), 0, 0)).toMatchObject({ text: '2 of 2 on rows · all used', ratio: 1, tone: 'all' })
  })

  it('a trimmed file reads what was kept and when', () => {
    expect(fileStanding({ ...file, pages: 6, trimmedAt: '2026-09-15T20:00:00Z', droppedPages: 69 }, on([1, 2, 3, 4, 5, 6]), 0, 0)).toEqual({ text: 'trimmed · 6 pages kept · Sep 15', ratio: 1, tone: 'all', hint: null })
  })
})
