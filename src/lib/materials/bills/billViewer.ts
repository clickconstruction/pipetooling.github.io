/**
 * The bill viewer's rules (punch list #431, PR 2): a supply house bill drawn in place, with the list it came from
 * beside it so a person flips through bills without a new tab each. Pure: where a bill sits in its list, which pages
 * of a file are its own, what a file is by its first bytes, and the words. `billViewerIo.ts` reads, and
 * `components/materials/BillViewer.tsx` draws.
 */

/** One bill in the list the viewer flips through. */
export interface BillViewerItem {
  invoiceId: string
  number: string
  house: string
  dateYmd: string
  /** The amount the list shows for it: what is on the job, or the whole bill. */
  amount: number
}

/** What the viewer shows beside the paper. */
export interface BillFacts {
  invoiceId: string
  number: string
  house: string
  /** The supply house's own site, offered beside a bill with no PDF. */
  houseSite: string | null
  dateYmd: string
  poText: string
  total: number
  kind: string
  /** What of the bill is on the job the viewer was opened from; null with no job, or a job the bill is not on. */
  onJob: { pct: number; amount: number } | null
  paid: boolean
  paidOnYmd: string | null
  /** The Drive link pasted on the bill's row. */
  link: string | null
  /** Our own copy in the bucket, when the bill was dropped on the form. */
  ownCopyPath: string | null
  /** The pages of the file that are this bill, as the reader found them; null when the file was not read. */
  pageFrom: number | null
  pageTo: number | null
  /** What the lines read from the paper say: `7 lines · adds up`. */
  linesWords: string
  linesTone: 'ok' | 'off' | 'accepted' | 'none'
}

export const BILL_VIEWER_WORDS = {
  opening: 'Opening the bill…',
  reading: 'Reading the PDF…',
  notYours: 'This bill is not one you can open.',
  notHere: 'This bill is not here.',
  noPdfTitle: 'This bill has no PDF yet.',
  noPdfBody: 'Add one on the bill to see the paper here. The facts beside it still read from the bill.',
  openTheBill: 'Open the bill',
  supplierSite: 'Open the supplier’s site',
  cannotOpenTitle: 'The app cannot open this file.',
  cannotOpenBody: 'Drive may still open it for you.',
  tryAgain: 'Try again',
  openInDrive: 'Open in Drive',
  notAPdf: 'This file is not a PDF or a picture, so the app cannot draw it here.',
  previous: 'Previous',
  next: 'Next',
  close: 'Close',
  wholeFile: 'See the whole file',
  ownPages: 'Back to this bill’s pages',
  notInSearch: 'not in the search',
  nothingMatches: 'Nothing matches.',
  searchPlaceholder: 'Search this list',
  keysHint: 'flip through the list as it is searched',
  factsNote: 'These facts come from the bill on file. The paper is the supplier’s own PDF.',
} as const

/** Where a bill sits in the list, and the bills either side of it. */
export function billViewerPosition(items: readonly BillViewerItem[], openId: string): { index: number; count: number; prevId: string | null; nextId: string | null; words: string } {
  const index = items.findIndex((item) => item.invoiceId === openId)
  const count = items.length
  if (index < 0) {
    // The search was narrowed past the bill on show: Next goes to the first bill the search left.
    return { index, count, prevId: null, nextId: items[0]?.invoiceId ?? null, words: BILL_VIEWER_WORDS.notInSearch }
  }
  return { index, count, prevId: items[index - 1]?.invoiceId ?? null, nextId: items[index + 1]?.invoiceId ?? null, words: `${index + 1} of ${count}` }
}

/** What a key does in the viewer. The side arrows flip unless a box has the cursor; the up and down arrows always flip. */
export function billViewerKey(key: string, typing: boolean): 'next' | 'prev' | 'close' | null {
  if (key === 'Escape') return 'close'
  if (key === 'ArrowDown' || (!typing && key === 'ArrowRight')) return 'next'
  if (key === 'ArrowUp' || (!typing && key === 'ArrowLeft')) return 'prev'
  return null
}

/** The pages of a file to draw for one bill. */
export interface BillPageRange {
  from: number
  to: number
  /** The pages in the whole file. */
  of: number
  /** True when the bill is the whole file. */
  whole: boolean
}

/**
 * The pages that are this bill, held inside the file. One PDF often holds several bills (a scanned stack, a month's
 * worth), and the reader keeps which pages are each one's. With no pages on record, or pages the file does not have,
 * the bill is the whole file.
 */
export function billPageRange(pageFrom: number | null | undefined, pageTo: number | null | undefined, numPages: number): BillPageRange {
  const of = Math.max(1, Math.floor(numPages) || 1)
  const from = Number.isInteger(pageFrom) && pageFrom! >= 1 && pageFrom! <= of ? pageFrom! : null
  if (from == null) return { from: 1, to: of, of, whole: true }
  const to = Number.isInteger(pageTo) && pageTo! >= from ? Math.min(pageTo!, of) : from
  return { from, to, of, whole: from === 1 && to === of }
}

/** The line under the paper of a bill that is part of a longer file; empty when the bill is the whole file. */
export function billPageNote(range: BillPageRange): string {
  if (range.whole) return ''
  const pages = range.from === range.to ? `page ${range.from}` : `pages ${range.from} to ${range.to}`
  return `This bill is ${pages} of a ${range.of} page file.`
}

/** How many pages are drawn before the rest wait behind a press: a long statement should not draw sixty canvases. */
export const BILL_PAGES_AT_ONCE = 6

/** The pages to draw now, and how many wait. */
export function billPagesToDraw(from: number, to: number, showAll: boolean): { pages: number[]; more: number } {
  const all = Math.max(0, to - from + 1)
  const n = showAll ? all : Math.min(all, BILL_PAGES_AT_ONCE)
  return { pages: Array.from({ length: n }, (_, i) => from + i), more: all - n }
}

/** What a file is, by its first bytes: the door answers an octet stream whatever Drive called it. */
export function billFileKind(bytes: ArrayBuffer): 'pdf' | 'image/jpeg' | 'image/png' | 'other' {
  const head = new Uint8Array(bytes.slice(0, 1024))
  // %PDF may sit a few bytes in, after a byte order mark or a stray line.
  for (let i = 0; i + 4 <= head.length; i += 1) {
    if (head[i] === 0x25 && head[i + 1] === 0x50 && head[i + 2] === 0x44 && head[i + 3] === 0x46) return 'pdf'
  }
  if (head[0] === 0xff && head[1] === 0xd8) return 'image/jpeg'
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'image/png'
  return 'other'
}

/** What of a bill is on a job, to the cent. */
export function billOnJobAmount(total: number, pct: number): number {
  return Math.round(total * pct) / 100
}

/** The address of a bill's own Edit window, on Materials → Supply houses. */
export function billEditHref(invoiceId: string): string {
  return `/materials?tab=supply-houses&bill=${encodeURIComponent(invoiceId)}`
}
