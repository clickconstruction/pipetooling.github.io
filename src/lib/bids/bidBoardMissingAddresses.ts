/**
 * "N bids have no map location yet" → a place to fix them (v2.3205).
 *
 * The map card's unmapped line becomes a door: a modal that lists every bid
 * the map can't place — the ones with no address at all, and the ones whose
 * address the geocoder couldn't find — each with its current address ready to
 * edit. Rows the person fixes stay in the list for the session so they can
 * watch the pin land ("Placed ✓") instead of the row simply vanishing.
 *
 * Pure module — no React, no Supabase.
 */
import type { BidBoardMapBid, BidBoardMapPin } from './bidBoardMap'

export type MissingAddressReason = 'no-address' | 'unplaced' | 'placed'

export interface MissingAddressRow {
  bid: BidBoardMapBid
  /** Why the row is here — or 'placed' once a fix landed and the map found it. */
  reason: MissingAddressReason
  /** For a bid that already has an address: is the geocoder still looking? */
  checking: boolean
  /** The customer's / GC's address on file, when it differs from the bid's — a one-tap suggestion, never applied on its own. */
  customerAddress: string | null
}

export function customerAddressHint(bid: BidBoardMapBid): string | null {
  const row = bid.row as { customers?: { address?: string | null } | null; bids_gc_builders?: { address?: string | null } | null }
  const a = (row.customers?.address ?? row.bids_gc_builders?.address ?? '').trim()
  if (!a || a.length < 3) return null
  return a === bid.address.trim() ? null : a
}

/**
 * The modal's rows: no-address bids first (they need typing), then the ones
 * the map couldn't place, then bids fixed this session that are now placed.
 * `keepIds` are the bids the person touched — they stay listed even after the
 * board reload moves them out of the missing sets.
 */
export function composeMissingAddressRows(input: {
  noAddress: readonly BidBoardMapBid[]
  unmapped: readonly BidBoardMapBid[]
  pins: readonly BidBoardMapPin[]
  resolving: boolean
  keepIds: ReadonlySet<string>
}): MissingAddressRow[] {
  const rows: MissingAddressRow[] = []
  const seen = new Set<string>()
  for (const b of input.noAddress) {
    seen.add(b.id)
    rows.push({ bid: b, reason: 'no-address', checking: false, customerAddress: customerAddressHint(b) })
  }
  for (const b of input.unmapped) {
    if (seen.has(b.id)) continue
    seen.add(b.id)
    rows.push({ bid: b, reason: 'unplaced', checking: input.resolving, customerAddress: customerAddressHint(b) })
  }
  for (const p of input.pins) {
    if (!input.keepIds.has(p.id) || seen.has(p.id)) continue
    seen.add(p.id)
    rows.push({ bid: p, reason: 'placed', checking: false, customerAddress: null })
  }
  return rows
}

/** "3 without an address · 5 the map couldn't place" (a placed count only after fixes). */
export function missingAddressSummary(rows: readonly MissingAddressRow[]): string {
  const n = (r: MissingAddressReason) => rows.filter((x) => x.reason === r).length
  const parts: string[] = []
  const none = n('no-address')
  const un = n('unplaced')
  const placed = n('placed')
  if (none) parts.push(`${none} without an address`)
  if (un) parts.push(`${un} the map couldn’t place`)
  if (placed) parts.push(`${placed} placed just now`)
  return parts.join(' · ') || 'Every bid on the board is on the map'
}

/** A draft is worth saving when it's non-empty and actually changed. */
export function addressDraftReady(draft: string, current: string): boolean {
  const d = draft.trim()
  return d.length >= 3 && d !== current.trim()
}

/** Row status line under the input. */
export function missingAddressStatus(row: MissingAddressRow): { text: string; tone: 'muted' | 'warn' | 'ok' } {
  switch (row.reason) {
    case 'no-address':
      return { text: 'No address on the bid — type the site address and save.', tone: 'warn' }
    case 'unplaced':
      return row.checking
        ? { text: 'Looking for this address on the map…', tone: 'muted' }
        : { text: 'The map couldn’t find this address. Check it on Google Maps, fix the spelling or add the city, then save.', tone: 'warn' }
    case 'placed':
      return { text: `Placed ✓${row.bid.distanceMiles != null ? ` · ${Math.round(row.bid.distanceMiles)} mi from the office` : ''}`, tone: 'ok' }
  }
}
