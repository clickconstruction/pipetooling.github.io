import { describe, expect, it } from 'vitest'
import {
  BILL_LINES_AT_ONCE,
  BILL_PAGES_AT_ONCE,
  BILL_VIEWER_WORDS,
  billEditHref,
  billFileKind,
  billLinesToList,
  billOnJobAmount,
  billPageNote,
  billPageRange,
  billPagesToDraw,
  billViewerKey,
  billViewerPosition,
  type BillFactLine,
  type BillViewerItem,
} from './billViewer'
import { plainWordsFailures } from '../../plainWords'

const item = (invoiceId: string): BillViewerItem => ({ invoiceId, number: invoiceId.toUpperCase(), house: 'Harlow Supply', dateYmd: '2026-11-16', amount: 10 })
const ITEMS = [item('a'), item('b'), item('c')]

const bytesOf = (...head: number[]): ArrayBuffer => new Uint8Array([...head, 0, 0, 0, 0]).buffer

describe('billViewerPosition', () => {
  it('says where a bill sits and what is either side', () => {
    expect(billViewerPosition(ITEMS, 'a')).toEqual({ index: 0, count: 3, prevId: null, nextId: 'b', words: '1 of 3' })
    expect(billViewerPosition(ITEMS, 'b')).toEqual({ index: 1, count: 3, prevId: 'a', nextId: 'c', words: '2 of 3' })
    expect(billViewerPosition(ITEMS, 'c')).toEqual({ index: 2, count: 3, prevId: 'b', nextId: null, words: '3 of 3' })
  })
  it('a bill the search left behind is not in it, and Next is the first bill left', () => {
    expect(billViewerPosition(ITEMS, 'z')).toEqual({ index: -1, count: 3, prevId: null, nextId: 'a', words: 'not in the search' })
    expect(billViewerPosition([], 'z')).toEqual({ index: -1, count: 0, prevId: null, nextId: null, words: 'not in the search' })
  })
})

describe('billViewerKey', () => {
  it('the side arrows flip unless a box has the cursor, and up and down always flip', () => {
    expect(billViewerKey('ArrowRight', false)).toBe('next')
    expect(billViewerKey('ArrowLeft', false)).toBe('prev')
    expect(billViewerKey('ArrowRight', true)).toBeNull()
    expect(billViewerKey('ArrowLeft', true)).toBeNull()
    expect(billViewerKey('ArrowDown', true)).toBe('next')
    expect(billViewerKey('ArrowUp', true)).toBe('prev')
  })
  it('Escape closes from anywhere, and any other key is left alone', () => {
    expect(billViewerKey('Escape', true)).toBe('close')
    expect(billViewerKey('Escape', false)).toBe('close')
    expect(billViewerKey('a', false)).toBeNull()
    expect(billViewerKey(' ', false)).toBeNull()
    expect(billViewerKey('Enter', false)).toBeNull()
  })
})

describe('billPageRange: a bill is its own pages of a file', () => {
  it('a bill inside a longer file is its pages alone', () => {
    expect(billPageRange(4, 5, 12)).toEqual({ from: 4, to: 5, of: 12, whole: false })
    expect(billPageRange(4, null, 12)).toEqual({ from: 4, to: 4, of: 12, whole: false })
    expect(billPageNote(billPageRange(4, 5, 12))).toBe('This bill is pages 4 to 5 of a 12 page file.')
    expect(billPageNote(billPageRange(4, 4, 12))).toBe('This bill is page 4 of a 12 page file.')
  })
  it('a bill that is the whole file says nothing about pages', () => {
    expect(billPageRange(1, 2, 2)).toEqual({ from: 1, to: 2, of: 2, whole: true })
    expect(billPageNote(billPageRange(1, 2, 2))).toBe('')
    expect(billPageNote(billPageRange(1, 1, 1))).toBe('')
  })
  it('no pages on record, or pages the file does not have, is the whole file', () => {
    expect(billPageRange(null, null, 3)).toEqual({ from: 1, to: 3, of: 3, whole: true })
    expect(billPageRange(9, 10, 3)).toEqual({ from: 1, to: 3, of: 3, whole: true })
    expect(billPageRange(0, 2, 3)).toEqual({ from: 1, to: 3, of: 3, whole: true })
    expect(billPageRange(1.5, 2, 3)).toEqual({ from: 1, to: 3, of: 3, whole: true })
  })
  it('a last page past the end stops at the end, and one before the first is the first', () => {
    expect(billPageRange(2, 99, 3)).toEqual({ from: 2, to: 3, of: 3, whole: false })
    expect(billPageRange(2, 1, 3)).toEqual({ from: 2, to: 2, of: 3, whole: false })
    expect(billPageRange(1, 1, 0)).toEqual({ from: 1, to: 1, of: 1, whole: true })
  })
})

describe('billPagesToDraw', () => {
  it('draws a short bill whole and holds the rest of a long one behind a press', () => {
    expect(billPagesToDraw(4, 5, false)).toEqual({ pages: [4, 5], more: 0 })
    const long = billPagesToDraw(1, 40, false)
    expect(long.pages).toHaveLength(BILL_PAGES_AT_ONCE)
    expect(long.pages[0]).toBe(1)
    expect(long.more).toBe(40 - BILL_PAGES_AT_ONCE)
    expect(billPagesToDraw(1, 40, true)).toMatchObject({ more: 0 })
    expect(billPagesToDraw(1, 40, true).pages).toHaveLength(40)
    expect(billPagesToDraw(5, 4, false)).toEqual({ pages: [], more: 0 })
  })
})

describe('billFileKind: a file is what its first bytes say', () => {
  it('knows a PDF, a JPEG and a PNG', () => {
    expect(billFileKind(bytesOf(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe('pdf')
    expect(billFileKind(bytesOf(0xff, 0xd8, 0xff))).toBe('image/jpeg')
    expect(billFileKind(bytesOf(0x89, 0x50, 0x4e, 0x47))).toBe('image/png')
  })
  it('finds a PDF whose mark sits a few bytes in, and calls anything else other', () => {
    expect(billFileKind(bytesOf(0xef, 0xbb, 0xbf, 0x25, 0x50, 0x44, 0x46))).toBe('pdf')
    expect(billFileKind(bytesOf(0x3c, 0x68, 0x74, 0x6d, 0x6c))).toBe('other')
    expect(billFileKind(new ArrayBuffer(0))).toBe('other')
  })
})

describe('billLinesToList: the lines beside the paper', () => {
  const line = (lineNo: number, description: string): BillFactLine => ({ lineNo, code: '', mfr: '', description, qty: 1, extendedCents: 100, component: false })
  const LONG = Array.from({ length: 12 }, (_, i) => line(i + 1, i === 9 ? 'ball valve' : `copper tee ${i + 1}`))
  const none = () => false
  const valve = (l: BillFactLine) => l.description.includes('valve')

  it('lists a short bill whole', () => {
    expect(billLinesToList(LONG.slice(0, 3), none, false)).toMatchObject({ found: 0, more: 0 })
    expect(billLinesToList(LONG.slice(0, 3), none, false).lines).toHaveLength(3)
  })
  it('lists the first few of a long bill and holds the rest behind the press', () => {
    const list = billLinesToList(LONG, none, false)
    expect(list.lines).toHaveLength(BILL_LINES_AT_ONCE)
    expect(list.more).toBe(12 - BILL_LINES_AT_ONCE)
    expect(billLinesToList(LONG, none, true)).toMatchObject({ more: 0 })
    expect(billLinesToList(LONG, none, true).lines).toHaveLength(12)
  })
  it('with a search on, the lines that hold its words come alone, wherever they sit on the paper', () => {
    const list = billLinesToList(LONG, valve, false)
    expect(list.lines.map((l) => l.lineNo)).toEqual([10])
    expect(list).toMatchObject({ found: 1, more: 11 })
    // Show all keeps the paper's order and still counts what was found.
    const all = billLinesToList(LONG, valve, true)
    expect(all.lines).toHaveLength(12)
    expect(all).toMatchObject({ found: 1, more: 0 })
  })
  it('a bill with no lines lists nothing', () => {
    expect(billLinesToList([], valve, false)).toEqual({ lines: [], found: 0, more: 0 })
  })
})

describe('the amount on a job, the bill’s door and the words', () => {
  it('what of a bill is on a job, to the cent', () => {
    expect(billOnJobAmount(2171.16, 50)).toBe(1085.58)
    expect(billOnJobAmount(100, 100)).toBe(100)
    expect(billOnJobAmount(33.33, 33.34)).toBe(11.11)
    expect(billOnJobAmount(-250, 50)).toBe(-125)
  })
  it('the bill’s Edit window is on Materials, Supply houses', () => {
    expect(billEditHref('inv-1')).toBe('/materials?tab=supply-houses&bill=inv-1')
  })
  it('every sentence is plain words', () => {
    for (const words of Object.values(BILL_VIEWER_WORDS)) expect(plainWordsFailures(words)).toEqual([])
  })
})
