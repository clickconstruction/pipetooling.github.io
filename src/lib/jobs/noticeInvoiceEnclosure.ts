/**
 * The invoice behind a § 53.056 notice (v2.3437). Tex. Prop. Code
 * § 53.056(a-3): "The notice may include an invoice or billing statement."
 * The same machinery the demand letter uses for Exhibit A (v2.3429): the
 * app's physical-invoice document for every billed, unpaid invoice on the
 * job, rendered to PDF and merged behind the notice with an INVOICE stamp, or
 * appended as print pages. Pure helpers here; the modal and the run do the I/O.
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { Database } from '../../types/database'
import { buildPhysicalInvoiceEmailBodies, type PhysicalInvoiceDocument } from '../physicalInvoiceDocument'
import { buildPhysicalInvoiceDocumentForBilledInvoice } from '../physicalInvoiceDocumentForBilledInvoice'
import type { DemandExhibitInput } from '../jobsDocuments/demandLetterPacket'
import { demandDate, exhibitInvoiceDocument, fallbackInvoiceNumber } from '../jobsDocuments/demandLetter'
import type { StripeInvoiceFacts } from '../stripeInvoiceFacts'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { portalReturnFooterLine } from '../../../supabase/functions/_shared/stripeInvoiceFooterPortalLink'
import { PORTAL_RETURN_SHORT_ORIGIN } from '../../../supabase/functions/_shared/customerPortalReturnUrl'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/** Billed invoices with money still open, oldest first — what the notice claims — each with what is still owed on it. */
export function unpaidBilledInvoicesWithOpen(job: JobWithDetails): Array<{ inv: JobsLedgerInvoice; open: number }> {
  const applied = new Map<string, number>()
  for (const p of job.payments ?? []) {
    if (p.invoice_id) applied.set(p.invoice_id, (applied.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0))
  }
  return (job.invoices ?? [])
    .map((inv) => ({ inv, open: Number(inv.amount ?? 0) - (applied.get(inv.id) ?? 0) }))
    .filter(({ inv, open }) => inv.status === 'billed' && open > 0.005)
    .sort((a, b) => a.inv.sequence_order - b.inv.sequence_order)
}

/** Billed invoices with money still open, oldest first — what the notice claims. */
export function unpaidBilledInvoices(job: JobWithDetails): JobsLedgerInvoice[] {
  return unpaidBilledInvoicesWithOpen(job).map(({ inv }) => inv)
}

export type NoticeInvoiceDoc = {
  invoiceId: string
  title: string
  doc: PhysicalInvoiceDocument
  /** The pay page (v2.3758): a Stripe bill has a payment page and so a code; null = paper only, no code. */
  stripeInvoiceId: string | null
  /** What is still owed on this bill (the pay page's "Still owed"). */
  openAmount: number
  /** The bill's line as the invoice reads it — the pay page's description. */
  description: string
}

export const PAY_PAGE_DESCRIPTION_MAX = 140

/**
 * A bill line that is not the work (v2.4724, Taunya's ask): the office's mailing note typed as
 * a service line ("Paper checks can be sent to: … call 512 360-0599 first") and the old
 * system's placeholder ("Job total (migrated)"). The pay page tells an owner what each code is
 * for, so these never stand for the bill there.
 */
export function payLineIsNotTheWork(line: string): boolean {
  const s = line.trim()
  if (!s) return true
  if (/\(migrated\)/i.test(s)) return true
  // "Cheques" is "checks" (v2.7956): a memo that spelled it that way printed the mailing note as the invoice's Scope.
  return /\b(?:paper\s+)?che(?:ck|que)s?\s+(?:can|may|should)\s+be\s+(?:sent|mailed)|\bmake\s+che(?:ck|que)s?\s+payable|\bremit\s+(?:payment\s+)?to\b|\bmail\s+(?:your\s+)?(?:check|cheque|payment)s?\s+to\b/i.test(s)
}

/**
 * The bill's line for the pay page (v2.3758): a bill with one service line is that line (a
 * trip charge, a change order — the Stripe memo under it is the mailing note, not the work);
 * a bill with many lines reads its scope (the memo) when it has one, else the first line and
 * how many more. Never longer than a row.
 */
export function payPageDescription(doc: Pick<PhysicalInvoiceDocument, 'serviceLines' | 'narrativeTitle' | 'lineDescription'>): string {
  const lines = (doc.serviceLines ?? []).map((l) => (l.description ?? '').trim()).filter((l) => !payLineIsNotTheWork(l))
  const scopeRaw = (doc.narrativeTitle || doc.lineDescription || '').trim()
  const scope = payLineIsNotTheWork(scopeRaw) ? '' : scopeRaw
  let out = ''
  if (lines.length === 1) out = lines[0]!
  else if (scope) out = scope
  else if (lines.length > 1) out = `${lines[0]} + ${lines.length - 1} more`
  out = out.replace(/\s+/g, ' ')
  return out.length > PAY_PAGE_DESCRIPTION_MAX ? `${out.slice(0, PAY_PAGE_DESCRIPTION_MAX - 1).trimEnd()}…` : out
}

/** Stripe's number as a bill prints it: "#878-2609161138"; '' when Stripe gave none. */
export function stripeBillNumber(facts: Pick<StripeInvoiceFacts, 'invoiceNumber'> | null | undefined): string {
  const n = (facts?.invoiceNumber ?? '').trim().replace(/^#/, '')
  return n ? `#${n}` : ''
}

/** How a bill's footer opens the line that sends the customer back to their portal (`create-stripe-invoice` appends it). */
const PORTAL_RETURN_LEAD = portalReturnFooterLine('').trim()
/** The customer's short portal address without its scheme: `my.example.com/`. */
const PORTAL_SHORT_HOST = PORTAL_RETURN_SHORT_ORIGIN.replace(/^https?:\/\//, '')

/** A footer line that carries the bill-to customer's portal address: the return line itself, or any line with a portal link in it. */
function footerLineHasPortalLink(line: string): boolean {
  const l = line.trim()
  return l.startsWith(PORTAL_RETURN_LEAD) || l.includes('/portal?t=') || l.includes(PORTAL_SHORT_HOST)
}

/**
 * A bill's footer for a paper that goes to someone else (v2.7513). A Stripe bill's footer ends *See your updated
 * statement any time at* and the bill-to customer's own portal address, which opens their statement with no sign-in.
 * A § 53.056 notice is mailed to the property's owner and the original contractor, so the enclosed invoice printed
 * that address for a third party. The line goes; the rest of the footer (the company's own block) stays as typed.
 * '' when nothing is left.
 */
export function footerWithoutPortalLink(footer: string | null | undefined): string {
  const raw = footer ?? ''
  if (!raw.trim()) return ''
  const kept = raw.split(/\r?\n/).filter((l) => !footerLineHasPortalLink(l))
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * The enclosed invoice as the paper prints it (v2.4852): Stripe's own number and due day when
 * the office has them (the app's document knows only the bill's position, "#0" for the first,
 * and falls back to the send day), never "#0" on the page, and no Scope when the memo under
 * the work is the mailing note ("Paper checks can be sent to…") rather than the work — the
 * pay page already reads it that way (`payPageDescription`). A bill whose only words are that
 * note keeps them: a blank invoice is worse.
 */
export function enclosedInvoiceDocument(doc: PhysicalInvoiceDocument, inv: Pick<JobsLedgerInvoice, 'sequence_order'>, hcp: string | null | undefined, facts: Pick<StripeInvoiceFacts, 'invoiceNumber' | 'dueYmd'> | null | undefined): PhysicalInvoiceDocument {
  const shown = exhibitInvoiceDocument(doc, { invoiceNumber: stripeBillNumber(facts), dueYmd: facts?.dueYmd ?? '' })
  const number = shown.invoiceNumberDisplay !== '—' && shown.invoiceNumberDisplay !== '#0' ? shown.invoiceNumberDisplay : fallbackInvoiceNumber(inv, hcp)
  const realLines = (shown.serviceLines ?? []).some((l) => (l.description ?? '').trim() && !payLineIsNotTheWork(l.description ?? ''))
  const scope = payLineIsNotTheWork(shown.narrativeTitle) && realLines ? '' : shown.narrativeTitle
  // The customer's portal address never rides a notice's enclosure (v2.7513): the paper, the PDF and the mailed piece all read this document.
  return { ...shown, invoiceNumberDisplay: number, narrativeTitle: scope, footer: footerWithoutPortalLink(shown.footer) }
}

/**
 * The document for each unpaid bill; a bill the job cannot render is skipped, never faked.
 * `stripeFacts` by invoice id (`fetchStripeInvoiceFacts`) puts Stripe's number and due day on
 * the paper; without them the app's own document prints, its number the fallback.
 */
export function noticeInvoiceDocs(job: JobWithDetails, stripeFacts?: Readonly<Record<string, Pick<StripeInvoiceFacts, 'invoiceNumber' | 'dueYmd'>>>): NoticeInvoiceDoc[] {
  const out: NoticeInvoiceDoc[] = []
  for (const { inv, open } of unpaidBilledInvoicesWithOpen(job)) {
    let built: PhysicalInvoiceDocument | null = null
    try {
      built = buildPhysicalInvoiceDocumentForBilledInvoice(job, inv)
    } catch {
      built = null
    }
    if (!built) continue
    const doc = enclosedInvoiceDocument(built, inv, job.hcp_number, stripeFacts?.[inv.id])
    // The number the bill shows — Stripe's when known, never "#0" for the primary bill — and the day it went out (v2.3445).
    const number = doc.invoiceNumberDisplay
    const billed = calendarYmdInAppTzFromIso((inv.billed_at ?? inv.sent_to_customer_at ?? '') as string)
    out.push({
      invoiceId: inv.id,
      title: `Invoice ${number}${/^\d{4}-\d{2}-\d{2}$/.test(billed) ? `, ${demandDate(billed)}` : ''}`,
      doc,
      stripeInvoiceId: (inv.stripe_invoice_id ?? '').trim() || null,
      openAmount: Math.round(open * 100) / 100,
      description: payPageDescription(doc),
    })
  }
  return out
}

/** "Invoice #1, August 18, 2026 enclosed" / "Invoices #1 and #2 enclosed" — the notice's reference strip. */
export function noticeEnclosureRefItem(docs: readonly NoticeInvoiceDoc[]): string {
  if (docs.length === 0) return ''
  if (docs.length === 1) return `${docs[0]!.title} enclosed`
  return `${docs.length} invoices enclosed`
}

/** The exhibit inputs for the packet merge, stamped INVOICE rather than EXHIBIT. */
export function noticeInvoiceExhibitInputs(docs: readonly NoticeInvoiceDoc[], toPdf: (doc: PhysicalInvoiceDocument) => Promise<Blob>): Promise<DemandExhibitInput[]> {
  return Promise.all(docs.map(async (d) => ({ label: 'A' as const, stamp: 'INVOICE', title: d.title, blob: await toPdf(d.doc) })))
}

/**
 * Print pages for the enclosed invoices — one section per invoice, each on its own sheet. The body is the invoice's
 * email body printed as paper (v2.7513): it opened *Please find your invoice attached as a PDF*, on a sheet of paper.
 */
export function noticeInvoicePrintSections(docs: readonly NoticeInvoiceDoc[]): string[] {
  return docs.map(
    (d) =>
      `<div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:0.72rem;color:#8a1c1c;font-weight:700;letter-spacing:0.08em;border:2px solid #8a1c1c;display:inline-block;padding:3px 6px;margin-bottom:0.8rem">INVOICE · enclosed with the § 53.056 notice (Tex. Prop. Code § 53.056(a-3))</div>` +
      buildPhysicalInvoiceEmailBodies(d.doc, { paper: true }).html,
  )
}
