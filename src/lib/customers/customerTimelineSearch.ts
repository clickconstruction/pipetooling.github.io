/**
 * Customer timeline doors (punch list #97, PR 3): the Pipeline search's customer chips and the
 * `?customerTimeline=<id>` link that opens a customer's timeline on any page. Pure.
 */

/** Typed into the Pipeline search, a customer's name offers that customer's timeline. */
export const CUSTOMER_TIMELINE_SEARCH_MIN = 3
/** More matches than this and the search is too broad to name one customer: no chips. */
export const CUSTOMER_TIMELINE_SEARCH_MAX = 3
export const CUSTOMER_TIMELINE_PARAM = 'customerTimeline'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type CustomerLike = { id: string; name: string | null; archived_at?: string | null }

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * The customers a search names: every live customer whose name holds the typed words, when there
 * are one to three of them. The exact name first, then names that start with it, then A to Z.
 */
export function customerTimelineSearchMatches<T extends CustomerLike>(query: string, customers: readonly T[]): T[] {
  const q = norm(query)
  if (q.length < CUSTOMER_TIMELINE_SEARCH_MIN) return []
  const hits = customers.filter((c) => !c.archived_at && norm(c.name).includes(q))
  if (hits.length === 0 || hits.length > CUSTOMER_TIMELINE_SEARCH_MAX) return []
  const rank = (c: T) => (norm(c.name) === q ? 0 : norm(c.name).startsWith(q) ? 1 : 2)
  return [...hits].sort((a, b) => rank(a) - rank(b) || norm(a.name).localeCompare(norm(b.name)))
}

/** A link that opens the customer's timeline over `pathname` (the Pipeline by default). */
export function customerTimelineHref(customerId: string, pathname = '/jobs', search = '?tab=stages'): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  params.set(CUSTOMER_TIMELINE_PARAM, customerId)
  return `${pathname}?${params.toString()}`
}

/**
 * The link's customer, read once and stripped: `nextSearch` is the address without it. null when
 * the address has no link; `customerId` null when it holds something that is not a customer id.
 */
export function readCustomerTimelineParam(search: string): { customerId: string | null; nextSearch: string } | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  if (!params.has(CUSTOMER_TIMELINE_PARAM)) return null
  const raw = (params.get(CUSTOMER_TIMELINE_PARAM) ?? '').trim()
  params.delete(CUSTOMER_TIMELINE_PARAM)
  const rest = params.toString()
  return { customerId: UUID_RE.test(raw) ? raw : null, nextSearch: rest ? `?${rest}` : '' }
}
