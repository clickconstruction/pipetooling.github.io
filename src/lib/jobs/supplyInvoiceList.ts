/**
 * A job's supply house invoices as a list a person can search and share (punch list #431, PR 1): the Job Summary's
 * *Invoices from Supply Houses*. The search reads the four facts a row shows, the house, the invoice number, the date
 * and the amount, off the rows already loaded, so it needs no index. A date typed as a day (*nov 16*, *11/16*,
 * *2026-11-16*) is matched as that day and never as loose digits, so *nov 1* does not find the 16th. The share link
 * is the app's own lasting link to a bill (`fileRoute.ts`), never a public file link.
 *
 * Since PR 3 the search also reaches the lines read from each bill's paper (punch list #298 keeps them as rows): a
 * word the four facts do not hold may be a part on the paper, by its description, the house's code or the maker's
 * number. A row found that way says which line found it.
 */
import type { JobSummaryInvoiceAllocationLine } from '../../types/jobSummary'
import { fileUrl } from '../files/fileRoute'
import { supplyHouseWebsitePortalHref } from '../supplyHouseWebsite'

export type SupplyInvoiceRow = JobSummaryInvoiceAllocationLine

/** The list grows a search box at this many rows: under it the eye is faster than the box. */
export const SUPPLY_INVOICE_SEARCH_FROM = 8

export const SUPPLY_INVOICE_WORDS = {
  searchPlaceholder: 'Search house, invoice, date or amount',
  searchPlaceholderWithLines: 'Search house, invoice, date, amount or a part',
  onThePaper: 'On the paper:',
  searchLabel: 'Search this job’s invoices',
  clearSearch: 'Clear the search',
  allHouses: 'All',
  copied: 'Link copied to clipboard',
  shareTitle: 'Copy a link to this invoice',
  shareLabel: (invoiceNumber: string) => `Copy a link to invoice ${invoiceNumber}`,
  copyByHand: (url: string) => `Copy this link: ${url}`,
  noPdf: 'no PDF',
  noPdfTitle: 'This bill has no PDF yet. Add one on the bill in Materials, Supply houses.',
  supplierSite: 'supplier’s site',
} as const

/** Who reads a bill's own row, so whose copied link opens: the office (the read policy on `supply_house_invoices`). */
const SHARE_ROLES: ReadonlySet<string> = new Set(['dev', 'master_technician', 'assistant', 'controller'])

/** True for a role whose copied link would open. Anyone else sees the list with no share icon. */
export function canShareSupplyInvoice(role: string | null | undefined): boolean {
  return !!role && SHARE_ROLES.has(role)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'] as const

/**
 * An invoice's day as the list writes it: the month and the day, and the year only when it is not this year (the
 * owner, 2026-11-23). `Nov 16` this year, `Dec 18, 2025` for another. A day that is not a `YYYY-MM-DD` comes back as
 * it came, and an empty one as a dash.
 */
export function invoiceDayWords(ymd: string | null | undefined, todayYmd: string): string {
  const text = (ymd ?? '').trim()
  if (!text) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined
  if (!m || !month) return text
  const day = `${month} ${Number(m[3])}`
  return m[1] === todayYmd.slice(0, 4) ? day : `${day}, ${m[1]}`
}

/** One thing the search asks of a row. */
type Term =
  | { kind: 'text'; text: string }
  | { kind: 'day'; month: number; day: number; year: number | null }
  | { kind: 'month'; month: number; year: number | null; word: string }

/** `nov`, `sept`, `november`: a month by three letters or more of its name, else 0. */
function monthOf(word: string): number {
  const w = word.replace(/[.,]$/, '')
  if (w.length < 3 || !/^[a-z]+$/.test(w)) return 0
  return MONTH_NAMES.findIndex((name) => name.startsWith(w)) + 1
}

function fullYear(text: string): number {
  const n = Number(text)
  return text.length === 2 ? 2000 + n : n
}

/** The search text as terms: a typed day is one term, everything else a word. */
export function supplyInvoiceSearchTerms(query: string): Term[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const terms: Term[] = []
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!
    const month = monthOf(word)
    if (month) {
      const next = words[i + 1] ?? ''
      const after = words[i + 2] ?? ''
      const dayText = /^(\d{1,2}),?$/.exec(next)
      if (dayText && Number(dayText[1]) >= 1 && Number(dayText[1]) <= 31) {
        const year = /^\d{4}$/.test(after) ? Number(after) : null
        terms.push({ kind: 'day', month, day: Number(dayText[1]), year })
        i += year == null ? 1 : 2
        continue
      }
      if (/^\d{4}$/.test(next)) {
        terms.push({ kind: 'month', month, year: Number(next), word })
        i += 1
        continue
      }
      terms.push({ kind: 'month', month, year: null, word })
      continue
    }
    const slash = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(word)
    if (slash && Number(slash[1]) >= 1 && Number(slash[1]) <= 12 && Number(slash[2]) >= 1 && Number(slash[2]) <= 31) {
      terms.push({ kind: 'day', month: Number(slash[1]), day: Number(slash[2]), year: slash[3] ? fullYear(slash[3]) : null })
      continue
    }
    const iso = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/.exec(word)
    if (iso && Number(iso[2]) >= 1 && Number(iso[2]) <= 12) {
      terms.push(iso[3] ? { kind: 'day', month: Number(iso[2]), day: Number(iso[3]), year: Number(iso[1]) } : { kind: 'month', month: Number(iso[2]), year: Number(iso[1]), word })
      continue
    }
    const text = word.replace(/^\$/, '')
    if (text) terms.push({ kind: 'text', text })
  }
  return terms
}

function alnum(text: string): string {
  return text.replace(/[^a-z0-9]/g, '')
}

/** An amount the two ways a person types it: `1085.58` and `1,085.58`. */
function amountForms(amount: number): string[] {
  if (!Number.isFinite(amount)) return []
  const fixed = Math.abs(amount).toFixed(2)
  return [fixed, Number(fixed).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })]
}

function matchesText(row: SupplyInvoiceRow, text: string, date: RegExpExecArray | null): boolean {
  if ((row.supply_house_name ?? '').toLowerCase().includes(text)) return true
  const number = (row.invoice_number ?? '').toLowerCase()
  if (number.includes(text)) return true
  // `bw7731` finds `BW 7731-02`: the number with its spaces and marks dropped, against the word the same way.
  const bare = alnum(text)
  if (bare.length >= 2 && alnum(number).includes(bare)) return true
  if (date && date[0].includes(text)) return true
  return [...amountForms(row.allocated_amount), ...amountForms(row.invoice_total_amount)].some((form) => form.includes(text))
}

/** One line read from a bill's paper, as the search reads it. */
export interface InvoiceLineWords {
  description: string
  /** The supply house's own part code. */
  code: string
  /** The maker's number, when the paper prints one. */
  mfr: string
}

/** The lines read from each bill's paper, by invoice id. A bill with no paper read has no entry. */
export type InvoiceLinesById = ReadonlyMap<string, readonly InvoiceLineWords[]>

/** Whether a word is on a line: in its description, or in a code with or without its dashes and spaces. */
export function lineHoldsWord(line: InvoiceLineWords, text: string): boolean {
  if (line.description.toLowerCase().includes(text)) return true
  const bare = alnum(text)
  return [line.code, line.mfr].some((code) => {
    const c = code.toLowerCase()
    return !!c && (c.includes(text) || (bare.length >= 2 && alnum(c).includes(bare)))
  })
}

/** How a row meets a term: by its own four facts, by a line on its paper, or not at all. */
function meetsTerm(row: SupplyInvoiceRow, term: Term, lines: readonly InvoiceLineWords[]): 'facts' | InvoiceLineWords | null {
  const date = /^(\d{4})-(\d{2})-(\d{2})/.exec(row.invoice_date ?? '')
  const byLine = (text: string) => lines.find((line) => lineHoldsWord(line, text)) ?? null
  if (term.kind === 'text') return matchesText(row, term.text, date) ? 'facts' : byLine(term.text)
  const inMonth = !!date && Number(date[2]) === term.month && (term.year == null || Number(date[1]) === term.year)
  if (term.kind === 'day') return inMonth && Number(date![3]) === term.day ? 'facts' : null
  if (inMonth) return 'facts'
  // A month typed alone may be the start of a house's name (*may* in a house called Mayfield) or of a part's, so it is
  // read as a word too.
  if (term.year != null) return null
  return matchesText(row, term.word, date) ? 'facts' : byLine(term.word)
}

/** The words of a search that are plain words, for marking them where they were found. A typed day is not one. */
export function supplyInvoiceSearchWords(query: string): string[] {
  return supplyInvoiceSearchTerms(query).flatMap((term) => (term.kind === 'text' ? [term.text] : term.kind === 'month' && term.year == null ? [term.word] : []))
}

/**
 * A text cut where the search's words sit in it, so a screen can mark them. The first place each word is found, the
 * pieces in order; a text none of the words is in comes back as one unmarked piece.
 */
export function markWords(text: string, words: readonly string[]): { text: string; hit: boolean }[] {
  const lower = text.toLowerCase()
  const spans: [number, number][] = []
  for (const word of words) {
    if (word.length < 2) continue
    const at = lower.indexOf(word)
    if (at >= 0 && !spans.some(([from, to]) => at < to && at + word.length > from)) spans.push([at, at + word.length])
  }
  if (spans.length === 0) return [{ text, hit: false }]
  spans.sort((a, b) => a[0] - b[0])
  const out: { text: string; hit: boolean }[] = []
  let at = 0
  for (const [from, to] of spans) {
    if (from > at) out.push({ text: text.slice(at, from), hit: false })
    out.push({ text: text.slice(from, to), hit: true })
    at = to
  }
  if (at < text.length) out.push({ text: text.slice(at), hit: false })
  return out
}

/**
 * The rows the search and the house chip leave, in the order they came, with what they add up to on this job. Every
 * term must be met, by the row's own facts or, when `lines` is handed in, by a line on its paper. `onPaper` names the
 * line that found a row its own facts would not have. An empty search with no house is every row.
 */
export function searchSupplyInvoices(
  rows: readonly SupplyInvoiceRow[],
  query: string,
  house: string | null = null,
  lines: InvoiceLinesById | null = null,
): { rows: SupplyInvoiceRow[]; total: number; onPaper: Map<string, InvoiceLineWords> } {
  const terms = supplyInvoiceSearchTerms(query)
  const onPaper = new Map<string, InvoiceLineWords>()
  const kept = rows.filter((row) => {
    if (house != null && (row.supply_house_name ?? '') !== house) return false
    const rowLines = lines?.get(row.invoice_id) ?? []
    let found: InvoiceLineWords | null = null
    for (const term of terms) {
      const met = meetsTerm(row, term, rowLines)
      if (!met) return false
      if (met !== 'facts') found ??= met
    }
    if (found) onPaper.set(row.invoice_id, found)
    return true
  })
  const cents = kept.reduce((sum, row) => sum + Math.round((Number(row.allocated_amount) || 0) * 100), 0)
  return { rows: kept, total: cents / 100, onPaper }
}

/** A chip per supply house, the one with the most invoices first; none when the list has one house. */
export function supplyHouseChips(rows: readonly SupplyInvoiceRow[]): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const name = row.supply_house_name ?? ''
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  if (counts.size < 2) return []
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** The words after the count: `invoice` for one, `invoices` otherwise, with `of 18` when the list is narrowed. */
export function supplyInvoiceCountWords(shown: number, all: number): string {
  const noun = all === 1 ? 'invoice' : 'invoices'
  return shown === all ? noun : `of ${all} ${noun}`
}

/** The link the share icon copies: the bill's lasting link, with the job so the page can flip through that job's list. */
export function supplyInvoiceShareUrl(invoiceId: string, jobId: string | null | undefined): string {
  const url = fileUrl('bills', invoiceId)
  return jobId ? `${url}?job=${encodeURIComponent(jobId)}` : url
}

/** The bill's own PDF, when its row links one. A map link someone pasted is not one. */
export function supplyInvoicePdfHref(row: Pick<SupplyInvoiceRow, 'invoice_link'>): string | null {
  return supplyHouseWebsitePortalHref(row.invoice_link)
}

/** The supply house's own site, offered beside a bill with no PDF and never as the bill itself. */
export function supplierSiteHref(row: Pick<SupplyInvoiceRow, 'website_url'>): string | null {
  return supplyHouseWebsitePortalHref(row.website_url)
}
