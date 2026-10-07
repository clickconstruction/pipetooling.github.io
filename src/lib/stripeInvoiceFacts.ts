import { supabase } from './supabase'
import { getAccessTokenForEdgeFunctions } from './supabaseAccessTokenForEdge'
import { stripeModeInvokeBody, type BillingStripeModePref } from './billingStripeModePref'
import { parseStripeInvoiceDetailsResponse, type StripeInvoiceLineDetail } from './stripeInvoiceDetailsResponse'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'

/**
 * What Stripe rendered for a hosted bill (v2.3425, shared since v2.4852): the number the
 * customer saw, the day it was due and the lines as they saw them. The app's own document
 * for a Stripe-hosted bill knows only the bill's position on the job ("#0" for the first)
 * and falls back to the send day for the due day, so a legal paper that encloses the bill
 * — the demand letter's exhibit, the § 53.056 notice's enclosure, the pay page — reads
 * these instead. One fetch per bill per sitting, shared by every reader.
 */
export type StripeInvoiceFacts = {
  invoiceNumber: string | null
  /** YYYY-MM-DD in the app's calendar, or null when Stripe set no due day. */
  dueYmd: string | null
  lines: StripeInvoiceLineDetail[]
}

/** A Stripe unix timestamp's day in the app's calendar; null for none. */
export function stripeUnixToAppYmd(sec: number | null | undefined): string | null {
  if (!sec || !Number.isFinite(sec)) return null
  // Assembled from the parts: a locale's own order (en-CA reads mm/dd/yyyy on a Node with small ICU) must not decide the shape.
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(sec * 1000))
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((x) => x.type === t)?.value ?? ''
  const ymd = `${get('year')}-${get('month')}-${get('day')}`
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null
}

/** The facts from one parsed `get-stripe-invoice-details` answer. */
export function stripeInvoiceFactsFrom(parsed: { invoice_number: string | null; due_date: number | null; lines: StripeInvoiceLineDetail[] }): StripeInvoiceFacts {
  return { invoiceNumber: parsed.invoice_number, lines: parsed.lines, dueYmd: stripeUnixToAppYmd(parsed.due_date) }
}

const cache = new Map<string, Promise<StripeInvoiceFacts | null>>()

async function fetchOne(invoiceId: string, token: string, mode: BillingStripeModePref): Promise<StripeInvoiceFacts | null> {
  const { data } = await supabase.functions.invoke('get-stripe-invoice-details', {
    body: { jobs_ledger_invoice_id: invoiceId, ...stripeModeInvokeBody(mode) },
    headers: { Authorization: `Bearer ${token}` },
  })
  const parsed = parseStripeInvoiceDetailsResponse(data as Record<string, unknown> | null)
  return parsed ? stripeInvoiceFactsFrom(parsed) : null
}

/**
 * The facts for each `jobs_ledger_invoices` id, by id — only the bills Stripe answered for.
 * A bill Stripe cannot answer (not hosted, a refused token, a network fault) is left out and
 * asked again next time; an answer is kept for the sitting. Never throws: a reader that
 * gets nothing prints the app's own document.
 */
export async function fetchStripeInvoiceFacts(invoiceIds: ReadonlyArray<string>, mode: BillingStripeModePref): Promise<Record<string, StripeInvoiceFacts>> {
  const ids = Array.from(new Set(invoiceIds.map((id) => id.trim()).filter(Boolean)))
  const out: Record<string, StripeInvoiceFacts> = {}
  if (ids.length === 0) return out
  const token = await getAccessTokenForEdgeFunctions().catch(() => null)
  if (!token) return out
  await Promise.all(
    ids.map(async (id) => {
      const key = `${mode}:${id}`
      let p = cache.get(key)
      if (!p) {
        p = fetchOne(id, token, mode).catch(() => null)
        cache.set(key, p)
      }
      const facts = await p
      if (facts) out[id] = facts
      else cache.delete(key)
    }),
  )
  return out
}

/** Test seam: forget every answer. */
export function clearStripeInvoiceFactsCache(): void {
  cache.clear()
}
