/**
 * Pure shaping for the Supply house Directory pane (to-dos/supply-house-directory,
 * PR 1): joins houses, their reps, their price-request history and their price
 * coverage into rows, applies the search, and reports coverage — how many
 * houses have a rep and how many still need one. The component keeps the
 * queries; everything that decides what a row says lives here.
 */

import { isQuotableVendorKind, vendorKindLabel, vendorKindOf, type VendorKind } from './vendorKind'

export type DirectoryHouse = {
  id: string
  name: string
  address: string | null
  phone: string | null
  website_url: string | null
  notes: string | null
  is_insurer: boolean
  /** Present once the v2.3172 column is pushed; `vendorKindOf` falls back to `is_insurer` before that. */
  vendor_kind?: string | null
}

export type DirectoryRep = {
  id: string
  supply_house_id: string | null
  label: string | null
  name: string | null
  email: string
  is_default: boolean
  created_by: string | null
  created_at: string
}

export type DirectoryRequestStatus = 'draft' | 'sent' | 'quoted' | 'closed'

export type DirectoryRequest = {
  supply_house_id: string | null
  created_at: string
  created_by: string | null
  status: string
  bid_id: string | null
  bid_label: string | null
}

export type DirectoryKind = VendorKind

export type DirectoryRow<H extends DirectoryHouse = DirectoryHouse> = {
  house: H
  kind: DirectoryKind
  /** Default rep first, then alphabetical by label / name. */
  reps: DirectoryRep[]
  defaultRep: DirectoryRep | null
  /** A supply house (not a ledger-only vendor) with no rep on file. */
  needsRep: boolean
  /** Priced parts on file, summed across service types; null when stats never loaded. */
  priceCount: number | null
  /** Newest price request to this house, if any. */
  lastRequest: DirectoryRequest | null
  /** Up to `recentLimit` newest requests, newest first. */
  recentRequests: DirectoryRequest[]
}

export type DirectoryCoverage = {
  /** Supply houses (ledger-only kinds excluded). */
  total: number
  withRep: number
  needRep: number
}

export type BuildDirectoryInput<H extends DirectoryHouse = DirectoryHouse> = {
  houses: H[]
  reps: DirectoryRep[]
  requests: DirectoryRequest[]
  priceCountByHouse: Record<string, number> | null
  search?: string
  /** `supply_house` keeps quotable houses only (the estimator door); `all` is the office view; a specific kind narrows the office view. */
  kinds?: 'all' | DirectoryKind
  recentLimit?: number
}

export function directoryKindOf(house: Pick<DirectoryHouse, 'is_insurer' | 'vendor_kind'>): DirectoryKind {
  return vendorKindOf(house)
}

export function directoryKindLabel(kind: DirectoryKind): string {
  return vendorKindLabel(kind)
}

/** What a request row's status means to the next estimator reading the directory. */
export function requestOutcomeLabel(status: string): string {
  switch (status) {
    case 'quoted':
      return 'answered'
    case 'closed':
      return 'closed'
    case 'draft':
      return 'draft'
    default:
      return 'no reply yet'
  }
}

function repSortKey(rep: DirectoryRep): string {
  return ((rep.label ?? '').trim() || (rep.name ?? '').trim() || rep.email).toLowerCase()
}

function sortReps(reps: DirectoryRep[]): DirectoryRep[] {
  return [...reps].sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
    return repSortKey(a).localeCompare(repSortKey(b))
  })
}

function normalize(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

/** Search matches the house name and address, and each rep's label, name and email. */
export function directorySearchMatches(row: { house: Pick<DirectoryHouse, 'name' | 'address'>; reps: DirectoryRep[] }, query: string): boolean {
  const q = normalize(query)
  if (!q) return true
  if (normalize(row.house.name).includes(q)) return true
  if (normalize(row.house.address).includes(q)) return true
  return row.reps.some((r) => normalize(r.label).includes(q) || normalize(r.name).includes(q) || normalize(r.email).includes(q))
}

/** Group order: houses with a rep, then ledger-only kinds, then houses that need a rep. */
function rowGroup(row: DirectoryRow<DirectoryHouse>): number {
  if (!isQuotableVendorKind(row.kind)) return 1
  return row.needsRep ? 2 : 0
}

export function buildDirectoryRows<H extends DirectoryHouse>(input: BuildDirectoryInput<H>): { rows: DirectoryRow<H>[]; coverage: DirectoryCoverage } {
  const kinds = input.kinds ?? 'all'
  const recentLimit = input.recentLimit ?? 3

  const repsByHouse = new Map<string, DirectoryRep[]>()
  for (const rep of input.reps) {
    if (!rep.supply_house_id) continue
    const list = repsByHouse.get(rep.supply_house_id) ?? []
    list.push(rep)
    repsByHouse.set(rep.supply_house_id, list)
  }

  const requestsByHouse = new Map<string, DirectoryRequest[]>()
  const sortedRequests = [...input.requests].sort((a, b) => b.created_at.localeCompare(a.created_at))
  for (const req of sortedRequests) {
    if (!req.supply_house_id) continue
    const list = requestsByHouse.get(req.supply_house_id) ?? []
    list.push(req)
    requestsByHouse.set(req.supply_house_id, list)
  }

  const coverage: DirectoryCoverage = { total: 0, withRep: 0, needRep: 0 }
  const rows: DirectoryRow<H>[] = []

  for (const house of input.houses) {
    const kind = directoryKindOf(house)
    if (kinds !== 'all' && kind !== kinds) continue
    const reps = sortReps(repsByHouse.get(house.id) ?? [])
    const defaultRep = reps.find((r) => r.is_default) ?? reps[0] ?? null
    const needsRep = isQuotableVendorKind(kind) && reps.length === 0
    const history = requestsByHouse.get(house.id) ?? []
    const row: DirectoryRow<H> = {
      house,
      kind,
      reps,
      defaultRep,
      needsRep,
      priceCount: input.priceCountByHouse ? (input.priceCountByHouse[house.id] ?? 0) : null,
      lastRequest: history[0] ?? null,
      recentRequests: history.slice(0, recentLimit),
    }
    if (isQuotableVendorKind(kind)) {
      coverage.total += 1
      if (needsRep) coverage.needRep += 1
      else coverage.withRep += 1
    }
    if (!directorySearchMatches(row, input.search ?? '')) continue
    rows.push(row)
  }

  rows.sort((a, b) => {
    const ga = rowGroup(a)
    const gb = rowGroup(b)
    if (ga !== gb) return ga - gb
    return a.house.name.localeCompare(b.house.name, undefined, { sensitivity: 'base' })
  })

  return { rows, coverage }
}

/** Sum a stats row set (one row per house × service type) into priced parts per house. */
export function priceCountsByHouse(
  rows: Array<{ supply_house_id: string; price_count: number; service_type_id: string }>,
  serviceTypeId?: string | null,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    if (serviceTypeId && r.service_type_id !== serviceTypeId) continue
    out[r.supply_house_id] = (out[r.supply_house_id] ?? 0) + (r.price_count ?? 0)
  }
  return out
}

/** "12 days ago" style phrase for the directory's request column; `null` when the input is unparsable. */
export function directoryAgoPhrase(iso: string, nowMs: number): string | null {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  const days = Math.floor((nowMs - t) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  const years = Math.floor(days / 365)
  return years === 1 ? 'a year ago' : `${years} years ago`
}
