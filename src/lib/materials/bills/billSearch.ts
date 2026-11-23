/**
 * One search across every supply house bill (punch list #431, PR 5): what the box on Materials → Supply houses asks
 * the database, and how a hit reads. The database does the finding (`search_supply_bills`, migration
 * `20261123193100`), as the caller, so nobody finds a bill the app would not show them. This file turns what a person
 * typed into what the function takes, with the same reading of a day and a month as the Job Summary's list
 * (`lib/jobs/supplyInvoiceList.ts`), and reads a row back. Pure.
 */
import { effectiveJobLedgerNumber } from '../../ledgerDisplayPrefixes'
import { supplyInvoiceSearchTerms } from '../../jobs/supplyInvoiceList'
import type { BillViewerItem } from './billViewer'

/** A search starts at this many letters: one letter finds most of the bills on file. */
export const BILL_SEARCH_MIN = 2

/** How many bills one search brings back. */
export const BILL_SEARCH_LIMIT = 60

/** How long the box waits after the last key before it asks. */
export const BILL_SEARCH_WAIT_MS = 250

export const BILL_SEARCH_WORDS = {
  label: 'Search every bill',
  placeholder: 'Search every bill: number, house, PO, amount or a part',
  searching: 'Searching…',
  failed: 'The search did not run.',
  tryAgain: 'Try again',
  clear: 'Clear the search',
  onThePaper: 'On the paper:',
  noJob: 'No job on this bill',
  noPdf: 'no PDF',
  paid: 'paid',
  /** `12 bills`, or `the first 60 bills` when the search stopped at its limit. */
  count: (n: number, atLimit: boolean) => (atLimit ? `the first ${n} bills` : `${n} ${n === 1 ? 'bill' : 'bills'}`),
} as const

/** What `search_supply_bills` takes. */
export interface BillSearchArgs {
  words: string[]
  year: number | null
  month: number | null
  day: number | null
}

/**
 * What a person typed, as the function takes it: the plain words, and the first day or month typed as the date to
 * narrow by. Null when there is nothing worth asking: under two letters, with no date.
 */
export function billSearchArgs(query: string): BillSearchArgs | null {
  const terms = supplyInvoiceSearchTerms(query)
  const words: string[] = []
  let date: { year: number | null; month: number | null; day: number | null } | null = null
  for (const term of terms) {
    if (term.kind === 'text') words.push(term.text)
    else if (!date) date = { year: term.year, month: term.month, day: term.kind === 'day' ? term.day : null }
    // A second date cannot also hold, so it is read as the word it was typed as, and finds nothing unless a bill holds it.
    else if (term.kind === 'month') words.push(term.word)
  }
  const letters = words.join('').length
  if (!date && letters < BILL_SEARCH_MIN) return null
  return { words, year: date?.year ?? null, month: date?.month ?? null, day: date?.day ?? null }
}

/** One bill the search found, as the function answers it. */
export interface BillSearchHit {
  invoice_id: string
  invoice_number: string
  invoice_date: string | null
  amount: number | string
  supply_house_id: string
  supply_house_name: string
  purchase_order_number: string | null
  is_paid: boolean
  has_pdf: boolean
  jobs: { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; pct: number | string }[] | null
  on_paper: string | null
  on_paper_code: string | null
}

/** The jobs a bill is on, in words: `JP1042 · Oak Hollow`, with its share when the bill is split. */
export function billSearchJobsWords(hit: Pick<BillSearchHit, 'jobs'>): string {
  const jobs = hit.jobs ?? []
  if (jobs.length === 0) return BILL_SEARCH_WORDS.noJob
  return jobs
    .map((job) => {
      const number = effectiveJobLedgerNumber(job.hcp_number, job.click_number)
      const name = (job.job_name ?? '').trim()
      const label = [number, name].filter(Boolean).join(' · ') || 'a job'
      const pct = Number(job.pct)
      return jobs.length > 1 && Number.isFinite(pct) ? `${label} (${pct}%)` : label
    })
    .join(', ')
}

/** The hits as the bill viewer lists them, in the order found. */
export function billSearchViewerItems(hits: readonly BillSearchHit[]): BillViewerItem[] {
  return hits.map((hit) => ({ invoiceId: hit.invoice_id, number: hit.invoice_number, house: hit.supply_house_name, dateYmd: (hit.invoice_date ?? '').slice(0, 10), amount: Number(hit.amount) || 0 }))
}
