/**
 * Job accounts at the counter, PR 5 (v2.3440): the question on a new job and
 * same-property reuse. The moment a hand-made job saves, the office says
 * which houses it will buy from — and when another job at the same address
 * already has an open account at a house, the app offers to reuse it instead
 * of asking Curly twice. Pure: the offers and the plan the prompt executes.
 */

import { normalizeAddressForMatch } from './lienProperty'
import type { JobAccountStripEntry } from './jobAccountStrip'

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

/** The note on a not-needed row written from the new-job question. */
export const NEW_JOB_NOT_NEEDED_NOTE = 'New job — no job account needed'
