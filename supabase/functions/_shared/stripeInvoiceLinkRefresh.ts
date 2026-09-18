/**
 * Stripe hosted-invoice links expire — 30 days after the invoice's due date
 * (30 days after finalizing when there is none; never more than 120 days).
 * `create-stripe-invoice` stores `hosted_invoice_url` once, and every reader
 * (the portal's Pay, the Bill tab's Text · Copy link · Email cluster, View bill,
 * Collect payment, Documents, the Legal desk) hands that stored copy out, so a
 * customer chased on an old bill got Stripe's "link expired" page. Retrieving
 * the invoice through the API returns a fresh link (good for at least ten days).
 *
 * The nightly sweep (`refresh-stripe-invoice-links`, v2.3589) retrieves every
 * open Stripe bill and stores the current link, so the stored column is never
 * more than a day old. This file is the pure part: grouping rows by Stripe
 * mode, deciding per row whether the stored link changes, and the one summary
 * line the run logs. Mirrored by `src/lib/billing/stripeInvoiceLinkRefresh.test.ts`.
 */

export type OpenStripeBillRow = {
  id: string
  stripe_invoice_id: string
  /** `'live' | 'test'`; NULL is pre-v2.1114 legacy and reads as live (A3). */
  stripe_mode: string | null
  hosted_invoice_url: string | null
  stripe_invoice_status: string | null
}

export type FetchedStripeInvoice = {
  hosted_invoice_url: string | null
  status: string | null
}

export type LinkRefreshDecision =
  | { kind: 'renewed'; url: string }
  | { kind: 'unchanged' }
  | { kind: 'no_link' }

/** NULL / unknown modes are live — the row is the authority on its mode, legacy rows are live (A3). */
export function stripeModeOfRow(row: Pick<OpenStripeBillRow, 'stripe_mode'>): 'live' | 'test' {
  return row.stripe_mode === 'test' ? 'test' : 'live'
}

export function groupRowsByStripeMode<T extends Pick<OpenStripeBillRow, 'stripe_mode'>>(rows: readonly T[]): { live: T[]; test: T[] } {
  const out: { live: T[]; test: T[] } = { live: [], test: [] }
  for (const r of rows) out[stripeModeOfRow(r)].push(r)
  return out
}

/** The stored link changes only when Stripe hands back a different, non-empty one. */
export function decideLinkRefresh(row: Pick<OpenStripeBillRow, 'hosted_invoice_url'>, fetched: FetchedStripeInvoice): LinkRefreshDecision {
  const next = (fetched.hosted_invoice_url ?? '').trim()
  if (!next) return { kind: 'no_link' }
  const current = (row.hosted_invoice_url ?? '').trim()
  return next === current ? { kind: 'unchanged' } : { kind: 'renewed', url: next }
}

/** Stripe says something other than the row does — counted, not written (the webhook owns status). */
export function statusDrifted(row: Pick<OpenStripeBillRow, 'stripe_invoice_status'>, fetched: FetchedStripeInvoice): boolean {
  const s = (fetched.status ?? '').trim()
  return s !== '' && s !== (row.stripe_invoice_status ?? '').trim()
}

/**
 * Could the stored link be dead? Stripe expires it 30 days after the due date,
 * and `create-stripe-invoice` sets the due date at least one day after billing,
 * so a link is provably live for 31 days after `billed_at`. The on-read refresh
 * (v2.3590 — the portal, View bill) re-fetches from Stripe only past this
 * margin, and always when the billed date is unknown; the nightly sweep
 * refreshes everything regardless.
 */
export const STRIPE_LINK_STALE_AFTER_DAYS = 25

export function linkMayBeStale(billedAt: string | null | undefined, nowMs: number, marginDays: number = STRIPE_LINK_STALE_AFTER_DAYS): boolean {
  if (!billedAt) return true
  const t = Date.parse(billedAt)
  if (!Number.isFinite(t)) return true
  return nowMs - t >= marginDays * 86400 * 1000
}

export type LinkRefreshTally = {
  open: number
  live: number
  test: number
  renewed: number
  unchanged: number
  noLink: number
  failed: number
  statusDrift: number
  skippedNoKey: number
}

export function emptyTally(): LinkRefreshTally {
  return { open: 0, live: 0, test: 0, renewed: 0, unchanged: 0, noLink: 0, failed: 0, statusDrift: 0, skippedNoKey: 0 }
}

export function summarizeLinkRefresh(t: LinkRefreshTally, dryRun: boolean): string {
  const head = dryRun ? 'refresh-stripe-invoice-links (dry run)' : 'refresh-stripe-invoice-links'
  return `${head}: ${t.open} open Stripe bill(s) (${t.live} live · ${t.test} test) · ${t.renewed} link(s) renewed · ${t.unchanged} unchanged · ${t.noLink} with no link from Stripe · ${t.failed} failed · ${t.statusDrift} with a Stripe status the row does not carry · ${t.skippedNoKey} skipped (no key for their mode)`
}
