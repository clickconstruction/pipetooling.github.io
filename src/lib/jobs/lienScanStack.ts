/**
 * One scan of a whole stack (punch list #366). The owner's steer of 2026-11-16: *aim towards one PDF per lien, but if
 * they are all for one person a user may scan a whole stack*. The office feeds the clerk's stamped affidavits through
 * the scanner in one pass and gets one PDF of many pages.
 *
 * The window never saves that file whole. Each page is sent to a lien, and each lien's pages become a PDF of their
 * own on that lien's own job, so a job's folder never holds another job's affidavit and each piece is held to the
 * folder's limit by itself, not the stack.
 *
 * A page starts **in order**: the first page for the first lien in the list, the next for the next, since the short
 * affidavit is one sheet and a batch comes back about as it was printed. The office changes a page three ways:
 *
 * - **pick a lien** for it by hand;
 * - **same lien as the page before**, for an affidavit that ran to a second sheet;
 * - **not an affidavit**, for a clerk's receipt or a blank back.
 *
 * Every page still in order then takes the next lien nobody has, so marking page 2 as a receipt moves the pages
 * after it up by one, as a person would. A page with no lien left for it is held, and says so.
 *
 * Pure: pages in, each lien's pages out, as the pieces `lienScanBatch.ts` plans. The split itself is
 * `lienScanStackIo.ts`.
 */
import type { LienScanMatch, LienScanPiece, LienScanTarget } from './lienScanBatch'

/** What the office said about one page; `auto` is a page still in order. */
export type LienScanStackPage = { kind: 'auto' } | { kind: 'hand'; filingId: string } | { kind: 'join' } | { kind: 'skip' }

/** A stack as the window holds it: its key, its file's name and size, and one entry a page. */
export type LienScanStack = { key: string; name: string; size: number; pages: ReadonlyArray<LienScanStackPage> }

/** A fresh stack: every page in order. */
export function lienScanStackPages(pageCount: number): LienScanStackPage[] {
  return Array.from({ length: Math.max(0, Math.floor(pageCount)) }, () => ({ kind: 'auto' }) as LienScanStackPage)
}

/** One page changed. */
export function lienScanStackWith(pages: ReadonlyArray<LienScanStackPage>, index: number, next: LienScanStackPage): LienScanStackPage[] {
  return pages.map((p, i) => (i === index ? next : p))
}

/** Where each page goes once every rule is applied: a lien's filing, or null for a page that goes nowhere. */
export type LienScanStackResolved = {
  /** One entry a page, in order. `left` is true for a page that wanted a lien and found none. */
  pages: Array<{ page: number; kind: LienScanStackPage['kind']; filingId: string | null; left: boolean }>
  /** Each lien that gets pages, in the order its first page stands, with its pages in order. */
  groups: Array<{ filingId: string; pages: number[] }>
}

/**
 * Apply the rules, top to bottom. A lien picked by hand anywhere in the stack is kept out of the in-order run, so
 * moving one page never gives its lien to another page as well. `taken` names liens that other pieces in the window
 * already hold (a separate file, or another stack), which the in-order run also steps over.
 */
export function lienScanStackResolve(pages: ReadonlyArray<LienScanStackPage>, targets: ReadonlyArray<Pick<LienScanTarget, 'filingId'>>, taken: ReadonlySet<string> = new Set()): LienScanStackResolved {
  const known = new Set(targets.map((t) => t.filingId))
  const byHand = new Set(pages.flatMap((p) => (p.kind === 'hand' && known.has(p.filingId) ? [p.filingId] : [])))
  const free = targets.map((t) => t.filingId).filter((id) => !byHand.has(id) && !taken.has(id))
  const out: LienScanStackResolved['pages'] = []
  let before: string | null = null
  pages.forEach((p, i) => {
    let filingId: string | null = null
    let left = false
    if (p.kind === 'hand') filingId = known.has(p.filingId) ? p.filingId : null
    else if (p.kind === 'join') filingId = before
    else if (p.kind === 'auto') filingId = free.shift() ?? null
    if (p.kind !== 'skip' && !filingId) left = true
    out.push({ page: i + 1, kind: p.kind, filingId, left })
    // A page that is not an affidavit does not break a run: the sheet after a receipt can still join the lien before it.
    if (p.kind !== 'skip') before = filingId
  })
  const groups: LienScanStackResolved['groups'] = []
  for (const p of out) {
    if (!p.filingId) continue
    const g = groups.find((x) => x.filingId === p.filingId)
    if (g) g.pages.push(p.page)
    else groups.push({ filingId: p.filingId, pages: [p.page] })
  }
  return { pages: out, groups }
}

/** *page 3*, *pages 3 and 4*, *pages 3 to 5*, *pages 2, 5 and 6*. */
export function lienScanPagesWords(pages: ReadonlyArray<number>): string {
  const p = [...pages].sort((a, b) => a - b)
  if (p.length === 0) return 'no page'
  if (p.length === 1) return `page ${p[0]}`
  const run = p.every((n, i) => i === 0 || n === (p[i - 1] ?? 0) + 1)
  if (run && p.length > 2) return `pages ${p[0]} to ${p[p.length - 1]}`
  return `pages ${p.slice(0, -1).join(', ')} and ${p[p.length - 1]}`
}

/** A piece's key in the window: a lien's pages of one stack, or one page nobody took. */
export const lienScanStackPieceKey = (stackKey: string, filingId: string) => `${stackKey}:lien:${filingId}`
export const lienScanStackLeftKey = (stackKey: string, page: number) => `${stackKey}:page:${page}`

export type LienScanStackPiece = LienScanPiece & {
  stackKey: string
  /** The pages this piece is cut from, 1-based, in order. */
  pages: number[]
}

/**
 * The stack as the plan's pieces: one for each lien that gets pages, then one for each page left with no lien, which
 * the plan holds. A piece's size is its share of the stack by pages, a fair first guess for the folder's limit; the
 * true size is known once it is cut, and a piece over the limit is refused then with what to do.
 */
export function lienScanStackPieces(stack: LienScanStack, resolved: LienScanStackResolved): { pieces: LienScanStackPiece[]; matches: Record<string, LienScanMatch> } {
  const total = Math.max(1, stack.pages.length)
  const share = (n: number) => Math.max(1, Math.round((stack.size * n) / total))
  const pieces: LienScanStackPiece[] = []
  const matches: Record<string, LienScanMatch> = {}
  for (const g of resolved.groups) {
    const key = lienScanStackPieceKey(stack.key, g.filingId)
    pieces.push({ key, name: `${stack.name}, ${lienScanPagesWords(g.pages)}`, size: share(g.pages.length), type: 'application/pdf', stackKey: stack.key, pages: g.pages })
    matches[key] = { filingId: g.filingId, by: 'stack' }
  }
  for (const p of resolved.pages) {
    if (!p.left) continue
    const key = lienScanStackLeftKey(stack.key, p.page)
    pieces.push({ key, name: `${stack.name}, page ${p.page}`, size: share(1), type: 'application/pdf', stackKey: stack.key, pages: [p.page] })
    matches[key] = null
  }
  return { pieces, matches }
}

/** The choices a page's list offers besides a lien, by their values. */
export const LIEN_SCAN_STACK_CHOICE = { auto: '__auto', join: '__join', skip: '__skip' } as const

/** A page's rule as its list's value, and back. */
export function lienScanStackChoiceOf(page: LienScanStackPage): string {
  return page.kind === 'hand' ? page.filingId : LIEN_SCAN_STACK_CHOICE[page.kind]
}
export function lienScanStackPageOf(value: string): LienScanStackPage {
  if (value === LIEN_SCAN_STACK_CHOICE.auto) return { kind: 'auto' }
  if (value === LIEN_SCAN_STACK_CHOICE.join) return { kind: 'join' }
  if (value === LIEN_SCAN_STACK_CHOICE.skip) return { kind: 'skip' }
  return { kind: 'hand', filingId: value }
}

export const LIEN_SCAN_STACK_WORDS = {
  /** On a picked PDF with more than one page. */
  offer: (pages: number) => `This file has ${pages} pages.`,
  split: 'It holds several liens: split it ›',
  keep: 'Keep it as one file',
  how: 'Each page starts in order, one page a lien. Change a page that is wrong, and the pages after it follow.',
  auto: 'In order',
  join: 'Same lien as the page before',
  skip: 'Not an affidavit',
  left: 'No lien is left for this page. Pick one, or mark it as not an affidavit.',
  skipped: 'Left out. It is saved nowhere.',
  openPage: 'Open this page',
} as const

/** Over a split stack: *stack.pdf · 12 pages · 10 liens · 1 page left out*. */
export function lienScanStackHeadWords(stack: Pick<LienScanStack, 'name' | 'pages'>, resolved: LienScanStackResolved): string {
  const n = stack.pages.length
  const skipped = resolved.pages.filter((p) => p.kind === 'skip').length
  const liens = resolved.groups.length
  return [stack.name, n === 1 ? '1 page' : `${n} pages`, liens === 1 ? '1 lien' : `${liens} liens`, skipped === 0 ? '' : skipped === 1 ? '1 page left out' : `${skipped} pages left out`].filter(Boolean).join(' · ')
}
