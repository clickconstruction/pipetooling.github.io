/**
 * Supply house bill lines, the sweep (punch list #298 PR 2, v2.6882): the pure half of `bill-lines-sweep`, which reads
 * the bills already on file from the PDF each row links and keeps their lines as rows. No Deno globals, so the app's
 * tests hold it (`src/lib/materials/lines/billSweep.ts` re-exports it).
 *
 *   * Which bills are due. A bill's row with a Drive link and no paper is read; one file is read once however many
 *     rows link it (`sweepPlan`), newest bill first. A row the sweep could not read is held with its reason
 *     (`supply_bill_holds`) and comes back by itself only where another try can help (`holdDue`); a row whose link or
 *     number a person changed is due again.
 *   * What the model is asked for. A file may hold several papers (a stack of bills scanned together, an invoice
 *     with its ship ticket), so the answer is a list of papers, each the bill reader's own shape with the pages it
 *     covers (`PAPERS_SCHEMA`, `readPapersAnswer`). A long file is read a few pages at a time (`pageRanges`) and a
 *     paper that runs across two ranges is joined (`joinPapers`).
 *   * Which paper is which row's. By the invoice number once both are folded: exactly, or the printed number with
 *     a short suffix the office did not type when the paper's total is the row's amount (`matchRows`). A row whose
 *     number is not in its file is held; a paper with no row is kept with no bill, for the Add invoice door later.
 *   * The rows written (`paperRowOf`): the paper checked by `checkPaper` against the row's amount and the PDF's own
 *     text, so a paper counts only when every sum holds and every part code is on the paper.
 *   * One more check under new rules (`recheckStored`, PR 1c, v2.7103). A paper held off under older rules is checked
 *     again from the lines on file, with no model read, and counts once the sums the check now knows hold.
 */
import { BILL_SCHEMA, BILL_SYSTEM, readBillAnswer, type BillRead } from './billRead.ts'
import { CHECK_RULES, checkPaper, moneyWords, paperFromBillRead, PURCHASE_KINDS, settlePaper, type LineKind, type PaperCheck, type PaperKind, type PaperLine, type PaperRead, type PricingUnit } from './paperChecks.ts'

/** The `app_settings` key of the sweep's switch. 'true' reads bills by themselves (the card's call 1); anything else stops the cron. */
export const BILL_SWEEP_SWITCH_KEY = 'bill_lines_sweep_on_v1'

export function billSweepIsOn(valueText: string | null | undefined): boolean {
  return valueText === 'true'
}

/** How many model reads the sweep makes in a rolling day. Its own cap, apart from the form's 150: the backfill is about 520 bills at about a cent each. */
export const BILL_SWEEP_DAILY_CAP = 600

/** Files a cron run takes, and the most a run may be asked for. */
export const SWEEP_FILES = 3
export const SWEEP_FILES_MAX = 12
/** Files read side by side in one run. */
export const SWEEP_CONCURRENCY = 4
/** Past this a run starts no new file; a file under way finishes. */
export const SWEEP_START_BUDGET_MS = 90_000
/** Pages one model read takes. A longer file is split and read in ranges. */
export const PAGES_PER_READ = 3
/** The longest file the sweep reads, in pages. */
export const SWEEP_MAX_PAGES = 60
/** The answer's room. Under the SDK's line for a call that must stream. */
export const SWEEP_MAX_TOKENS = 20_000
/** A row left `reading` this long was dropped by a run that died; the next run takes it. */
export const READING_STALE_MS = 15 * 60_000

// ---------------------------------------------------------------------------
// The bill's row, its link and its number
// ---------------------------------------------------------------------------

/** A `supply_house_invoices` row as the sweep reads it. */
export interface SweepInvoice {
  id: string
  supplyHouseId: string | null
  number: string
  /** YYYY-MM-DD. */
  dateYmd: string
  /** The row's amount in cents, as typed; a credit may be either sign. */
  amountCents: number
  kind: 'invoice' | 'credit'
  link: string | null
}

/** file/d/<id>, open?id= or uc?id= on drive.google.com → the file's id; null for a folder, a Google Doc or any other link. */
export function fileIdOfLink(link: string | null | undefined): string | null {
  const m = /drive\.google\.com\/(?:file\/(?:u\/\d+\/)?d\/([\w-]{20,})|(?:open|uc)\?(?:[^#]*&)?id=([\w-]{20,}))/.exec(link ?? '')
  return m?.[1] ?? m?.[2] ?? null
}

/** A number folded for the exact match: upper case, letters and digits only, leading zeros gone. '' never matches. */
export function foldNumber(n: string | null | undefined): string {
  return (n ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+(?=.)/, '')
}

/** The match's rules, counted. A hold made under older rules is due one more read (2: a printed suffix, v2.6897). */
export const MATCH_RULES = 2

/**
 * What a hold was made on: the file, the number and the rules of the match. A person who changes the link or the
 * number makes the row due again, and so does a rule that might now find its paper.
 */
export function seenKey(inv: Pick<SweepInvoice, 'link' | 'number'>): string {
  return `${fileIdOfLink(inv.link) ?? ''}|${foldNumber(inv.number)}|r${MATCH_RULES}`
}

// ---------------------------------------------------------------------------
// The holds
// ---------------------------------------------------------------------------

export type HoldWhy = 'reading' | 'link' | 'cannot_open' | 'not_readable' | 'too_big' | 'number_not_in_file' | 'not_a_bill' | 'statement' | 'refused' | 'cut' | 'failed'

export const HOLD_WHYS: readonly HoldWhy[] = ['reading', 'link', 'cannot_open', 'not_readable', 'too_big', 'number_not_in_file', 'not_a_bill', 'statement', 'refused', 'cut', 'failed']

/** Each reason in words, with its door: what a person does about it. */
export const HOLD_WORDS: Readonly<Record<HoldWhy, { words: string; door: string }>> = {
  reading: { words: 'The bill is being read now.', door: 'Nothing to do.' },
  link: { words: 'The link on the bill is not a file in Drive.', door: 'Paste the link to the bill’s PDF in Drive.' },
  cannot_open: { words: 'The app cannot open the file.', door: 'Share the file with the app, or paste a link the app can open.' },
  not_readable: { words: 'The file is not a PDF or a picture.', door: 'Link the bill as a PDF.' },
  too_big: { words: 'The file is over the reader’s size limit.', door: 'Link a smaller scan.' },
  number_not_in_file: { words: 'The bill’s number is not in its file.', door: 'Look, to pick the pages or fix the link.' },
  not_a_bill: { words: 'The paper with the bill’s number is not an invoice.', door: 'Look, to fix the link.' },
  statement: { words: 'The file is a statement.', door: 'Nothing to do. A statement has no lines of its own.' },
  refused: { words: 'The model would not read the file.', door: 'Read again, or type the lines.' },
  cut: { words: 'The read was cut short.', door: 'Read again, or type the lines.' },
  failed: { words: 'The read did not come back whole.', door: 'It is tried again by itself.' },
}

/** A `supply_bill_holds` row. */
export interface SweepHold {
  invoiceId: string
  why: HoldWhy
  seenKey: string
  /** ISO. */
  triedAt: string
  tries: number
}

const HOUR = 60 * 60_000

/**
 * Whether a held row is due another read. A changed link or number: always. Left `reading` by a run that died: after
 * a quarter hour. A read that failed: an hour on, six times. A file the app could not open, or the model refused or
 * cut: a day on, four times. Everything else waits for a person.
 */
export function holdDue(hold: SweepHold, inv: Pick<SweepInvoice, 'link' | 'number'>, nowMs: number): boolean {
  if (hold.seenKey !== seenKey(inv)) return true
  const age = nowMs - Date.parse(hold.triedAt)
  if (hold.why === 'reading') return age >= READING_STALE_MS
  if (hold.why === 'failed') return age >= HOUR && hold.tries < 6
  if (hold.why === 'cannot_open' || hold.why === 'refused' || hold.why === 'cut') return age >= 24 * HOUR && hold.tries < 4
  return false
}

// ---------------------------------------------------------------------------
// What is due, and where the whole set stands
// ---------------------------------------------------------------------------

/** One file to read: every row that links it and has no paper yet. */
export interface FileJob {
  fileId: string
  rows: SweepInvoice[]
  /** The newest due row's date, the queue's order. */
  newestYmd: string
}

export interface SweepStatus {
  /** Every bill on file. */
  bills: number
  /** Bills with no link at all. */
  noPdf: number
  /** Bills with a paper. */
  read: number
  /** Bills held, by reason; a row being read now is not held. */
  held: Partial<Record<HoldWhy, number>>
  heldTotal: number
  /** Bills a run would read now, and the files behind them. */
  ready: number
  readyFiles: number
}

export interface SweepPlan {
  files: FileJob[]
  /** Rows whose link is not a Drive file and which no hold says so yet: held with no read. */
  linkHolds: SweepInvoice[]
  status: SweepStatus
}

/** What a run would do, from the three reads: every bill, which have a paper, and the holds. */
export function sweepPlan(args: { invoices: readonly SweepInvoice[]; paperInvoiceIds: ReadonlySet<string>; holds: ReadonlyMap<string, SweepHold>; nowMs: number }): SweepPlan {
  const status: SweepStatus = { bills: args.invoices.length, noPdf: 0, read: 0, held: {}, heldTotal: 0, ready: 0, readyFiles: 0 }
  const byFile = new Map<string, { rows: SweepInvoice[]; due: SweepInvoice[] }>()
  const linkHolds: SweepInvoice[] = []
  const hold = (why: HoldWhy) => {
    status.held[why] = (status.held[why] ?? 0) + 1
    status.heldTotal += 1
  }
  for (const inv of args.invoices) {
    if (args.paperInvoiceIds.has(inv.id)) {
      status.read += 1
      continue
    }
    if (!(inv.link ?? '').trim()) {
      status.noPdf += 1
      continue
    }
    const fileId = fileIdOfLink(inv.link)
    const held = args.holds.get(inv.id)
    if (!fileId) {
      hold('link')
      if (!held || held.why !== 'link' || held.seenKey !== seenKey(inv)) linkHolds.push(inv)
      continue
    }
    const entry = byFile.get(fileId) ?? { rows: [], due: [] }
    entry.rows.push(inv)
    if (!held || holdDue(held, inv, args.nowMs)) entry.due.push(inv)
    else if (held.why !== 'reading') hold(held.why)
    byFile.set(fileId, entry)
  }
  const files: FileJob[] = []
  for (const [fileId, entry] of byFile) {
    if (!entry.due.length) continue
    status.ready += entry.due.length
    files.push({ fileId, rows: entry.rows, newestYmd: entry.due.reduce((a, r) => (r.dateYmd > a ? r.dateYmd : a), '') })
  }
  files.sort((a, b) => (a.newestYmd === b.newestYmd ? a.fileId.localeCompare(b.fileId) : b.newestYmd.localeCompare(a.newestYmd)))
  status.readyFiles = files.length
  return { files, linkHolds, status }
}

const count = (n: number, one: string, many: string): string => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`

/** The progress line: *Lines read on 212 of 520 bills · 14 held · 294 to read · 19 with no PDF*. */
export function statusWords(s: SweepStatus): string {
  const parts = [`Lines read on ${s.read.toLocaleString('en-US')} of ${count(s.bills, 'bill', 'bills')}`]
  if (s.heldTotal) parts.push(`${s.heldTotal.toLocaleString('en-US')} held`)
  if (s.ready) parts.push(`${s.ready.toLocaleString('en-US')} to read`)
  if (s.noPdf) parts.push(`${s.noPdf.toLocaleString('en-US')} with no PDF`)
  return parts.join(' · ')
}

/** The linked files a probe tries: `n` of them, spread evenly from the newest bill to the oldest. */
export function probePick(invoices: readonly SweepInvoice[], n: number): { fileId: string; invoiceId: string }[] {
  const seen = new Set<string>()
  const files: { fileId: string; invoiceId: string; ymd: string }[] = []
  for (const inv of [...invoices].sort((a, b) => b.dateYmd.localeCompare(a.dateYmd))) {
    const fileId = fileIdOfLink(inv.link)
    if (!fileId || seen.has(fileId)) continue
    seen.add(fileId)
    files.push({ fileId, invoiceId: inv.id, ymd: inv.dateYmd })
  }
  if (files.length <= n) return files.map(({ fileId, invoiceId }) => ({ fileId, invoiceId }))
  const out: { fileId: string; invoiceId: string }[] = []
  for (let i = 0; i < n; i++) {
    const f = files[Math.round((i * (files.length - 1)) / (n - 1 || 1))]!
    out.push({ fileId: f.fileId, invoiceId: f.invoiceId })
  }
  return out
}

/** The probe's line: *The app opened 20 of 20 linked files.* */
export function probeWords(tried: number, opened: number): string {
  if (!tried) return 'No bill links a file in Drive yet.'
  return `The app opened ${opened} of ${count(tried, 'linked file', 'linked files')}.${opened < tried ? ' Share the bills’ folder with the app so it can read the rest.' : ''}`
}

// ---------------------------------------------------------------------------
// What the model is asked for
// ---------------------------------------------------------------------------

const { page_count: _pageCount, ...PAPER_PROPERTIES } = BILL_SCHEMA.properties
void _pageCount

/** The shape the sweep's read answers with: every paper in the file, each the bill reader's own fields with its pages. */
export const PAPERS_SCHEMA = {
  type: 'object',
  properties: {
    papers: {
      type: 'array',
      description: 'Every paper in the file, in the order they appear: one entry per invoice, credit memo, ship ticket, acknowledgement, quote, bid or statement. A paper that runs over several pages is one entry.',
      items: {
        type: 'object',
        properties: {
          ...PAPER_PROPERTIES,
          page_from: { type: 'integer', description: 'The first page of the file this paper is on, counting from 1.' },
          page_to: { type: 'integer', description: 'The last page of the file this paper is on, counting from 1.' },
        },
        required: [...BILL_SCHEMA.required.filter((k) => k !== 'page_count'), 'page_from', 'page_to'],
        additionalProperties: false,
      },
    },
    page_count: { type: 'integer', description: 'How many pages the file has.' },
  },
  required: ['papers', 'page_count'],
  additionalProperties: false,
} as const

export const PAPERS_SYSTEM = [
  BILL_SYSTEM,
  'A file may hold several papers, one after another: a stack of invoices scanned together, or an invoice with its ship ticket. Answer one entry for each paper, in order, with the pages it is on.',
  'Pages that carry the same document number are one paper. A page that continues a paper and prints no number of its own is still that paper\'s page.',
  'When the file starts in the middle of a paper, answer that paper with whatever it prints, and leave the fields it does not print empty.',
].join(' ')

/** The message beside the file: the house the bills were recorded for, and which pages of a longer file these are. */
export function papersUserMessage(houseName: string, range?: { from: number; to: number; of: number } | null): string {
  return [
    `This file is on record for the supply house ${houseName.trim() || '(unnamed)'}.`,
    range ? `It is pages ${range.from} to ${range.to} of a file of ${range.of} pages, so its first paper may start in the middle and its last may be cut off. Count its pages from 1.` : '',
    'Read every paper in it and fill the fields. If a letterhead names another house, copy that name exactly as printed.',
  ]
    .filter(Boolean)
    .join(' ')
}

/** One paper of a file, as read, with the pages of the whole file it covers (null when the model gave none). */
export interface FilePaper {
  read: BillRead
  pageFrom: number | null
  pageTo: number | null
}

const pageNo = (v: unknown, offset: number): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 1 ? Math.round(v) + offset : null)

/**
 * The model's answer as papers; null when it is not the shape asked for. `pageOffset` is how many pages of the whole
 * file come before this read, so a range's page 1 is the file's page 4. A paper the reader cannot place is left out.
 */
export function readPapersAnswer(json: unknown, pageOffset = 0): { papers: FilePaper[]; pageCount: number | null } | null {
  if (!json || typeof json !== 'object') return null
  const o = json as Record<string, unknown>
  if (!Array.isArray(o.papers)) return null
  const papers: FilePaper[] = []
  for (const raw of o.papers.slice(0, 80)) {
    const read = readBillAnswer(raw)
    if (!read) continue
    const r = raw as Record<string, unknown>
    const pageFrom = pageNo(r.page_from, pageOffset)
    const pageTo = pageNo(r.page_to, pageOffset)
    papers.push({ read, pageFrom, pageTo: pageTo != null && pageFrom != null && pageTo < pageFrom ? pageFrom : pageTo })
  }
  return { papers, pageCount: typeof o.page_count === 'number' && o.page_count >= 1 ? Math.round(o.page_count) : null }
}

/** The text block of a Messages answer, parsed as papers; null when there is none or it is not JSON. */
export function papersFromContent(content: ReadonlyArray<{ type: string; text?: string }>, pageOffset = 0): { papers: FilePaper[]; pageCount: number | null } | null {
  const block = content.find((b) => b.type === 'text' && typeof b.text === 'string')
  if (!block?.text) return null
  try {
    return readPapersAnswer(JSON.parse(block.text), pageOffset)
  } catch {
    return null
  }
}

/** A file's pages in ranges of `per`: 7 pages by 3 → 1–3, 4–6, 7–7. */
export function pageRanges(pages: number, per = PAGES_PER_READ): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = []
  for (let from = 1; from <= pages; from += per) out.push({ from, to: Math.min(pages, from + per - 1) })
  return out
}

const filled = (a: string, b: string): string => a || b

/**
 * The ranges' papers as the file's papers. A range's first paper joins the paper before it when it carries the same
 * number and the same kind (or one of them could not be placed), or when it prints no number and the paper before
 * printed no total: its lines follow on, the money is whichever range printed it (a total prints at the end), and the
 * pages run through.
 */
export function joinPapers(ranges: readonly (readonly FilePaper[])[]): FilePaper[] {
  const out: FilePaper[] = []
  for (const range of ranges) {
    range.forEach((paper, i) => {
      const prev = out[out.length - 1]
      if (i === 0 && prev && continues(prev.read, paper.read)) {
        const a = prev.read
        const b = paper.read
        out[out.length - 1] = {
          pageFrom: prev.pageFrom ?? paper.pageFrom,
          pageTo: paper.pageTo ?? prev.pageTo,
          read: {
            ...a,
            kind: a.kind === 'other' ? b.kind : a.kind,
            houseName: filled(a.houseName, b.houseName),
            number: filled(a.number, b.number),
            dateYmd: filled(a.dateYmd, b.dateYmd),
            orderNumber: filled(a.orderNumber, b.orderNumber),
            poText: filled(a.poText, b.poText),
            accountRef: filled(a.accountRef, b.accountRef),
            shipTo: filled(a.shipTo, b.shipTo),
            jobText: filled(a.jobText, b.jobText),
            terms: filled(a.terms, b.terms),
            referencesNumber: filled(a.referencesNumber, b.referencesNumber),
            lines: [...a.lines, ...b.lines],
            subtotalCents: b.subtotalCents ?? a.subtotalCents,
            taxCents: b.taxCents ?? a.taxCents,
            freightCents: b.freightCents ?? a.freightCents,
            totalCents: b.totalCents ?? a.totalCents,
            pageCount: a.pageCount + b.pageCount,
            statementNumbers: [...a.statementNumbers, ...b.statementNumbers],
            notes: filled(a.notes, b.notes),
          },
        }
        return
      }
      out.push(paper)
    })
  }
  return out
}

function continues(prev: BillRead, next: BillRead): boolean {
  const kindsAgree = prev.kind === next.kind || prev.kind === 'other' || next.kind === 'other'
  if (!kindsAgree) return false
  const n = foldNumber(next.number)
  if (n) return n === foldNumber(prev.number)
  return prev.totalCents == null
}

// ---------------------------------------------------------------------------
// Which paper is which row's
// ---------------------------------------------------------------------------

export type RowOutcome = { invoice: SweepInvoice; paperIndex: number } | { invoice: SweepInvoice; hold: HoldWhy; note: string }

const KIND_WORDS: Readonly<Record<PaperKind, string>> = {
  invoice: 'an invoice',
  credit: 'a credit',
  ship_ticket: 'a ship ticket',
  acknowledgement: 'an order acknowledgement',
  quote: 'a quote',
  bid: 'a bid',
  statement: 'a statement',
  other: 'another kind of paper',
}

/** The longest run of digits a paper may print after the number the office typed: a shipment or a release, `.001` or ` 01`. */
export const NUMBER_SUFFIX_MAX = 3

/**
 * Whether a printed number is the typed one with a short suffix (v2.6897, the owner's call of 2026-11-10): both
 * folded, the typed number the start of the printed one, and what is left one to three digits. `387374` takes
 * `387374 01` and `S100200` takes `S100200.001`; `S100200.001` never takes `S100200.002`.
 */
export function numberWithSuffix(typed: string, printed: string): boolean {
  const t = foldNumber(typed)
  const p = foldNumber(printed)
  if (!t || p.length <= t.length || !p.startsWith(t)) return false
  return new RegExp(`^\\d{1,${NUMBER_SUFFIX_MAX}}$`).test(p.slice(t.length))
}

/**
 * Each row to its paper, by the invoice number (both folded). First every row takes the bill that carries its
 * number exactly; where two bills in the file carry it, the one whose total is the row's amount wins. Then a row
 * still without one takes a bill whose printed number is its own with a short suffix, and only when that paper's
 * total is the row's amount to the cent (`numberWithSuffix`), since the number alone no longer says it. A row whose
 * number is on a paper that is not a bill is held as that; one a statement lists is held as a statement; any other
 * is held as not in its file, with the numbers the file does hold. `unowned` are the papers no row took.
 */
export function matchRows(papers: readonly FilePaper[], rows: readonly SweepInvoice[]): { outcomes: RowOutcome[]; unowned: number[] } {
  const taken = new Set<number>()
  const picked = new Map<number, number>()
  const bills = papers.map((p, i) => ({ p, i })).filter(({ p }) => PURCHASE_KINDS.has(p.read.kind))
  const totalIsRows = (p: FilePaper, invoice: SweepInvoice): boolean => p.read.totalCents != null && Math.abs(p.read.totalCents - Math.abs(invoice.amountCents)) <= 1
  // The exact numbers first, for every row, so a suffix never takes a paper another row names outright.
  rows.forEach((invoice, r) => {
    const n = foldNumber(invoice.number)
    if (!n) return
    const same = bills.filter(({ p, i }) => !taken.has(i) && foldNumber(p.read.number) === n)
    const pick = same.find(({ p }) => totalIsRows(p, invoice)) ?? same[0]
    if (!pick) return
    taken.add(pick.i)
    picked.set(r, pick.i)
  })
  rows.forEach((invoice, r) => {
    if (picked.has(r)) return
    const pick = bills.find(({ p, i }) => !taken.has(i) && numberWithSuffix(invoice.number, p.read.number) && totalIsRows(p, invoice))
    if (!pick) return
    taken.add(pick.i)
    picked.set(r, pick.i)
  })
  const billNumbers = [...new Set(bills.filter(({ p }) => p.read.number).map(({ p }) => p.read.number))]
  const outcomes: RowOutcome[] = rows.map((invoice, r) => {
    const paperIndex = picked.get(r)
    if (paperIndex != null) return { invoice, paperIndex }
    const n = foldNumber(invoice.number)
    const same = papers.filter((p, i) => n !== '' && !taken.has(i) && foldNumber(p.read.number) === n)
    const listed = papers.some((p) => p.read.kind === 'statement' && n !== '' && p.read.statementNumbers.some((s) => foldNumber(s) === n))
    if (same.some((p) => p.read.kind === 'statement') || listed) return { invoice, hold: 'statement', note: 'The file is a statement that lists this bill.' }
    const notBill = same.find((p) => !PURCHASE_KINDS.has(p.read.kind))
    if (notBill) return { invoice, hold: 'not_a_bill', note: `The paper with this number is ${KIND_WORDS[notBill.read.kind]}, not an invoice.` }
    const holds = !papers.length ? 'No paper was read in the file.' : billNumbers.length ? `The file holds ${billNumbers.slice(0, 6).join(', ')}${billNumbers.length > 6 ? ' and more' : ''}.` : `The file holds ${KIND_WORDS[papers[0]!.read.kind]} and no invoice.`
    return { invoice, hold: 'number_not_in_file', note: holds }
  })
  return { outcomes, unowned: papers.map((_, i) => i).filter((i) => !taken.has(i)) }
}

// ---------------------------------------------------------------------------
// The rows written
// ---------------------------------------------------------------------------

/** How the PDF's text stands for the code check: the whole text layer, or null when it is a scan or was not read whole. */
export interface PaperText {
  text: string | null
  /** true a text layer read whole; false a scan; null not known. */
  layer: boolean | null
}

/**
 * A paper as its `supply_papers` row and its `supply_paper_lines` rows, checked. A paper that is a bill's takes the
 * row's kind (a person said invoice or credit) and is held to the row's amount; a paper with no bill keeps the kind
 * the reader gave it. The note is the first problem in words, as the Look window's strip reads it.
 */
export function paperRowOf(args: { paper: FilePaper; invoice: SweepInvoice | null; houseId: string | null; fileId: string; text: PaperText; model: string; readId: string | null; readAt: string }): {
  paper: Record<string, unknown>
  lines: Record<string, unknown>[]
  check: PaperCheck
} {
  const { read } = args.paper
  const kind: PaperKind = args.invoice ? args.invoice.kind : read.kind
  const paper = { ...paperFromBillRead(read), kind }
  const check = checkPaper(paper, { rowAmountCents: args.invoice ? args.invoice.amountCents : null, text: args.text.text })
  return {
    check,
    paper: {
      supply_house_id: args.invoice?.supplyHouseId ?? args.houseId,
      invoice_id: args.invoice?.id ?? null,
      kind,
      number: read.number || args.invoice?.number || '',
      dated_on: read.dateYmd || args.invoice?.dateYmd || null,
      order_number: read.orderNumber,
      po_text: read.poText,
      drive_file_id: args.fileId,
      page_from: args.paper.pageFrom,
      page_to: args.paper.pageTo,
      subtotal_cents: paper.subtotalCents,
      tax_cents: paper.taxCents,
      freight_cents: paper.freightCents,
      total_cents: paper.totalCents,
      read_by: `sweep:${args.model}`,
      read_id: args.readId,
      read_at: args.readAt,
      check_state: check.state,
      check_note: checkNoteOf(check),
      check_rules: CHECK_RULES,
      text_layer: args.text.layer,
    },
    lines: paper.lines.map((l) => ({
      line_no: l.lineNo,
      line_kind: l.lineKind,
      house_code: l.houseCode.slice(0, 60),
      mfr_number: l.mfrNumber.slice(0, 60),
      description: l.description.slice(0, 240),
      unit: l.unit.slice(0, 12),
      qty_ordered: l.qtyOrdered,
      qty_shipped: l.qtyShipped,
      qty_backordered: l.qtyBackordered,
      unit_price: l.unitPrice,
      pricing_unit: l.pricingUnit,
      extended_cents: l.extendedCents,
    })),
  }
}

/** The note a paper keeps: the first problem in words while it is off, nothing once it adds up. */
export function checkNoteOf(check: PaperCheck): string {
  return check.state === 'off' ? check.words.replace(/^\d+ lines? · /, '').slice(0, 400) : ''
}

// ---------------------------------------------------------------------------
// One more check under new rules
// ---------------------------------------------------------------------------

/** The off papers a run checks again, and the files it opens for their text. Small: the work is a handful of reads. */
export const RECHECK_PAPERS = 12
export const RECHECK_FILES = 3

/** A `supply_paper_lines` row as the recheck reads it. PostgREST answers a numeric as a number or a string. */
export interface StoredLineRow {
  line_no: number
  line_kind: string
  house_code: string | null
  mfr_number: string | null
  description: string | null
  unit: string | null
  qty_ordered: number | string | null
  qty_shipped: number | string | null
  qty_backordered: number | string | null
  unit_price: number | string | null
  pricing_unit: string
  extended_cents: number | null
}

const numberOrNull = (v: number | string | null): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

export function lineOfStoredRow(r: StoredLineRow): PaperLine {
  return {
    lineNo: r.line_no,
    lineKind: (r.line_kind === 'charge' || r.line_kind === 'component' ? r.line_kind : 'part') as LineKind,
    houseCode: r.house_code ?? '',
    mfrNumber: r.mfr_number ?? '',
    description: r.description ?? '',
    unit: r.unit ?? '',
    qtyOrdered: numberOrNull(r.qty_ordered),
    qtyShipped: numberOrNull(r.qty_shipped),
    qtyBackordered: numberOrNull(r.qty_backordered),
    unitPrice: numberOrNull(r.unit_price),
    pricingUnit: (r.pricing_unit === 'per_hundred' || r.pricing_unit === 'per_thousand' ? r.pricing_unit : 'each') as PricingUnit,
    extendedCents: r.extended_cents,
  }
}

export interface Recheck {
  check: PaperCheck
  /** What `supply_papers` takes: the state, the note, and the rules it was checked under. */
  paper: { check_state: 'adds_up' | 'off'; check_note: string; check_rules: number }
  /** The lines the paper's own sums turned (`settlePaper`), as the columns to write, by line number. */
  lineFixes: { line_no: number; qty_shipped: number | null; unit_price: number | null; extended_cents: number | null }[]
}

/**
 * A paper on file, checked again from its own lines: settled by its sums, then held to every check against the
 * bill's amount and, when the caller has it, the PDF's text. No model read. The caller writes the line fixes first
 * and the state after, so a paper never counts with a line the check did not see.
 */
export function recheckStored(args: { paper: PaperRead; rowAmountCents: number | null; text?: string | null }): Recheck {
  const settled = settlePaper(args.paper)
  const check = checkPaper(settled.paper, { rowAmountCents: args.rowAmountCents, text: args.text })
  const byNo = new Map(settled.paper.lines.map((l) => [l.lineNo, l]))
  return {
    check,
    paper: { check_state: check.state, check_note: checkNoteOf(check), check_rules: CHECK_RULES },
    lineFixes: settled.changed.map((lineNo) => {
      const l = byNo.get(lineNo)!
      return { line_no: lineNo, qty_shipped: l.qtyShipped, unit_price: l.unitPrice, extended_cents: l.extendedCents }
    }),
  }
}

/** The recheck in one line: *Checked 6 bills again under the new rules: 4 now add up.* '' when none was due. */
export function recheckWords(checked: number, addUp: number): string {
  if (!checked) return ''
  return `Checked ${count(checked, 'bill', 'bills')} again under the new rules: ${addUp} now ${addUp === 1 ? 'adds' : 'add'} up.`
}

// ---------------------------------------------------------------------------
// The run's answer
// ---------------------------------------------------------------------------

export interface SweepRun {
  files: number
  /** Bills whose lines were kept, and how many of those add up. */
  kept: number
  addUp: number
  /** Papers kept with no bill: a second bill in a file, a ship ticket. */
  unowned: number
  held: number
  /** Model reads made, and what they cost. */
  reads: number
  cents: number
  capped: boolean
}

export const EMPTY_SWEEP_RUN: SweepRun = { files: 0, kept: 0, addUp: 0, unowned: 0, held: 0, reads: 0, cents: 0, capped: false }

/** The run in one line: *Read 3 files: 4 bills' lines kept (3 add up), 1 held. Lines read on 216 of 539 bills · …* */
export function sweepWords(run: SweepRun, status: SweepStatus): string {
  const did = !run.files
    ? run.capped
      ? `The sweep has made its ${BILL_SWEEP_DAILY_CAP} reads for the day.`
      : 'Nothing to read.'
    : `Read ${count(run.files, 'file', 'files')}: ${count(run.kept, 'bill’s lines', 'bills’ lines')} kept (${run.addUp} ${run.addUp === 1 ? 'adds' : 'add'} up)${run.held ? `, ${run.held} held` : ''}${run.unowned ? `, ${count(run.unowned, 'paper', 'papers')} with no bill` : ''}, ${moneyWords(Math.round(run.cents))}.`
  return `${did} ${statusWords(status)}`
}
