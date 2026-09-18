import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { stripeApiKeyForMode, type StripeBillingMode } from './stripeSecrets.ts'
import {
  decideLinkRefresh,
  emptyTally,
  groupRowsByStripeMode,
  statusDrifted,
  type LinkRefreshTally,
  type OpenStripeBillRow,
} from './stripeInvoiceLinkRefresh.ts'

/**
 * The one loop that re-fetches Stripe hosted-invoice links (v2.3589 / v2.3590):
 * each row retrieved in its own mode, a few in flight at once, the row's
 * `hosted_invoice_url` replaced when Stripe's differs. Used by the nightly
 * sweep (every open bill), the customer portal (bills past the stale margin)
 * and `get-stripe-invoice-details` writes its own single row. Never throws
 * for one row's failure — it is counted; a mode with no key is skipped.
 */

/** Stripe retrieves in flight at once — well under the 100 req/s live limit. */
export const STRIPE_LINK_REFRESH_CONCURRENCY = 5

export type StripeLinkRefreshResult = {
  tally: LinkRefreshTally
  /** jobs_ledger_invoices id → the fresh link, for every row that was renewed (written unless dryRun). */
  renewedUrls: Map<string, string>
  statusDrift: Array<{ id: string; row: string | null; stripe: string | null }>
}

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i]!)
    }
  })
  await Promise.all(workers)
  return out
}

export async function refreshStripeInvoiceLinks(
  admin: SupabaseClient,
  rows: readonly OpenStripeBillRow[],
  opts: { dryRun?: boolean; concurrency?: number; log?: string } = {},
): Promise<StripeLinkRefreshResult> {
  const tag = opts.log ?? 'refreshStripeInvoiceLinks'
  const tally = emptyTally()
  tally.open = rows.length
  const groups = groupRowsByStripeMode(rows)
  tally.live = groups.live.length
  tally.test = groups.test.length
  const renewedUrls = new Map<string, string>()
  const statusDrift: StripeLinkRefreshResult['statusDrift'] = []

  for (const mode of ['live', 'test'] as StripeBillingMode[]) {
    const group = groups[mode]
    if (group.length === 0) continue
    const key = stripeApiKeyForMode(mode)
    if (!key) {
      tally.skippedNoKey += group.length
      console.warn(`${tag}: no Stripe key for ${mode} — ${group.length} row(s) skipped`)
      continue
    }
    const stripe = new Stripe(key, { apiVersion: '2024-06-20' })
    await mapLimit(group, opts.concurrency ?? STRIPE_LINK_REFRESH_CONCURRENCY, async (row) => {
      try {
        const inv = await stripe.invoices.retrieve(row.stripe_invoice_id)
        const fetched = { hosted_invoice_url: inv.hosted_invoice_url ?? null, status: inv.status ?? null }
        if (statusDrifted(row, fetched)) {
          tally.statusDrift += 1
          statusDrift.push({ id: row.id, row: row.stripe_invoice_status, stripe: fetched.status })
        }
        const decision = decideLinkRefresh(row, fetched)
        if (decision.kind === 'unchanged') tally.unchanged += 1
        else if (decision.kind === 'no_link') tally.noLink += 1
        else {
          if (!opts.dryRun) {
            const { error } = await admin.from('jobs_ledger_invoices').update({ hosted_invoice_url: decision.url }).eq('id', row.id)
            if (error) throw new Error(error.message)
          }
          tally.renewed += 1
          renewedUrls.set(row.id, decision.url)
        }
      } catch (e) {
        tally.failed += 1
        console.warn(`${tag}: ${row.id} (${mode} ${row.stripe_invoice_id}) failed —`, e instanceof Error ? e.message : String(e))
      }
    })
  }
  return { tally, renewedUrls, statusDrift }
}
