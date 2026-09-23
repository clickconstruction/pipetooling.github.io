/**
 * The pay page behind a § 53.056 notice (punch list #35, v2.3758): one QR code per unpaid
 * bill under the office's own sentence, "Once these bills are paid, there will be no lien
 * filed." The office used to build this page by hand with codes straight to Stripe, which
 * expire; each code here carries the bill's `/pay/<id>` address (v2.3754), which fetches
 * Stripe's current link when scanned. Pure: the rows from the enclosed bills, the blocks the
 * packet renders. The codes themselves (SVG for print, PNG for the PDF) are built in the
 * browser by `lienNoticePayPageAssets.ts` and handed in as `assets`.
 */
import type { FilingDocBlock, FilingDocExtras } from '../jobsDocuments/lienFilingDocuments'
import { demandMoney } from '../jobsDocuments/demandLetter'
import { payLinkDisplay } from '../billing/payLink'
import type { NoticeInvoiceDoc } from './noticeInvoiceEnclosure'

/**
 * Decision 2 of the to-do: counsel's memo says the GC's envelope is "the form and invoices
 * only"; a pay page is neither a letter nor a smear, but it is an addition, so it is the
 * owner's (and counsel's) call. Off until they say — one line to turn on.
 */
export const PAY_PAGE_ON_GC_COPY = false

export const PAY_PAGE_TITLE = 'Once these bills are paid, there will be no lien filed.'

export type PayPageCopy = 'owner' | 'original_contractor'

export type PayPageRow = {
  invoiceId: string
  /** "Invoice #273-2, June 12, 2026" — the number the bill shows and the day it went out. */
  label: string
  /** The bill's line as the invoice reads it; '' when the document has none. */
  description: string
  openAmount: number
  /** A Stripe bill has a payment page and so a code; a paper bill prints its row without one. */
  payable: boolean
}

/** By invoice id: the code as SVG (print) and PNG (PDF); a row with no entry prints without a code. */
export type PayPageAssets = Readonly<Record<string, { svg: string; png: string | null }>>

export function payPageRows(docs: readonly NoticeInvoiceDoc[]): PayPageRow[] {
  return docs.map((d) => ({
    invoiceId: d.invoiceId,
    label: d.title,
    description: d.description,
    openAmount: d.openAmount,
    payable: Boolean(d.stripeInvoiceId),
  }))
}

/** Which copies carry the page. */
export function payPageAppliesTo(copy: PayPageCopy): boolean {
  return copy === 'owner' || PAY_PAGE_ON_GC_COPY
}

/** The cover letter's rule, repeated on the page so it never contradicts the letter it follows. */
export function payPageOwnerRule(gcName: string, claimantName: string): string {
  const gc = gcName.trim()
  const us = claimantName.trim() || 'us'
  if (!gc) return ''
  return `Please pay these only if ${gc} has told you in writing that you may pay ${us} directly. Otherwise hold the amount back from ${gc}, as the cover letter asks.`
}

/** "5 bills · $28,987.00 still owed" — the desk's label for the page. */
export function payPageSummary(rows: readonly PayPageRow[]): string {
  if (rows.length === 0) return ''
  const total = rows.reduce((s, r) => s + r.openAmount, 0)
  return `${rows.length} ${rows.length === 1 ? 'bill' : 'bills'} · ${demandMoney(String(total))} still owed`
}

export type PayPageInput = {
  rows: readonly PayPageRow[]
  assets: PayPageAssets
  copy: PayPageCopy
  /** "Owner of record" — the reference strip's "Copy for:"; '' leaves the strip as the notice's. */
  copyLabel: string
  gcName: string
  claimantName: string
  contactPerson: string
  phone: string
  extras: FilingDocExtras
}

/**
 * The page as the packet renders it — empty when the copy does not carry it, or when no bill has
 * a payment page (a page of codes with no code on it is not a page; the enclosed invoices say
 * what is owed). A paper bill beside a Stripe bill keeps its row, with a note instead of a code.
 */
export function payPageBlocks(i: PayPageInput): FilingDocBlock[] {
  if (!payPageAppliesTo(i.copy) || !i.rows.some((r) => r.payable)) return []
  const blocks: FilingDocBlock[] = []
  if (i.extras.letterhead && i.extras.letterhead.company.trim()) blocks.push({ kind: 'letterhead', ...i.extras.letterhead })
  const refItems = [...(i.extras.refItems ?? []), ...(i.copyLabel.trim() ? [`Copy for: ${i.copyLabel.trim()}`] : [])]
  if (refItems.length) blocks.push({ kind: 'refstrip', items: refItems })
  blocks.push({ kind: 'title', lines: [PAY_PAGE_TITLE] })
  blocks.push({
    kind: 'paragraph',
    text: "Each code below opens that bill's secure payment page. Scan it with a phone camera to pay by card or bank transfer, or type the address under it. The bill itself is enclosed behind this page.",
  })
  if (i.copy === 'owner') {
    const rule = payPageOwnerRule(i.gcName, i.claimantName)
    if (rule) blocks.push({ kind: 'callout', text: rule })
  }
  for (const r of i.rows) {
    const asset = r.payable ? i.assets[r.invoiceId] : undefined
    blocks.push({
      kind: 'payRow',
      label: r.label,
      description: r.description,
      amountLine: `Still owed: ${demandMoney(String(r.openAmount))}`,
      address: r.payable ? payLinkDisplay(r.invoiceId) : '',
      note: r.payable ? '' : 'No online payment page for this bill — pay by check to the address above.',
      svg: asset?.svg ?? null,
      png: asset?.png ?? null,
    })
  }
  const total = i.rows.reduce((s, r) => s + r.openAmount, 0)
  blocks.push({
    kind: 'paragraph',
    text: `${i.rows.length} ${i.rows.length === 1 ? 'bill' : 'bills'} enclosed behind this page · ${demandMoney(String(total))} still owed on ${i.rows.length === 1 ? 'it' : 'them'}.`,
  })
  const who = [i.contactPerson.trim(), i.phone.trim()].filter(Boolean).join(', ')
  blocks.push({
    kind: 'paragraph',
    text: `A code opens the bill in your phone's browser; nothing is installed. A bill already paid says so instead of asking again.${who ? ` Questions: ${who}.` : ''}`,
  })
  return blocks
}
