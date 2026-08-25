import type { EstimateLineItemNormalized } from './estimateLineItemNormalize'

/**
 * Quick Estimate kernel (v2.2293) — the field wizard's pure logic. A master on
 * a job writes up a change order (or, through the side door, an estimate) in
 * five screens and hands it to Dispatch. This module owns everything testable:
 * ballpark parsing, the send rule, the ✓/— review rows, and the dispatch
 * request's title/summary — the component only renders and saves.
 *
 * Design contract (owner-approved mockup v4):
 * - Change-order-first: picking a job IS declaring the doc kind.
 * - Everything skippable except the work itself: a send needs a description
 *   or at least one photo.
 * - The ballpark is never a real price: it lands as a $0 placeholder line so
 *   the editor's step rail flags cost as unfinished and the document total
 *   stays 0 until the office prices it.
 */

export type QuickEstimateBranch = 'change_order' | 'estimate'

export type QuickEstimateStage = 'job' | 'customer' | 'work' | 'cost' | 'review' | 'done'

export type QuickEstimateSummaryInput = {
  branch: QuickEstimateBranch
  /** "HCP 5124 — Herber Custom Homes" (CO branch) — null when skipped. */
  jobLabel: string | null
  /** Picked customer name or free-typed name (estimate branch) — null when skipped. */
  customerLabel: string | null
  description: string
  photoCount: number
  /** Parsed ballpark in cents — null when skipped. */
  ballparkCents: number | null
  /** Optional one-liner for dispatch. */
  dispatchNote: string
}

/** "$1,350" / "$250" — whole dollars unless the ballpark carried cents. */
export function formatBallparkUsd(cents: number): string {
  const dollars = cents / 100
  const hasCents = cents % 100 !== 0
  return (
    '$' +
    dollars.toLocaleString('en-US', {
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: hasCents ? 2 : 0,
    })
  )
}

/**
 * "1,350", "$1350", " 1350.50 " → cents; garbage/empty/zero/negative → null
 * (a zero ballpark is a skip, not an answer).
 */
export function parseBallparkDollars(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const cents = Math.round(parseFloat(cleaned) * 100)
  return cents > 0 ? cents : null
}

/** The one hard rule: a send needs something for the office to work from. */
export function quickEstimateCanSend(input: { description: string; photoCount: number }): boolean {
  return input.description.trim().length > 0 || input.photoCount > 0
}

export type QuickEstimateReviewRow = {
  key: 'target' | 'work' | 'ballpark' | 'rest'
  label: string
  value: string
  filled: boolean
}

/** The ✓/— rows on the review screen; skips phrase the office's next move. */
export function quickEstimateReviewRows(input: QuickEstimateSummaryInput): QuickEstimateReviewRow[] {
  const isCO = input.branch === 'change_order'
  const target = isCO ? input.jobLabel : input.customerLabel
  const desc = input.description.trim()
  const workParts: string[] = []
  if (desc) workParts.push(desc.length > 64 ? desc.slice(0, 64).trimEnd() + '…' : desc)
  if (input.photoCount > 0) workParts.push(`${input.photoCount} photo${input.photoCount === 1 ? '' : 's'}`)
  return [
    {
      key: 'target',
      label: isCO ? 'Job' : 'For',
      value: target ?? 'Skipped — in the notes',
      filled: target != null,
    },
    {
      key: 'work',
      label: isCO ? 'Change' : 'Work',
      value: workParts.join(' · ') || 'Nothing yet',
      filled: quickEstimateCanSend(input),
    },
    {
      key: 'ballpark',
      label: 'Ballpark',
      value: input.ballparkCents != null ? formatBallparkUsd(input.ballparkCents) : 'Skipped — office prices it',
      filled: input.ballparkCents != null,
    },
    {
      key: 'rest',
      label: 'Rest',
      value: isCO
        ? 'Office prices it & sends the CO'
        : input.customerLabel
          ? 'Office finishes pricing & paperwork'
          : 'Office finds/creates the customer',
      filled: false,
    },
  ]
}

/** Dispatch inbox card headline. */
export function quickEstimateDispatchTitle(input: QuickEstimateSummaryInput): string {
  const kind = input.branch === 'change_order' ? 'change order' : 'estimate'
  const target =
    (input.branch === 'change_order' ? input.jobLabel : input.customerLabel)?.trim() || 'from the field'
  return `Review field ${kind} — ${target}`
}

/** One-line ✓/— summary for the dispatch card (mirrors the review screen). */
export function quickEstimateReferenceSummary(input: QuickEstimateSummaryInput): string {
  const isCO = input.branch === 'change_order'
  const parts: string[] = []
  const target = isCO ? input.jobLabel : input.customerLabel
  parts.push(`${isCO ? 'Job' : 'For'} ${target != null ? '✓' : '— skipped'}`)
  const photoBit = input.photoCount > 0 ? ` (${input.photoCount} photo${input.photoCount === 1 ? '' : 's'})` : ''
  parts.push(`Work ${quickEstimateCanSend(input) ? '✓' : '—'}${photoBit}`)
  parts.push(
    input.ballparkCents != null ? `Ballpark ${formatBallparkUsd(input.ballparkCents)}` : 'Ballpark — skipped',
  )
  const note = input.dispatchNote.trim()
  if (note) parts.push(`Note: ${note}`)
  return parts.join(' | ')
}

/**
 * The ballpark as a $0 placeholder line — clearly labeled, never a chargeable
 * price, keeps the rail's cost step unfinished until the office replaces it.
 */
export function quickEstimateBallparkLine(cents: number): EstimateLineItemNormalized {
  return {
    line_item: `Field ballpark: ~${formatBallparkUsd(cents)} — to be priced`,
    description: '',
    quantity: 1,
    unit_price_cents: 0,
    amount_cents: 0,
  }
}

/**
 * Estimate-branch work description as line one (plain estimates have no
 * "description of change" field; COs use change_order_fields instead).
 */
export function quickEstimateWorkLine(description: string): EstimateLineItemNormalized {
  return {
    line_item: 'Field write-up',
    description: description.trim(),
    quantity: 1,
    unit_price_cents: 0,
    amount_cents: 0,
  }
}

/** Draft title: COs stay untitled (list shows CO + customer); estimates carry the free-typed lead. */
export function quickEstimateDraftTitle(branch: QuickEstimateBranch, freeTypedCustomer: string): string {
  if (branch !== 'estimate') return ''
  const who = freeTypedCustomer.trim()
  return who ? `Field estimate — ${who}` : ''
}
