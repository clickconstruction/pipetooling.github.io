/**
 * Contracts & terms as an index (v2.4108): the cards ordered the way a customer meets them, one
 * line per contract, a lens to narrow the list and a find box — so eighteen texts read as a table
 * of contents first and a card second. Pure; the tab renders it.
 */
import { CONTRACT_STATUS_LABELS, type ContractCatalogArea, type ContractCatalogEntry, type ContractTextStatus, type ResolvedContractText } from './customerContractCatalog'
import type { ContractLastSent } from './contractLastSent'
import type { ReviewState } from './contractTextHistory'

/** The sections, in the order a customer meets them. */
export const CONTRACT_AREA_ORDER: readonly ContractCatalogArea[] = ['estimates', 'bids', 'jobs', 'signing', 'billing', 'liens']

export const CONTRACT_AREA_HINTS: Readonly<Record<ContractCatalogArea, string>> = {
  estimates: 'what a homeowner accepts on an estimate',
  bids: 'what a contractor approves in the bid room, and the letter behind it',
  jobs: 'what a homeowner signs on a job, and what a job sends',
  signing: 'the sentences on every page a signature is taken',
  billing: 'what rides on a bill',
  liens: 'the notices and letters of chapter 53 and collections',
}

/** What the index knows about one card — the tab's card model, narrowed to what a row and a lens read. */
export type IndexCard = {
  entry: Pick<ContractCatalogEntry, 'id' | 'name' | 'area' | 'audience' | 'group'>
  text: Pick<ResolvedContractText, 'key' | 'title' | 'text' | 'status'>
  sent: Pick<ContractLastSent, 'status' | 'staleDrafts'> | null
  review: Pick<ReviewState, 'status'>
}

export type NeedsLookReason = 'differs' | 'blank' | 'review_due'

export const NEEDS_LOOK_LABELS: Readonly<Record<NeedsLookReason, string>> = {
  differs: 'what went out is not what the card says',
  blank: 'nothing is set',
  review_due: 'the review is due',
}

/**
 * Why a card needs a look, or nothing. A card that has never been reviewed is not on this list —
 * on the first day that is every card — the never-reviewed count stays on the top line.
 */
export function needsLookReasons(card: Pick<IndexCard, 'text' | 'sent' | 'review'>): NeedsLookReason[] {
  const out: NeedsLookReason[] = []
  if (card.sent && (card.sent.status === 'differs' || card.sent.staleDrafts > 0)) out.push('differs')
  if (card.text.status === 'blank') out.push('blank')
  if (card.review.status === 'due') out.push('review_due')
  return out
}

export type ContractLens = 'all' | 'needs_look' | ContractTextStatus

/** The lenses in the order the chips show them: every card, the ones that need a look, then each kind of wording. */
export const CONTRACT_LENS_ORDER: readonly ContractLens[] = ['all', 'needs_look', 'yours', 'built_in', 'blank', 'in_settings', 'per_record', 'fixed']

export function contractLensLabel(lens: ContractLens): string {
  if (lens === 'all') return 'All'
  if (lens === 'needs_look') return 'Needs a look'
  return CONTRACT_STATUS_LABELS[lens]
}

export function contractLensCounts(cards: ReadonlyArray<IndexCard>): Record<ContractLens, number> {
  const counts = Object.fromEntries(CONTRACT_LENS_ORDER.map((l) => [l, 0])) as Record<ContractLens, number>
  for (const c of cards) {
    counts.all += 1
    if (needsLookReasons(c).length > 0) counts.needs_look += 1
    counts[c.text.status] += 1
  }
  return counts
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Whether a row shows under the lens and the find box. The find box reads the title, the name and the wording itself. */
export function indexRowMatches(card: IndexCard, lens: ContractLens, query: string): boolean {
  if (lens === 'needs_look' && needsLookReasons(card).length === 0) return false
  if (lens !== 'all' && lens !== 'needs_look' && card.text.status !== lens) return false
  const q = norm(query)
  if (!q) return true
  return norm(`${card.text.title} ${card.entry.name} ${card.text.text}`).includes(q)
}

/** The cards of one section, in catalog order, after the lens and the find box. */
export function indexSection<T extends IndexCard>(cards: ReadonlyArray<T>, area: ContractCatalogArea, lens: ContractLens, query: string): T[] {
  return cards.filter((c) => c.entry.area === area && indexRowMatches(c, lens, query))
}

/** A row's short review word: the tab's long line is for the open card. */
export function reviewWord(review: Pick<ReviewState, 'status' | 'last'>): string {
  if (review.status === 'never') return 'Never'
  if (review.status === 'due') return 'Due'
  const d = review.last?.reviewed_on
  return d ? `Reviewed ${d.slice(5, 7).replace(/^0/, '')}/${d.slice(8, 10).replace(/^0/, '')}/${d.slice(2, 4)}` : 'Reviewed'
}

/** The row targeted by the page's hash (`#settings-contract-<entry id>`), so it opens on arrival; null when the hash names none. */
export function entryIdFromHash(hash: string): string | null {
  const m = /^#?settings-contract-([a-z0-9-]+)$/.exec(hash.trim())
  return m ? m[1]! : null
}
