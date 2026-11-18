/**
 * The words at the top of the Job form's Bill region (the Job form map's second pass, cut 2): the billing
 * slice's autosave line, and what the New Job money bar says. Pure, so `JobFormBillingHeader` only draws them.
 */
import type { EditJobBillingBar } from './editJobBillingBar'
import { formatCurrency } from './jobFormMoney'

export type BillingHeaderStatusLine = { words: string; failed: boolean }

/**
 * The header's autosave line. Only an open job's save in flight or failed earns it: the steady "Saved" is
 * noise (v2.1144), and a new job has no autosave.
 */
export function billingHeaderStatusLine(editingId: string | null | undefined, status: string): BillingHeaderStatusLine | null {
  if (!editingId) return null
  if (status === 'saving') return { words: 'Saving…', failed: false }
  if (status === 'error') return { words: 'Autosave failed — edit again to retry', failed: true }
  return null
}

export type NewJobMoneyBarKey = 'paid' | 'billed' | 'draft'

export type NewJobMoneyBar = {
  /** The bar's hover words. */
  barTitle: string
  /** The three slices, in stacking order; the component gives each its colour. */
  segments: { key: NewJobMoneyBarKey; frac: number }[]
  /** The legend rows: Paid and Billed always, Draft only while a draft holds money. */
  rows: { key: NewJobMoneyBarKey; label: string; value: number }[]
  bottomRow: { label: string; value: number; title: string }
}

/** A slice's own share of the job total, as the legend leads with it; plain words when there is no total yet. */
function shareLabel(bar: EditJobBillingBar, frac: number, words: string): string {
  return bar.hasBar ? `${Math.round(frac * 100)}% ${words}` : words
}

/**
 * The New Job form's money bar (an open job reads the ② money card instead, v2.4307). Each label leads with
 * its slice's own share of the job total, so the slices and the unbilled remainder sum to 100%, matching the
 * Stages legend.
 */
export function newJobMoneyBar(bar: EditJobBillingBar): NewJobMoneyBar {
  const rows: NewJobMoneyBar['rows'] = [
    { key: 'paid', label: shareLabel(bar, bar.paidFrac, 'Paid'), value: bar.paid },
    { key: 'billed', label: shareLabel(bar, bar.billedFrac, 'Billed'), value: bar.billedUnpaid },
  ]
  if (bar.draft > 0) rows.push({ key: 'draft', label: shareLabel(bar, bar.draftFrac, 'Draft (not sent)'), value: bar.draft })
  return {
    barTitle: `Job total $${formatCurrency(bar.total)} — paid $${formatCurrency(bar.paid)}, billed unpaid $${formatCurrency(bar.billedUnpaid)}, draft $${formatCurrency(bar.draft)}`,
    segments: [
      { key: 'paid', frac: bar.paidFrac },
      { key: 'billed', frac: bar.billedFrac },
      { key: 'draft', frac: bar.draftFrac },
    ],
    rows,
    bottomRow: { label: 'Remaining to bill', value: bar.remaining, title: 'Job Total minus payments and every draft or sent bill' },
  }
}
