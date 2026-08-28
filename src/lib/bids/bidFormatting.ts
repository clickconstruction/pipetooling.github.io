/**
 * Pure formatting/display helpers for the Bids page, extracted from `src/pages/Bids.tsx`.
 * No DOM, React, or Supabase access.
 */

import { formatCurrency } from '../format'
import { formatBidLedgerNumberLabel, resolveBidLedgerPrefix, type LedgerPrefixMap } from '../ledgerDisplayPrefixes'
import type { Bid } from '../../types/bids'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { Database } from '../../types/database'

type Customer = Database['public']['Tables']['customers']['Row']

export function formatCompactCurrency(n: number | null): string {
  if (n == null) return '—'
  const k = n / 1000
  if (k % 1 === 0) return `$${k}k`
  return `$${k.toFixed(1)}k`
}

/** Bid value in thousands with a `k` suffix — `153000` → `153k`. The suffix
 *  matters on the Bid Board phone cards, where the value has no column header
 *  to identify it. */
export function formatBidValueShort(n: number | null): string {
  if (n == null) return '—'
  const valueInThousands = n / 1000
  return `${valueInThousands >= 10 ? valueInThousands.toFixed(0) : valueInThousands.toFixed(1)}k`
}

export function formatTimeSinceLastContact(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso).getTime()
  const now = Date.now()
  const sec = Math.floor((now - d) / 1000)
  if (sec < 60) return 'Just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} minute${min !== 1 ? 's' : ''} ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr !== 1 ? 's' : ''} ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} day${day !== 1 ? 's' : ''} ago`
  const week = Math.floor(day / 7)
  if (week < 4) return `${week} week${week !== 1 ? 's' : ''} ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo} month${mo !== 1 ? 's' : ''} ago`
  return `${Math.floor(mo / 12)} year${Math.floor(mo / 12) !== 1 ? 's' : ''} ago`
}

export function formatShortDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}`
}

export function formatDateYYMMDD(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T12:00:00')
  if (isNaN(d.getTime())) return '—'
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  // Calculate days until/since
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diffMs = d.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))

  // Format with brackets
  const formattedDate = `${m}/${day}`
  if (diffDays < 0) return `${formattedDate} [+${Math.abs(diffDays)}]`
  return `${formattedDate} [-${diffDays}]`
}

export function formatDateYYMMDDParts(dateStr: string | null): { date: string; bracket: string } | null {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T12:00:00')
  if (isNaN(d.getTime())) return null
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diffMs = d.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))

  const formattedDate = `${m}/${day}`
  const bracket = diffDays < 0 ? `[+${Math.abs(diffDays)}]` : `[-${diffDays}]`

  return { date: formattedDate, bracket }
}

export function bidDisplayName(b: Bid): string {
  return b.project_name || ''
}

export function formatBidNameWithValue(bid: BidWithBuilder, prefixMap?: LedgerPrefixMap): string {
  const baseName = bidDisplayName(bid) || bid.customers?.name || bid.bids_gc_builders?.name || bid.id.slice(0, 8)
  // Standard identity: lead with the configured bid number (these rows carry no
  // trade pill, so the per-service-type prefix stays — e.g. BP356).
  const num = (bid.bid_number ?? '').trim()
  const numPrefix =
    num && prefixMap ? `${resolveBidLedgerPrefix(bid.service_type_id, prefixMap)}${num} · ` : ''

  if (bid.bid_value != null && bid.bid_value !== 0) {
    const valueInThousands = Number(bid.bid_value) / 1000
    const formattedValue = valueInThousands >= 10 ? valueInThousands.toFixed(0) : valueInThousands.toFixed(1)
    return `${numPrefix}${baseName} (${formattedValue})`
  }

  return `${numPrefix}${baseName}`
}

export function formatDesignDrawingPlanDate(dateStr: string | null): string {
  if (!dateStr || !dateStr.trim()) return ''
  const d = new Date(dateStr.trim() + 'T12:00:00')
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear() % 100
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${m}-${day}-${String(y).padStart(2, '0')}`
}

export function formatDesignDrawingPlanDateLabel(dateStr: string | null): string {
  if (!dateStr || !dateStr.trim()) return ''
  const d = new Date(dateStr.trim() + 'T12:00:00')
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear() % 100
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}/${day}/${String(y).padStart(2, '0')}`
}

/** Tab header when a bid is selected: `{prefix}{n} project name` if `bid_number` is set, else project name or `Bid`. */
export function bidWorkflowTabHeading(b: Bid, prefixMap: LedgerPrefixMap): string {
  const name = bidDisplayName(b).trim()
  const label = name || 'Bid'
  const num = b.bid_number?.trim()
  if (num) return `${formatBidLedgerNumberLabel(resolveBidLedgerPrefix(b.service_type_id, prefixMap), num)} ${label}`
  return label
}

/** Project name only — used for destructive confirm typing (Counts clear-all). */
export function countsConfirmLabel(bid: BidWithBuilder | null): string {
  const t = bid?.project_name?.trim()
  return t || 'Bid'
}

export function marginFlag(marginPercent: number | null): 'red' | 'yellow' | 'green' | null {
  if (marginPercent == null) return null
  if (marginPercent < 20) return 'red'
  if (marginPercent < 40) return 'yellow'
  return 'green'
}

/** Parse amount string and return formatted currency (e.g. "17242.50" -> "17,242.50") */
export function formatAmountFromString(s: string): string {
  const n = parseFloat(String(s).replace(/,/g, ''))
  return isNaN(n) ? '' : formatCurrency(n)
}

export function getCustomerDisplay(c: Customer): string {
  if (c.address) return `${c.name} - ${c.address}`
  return c.name
}

/**
 * Bid pill label for the call lenses (Why we lost, Waiting to hear) — v2.2052.
 * The project name is what everyone calls the job, so it leads; the street
 * (old behavior) is the fallback for unnamed bids, and the ledger label is the
 * last resort. Street-only pills collided constantly ("s. access rd." × 3).
 */
export function bidTriagePillLabel(
  b: { project: string | null; address: string | null; label: string },
  max = 26,
): string {
  const trim = (s: string) => (s.length > max ? `${s.slice(0, max)}…` : s)
  const name = (b.project ?? '').trim()
  if (name && name !== '—') return trim(name)
  const street = (b.address ?? '').split(',')[0]?.replace(/^\d+\s*/, '').trim()
  if (street) return trim(street)
  return b.label
}

/**
 * The Workbench's MULTIPLE stat (v2.2423, owner-approved mockup): revenue as a multiple of
 * cost to one decimal — "2.2×". Margin's other dialect (multiple = 1 / (1 − margin)).
 * Null when there is nothing to divide (no cost, or no revenue) — the stat renders "—".
 */
export function formatRevenueMultiple(revenue: number, cost: number): string | null {
  if (!Number.isFinite(revenue) || !Number.isFinite(cost) || cost <= 0 || revenue <= 0) return null
  return `${(revenue / cost).toFixed(1)}×`
}
