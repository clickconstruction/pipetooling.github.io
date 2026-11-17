import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { lienScanPlan, type LienScanTarget } from './lienScanBatch'
import {
  LIEN_SCAN_STACK_CHOICE,
  LIEN_SCAN_STACK_WORDS,
  lienScanPagesWords,
  lienScanStackChoiceOf,
  lienScanStackHeadWords,
  lienScanStackPageOf,
  lienScanStackPages,
  lienScanStackPieces,
  lienScanStackResolve,
  lienScanStackWith,
  type LienScanStack,
  type LienScanStackPage,
} from './lienScanStack'

// Every name and number here is made up.
const target = (jobNumber: string): LienScanTarget => ({ filingId: `f-${jobNumber}`, jobId: `job-${jobNumber}`, jobNumber, jobLabel: `${jobNumber} · Sample Job`, recordingNumber: `2026-00${jobNumber}`, filedYmd: '2026-11-13', county: 'Hays', hasScan: false })
const TARGETS = [target('1'), target('2'), target('3'), target('4')]
const liens = (pages: ReadonlyArray<LienScanStackPage>, taken?: ReadonlySet<string>) => lienScanStackResolve(pages, TARGETS, taken).pages.map((p) => p.filingId)

describe('lienScanStackResolve', () => {
  it('starts every page in order, one page a lien', () => {
    expect(liens(lienScanStackPages(4))).toEqual(['f-1', 'f-2', 'f-3', 'f-4'])
  })

  it('a page marked as not an affidavit moves the pages after it up by one', () => {
    const pages = lienScanStackWith(lienScanStackPages(5), 1, { kind: 'skip' })
    expect(liens(pages)).toEqual(['f-1', null, 'f-2', 'f-3', 'f-4'])
    expect(lienScanStackResolve(pages, TARGETS).pages[1]).toEqual({ page: 2, kind: 'skip', filingId: null, left: false })
  })

  it('a second sheet joins the lien before it, and the pages after it follow', () => {
    const pages = lienScanStackWith(lienScanStackPages(5), 1, { kind: 'join' })
    const r = lienScanStackResolve(pages, TARGETS)
    expect(r.pages.map((p) => p.filingId)).toEqual(['f-1', 'f-1', 'f-2', 'f-3', 'f-4'])
    expect(r.groups[0]).toEqual({ filingId: 'f-1', pages: [1, 2] })
  })

  it('a receipt between two sheets does not break the run', () => {
    let pages = lienScanStackPages(4)
    pages = lienScanStackWith(pages, 1, { kind: 'skip' })
    pages = lienScanStackWith(pages, 2, { kind: 'join' })
    expect(liens(pages)).toEqual(['f-1', null, 'f-1', 'f-2'])
  })

  it('a lien picked by hand is not handed out again in order', () => {
    const pages = lienScanStackWith(lienScanStackPages(4), 0, { kind: 'hand', filingId: 'f-3' })
    expect(liens(pages)).toEqual(['f-3', 'f-1', 'f-2', 'f-4'])
  })

  it('steps over liens another piece in the window already holds', () => {
    expect(liens(lienScanStackPages(2), new Set(['f-1', 'f-3']))).toEqual(['f-2', 'f-4'])
  })

  it('holds a page with no lien left, and a first page that joins nothing', () => {
    const r = lienScanStackResolve(lienScanStackPages(6), TARGETS)
    expect(r.pages.slice(4).map((p) => [p.page, p.filingId, p.left])).toEqual([[5, null, true], [6, null, true]])
    expect(lienScanStackResolve([{ kind: 'join' }], TARGETS).pages[0]).toMatchObject({ filingId: null, left: true })
    expect(lienScanStackResolve([{ kind: 'hand', filingId: 'f-gone' }], TARGETS).pages[0]).toMatchObject({ filingId: null, left: true })
  })
})

describe('the stack as the plan’s pieces', () => {
  const stack: LienScanStack = { key: 's1', name: 'stack.pdf', size: 6_000_000, pages: lienScanStackWith(lienScanStackWith(lienScanStackPages(6), 1, { kind: 'join' }), 2, { kind: 'skip' }) }
  const resolved = lienScanStackResolve(stack.pages, TARGETS)
  const { pieces, matches } = lienScanStackPieces(stack, resolved)

  it('is one piece for each lien that gets pages, named by its pages, and one for a page nobody took', () => {
    // Page 1 and 2 for the first lien, 3 left out, 4 to 6 in order: the stack has pages for four liens.
    expect(pieces.map((p) => [p.name, p.pages, matches[p.key]?.filingId ?? null])).toEqual([
      ['stack.pdf, pages 1 and 2', [1, 2], 'f-1'],
      ['stack.pdf, page 4', [4], 'f-2'],
      ['stack.pdf, page 5', [5], 'f-3'],
      ['stack.pdf, page 6', [6], 'f-4'],
    ])
    expect(pieces.every((p) => p.type === 'application/pdf')).toBe(true)
    // A piece's size is its share of the stack by pages.
    expect(pieces[0]!.size).toBe(2_000_000)
    expect(lienScanStackHeadWords(stack, resolved)).toBe('stack.pdf · 6 pages · 4 liens · 1 page left out')
  })

  it('goes through the plan the single files go through', () => {
    const plan = lienScanPlan(pieces, matches, TARGETS)
    expect(plan.ready.map((r) => [r.target.jobNumber, r.piece.name])).toEqual([
      ['1', 'stack.pdf, pages 1 and 2'],
      ['2', 'stack.pdf, page 4'],
      ['3', 'stack.pdf, page 5'],
      ['4', 'stack.pdf, page 6'],
    ])
    expect(plan.held).toEqual([])
    const over = { ...stack, pages: lienScanStackPages(5) }
    const p2 = lienScanStackPieces(over, lienScanStackResolve(over.pages, TARGETS))
    expect(lienScanPlan(p2.pieces, p2.matches, TARGETS).held.map((h) => [h.piece.name, h.key])).toEqual([['stack.pdf, page 5', 'no_lien']])
  })

  it('a large stack is fine: only a lien’s own piece meets the folder’s limit', () => {
    const big: LienScanStack = { key: 's2', name: 'big.pdf', size: 30 * 1024 * 1024, pages: lienScanStackPages(4) }
    const p = lienScanStackPieces(big, lienScanStackResolve(big.pages, TARGETS))
    expect(lienScanPlan(p.pieces, p.matches, TARGETS).held).toEqual([])
  })
})

describe('the words', () => {
  it('names a piece’s pages as a person would', () => {
    expect(lienScanPagesWords([3])).toBe('page 3')
    expect(lienScanPagesWords([3, 4])).toBe('pages 3 and 4')
    expect(lienScanPagesWords([3, 4, 5])).toBe('pages 3 to 5')
    expect(lienScanPagesWords([6, 2, 5])).toBe('pages 2, 5 and 6')
  })

  it('carries a page’s rule to its list and back', () => {
    for (const page of [{ kind: 'auto' }, { kind: 'join' }, { kind: 'skip' }, { kind: 'hand', filingId: 'f-2' }] as LienScanStackPage[]) expect(lienScanStackPageOf(lienScanStackChoiceOf(page))).toEqual(page)
    expect(lienScanStackChoiceOf({ kind: 'skip' })).toBe(LIEN_SCAN_STACK_CHOICE.skip)
  })

  it('keeps every sentence plain', () => {
    const sentences = [LIEN_SCAN_STACK_WORDS.offer(12), LIEN_SCAN_STACK_WORDS.how, LIEN_SCAN_STACK_WORDS.left, LIEN_SCAN_STACK_WORDS.skipped].flatMap((s) => s.split(/(?<=\.)\s+/)).filter(Boolean)
    for (const s of sentences) expect(plainWordsFailures(s), s).toEqual([])
  })
})
