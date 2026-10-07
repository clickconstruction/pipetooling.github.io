/**
 * Customers on a phone (punch list #30, PR 5a): the page is the search. Pure —
 * what a typed query matches, what *Recent* lists before anything is typed,
 * who owes, and the A–Z pages. The owner's calls (2026-09-27): *Recent* is
 * recently active, and an archived customer is never listed — a search can
 * still find one, marked.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

export interface PhoneCustomer {
  id: string
  name: string
  address: string
  phone: string
  email: string
  archived: boolean
  /** The account person — the search matches it, the row does not print it. */
  masterName: string
  masterEmail: string
  /** The newest of the last job, payment, bid or estimate; '' when none. A payment's `paid_on` is a day, the rest are instants. */
  lastActivityIso: string
  openBalance: number
  openJobs: number
  jobs: number
}

export const PHONE_RECENT_LIMIT = 25
export const PHONE_AZ_PAGE = 50
const OWES_FLOOR = 0.5

const lower = (s: string) => s.toLowerCase()
const digits = (s: string) => s.replace(/\D/g, '')

/** 0 = the name starts with it · 1 = a word in the name starts with it · 2 = the name holds it · 3 = only another field does · -1 = no match. */
function matchRank(c: PhoneCustomer, q: string, qDigits: string): number {
  const name = lower(c.name)
  if (name.startsWith(q)) return 0
  if (name.split(/[\s,.\-/&]+/).some((w) => w.startsWith(q))) return 1
  if (name.includes(q)) return 2
  if (lower(c.address).includes(q) || lower(c.email).includes(q) || lower(c.masterName).includes(q) || lower(c.masterEmail).includes(q)) return 3
  if (lower(c.phone).includes(q)) return 3
  // A phone typed without its punctuation still finds the number: three digits or more.
  if (qDigits.length >= 3 && qDigits.length === q.replace(/[\s().+-]/g, '').length && digits(c.phone).includes(qDigits)) return 3
  return -1
}

/** Everyone the query matches: live customers before archived ones, the best name match first, then A–Z. Empty for an empty query. */
export function matchPhoneCustomers(rows: ReadonlyArray<PhoneCustomer>, query: string): PhoneCustomer[] {
  const q = lower(query.trim())
  if (!q) return []
  const qDigits = digits(q)
  const hits: { c: PhoneCustomer; rank: number }[] = []
  for (const c of rows) {
    const rank = matchRank(c, q, qDigits)
    if (rank >= 0) hits.push({ c, rank })
  }
  hits.sort((a, b) => Number(a.c.archived) - Number(b.c.archived) || a.rank - b.rank || a.c.name.localeCompare(b.c.name, undefined, { sensitivity: 'base' }))
  return hits.map((h) => h.c)
}

/** Recently active, newest first — live customers with any activity on record. */
export function recentPhoneCustomers(rows: ReadonlyArray<PhoneCustomer>, limit = PHONE_RECENT_LIMIT): PhoneCustomer[] {
  return rows
    .filter((c) => !c.archived && c.lastActivityIso)
    .sort((a, b) => b.lastActivityIso.localeCompare(a.lastActivityIso) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .slice(0, limit)
}

/** Live customers who owe, the most owed first. */
export function owingPhoneCustomers(rows: ReadonlyArray<PhoneCustomer>): PhoneCustomer[] {
  return rows.filter((c) => !c.archived && c.openBalance > OWES_FLOOR).sort((a, b) => b.openBalance - a.openBalance || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

/** Every live customer A–Z, the first `shown` of them, and whether there are more. */
export function azPhoneCustomers(rows: ReadonlyArray<PhoneCustomer>, shown: number): { rows: PhoneCustomer[]; total: number; more: boolean } {
  const live = rows.filter((c) => !c.archived).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  return { rows: live.slice(0, Math.max(0, shown)), total: live.length, more: live.length > shown }
}

/** `3 d ago`, `today`, `Mar 2025` — how long since the customer was last active. */
export function phoneActivityWords(iso: string, todayYmd: string): string {
  const day = (iso ?? '').includes('T') ? calendarYmdInAppTzFromIso(iso) : (iso ?? '').slice(0, 10)
  if (!day) return ''
  const ms = Date.parse(`${todayYmd}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)
  if (Number.isNaN(ms)) return ''
  const d = Math.round(ms / 86_400_000)
  if (d <= 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 60) return `${d} d ago`
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[Number(day.slice(5, 7)) - 1] ?? ''} ${day.slice(0, 4)}`.trim()
}

/**
 * The row's two lines under the name (v2.3895): where the customer is, then how they stand — jobs,
 * what is owed (never for a role that cannot see money), when last active. They were one line, and a
 * long address pushed the jobs and the balance off the end of it.
 */
export function phoneCustomerLines(c: PhoneCustomer, opts: { todayYmd: string; moneyHidden: boolean; formatMoney: (n: number) => string }): { place: string; standing: string } {
  const standing: string[] = []
  if (c.archived) standing.push('Archived')
  if (c.openJobs > 0) standing.push(`${c.openJobs} open ${c.openJobs === 1 ? 'job' : 'jobs'}`)
  else if (c.jobs > 0) standing.push(`${c.jobs} ${c.jobs === 1 ? 'job' : 'jobs'}`)
  if (!opts.moneyHidden && c.openBalance > OWES_FLOOR) standing.push(`owes ${opts.formatMoney(c.openBalance)}`)
  const when = phoneActivityWords(c.lastActivityIso, opts.todayYmd)
  if (when) standing.push(`active ${when}`)
  return { place: c.address.trim(), standing: standing.join(' · ') }
}

/** The two lines as one: the address, the jobs, what is owed, when last active. */
export function phoneCustomerSubline(c: PhoneCustomer, opts: { todayYmd: string; moneyHidden: boolean; formatMoney: (n: number) => string }): string {
  const parts: string[] = []
  if (c.archived) parts.push('Archived')
  if (c.address.trim()) parts.push(c.address.trim())
  if (c.openJobs > 0) parts.push(`${c.openJobs} open ${c.openJobs === 1 ? 'job' : 'jobs'}`)
  else if (c.jobs > 0) parts.push(`${c.jobs} ${c.jobs === 1 ? 'job' : 'jobs'}`)
  if (!opts.moneyHidden && c.openBalance > OWES_FLOOR) parts.push(`owes ${opts.formatMoney(c.openBalance)}`)
  const when = phoneActivityWords(c.lastActivityIso, opts.todayYmd)
  if (when) parts.push(`active ${when}`)
  return parts.join(' · ')
}

/**
 * The PostgREST `or` filter for the job half of the search, or null when the
 * query is too short to be worth a read. The characters that would break the
 * filter's grammar are dropped, not escaped — a job search has no use for them.
 */
export function phoneJobSearchFilter(query: string): string | null {
  const q = query.trim().replace(/[,()%*\\"']/g, ' ').replace(/\s+/g, ' ').trim()
  if (q.length < 2) return null
  const like = `%${q}%`
  return ['job_name', 'job_address', 'hcp_number', 'click_number'].map((col) => `${col}.ilike.${like}`).join(',')
}
