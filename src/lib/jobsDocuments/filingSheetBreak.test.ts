import { describe, expect, it } from 'vitest'
import { filingSheetBreak, filingSheetWords, measureFilingSheet } from './filingSheetBreak'

// One Letter sheet's room at 96 px to the inch: 11 in less the 0.6 in head and foot.
const ROOM = 940.8

describe('where a printed paper breaks (punch list #305, v2.6896)', () => {
  it('a paper that fits is one page, its closing on it, and the window says nothing', () => {
    const b = filingSheetBreak({ heightPx: 870, roomPx: ROOM, runs: [{ topPx: 560, bottomPx: 870 }] })
    expect(b).toEqual({ pages: 1, closing: { page: 1, moved: false } })
    expect(filingSheetWords(b)).toBe('')
  })

  it('a paper that ends exactly at the foot of the sheet is still one page', () => {
    expect(filingSheetBreak({ heightPx: ROOM, roomPx: ROOM, runs: [{ topPx: 600, bottomPx: ROOM }] })).toEqual({ pages: 1, closing: { page: 1, moved: false } })
  })

  it('a closing that crosses the foot of page 1 moves whole to page 2, and the window says so', () => {
    // The short affidavit under a GC at the paper's own leading: 995 px on a 940.8 px sheet.
    const b = filingSheetBreak({ heightPx: 995, roomPx: ROOM, runs: [{ topPx: 561, bottomPx: 995 }] })
    expect(b).toEqual({ pages: 2, closing: { page: 2, moved: true } })
    expect(filingSheetWords(b)).toBe('This paper prints on 2 pages. The last statement, the signature and the notary’s block moved to page 2 together, so none of it is cut.')
  })

  it('a closing already on page 2 was not moved: the window gives the count and where it is', () => {
    const b = filingSheetBreak({ heightPx: 1500, roomPx: ROOM, runs: [{ topPx: 1100, bottomPx: 1500 }] })
    expect(b).toEqual({ pages: 2, closing: { page: 2, moved: false } })
    expect(filingSheetWords(b)).toBe('This paper prints on 2 pages. The signature and the notary’s block are on page 2.')
  })

  it('a moved run pushes what follows: a second run is placed after the push, and the pages count it', () => {
    // The first run crosses page 1's foot and moves 140.8 px down; the second then crosses page 2's foot.
    const b = filingSheetBreak({ heightPx: 1900, roomPx: ROOM, runs: [{ topPx: 800, bottomPx: 1000 }, { topPx: 1500, bottomPx: 1900 }] })
    expect(b).toEqual({ pages: 3, closing: { page: 3, moved: true } })
  })

  it('a run taller than a sheet cannot be kept: it splits, and is not called moved', () => {
    const b = filingSheetBreak({ heightPx: 1300, roomPx: ROOM, runs: [{ topPx: 100, bottomPx: 1300 }] })
    expect(b).toEqual({ pages: 2, closing: { page: 2, moved: false } })
  })

  it('a paper with no signature has no closing: the count alone', () => {
    const b = filingSheetBreak({ heightPx: 1200, roomPx: ROOM, runs: [] })
    expect(b).toEqual({ pages: 2, closing: null })
    expect(filingSheetWords(b)).toBe('This paper prints on 2 pages.')
  })

  it('nothing measured is nothing said: a frame with no layout reads zero', () => {
    expect(filingSheetBreak(null)).toBeNull()
    expect(filingSheetBreak({ heightPx: 0, roomPx: ROOM, runs: [] })).toBeNull()
    expect(filingSheetWords(null)).toBe('')
  })
})

describe('reading the laid-out paper', () => {
  const rect = (top: number, bottom: number) => ({ top, bottom, height: bottom - top }) as DOMRect
  const fakeDoc = (paper: { top: number; bottom: number } | null, runs: Array<{ top: number; bottom: number }>) =>
    ({
      querySelector: () =>
        paper
          ? { getBoundingClientRect: () => rect(paper.top, paper.bottom), querySelectorAll: () => runs.map((r) => ({ getBoundingClientRect: () => rect(r.top, r.bottom) })) }
          : null,
    }) as unknown as Document

  it('measures the runs from the paper’s own top, past the head band', () => {
    expect(measureFilingSheet(fakeDoc({ top: 58, bottom: 1053 }, [{ top: 619, bottom: 1053 }]), ROOM)).toEqual({ heightPx: 995, roomPx: ROOM, runs: [{ topPx: 561, bottomPx: 995 }] })
  })

  it('no paper, or a paper with no height, is null', () => {
    expect(measureFilingSheet(null, ROOM)).toBeNull()
    expect(measureFilingSheet(fakeDoc(null, []), ROOM)).toBeNull()
    expect(measureFilingSheet(fakeDoc({ top: 0, bottom: 0 }, []), ROOM)).toBeNull()
  })
})
