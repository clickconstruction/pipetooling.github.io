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

export type PriceRequestHouse = { id: string; name: string; defaultRep?: { label: string | null; name: string | null; email: string } | null }

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

export type PriceRequestSummary = { houses: number; requests: number; quotesIn: number }

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
  }
  const out = [...groups.values()]
  for (const g of out) g.requests.sort((a, b) => b.requestedYmd.localeCompare(a.requestedYmd) || b.row.created_at.localeCompare(a.row.created_at))
  out.sort((a, b) => a.houseName.localeCompare(b.houseName, undefined, { sensitivity: 'base' }))
  return { groups: out, summary: { houses: out.length, requests, quotesIn } }
}

export function priceRequestSummaryLine(s: PriceRequestSummary): string {
  if (s.requests === 0) return 'no price requests yet'
  const parts = [`${s.houses} ${s.houses === 1 ? 'house' : 'houses'}`, `${s.requests} ${s.requests === 1 ? 'request' : 'requests'}`]
  parts.push(s.quotesIn === 0 ? 'no quotes in' : `${s.quotesIn} ${s.quotesIn === 1 ? 'quote' : 'quotes'} in`)
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
  if (r.error) return { ok: false, error: `Request link: ${r.error}` }
  const q = normalizePastedLink(d.quoteUrl)
  if (q.error) return { ok: false, error: `Quote link: ${q.error}` }
  return { ok: true, requestUrl: r.url, quoteUrl: q.url }
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
