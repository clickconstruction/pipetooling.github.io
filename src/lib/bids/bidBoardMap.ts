/**
 * Bid Board "Bids on a map" card (v2.3162). Pure: the board's filtered rows
 * in, pins / legend / unmapped list out. `useAddressGeocodeCoords` resolves
 * the coordinates and `BidBoardMapCard` renders.
 *
 * The map is a second view of the list the board already shows — the same
 * search, trade pill and archived-unsent rule — never a filter on it. Pins are
 * colored by board section (the office map's bid colors, `BID_STAGE_MARKER_COLOR`);
 * an unsent bid due within the board's "soon" window gets a ring in the due
 * chip's tone, red once it is past due. Distance is the bid's own
 * `distance_from_office` (filled on save since v2.3142) — nothing is measured here.
 */
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { getSubmissionSectionKey, type SubmissionSectionKey } from './submissionSections'
import { bidBoardDueCellParts } from './bidBoardDateCells'
import { BID_STAGE_MARKER_COLOR } from '../map/builderBidMapFocus'
import { normalizeAddressForGeocodeKey } from '../map/normalizeAddressForGeocode'
import { formatBidLedgerNumberLabel, resolveBidLedgerPrefix, type LedgerPrefixMap } from '../ledgerDisplayPrefixes'
import { formatBidValueShort } from './bidFormatting'

/** Legend order — the board's own section order. */
export const BID_BOARD_MAP_SECTIONS: readonly SubmissionSectionKey[] = ['unsent', 'pending', 'won', 'startedOrComplete', 'lost']

export const BID_BOARD_MAP_SECTION_LABEL: Record<SubmissionSectionKey, string> = {
  unsent: 'Unsent',
  pending: 'Pending',
  won: 'Won',
  startedOrComplete: 'Started',
  lost: 'Lost',
}

/** Pin colors — the office map's bid-section colors, so a pin means the same thing everywhere. */
export const BID_BOARD_MAP_SECTION_COLOR: Record<SubmissionSectionKey, string> = BID_STAGE_MARKER_COLOR

export type BidBoardMapSectionVisibility = Record<SubmissionSectionKey, boolean>

/** Lost starts off — the working set is what the estimator is looking at; Lost is one tap away. */
export const BID_BOARD_MAP_DEFAULT_SECTIONS: BidBoardMapSectionVisibility = {
  unsent: true,
  pending: true,
  won: true,
  startedOrComplete: true,
  lost: false,
}

/** Distance rings drawn around the office anchor, in miles. */
export const BID_BOARD_MAP_RING_MILES: readonly number[] = [25, 50]

export type BidBoardMapDueTone = 'overdue' | 'soon'

/** Ring colors for a due bid — the due chip's own red / amber. */
export const BID_BOARD_MAP_DUE_RING_COLOR: Record<BidBoardMapDueTone, string> = {
  overdue: '#dc2626',
  soon: '#d97706',
}

/** One bid the card wants on the map, before coordinates are known. */
export type BidBoardMapBid = {
  id: string
  /** `B385 · Galloway Park Concession Stand` — number first, like the board rows. */
  label: string
  numberLabel: string
  projectName: string
  /** Customer or GC/Builder name, whichever the row shows. */
  gcName: string | null
  address: string
  addressKey: string
  section: SubmissionSectionKey
  dueTone: BidBoardMapDueTone | null
  /** `Thu 9/10 (-2)` — the due chip's text; null without a due date. */
  dueLabel: string | null
  estimatorName: string | null
  distanceMiles: number | null
  /** `$44k` from `bid_value`; null when the value is not set. */
  valueLabel: string | null
  /** The board row this bid came from — the openers take it back. */
  row: BidWithBuilder
}

export type BidBoardMapPin = BidBoardMapBid & { lat: number; lng: number }

function estimatorNameOf(est: BidWithBuilder['estimator']): string | null {
  const e = est == null ? null : Array.isArray(est) ? (est[0] ?? null) : est
  if (!e) return null
  return (e.name ?? '').trim() || e.email || null
}

/** `bids.distance_from_office` is free text ("96", "96.4 mi", "1,158.5") — the leading number, or null. */
export function parseBidDistanceMiles(raw: string | null | undefined): number | null {
  if (raw == null) return null
  const m = /-?\d+(\.\d+)?/.exec(raw.replace(/,/g, ''))
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * The board's filtered rows → the card's bid list, bucketed by the same rule
 * the sections use (`getSubmissionSectionKey`, archived-unsent dropped). A bid
 * with no usable address goes to `noAddress` — nothing to put on a map, but
 * the footer names it so someone can add one.
 */
export function bidBoardMapBids(
  bids: readonly BidWithBuilder[],
  prefixMap: LedgerPrefixMap,
  today: Date = new Date(),
): { bids: BidBoardMapBid[]; noAddress: BidBoardMapBid[] } {
  const out: BidBoardMapBid[] = []
  const noAddress: BidBoardMapBid[] = []
  for (const bid of bids) {
    const section = getSubmissionSectionKey(bid)
    if (!section) continue
    if (section === 'unsent' && bid.working_board_archived_at) continue
    const address = (bid.address ?? '').trim()
    const addressKey = normalizeAddressForGeocodeKey(address)
    const due = bidBoardDueCellParts(bid.bid_due_date, today, bid.outcome, bid.bid_date_sent)
    const numberLabel = formatBidLedgerNumberLabel(resolveBidLedgerPrefix(bid.service_type_id, prefixMap), bid.bid_number)
    const projectName = (bid.project_name ?? '').trim() || '—'
    const m: BidBoardMapBid = {
      id: bid.id,
      label: `${numberLabel} · ${projectName}`,
      numberLabel,
      projectName,
      gcName: (bid.customers?.name ?? bid.bids_gc_builders?.name ?? '').trim() || null,
      address,
      addressKey,
      section,
      dueTone: due && (due.urgency === 'overdue' || due.urgency === 'soon') ? due.urgency : null,
      dueLabel: due ? `${due.dateLabel} ${due.deltaLabel}` : null,
      estimatorName: estimatorNameOf(bid.estimator),
      distanceMiles: parseBidDistanceMiles(bid.distance_from_office),
      valueLabel: bid.bid_value != null ? `$${formatBidValueShort(bid.bid_value)}` : null,
      row: bid,
    }
    if (addressKey.length < 3) noAddress.push(m)
    else out.push(m)
  }
  return { bids: out, noAddress }
}

/** Attach cached / freshly geocoded coordinates; a bid whose key is missing stays unmapped. */
export function resolveBidBoardMapPins(
  bids: readonly BidBoardMapBid[],
  coords: ReadonlyMap<string, { lat: number; lng: number }>,
): { pins: BidBoardMapPin[]; unmapped: BidBoardMapBid[] } {
  const pins: BidBoardMapPin[] = []
  const unmapped: BidBoardMapBid[] = []
  for (const b of bids) {
    const c = coords.get(b.addressKey)
    if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) pins.push({ ...b, lat: c.lat, lng: c.lng })
    else unmapped.push(b)
  }
  return { pins, unmapped }
}

/** Legend chips: every section in board order with its pinned count (zero included — the chip is a toggle). */
export function bidBoardMapLegend(pins: readonly BidBoardMapPin[]): { section: SubmissionSectionKey; count: number }[] {
  const counts: Record<SubmissionSectionKey, number> = { unsent: 0, pending: 0, won: 0, startedOrComplete: 0, lost: 0 }
  for (const p of pins) counts[p.section] += 1
  return BID_BOARD_MAP_SECTIONS.map((section) => ({ section, count: counts[section] }))
}

/** The pins the canvas draws — sections toggled off in the legend are dropped. */
export function bidBoardMapVisiblePins(pins: readonly BidBoardMapPin[], show: BidBoardMapSectionVisibility): BidBoardMapPin[] {
  return pins.filter((p) => show[p.section])
}

/**
 * The initial fit keeps the map on the office's day-trip region; farther pins still draw, Fit all
 * reaches them. 150 mi keeps Houston in and Dallas / the Valley out — on a wide, short card a 300 mi
 * box already framed the whole Gulf coast.
 */
export const BID_BOARD_MAP_HOME_FIT_MILES = 150

/** Great-circle distance in miles (haversine) — for the home fit only, never for a bid's distance. */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * The points the map fits on load: the pins within `maxMiles` of the anchor (plus the anchor), so one
 * bid in another state does not zoom the map out to the whole country. With no anchor, or when nothing
 * is within range, every pin is fitted. `Fit all` bypasses this and fits every pin.
 */
export function bidBoardMapHomeFitPoints(
  pins: readonly { lat: number; lng: number }[],
  anchor: { lat: number; lng: number } | null,
  maxMiles: number = BID_BOARD_MAP_HOME_FIT_MILES,
): { lat: number; lng: number }[] {
  if (!anchor) return pins.map((p) => ({ lat: p.lat, lng: p.lng }))
  const near = pins.filter((p) => milesBetween(anchor, p) <= maxMiles).map((p) => ({ lat: p.lat, lng: p.lng }))
  if (near.length === 0) return [...pins.map((p) => ({ lat: p.lat, lng: p.lng })), { lat: anchor.lat, lng: anchor.lng }]
  return [...near, { lat: anchor.lat, lng: anchor.lng }]
}

/** `96 mi from the office`; null when the bid has no distance yet. */
export function bidBoardMapDistanceLine(bid: Pick<BidBoardMapBid, 'distanceMiles'>): string | null {
  if (bid.distanceMiles == null) return null
  const mi = bid.distanceMiles < 10 ? Math.round(bid.distanceMiles * 10) / 10 : Math.round(bid.distanceMiles)
  return `${mi} mi from the office`
}

/** The line under the map: `1 bid has no map location yet` / `4 bids have no map location yet`. */
export function bidBoardMapUnmappedLine(count: number): string | null {
  if (count <= 0) return null
  return count === 1 ? '1 bid has no map location yet' : `${count} bids have no map location yet`
}

/** Google Maps directions for a bid address (the same link shape the job rows use). */
export function bidBoardMapDirectionsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`
}

// ── Per-device "Hide map" preference ────────────────────────────────────────

const HIDDEN_KEY = 'pipetooling_bid_board_map_hidden'

export function readBidBoardMapHidden(storage: Pick<Storage, 'getItem'> | null = safeStorage()): boolean {
  try {
    return storage?.getItem(HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}

export function writeBidBoardMapHidden(hidden: boolean, storage: Pick<Storage, 'setItem' | 'removeItem'> | null = safeStorage()): void {
  try {
    if (!storage) return
    if (hidden) storage.setItem(HIDDEN_KEY, '1')
    else storage.removeItem(HIDDEN_KEY)
  } catch {
    /* private mode / blocked storage — the map just stays visible next load */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
