/**
 * Job accounts at the counter, PR 5 (v2.3440): the question on a new job and
 * same-property reuse. The moment a hand-made job saves, the office says
 * which houses it will buy from — and when another job at the same address
 * already has an open account at a house, the app offers to reuse it instead
 * of asking Curly twice. Pure: the offers and the plan the prompt executes.
 */

import { normalizeAddressForMatch } from './lienProperty'
import type { JobAccountStripEntry } from './jobAccountStrip'
import type { JobSupplyHouseAccountRow } from '../materials/jobSupplyHouseAccounts'

export interface SamePropertyJob {
  id: string
  label: string
  address: string | null | undefined
  entries: JobAccountStripEntry[]
}

export interface SamePropertyOffer {
  houseId: string
  houseName: string
  fromJobId: string
  fromJobLabel: string
  accountRef: string
  openedVia: string | null
  repContactId: string | null
}

/**
 * Jobs at the same address (exact normalized match, else the street line)
 * with an OPEN account at a house the new job has none at — one offer per
 * house, the first matching job wins. Order follows the new job's entries.
 */
export function samePropertyOffers(
  newJobAddress: string | null | undefined,
  newJobEntries: JobAccountStripEntry[],
  others: SamePropertyJob[],
): SamePropertyOffer[] {
  const key = normalizeAddressForMatch(newJobAddress ?? '')
  if (!key) return []
  const street = key.split(',')[0]?.trim() ?? ''
  const same = others.filter((o) => {
    const k = normalizeAddressForMatch(o.address ?? '')
    if (!k) return false
    if (k === key) return true
    return street !== '' && (k.split(',')[0]?.trim() ?? '') === street
  })
  const offers: SamePropertyOffer[] = []
  for (const e of newJobEntries) {
    if (e.state !== 'none') continue
    for (const o of same) {
      const open = o.entries.find((x) => x.houseId === e.houseId && x.state === 'open')
      if (!open) continue
      offers.push({
        houseId: e.houseId,
        houseName: e.houseName,
        fromJobId: o.id,
        fromJobLabel: o.label,
        accountRef: open.accountRef,
        openedVia: open.openedVia,
        repContactId: open.rep?.id ?? null,
      })
      break
    }
  }
  return offers
}

export type NewJobAccountsChoice = 'ask' | 'reuse' | 'skip'

export interface NewJobAccountsPlan {
  /** Houses to ask the office for (a requested row + the one errand). */
  ask: JobAccountStripEntry[]
  /** Accounts to copy from the same-property job (an open row, note "same property as …"). */
  reuse: SamePropertyOffer[]
}

/**
 * What the prompt writes from its picks. A house picked for reuse never also
 * gets asked; a house with no offer can only be asked.
 */
export function buildNewJobAccountsPlan(
  entries: JobAccountStripEntry[],
  offers: SamePropertyOffer[],
  picks: ReadonlyMap<string, NewJobAccountsChoice>,
): NewJobAccountsPlan {
  const offerByHouse = new Map(offers.map((o) => [o.houseId, o]))
  const ask: JobAccountStripEntry[] = []
  const reuse: SamePropertyOffer[] = []
  for (const e of entries) {
    if (e.state !== 'none') continue
    const choice = picks.get(e.houseId) ?? 'skip'
    if (choice === 'reuse') {
      const o = offerByHouse.get(e.houseId)
      if (o) reuse.push(o)
      else ask.push(e)
    } else if (choice === 'ask') {
      ask.push(e)
    }
  }
  return { ask, reuse }
}

/** The note on a copied account row. */
export function reuseNote(fromJobLabel: string): string {
  return `Same property as ${fromJobLabel}`
}

/**
 * The note the new-job question wrote on a not-needed row before it asked why: one press
 * marked every house, and these words stood in for a reason nobody gave. Nothing writes it
 * any more; it stays so the rows that carry it read truthfully (`notNeededSheetWords`).
 */
export const NEW_JOB_NOT_NEEDED_NOTE = 'New job — no job account needed'

/** True for a not-needed row from the old one-press answer: marked when the job was made, with no reason. */
export function isNoReasonNewJobNote(note: string | null | undefined): boolean {
  return (note ?? '').trim() === NEW_JOB_NOT_NEEDED_NOTE
}

/** The one-tap reasons under *None needed* on the new-job question; the box takes any other. */
export const NEW_JOB_NOT_NEEDED_REASONS = ['Service call', 'Builder’s own account', 'Insurer pays the house'] as const

export interface NewJobNotNeededRow {
  job_id: string
  supply_house_id: string
  status: 'not_needed'
  note: string
}

/**
 * The rows *None needed* writes: one per house still unanswered, each carrying the reason as
 * its note, the way every other not-needed door does. Empty when no reason was given or no
 * house is left to answer for, and then the button is dead.
 */
export function newJobNotNeededRows(jobId: string, entries: JobAccountStripEntry[], reason: string): NewJobNotNeededRow[] {
  const note = reason.trim()
  if (!note) return []
  return entries
    .filter((e) => e.state === 'none')
    .map((e) => ({ job_id: jobId, supply_house_id: e.houseId, status: 'not_needed' as const, note }))
}

/**
 * What the not-needed sheet says about one house. A typed reason reads as the office's
 * decision; the old one-press answer says what it was, so nobody reads a reason into it.
 */
export function notNeededSheetWords(houseName: string, note: string | null | undefined): string {
  const reason = (note ?? '').trim()
  if (isNoReasonNewJobNote(reason)) return 'Marked not needed when the job was made. No reason was given.'
  if (!reason) return `Marked not needed at ${houseName}. No reason was given.`
  return `The office decided this job does not need an account at ${houseName}: ${reason}`
}

/** The chip's hover words for a not-needed house. */
export function notNeededChipTitle(note: string | null | undefined): string {
  const reason = (note ?? '').trim()
  if (!reason || isNoReasonNewJobNote(reason)) return 'Not needed: no reason was given'
  return `Not needed: ${reason}`
}

/**
 * The row *Change this* hands the Mark opened window. The old one-press note is left out, so
 * staying on not needed takes a real reason.
 */
export function changeNotNeededExisting(jobId: string, entry: JobAccountStripEntry): JobSupplyHouseAccountRow | null {
  if (!entry.accountId) return null
  return {
    id: entry.accountId,
    job_id: jobId,
    supply_house_id: entry.houseId,
    status: 'not_needed',
    account_ref: '',
    opened_via: null,
    rep_contact_id: null,
    requested_by: null,
    requested_at: null,
    requested_from_counter: false,
    opened_by: null,
    opened_at: null,
    note: isNoReasonNewJobNote(entry.note) ? '' : entry.note,
  }
}
