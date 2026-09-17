/**
 * Price requests on a bid (v2.3175) — the Edit Bid → Files & Links table.
 *
 * One row per request, grouped under its supply house. Two kinds share the
 * table: requests the app sent through Send price requests (a token, an email,
 * sent / viewed / quoted) and requests the estimator sent by hand and recorded
 * here (a house, the day it went out, a link to the request and a link to the
 * quote). Both are `bid_rfqs` rows; `sent_via` tells them apart.
 *
 * Pure: shaping, labels and states only. The component keeps the queries.
 */

import { canNudge, type DeskRfq } from '../rfq/rfqDesk'

export type PriceRequestRow = {
  id: string
  sent_via: 'app' | 'outside'
  supply_house_id: string | null
  /** The house name as sent (app rows) — a fallback when the house row is gone. */
  sent_to: string | null
  sent_email: string | null
  status: string
  token: string | null
  created_at: string
  created_by: string | null
  viewed_at: string | null
  needed_by: string | null
  requested_on: string | null
  request_url: string | null
  quote_url: string | null
  /** v2.3245: the desk's nudge throttle reads these. */
  last_reminded_at: string | null
  reminder_count: number
}

export type PriceRequestQuote = {
  id: string
  rfq_id: string | null
  supply_house_id: string | null
  received_at: string
  valid_until: string | null
  line_count: number
}

export type PriceRequestHouse = { id: string; name: string; defaultRep?: { label: string | null; name: string | null; email: string; phone?: string | null } | null }

export type NeededByState = { kind: 'none' } | { kind: 'met'; ymd: string } | { kind: 'waiting'; ymd: string } | { kind: 'late'; ymd: string }

export type PriceRequestQuoteCell =
  | { kind: 'none' }
  /** A quote plugged in on Pricing, linked to this request. */
  | { kind: 'plugged'; quoteId: string; lineCount: number; receivedAt: string; validUntil: string | null }
  /** A link pasted on this row. */
  | { kind: 'link'; url: string }

export type PriceRequestShaped = {
  row: PriceRequestRow
  /** YYYY-MM-DD the request went out: `requested_on` for outside rows, `created_at`'s day otherwise. */
  requestedYmd: string
  neededBy: NeededByState
  /** The vendor's quote page for app rows (null when there is no token). */
  vendorPageUrl: string | null
  quote: PriceRequestQuoteCell
  /** Only rows recorded by hand can be edited or removed here. */
  editable: boolean
}

export type PriceRequestGroup = {
  houseId: string | null
  houseName: string
  house: PriceRequestHouse | null
  requests: PriceRequestShaped[]
}

export type PriceRequestSummary = { houses: number; requests: number; quotesIn: number; late: number }

/**
 * The Status column (v2.3572, PR 3 of the price-requests loop): one chip per row. `quoted`
 * when the row has a plugged quote or a quote link; `late` when its needed-by is past with
 * nothing in, with the days; `waiting` otherwise — including a row with no needed-by at all,
 * so a hand-sent row never reads blank.
 */
export type RequestStatus = { kind: 'waiting' } | { kind: 'late'; days: number } | { kind: 'quoted' } | { kind: 'closed' }

function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const [fy, fm, fd] = fromYmd.split('-').map(Number)
  const [ty, tm, td] = toYmd.split('-').map(Number)
  return Math.round((Date.UTC(ty!, (tm ?? 1) - 1, td ?? 1) - Date.UTC(fy!, (fm ?? 1) - 1, fd ?? 1)) / 86_400_000)
}

export function requestStatusFor(r: Pick<PriceRequestShaped, 'quote' | 'neededBy'> & { row: Pick<PriceRequestRow, 'status'> }, todayYmd: string): RequestStatus {
  if (r.quote.kind !== 'none') return { kind: 'quoted' }
  // A closed request with nothing in is over, not late — the desk closed it or the vendor did.
  if (r.row.status === 'closed') return { kind: 'closed' }
  if (r.neededBy.kind === 'late') return { kind: 'late', days: Math.max(1, daysBetweenYmd(r.neededBy.ymd, todayYmd)) }
  return { kind: 'waiting' }
}

export function requestStatusLabel(st: RequestStatus): string {
  if (st.kind === 'quoted') return 'quote in'
  if (st.kind === 'closed') return 'closed'
  if (st.kind === 'late') return `late ${st.days}d`
  return 'waiting'
}

export const VENDOR_QUOTE_PAGE_BASE = 'https://clicktooling.com/q/'

export function vendorQuotePageUrl(token: string | null | undefined): string | null {
  const t = (token ?? '').trim()
  return t ? `${VENDOR_QUOTE_PAGE_BASE}${t}` : null
}

/** YYYY-MM-DD of an ISO timestamp in the company calendar; the caller passes the converter. */
export function requestedYmdOf(row: Pick<PriceRequestRow, 'sent_via' | 'requested_on' | 'created_at'>, isoToYmd: (iso: string) => string): string {
  if (row.sent_via === 'outside' && row.requested_on) return row.requested_on.slice(0, 10)
  return isoToYmd(row.created_at)
}

export function neededByState(row: Pick<PriceRequestRow, 'needed_by'>, quoteIn: boolean, todayYmd: string): NeededByState {
  const ymd = (row.needed_by ?? '').slice(0, 10)
  if (!ymd) return { kind: 'none' }
  if (quoteIn) return { kind: 'met', ymd }
  return ymd < todayYmd ? { kind: 'late', ymd } : { kind: 'waiting', ymd }
}

export function quoteCellFor(row: Pick<PriceRequestRow, 'id' | 'quote_url'>, quotes: readonly PriceRequestQuote[]): PriceRequestQuoteCell {
  const plugged = quotes.filter((q) => q.rfq_id === row.id).sort((a, b) => b.received_at.localeCompare(a.received_at))[0]
  if (plugged) return { kind: 'plugged', quoteId: plugged.id, lineCount: plugged.line_count, receivedAt: plugged.received_at, validUntil: plugged.valid_until }
  const url = (row.quote_url ?? '').trim()
  if (url) return { kind: 'link', url }
  return { kind: 'none' }
}

export function shapePriceRequest(
  row: PriceRequestRow,
  quotes: readonly PriceRequestQuote[],
  todayYmd: string,
  isoToYmd: (iso: string) => string,
): PriceRequestShaped {
  const quote = quoteCellFor(row, quotes)
  return {
    row,
    requestedYmd: requestedYmdOf(row, isoToYmd),
    neededBy: neededByState(row, quote.kind !== 'none', todayYmd),
    vendorPageUrl: row.sent_via === 'app' ? vendorQuotePageUrl(row.token) : null,
    quote,
    editable: row.sent_via === 'outside',
  }
}

/**
 * Group by house, houses alphabetical, requests newest first within a house.
 * Draft app rows (never sent) are left out — the desk hides them the same way.
 * Rows whose house row is missing group under the name the request carried.
 */
export function groupPriceRequests(
  rows: readonly PriceRequestRow[],
  quotes: readonly PriceRequestQuote[],
  houses: readonly PriceRequestHouse[],
  todayYmd: string,
  isoToYmd: (iso: string) => string,
): { groups: PriceRequestGroup[]; summary: PriceRequestSummary } {
  const houseById = new Map(houses.map((h) => [h.id, h]))
  const groups = new Map<string, PriceRequestGroup>()
  let quotesIn = 0
  let requests = 0
  let late = 0
  for (const row of rows) {
    if (row.sent_via === 'app' && row.status === 'draft') continue
    const shaped = shapePriceRequest(row, quotes, todayYmd, isoToYmd)
    const house = row.supply_house_id ? (houseById.get(row.supply_house_id) ?? null) : null
    const key = row.supply_house_id ?? `name:${(row.sent_to ?? '').trim().toLowerCase() || 'unknown'}`
    const g = groups.get(key) ?? { houseId: row.supply_house_id, houseName: house?.name ?? (row.sent_to ?? '').trim() ?? 'Unknown house', house, requests: [] }
    if (!g.houseName) g.houseName = 'Unknown house'
    g.requests.push(shaped)
    groups.set(key, g)
    requests += 1
    if (shaped.quote.kind !== 'none') quotesIn += 1
    else if (requestStatusFor(shaped, todayYmd).kind === 'late') late += 1
  }
  const out = [...groups.values()]
  for (const g of out) g.requests.sort((a, b) => b.requestedYmd.localeCompare(a.requestedYmd) || b.row.created_at.localeCompare(a.row.created_at))
  out.sort((a, b) => a.houseName.localeCompare(b.houseName, undefined, { sensitivity: 'base' }))
  return { groups: out, summary: { houses: out.length, requests, quotesIn, late } }
}

export function priceRequestSummaryLine(s: PriceRequestSummary): string {
  if (s.requests === 0) return 'no price requests yet'
  const parts = [`${s.houses} ${s.houses === 1 ? 'house' : 'houses'}`, `${s.requests} ${s.requests === 1 ? 'request' : 'requests'}`]
  parts.push(s.quotesIn === 0 ? 'no quotes in' : `${s.quotesIn} ${s.quotesIn === 1 ? 'quote' : 'quotes'} in`)
  if (s.late > 0) parts.push(`${s.late} late`)
  return parts.join(' · ')
}

/** Short label for a pasted link: the host, or "Drive" / "Sheets" / "Docs" when Google. */
export function linkHostLabel(url: string): string {
  try {
    const u = new URL(url)
    const h = u.hostname.replace(/^www\./, '')
    if (h === 'drive.google.com') return 'Drive'
    if (h === 'docs.google.com') return u.pathname.startsWith('/spreadsheets') ? 'Sheets' : 'Docs'
    if (h.endsWith('dropbox.com')) return 'Dropbox'
    return h
  } catch {
    return 'link'
  }
}

/** Accepts http(s) only; trims; empty → null. Returns `{ error }` for anything else. */
/**
 * The text a pasted link shows as (v2.3195): the address itself, without the
 * scheme or "www.", cut to `max` characters with an ellipsis — so the cell reads
 * as the link it is ("drive.google.com/file/d/1EcQ…") and the full address is the
 * link's own href / hover.
 */
export function linkDisplayText(url: string, max = 44): string {
  const bare = url.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
  if (bare.length <= max) return bare
  return `${bare.slice(0, Math.max(1, max - 1))}…`
}

export function normalizePastedLink(raw: string): { url: string | null; error?: string } {
  const t = raw.trim()
  if (!t) return { url: null }
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(t)?.[1]?.toLowerCase()
  if (scheme && scheme !== 'http' && scheme !== 'https') return { url: null, error: 'Paste a web link (https://…).' }
  try {
    const u = new URL(scheme ? t : `https://${t}`)
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return { url: null, error: 'That does not look like a link.' }
    return { url: u.toString() }
  } catch {
    return { url: null, error: 'That does not look like a link.' }
  }
}

export type OutsideRequestDraft = { supplyHouseId: string | null; requestedOn: string; requestUrl: string; quoteUrl: string }

/** What must be true before an outside request saves. */
export function validateOutsideRequest(d: OutsideRequestDraft): { ok: true; requestUrl: string | null; quoteUrl: string | null } | { ok: false; error: string } {
  if (!d.supplyHouseId) return { ok: false, error: 'Pick a supply house.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.requestedOn)) return { ok: false, error: 'When was it requested?' }
  const r = normalizePastedLink(d.requestUrl)
  if (r.error) return { ok: false, error: `Quote link: ${r.error}` }
  const q = normalizePastedLink(d.quoteUrl)
  if (q.error) return { ok: false, error: `Quote link: ${q.error}` }
  return { ok: true, requestUrl: r.url, quoteUrl: q.url }
}

/**
 * Several hand-sent requests recorded in one pass (v2.3495) — three houses
 * asked on the same bid are one trip through the form, not three. Each house
 * carries its own day and its own quote link, because a batch mailed on
 * Friday can still come back one quote at a time.
 *
 * The link lands in `request_url`, exactly where the single-row editor's
 * "Quote link" box has put it since v2.3477 — the two paths must agree, or
 * editing a row would move its link between columns.
 */
export type OutsideRequestBatchEntry = { supplyHouseId: string; requestedOn: string; requestUrl: string }

export type OutsideRequestBatchDraft = { entries: readonly OutsideRequestBatchEntry[] }

/** A row ready to insert; the caller adds bid_id, sent_via, status and scope. */
export type PlannedOutsideRequest = { supplyHouseId: string; requestedOn: string; requestUrl: string | null }

export type PlanOutsideRequestsResult =
  | { ok: true; rows: PlannedOutsideRequest[] }
  /** `atHouseId` names the entry at fault so the caller can say which house. */
  | { ok: false; error: string; atHouseId?: string }

/**
 * Validate a batch of hand-sent requests. Entry order is preserved; blank
 * links become null. The messages match the single-row editor's word for
 * word, so the surface never speaks two dialects.
 */
export function planOutsideRequests(d: OutsideRequestBatchDraft): PlanOutsideRequestsResult {
  if (d.entries.length === 0) return { ok: false, error: 'Pick a supply house.' }
  const seen = new Set<string>()
  const rows: PlannedOutsideRequest[] = []
  for (const e of d.entries) {
    if (!e.supplyHouseId) return { ok: false, error: 'Pick a supply house.' }
    if (seen.has(e.supplyHouseId)) return { ok: false, error: 'That house is already in this batch.', atHouseId: e.supplyHouseId }
    seen.add(e.supplyHouseId)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.requestedOn)) return { ok: false, error: 'When was it requested?', atHouseId: e.supplyHouseId }
    const r = normalizePastedLink(e.requestUrl)
    if (r.error) return { ok: false, error: `Quote link: ${r.error}`, atHouseId: e.supplyHouseId }
    rows.push({ supplyHouseId: e.supplyHouseId, requestedOn: e.requestedOn, requestUrl: r.url })
  }
  return { ok: true, rows }
}

/**
 * PR 2 of the price-requests loop (v2.3526): each house card in the add block
 * carries a HOW. `app` — the app emails the house's rep through send-rfq-email
 * (the row, the token and the email are the function's); `outside` — the
 * estimator sends it themselves and the app records the row (today's path).
 */
export type AskHouseHow = 'app' | 'outside'

export type AskHouseEntry = OutsideRequestBatchEntry & {
  how: AskHouseHow
  /** The address the app emails (the default rep's, or one typed in). Ignored for `outside`. */
  email: string
}

const ASK_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type PlannedAppRequest = { supplyHouseId: string; email: string }

export type PlanAskHousesResult =
  | { ok: true; outside: PlannedOutsideRequest[]; app: PlannedAppRequest[] }
  | { ok: false; error: string; atHouseId?: string }

/**
 * Validate the whole block: the hand-sent cards exactly as `planOutsideRequests`
 * does, the app-sent cards for a usable address. Entry order is preserved on
 * each side. A house with no rep and no typed address cannot be app-sent —
 * the message says so and names the house.
 */
export function planAskHouses(entries: readonly AskHouseEntry[]): PlanAskHousesResult {
  if (entries.length === 0) return { ok: false, error: 'Pick a supply house.' }
  const outsideEntries = entries.filter((e) => e.how !== 'app')
  const appEntries = entries.filter((e) => e.how === 'app')
  const seen = new Set<string>()
  for (const e of entries) {
    if (!e.supplyHouseId) return { ok: false, error: 'Pick a supply house.' }
    if (seen.has(e.supplyHouseId)) return { ok: false, error: 'That house is already in this batch.', atHouseId: e.supplyHouseId }
    seen.add(e.supplyHouseId)
  }
  const outside: PlanOutsideRequestsResult = outsideEntries.length ? planOutsideRequests({ entries: outsideEntries }) : { ok: true, rows: [] }
  if (!outside.ok) return outside
  const app: PlannedAppRequest[] = []
  for (const e of appEntries) {
    const email = e.email.trim()
    if (!ASK_EMAIL_RE.test(email)) return { ok: false, error: 'No address to email — type one, or switch this house to I’ll send it.', atHouseId: e.supplyHouseId }
    app.push({ supplyHouseId: e.supplyHouseId, email })
  }
  return { ok: true, outside: outside.rows, app }
}

/** The default how for a house: the app emails it when a rep with an address is on file. */
export function defaultAskHow(repEmail: string | null | undefined): AskHouseHow {
  return repEmail && ASK_EMAIL_RE.test(repEmail.trim()) ? 'app' : 'outside'
}

/** The Ask button's label: what the press will do. */
export function askButtonLabel(entries: readonly Pick<AskHouseEntry, 'how'>[]): string {
  const n = entries.length
  const app = entries.filter((e) => e.how === 'app').length
  if (n === 0) return 'Add request'
  if (app === 0) return n > 1 ? `Add ${n} requests` : 'Add request'
  if (app === n) return n > 1 ? `Ask ${n} houses` : 'Ask by email'
  return `Ask ${n} houses · ${app} by email`
}

export type AskedHouse = { count: number; lastYmd: string }

/**
 * Houses this bid has already asked, from the groups the table has built
 * anyway — so the picker can say "asked Sep 2" instead of letting someone
 * ask Ferguson twice without noticing. House-less rows are skipped.
 */
export function askedHouseSummary(groups: readonly PriceRequestGroup[]): Map<string, AskedHouse> {
  const out = new Map<string, AskedHouse>()
  for (const g of groups) {
    if (!g.houseId || g.requests.length === 0) continue
    let lastYmd = g.requests[0]!.requestedYmd
    for (const r of g.requests) if (r.requestedYmd > lastYmd) lastYmd = r.requestedYmd
    out.set(g.houseId, { count: g.requests.length, lastYmd })
  }
  return out
}

/**
 * Whether this row can be nudged right now (v2.3245) — the desk's own rule,
 * so the Edit Bid table and the desk never disagree: app-sent rows with an
 * email, not yet quoted or closed, and not nudged in the last 24h.
 */
export function nudgeStateFor(row: PriceRequestRow, nowMs: number): { ok: boolean; reason?: string } {
  const asDesk: DeskRfq = {
    id: row.id,
    houseName: row.sent_to,
    sentEmail: row.sent_email,
    status: (row.status === 'draft' || row.status === 'quoted' || row.status === 'closed' ? row.status : 'sent') as DeskRfq['status'],
    createdAt: row.created_at,
    viewedAt: row.viewed_at,
    lastRemindedAt: row.last_reminded_at,
    reminderCount: row.reminder_count,
    neededBy: row.needed_by,
    emailLastEvent: null,
    scopeLines: [],
    sentVia: row.sent_via,
  }
  return canNudge(asDesk, nowMs)
}

/** True when the row should show a Nudge button at all (the button may still be disabled with a reason). */
export function showsNudge(row: Pick<PriceRequestRow, 'sent_via' | 'sent_email' | 'status'>): boolean {
  return row.sent_via === 'app' && !!row.sent_email && row.status !== 'quoted' && row.status !== 'closed' && row.status !== 'draft'
}
