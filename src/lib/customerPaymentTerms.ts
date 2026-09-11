/**
 * "Their Word" PR 4 — payment terms on the customer: the one lever the
 * promise record leads to. Pure: labels, the warning bar New Bid / New Job
 * show, and the parse of a customers row. No React, no supabase.
 */

import { formatKeptRecord, formatUsualSlip, type CustomerPromiseRecord } from './jobs/paymentPromises'

export type CustomerPaymentTerms = 'standard' | 'deposit_required' | 'no_new_work_past_promise' | 'winding_down'

export const CUSTOMER_PAYMENT_TERMS: ReadonlyArray<{ key: CustomerPaymentTerms; label: string; hint: string }> = [
  { key: 'standard', label: 'Standard', hint: 'Bill on completion, chase per the loop.' },
  { key: 'deposit_required', label: 'Deposit required', hint: 'A deposit before work starts on new jobs and bids.' },
  { key: 'no_new_work_past_promise', label: 'No new work past an unpaid promise', hint: 'New Job and New Bid warn while a promise is broken.' },
  { key: 'winding_down', label: 'Winding down', hint: 'Finish open jobs, decline new ones. Shows the reason on New Bid.' },
]

const TERMS_KEYS: ReadonlySet<string> = new Set(CUSTOMER_PAYMENT_TERMS.map((t) => t.key))

export function isCustomerPaymentTerms(v: unknown): v is CustomerPaymentTerms {
  return typeof v === 'string' && TERMS_KEYS.has(v)
}

export function paymentTermsLabel(terms: CustomerPaymentTerms): string {
  return CUSTOMER_PAYMENT_TERMS.find((t) => t.key === terms)?.label ?? 'Standard'
}

export type CustomerTermsRow = {
  terms: CustomerPaymentTerms
  note: string | null
  setByName: string | null
  setAt: string | null
}

/** Defensive read of a customers row's terms columns (missing columns → standard). */
export function parseCustomerTerms(row: Record<string, unknown> | null | undefined, setByName?: string | null): CustomerTermsRow {
  const terms = isCustomerPaymentTerms(row?.payment_terms) ? row!.payment_terms : 'standard'
  const note = typeof row?.payment_terms_note === 'string' && row.payment_terms_note.trim() ? row.payment_terms_note.trim() : null
  const setAt = typeof row?.payment_terms_set_at === 'string' ? row.payment_terms_set_at : null
  return { terms, note, setByName: setByName?.trim() || null, setAt }
}

export type TermsWarning = {
  /** 'warn' = amber bar; 'stop' = red bar (winding down, or no-new-work with a broken promise open). */
  severity: 'warn' | 'stop'
  headline: string
  /** The record line ("keeps 1 of 5 · slips ~23d · 2 bills open past promise") — empty when unknown. */
  detail: string
  note: string | null
}

/**
 * What New Bid / New Job show for a customer. Null for standard terms with
 * nothing broken — the common case stays silent. A customer on standard
 * terms with a promise currently broken still gets a quiet warning: the
 * record is the whole point.
 */
export function customerTermsWarning(terms: CustomerTermsRow | null | undefined, record: CustomerPromiseRecord | null | undefined): TermsWarning | null {
  const t = terms?.terms ?? 'standard'
  const openBroken = record?.openBroken ?? 0
  const parts = [record ? formatKeptRecord(record) : null, record ? formatUsualSlip(record) : null, openBroken > 0 ? `${openBroken} bill${openBroken === 1 ? '' : 's'} open past promise` : null].filter((x): x is string => x != null)
  const detail = parts.join(' · ')
  const note = terms?.note ?? null
  if (t === 'winding_down') return { severity: 'stop', headline: 'Winding down — finish open jobs, decline new ones', detail, note }
  if (t === 'no_new_work_past_promise') {
    return openBroken > 0
      ? { severity: 'stop', headline: 'No new work — a payment promise is broken', detail, note }
      : { severity: 'warn', headline: 'No new work past an unpaid promise', detail, note }
  }
  if (t === 'deposit_required') return { severity: 'warn', headline: 'Deposit required before work starts', detail, note }
  if (openBroken > 0) return { severity: 'warn', headline: 'A payment promise is broken right now', detail, note }
  return null
}
