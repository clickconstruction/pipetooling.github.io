/**
 * The History composer's *About* picker (v2.6205, the owner: *I don't like this dropdown*). The native
 * select listed the site's pieces in ledger order with bare labels and no search; a site of thirty jobs
 * made the writer scan it every time. This kernel orders the pieces (the site first, then the pieces
 * written about last, then jobs and bids newest first, then the customer), words each with its stage or
 * status, and gives each a search string of its number and name. Pure; `DevelopmentHistoryTools.tsx`
 * draws it on `SearchableSelect`.
 */
import type { HistoryAbout, HistoryEntry, HistoryPiece } from './history'
import { bidStatusWord, type MemberBid, type MemberJob } from './overview'
import { labelJobsLedgerStatusForDashboard } from '../jobsLedgerStatusPipeline'

export type AboutGroupKey = 'site' | 'recent' | 'jobs' | 'bids' | 'customer'

export type AboutRow = {
  /** `site`, `job:<id>`, `bid:<id>` or `customer`: the composer's value. */
  key: string
  about: HistoryAbout
  /** The piece's number and name, as the row and the picked trigger read it. */
  label: string
  /** The stage or status word beside the name; null for the site and the customer. */
  meta: string | null
  /** What a typed search matches: the label and, for the site, its name alone. */
  search: string
  group: Exclude<AboutGroupKey, 'recent'>
}

export type AboutGroup = { group: AboutGroupKey; label: string; rows: AboutRow[] }

export const ABOUT_GROUP_LABEL: Record<AboutGroupKey, string> = { site: 'The site', recent: 'Written about last', jobs: 'Jobs', bids: 'Bids', customer: 'The customer' }

/** How many of the pieces written about last the picker lists under the site. */
export const ABOUT_RECENT_MAX = 4

export function aboutKeyOf(about: HistoryAbout): string {
  return about.kind === 'site' ? 'site' : about.kind === 'customer' ? 'customer' : `${about.kind}:${about.id}`
}

/** The amber *JP1098 only* chip's piece as a composer key, or null when no piece is picked. */
export function aboutKeyOfPiece(piece: HistoryPiece | null): string | null {
  if (!piece) return null
  if (piece.jobId) return `job:${piece.jobId}`
  if (piece.bidId) return `bid:${piece.bidId}`
  return null
}

/** The number in a ledger label ("JP957" → 957); a label with none sorts last. */
function ledgerNumber(label: string): number {
  const m = label.match(/(\d+)/)
  return m ? Number(m[1]) : -1
}

export function aboutRows(input: {
  development: { name: string }
  customer: { id: string; name: string } | null
  jobs: MemberJob[]
  bids: MemberBid[]
  jobLabel: (j: MemberJob) => string
  bidLabel: (b: MemberBid) => string
}): AboutRow[] {
  const site: AboutRow = { key: 'site', about: { kind: 'site' }, label: input.development.name, meta: null, search: input.development.name, group: 'site' }
  const jobs = input.jobs
    .map((j): AboutRow => {
      const num = input.jobLabel(j)
      const label = `${num} ${(j.job_name ?? '').trim()}`.trim()
      return { key: `job:${j.id}`, about: { kind: 'job', id: j.id }, label, meta: labelJobsLedgerStatusForDashboard(j.status), search: label, group: 'jobs' }
    })
    .sort((a, b) => ledgerNumber(b.label) - ledgerNumber(a.label) || a.label.localeCompare(b.label))
  const bids = input.bids
    .map((b): AboutRow => {
      const num = input.bidLabel(b)
      const label = `${num} ${(b.project_name ?? '').trim()}`.trim()
      return { key: `bid:${b.id}`, about: { kind: 'bid', id: b.id }, label, meta: bidStatusWord(b), search: label, group: 'bids' }
    })
    .sort((a, b) => ledgerNumber(b.label) - ledgerNumber(a.label) || a.label.localeCompare(b.label))
  const customer: AboutRow[] = input.customer ? [{ key: 'customer', about: { kind: 'customer', id: input.customer.id }, label: input.customer.name, meta: null, search: input.customer.name, group: 'customer' }] : []
  return [site, ...jobs, ...bids, ...customer]
}

/**
 * The picker's groups: the site; the pieces written about last (newest line first, each piece once,
 * never the site, only pieces still in the development); then jobs, bids and the customer. A group
 * with no rows is left out.
 */
export function aboutGroups(rows: AboutRow[], entries: ReadonlyArray<Pick<HistoryEntry, 'about' | 'happenedAt'>>, recentMax = ABOUT_RECENT_MAX): AboutGroup[] {
  const byKey = new Map(rows.map((r) => [r.key, r]))
  const recent: AboutRow[] = []
  const seen = new Set<string>()
  for (const e of [...entries].sort((a, b) => b.happenedAt.localeCompare(a.happenedAt))) {
    if (e.about.kind === 'site') continue
    const key = aboutKeyOf(e.about)
    const row = byKey.get(key)
    if (!row || seen.has(key)) continue
    seen.add(key)
    recent.push(row)
    if (recent.length >= recentMax) break
  }
  const groups: AboutGroup[] = [
    { group: 'site', label: ABOUT_GROUP_LABEL.site, rows: rows.filter((r) => r.group === 'site') },
    { group: 'recent', label: ABOUT_GROUP_LABEL.recent, rows: recent },
    { group: 'jobs', label: ABOUT_GROUP_LABEL.jobs, rows: rows.filter((r) => r.group === 'jobs') },
    { group: 'bids', label: ABOUT_GROUP_LABEL.bids, rows: rows.filter((r) => r.group === 'bids') },
    { group: 'customer', label: ABOUT_GROUP_LABEL.customer, rows: rows.filter((r) => r.group === 'customer') },
  ]
  return groups.filter((g) => g.rows.length > 0)
}

/** Every row once, in picker order, for a lookup by key. */
export function aboutRowsOf(groups: AboutGroup[]): AboutRow[] {
  const seen = new Set<string>()
  const out: AboutRow[] = []
  for (const g of groups) {
    for (const r of g.rows) {
      if (seen.has(r.key)) continue
      seen.add(r.key)
      out.push(r)
    }
  }
  return out
}
