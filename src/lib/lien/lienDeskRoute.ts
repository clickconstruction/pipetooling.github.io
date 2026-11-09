/**
 * The Lien desk's address (punch list #182, the Lien desk's move): the desk is a page at `/lien-desk`,
 * and what it shows is in the address, so a reload keeps your place and the address bar is the link
 * to paste. `?tab=` is the view by a plain word — `deadlines` for the Deadlines grid, and under All
 * filings `notices`, `affidavits`, `retainage` or `timeline`; Do now is the default and never written.
 * `&job=<id>` is the notice the Notices list opens on, `&pile=<pile>` the pile it is narrowed to, and a
 * link that names a job or a pile with no tab lands on Notices, as the old door did. `&records=<job id>`
 * (or `records=1`) opens Records for an owner over the desk, a door the page consumes once.
 *
 * The links in the wild keep working: `/jobs?tab=stages&liendesk=1` with `&kind=`, `&liendeskJob=` and
 * `&liendeskPile=` (the Dashboard's cards, the forecast, the guides, the Materials lines, bookmarks)
 * and `?ownerrecords=<job id>` are mapped by `lienDeskRedirect`, and the Jobs page sends them here
 * with `replace`.
 */
import { LIEN_DESK_PILES, type LienDeskPile } from '../jobs/lienDesk'

export const LIEN_DESK_PATH = '/lien-desk'

/** The desk's views and kinds as the desk names them: Do now, Deadlines, and the four lists under All filings. */
export type LienDeskKind = 'next' | 'calendar' | 'notice' | 'affidavit' | 'retainage' | 'timeline'

/** The view the desk opens on when the address names none. */
export const LIEN_DESK_DEFAULT_KIND: LienDeskKind = 'next'

const KIND_BY_WORD: Record<string, LienDeskKind> = {
  now: 'next',
  deadlines: 'calendar',
  notices: 'notice',
  affidavits: 'affidavit',
  retainage: 'retainage',
  timeline: 'timeline',
}

const WORD_BY_KIND: Record<LienDeskKind, string> = {
  next: 'now',
  calendar: 'deadlines',
  notice: 'notices',
  affidavit: 'affidavits',
  retainage: 'retainage',
  timeline: 'timeline',
}

export type LienDeskAddress = {
  /** The view; null when the address names none (Do now applies). */
  kind: LienDeskKind | null
  /** The notice to open on; null for the list's own pick. */
  job: string | null
  /** The Notices pile the list is narrowed to; null for every pile. */
  pile: LienDeskPile | null
  /** Records for an owner, opened over the desk: the job whose property to open on, or null for the window alone; absent when not asked. */
  records: { jobId: string | null } | null
}

/** The view an address word names, or null for a word the desk does not know. */
export function lienDeskKindFromWord(word: string | null | undefined): LienDeskKind | null {
  if (!word) return null
  return KIND_BY_WORD[word] ?? null
}

/** Every pile the Notices list can be narrowed to, by its key. */
const PILE_KEYS: ReadonlyArray<LienDeskPile> = LIEN_DESK_PILES.map((p) => p.key)

function pileFromWord(word: string | null | undefined): LienDeskPile | null {
  if (!word) return null
  return PILE_KEYS.find((p) => p === word) ?? null
}

/** The address of a view, a notice and a pile: `/lien-desk?tab=notices&job=…&pile=…`; the default view is never written. */
export function lienDeskHref(parts: { kind?: LienDeskKind | null; job?: string | null; pile?: LienDeskPile | null; records?: { jobId: string | null } | null } = {}): string {
  const q = new URLSearchParams()
  if (parts.kind && parts.kind !== LIEN_DESK_DEFAULT_KIND) q.set('tab', WORD_BY_KIND[parts.kind])
  if (parts.job) q.set('job', parts.job)
  if (parts.pile) q.set('pile', parts.pile)
  if (parts.records) q.set('records', parts.records.jobId ?? '1')
  const s = q.toString()
  return s ? `${LIEN_DESK_PATH}?${s}` : LIEN_DESK_PATH
}

/** What the address asks the desk to show. An unknown tab word reads as no tab; a job or a pile with no tab reads as Notices. */
export function lienDeskFromSearch(search: URLSearchParams): LienDeskAddress {
  const job = (search.get('job') ?? '').trim() || null
  const pile = pileFromWord(search.get('pile'))
  const word = search.get('tab')
  const kind = word ? lienDeskKindFromWord(word) : job || pile ? 'notice' : null
  const records = search.get('records')
  return {
    kind,
    job,
    pile,
    records: records == null || records === '' ? null : { jobId: records === '1' || records === 'true' ? null : records },
  }
}

/**
 * The old links, mapped: `?liendesk=1` opens the desk on Do now; `&kind=notice|affidavit|retainage|timeline`
 * its list; `&liendeskJob=<id>` the job's notice and `&liendeskPile=<pile>` the pile, each landing on Notices
 * when no kind is named; `?ownerrecords=<job id>` the desk with Records for an owner open on that job's
 * property. Null when the search carries neither door, so the caller leaves the page alone.
 */
export function lienDeskRedirect(search: URLSearchParams): string | null {
  const records = (search.get('ownerrecords') ?? '').trim()
  if (records) return lienDeskHref({ records: { jobId: records } })
  const flag = search.get('liendesk')
  if (flag !== '1' && flag !== 'true') return null
  const job = (search.get('liendeskJob') ?? '').trim() || null
  const pile = pileFromWord(search.get('liendeskPile'))
  const kindWord = search.get('kind')
  const kind: LienDeskKind | null =
    kindWord === 'affidavit' || kindWord === 'retainage' || kindWord === 'timeline' || kindWord === 'notice' ? kindWord : job || pile ? 'notice' : null
  return lienDeskHref({ kind, job, pile })
}
