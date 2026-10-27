/**
 * The estimate on paper (v2.5993, punch list #204 PR 3): every line the PDF draws, pure, from the
 * row and the resolved customer experience — the office's second ask from the City of Seguin case:
 * *"Need an option to also download the PDF to send to more than one person."* A city routes a quote
 * to people who are not the link's addressee, so the paper reads as the customer page did: the
 * title, the For line, the good-through day, every option with its lines and total (or the one set
 * of lines), the terms, and how to approve — never the link's token (the owner's call 6): a token in
 * a file that gets forwarded is a token nobody can retire. The drawing is `estimatePaperPdf.ts`;
 * a download is a send and files a copy (`docs/SENT_COPIES.md`).
 */
import { normalizeEstimateLineItemsFromJson, type EstimateLineItemNormalized } from '../estimateLineItemNormalize'
import { changeOrderDocDisplayTitle, formatSignedCentsUsd, isChangeOrderDocKind, parseEstimateChangeOrderFields } from '../estimateChangeOrder'
import { formatValidUntilForDisplay } from '../formatEstimateValidUntilDisplay'
import { parseAcceptHeaderBrand, type EstimateAcceptHeaderBrand } from '../estimateAcceptHeaderBrand'
import { estimateEmailCompanyName } from '../../../supabase/functions/_shared/estimateEmailLetterhead'
import { estimateOptionTotalCents, normalizeEstimateOptionsFromJson, type EstimateOption } from './estimateOptions'
import { estimateOfferedOptionsView } from './estimateOfferedOptionsView'
import { acceptedEstimateOptionKeys, describeAcceptedEstimateRecord } from './estimateAcceptedRecord'

export type EstimatePaperLine = { name: string; description: string; count: string; unit: string; amount: string }

export type EstimatePaperBlock = {
  /** `Option 2 · HDPE water line`; empty for the one block of a single-price estimate. */
  heading: string
  /** `★ Recommended` · `Add-on` · `Starts ticked` · `Accepted`. */
  tags: string[]
  pitch: string
  lines: EstimatePaperLine[]
  /** The block's own total; empty for the one block of a single-price estimate (the total line says it). */
  total: string
}

export type EstimatePaperModel = {
  /** `Estimate 175 - City of Seguin.pdf` */
  fileName: string
  /** The sent copy's title: `Estimate 175 · City of Seguin`. */
  copyTitle: string
  company: string
  brand: EstimateAcceptHeaderBrand | null
  title: string
  /** `Estimate #175 · sent Sep 24, 2026` */
  kindLine: string
  /** `For 1433 Stagecoach Road, Seguin, TX`; null when the row has none. */
  forLine: string | null
  /** `Good through Thu Nov 26, 2026`; null when the row has no date. */
  goodThrough: string | null
  /** A change order's facts, one a line; empty on an estimate. */
  changeOrder: string[]
  linesHeading: string
  blocks: EstimatePaperBlock[]
  /** `Total $10,972.00` · `Net change to contract +$1,200.00` */
  totalLine: string
  /** Under the total: the recommended option's standing, or what was accepted of what was offered. */
  totalNote: string | null
  /** `Accepted by Dana Ruiz on Oct 2, 2026.`; null until accepted. */
  acceptedLine: string | null
  termsHeading: string
  terms: string[]
  /** `This estimate is subject to our Terms and Conditions: https://…/estimate/terms`; null with no link. */
  termsLink: string | null
  /** How to approve, with no token in it; empty once the estimate is no longer open. */
  approve: string
  footer: string[]
}

export type EstimatePaperRow = {
  estimate_number: number
  title: string | null
  doc_kind: string | null
  status: string
  sent_at: string | null
  valid_until: string | null
  line_items_snapshot: unknown
  options_snapshot: unknown
  terms_snapshot: string | null
  total_cents: number
  customer_email: string | null
  accept_header_brand: string | null
  change_order_fields: unknown
  accepted_option_key?: string | null
  accepted_option_keys?: string[] | null
  acceptor_printed_name?: string | null
  acceptor_consented_at?: string | null
}

export type EstimatePaperExperience = {
  docTitleFallback: string
  docLineItemsHeading: string
  docTermsHeading: string
  docTotalLabel: string
  acceptPageFooter: string
}

export type EstimatePaperInput = {
  row: EstimatePaperRow
  customerName: string | null
  /** The For line as the customer page resolves it (the override, else the customer's address). */
  forLine: string | null
  experience: EstimatePaperExperience | null
  /** The public terms page; null leaves the link line out. */
  termsHref: string | null
}

export function formatPaperMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

const dayWords = (iso: string | null | undefined): string | null => {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(t))
}

const countWords = (q: number): string => (Number.isInteger(q) ? String(q) : String(q))

export function paperLines(lines: EstimateLineItemNormalized[]): EstimatePaperLine[] {
  return lines.map((l) => ({
    name: (l.line_item ?? '').trim() || '—',
    description: (l.description ?? '').trim(),
    count: countWords(l.quantity),
    unit: formatPaperMoney(l.unit_price_cents),
    amount: formatPaperMoney(l.amount_cents ?? l.quantity * l.unit_price_cents),
  }))
}

/** `Estimate 175 - City of Seguin.pdf`: the number and the customer's name, file-safe. */
export function estimatePdfFileName(estimateNumber: number, customerName: string | null, docKind: string | null): string {
  const kind = isChangeOrderDocKind(docKind) ? 'Change order' : 'Estimate'
  const who = (customerName ?? '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
  return who ? `${kind} ${estimateNumber} - ${who}.pdf` : `${kind} ${estimateNumber}.pdf`
}

/** The paragraphs of the terms, blank lines between. */
function termsParagraphs(terms: string | null): string[] {
  return (terms ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function approveWords(row: EstimatePaperRow, isCo: boolean): string {
  if (row.status !== 'sent') return ''
  const what = isCo ? 'change order' : 'estimate'
  const to = (row.customer_email ?? '').trim()
  return to
    ? `To approve this ${what}, open the link in the email sent to ${to}. The link is not in this file.`
    : `To approve this ${what}, open the link in the email you received. The link is not in this file.`
}

export function estimatePaperModel(input: EstimatePaperInput): EstimatePaperModel {
  const { row, experience } = input
  const isCo = isChangeOrderDocKind(row.doc_kind)
  const brand = parseAcceptHeaderBrand(row.accept_header_brand)
  const company = estimateEmailCompanyName(brand)
  const rawTitle = (row.title ?? '').trim()
  const title = (isCo ? changeOrderDocDisplayTitle(rawTitle) : rawTitle) || experience?.docTitleFallback || (isCo ? 'Change order' : 'Estimate')
  const sent = dayWords(row.sent_at)
  const kindLine = `${isCo ? 'Change order' : 'Estimate'} #${row.estimate_number}${sent ? ` · sent ${sent}` : ''}`
  const forLine = input.forLine?.trim() ? `For ${input.forLine.trim()}` : null
  const gt = (row.valid_until ?? '').trim().slice(0, 10)
  const goodThrough = /^\d{4}-\d{2}-\d{2}$/.test(gt) ? `Good through ${formatValidUntilForDisplay(gt)}` : null

  const changeOrder: string[] = []
  if (isCo) {
    const co = parseEstimateChangeOrderFields(row.change_order_fields)
    changeOrder.push(`Description of change: ${co.description_of_change.trim() || '—'}`)
    changeOrder.push(`Reason for change: ${co.reason_for_change.trim() || '—'}`)
    changeOrder.push(`Impact on schedule: ${co.impact_on_schedule.trim() || '—'}`)
    if (co.response_requested_by.trim()) changeOrder.push(`Response requested by: ${co.response_requested_by.trim()}`)
  }

  const options: EstimateOption[] = isCo ? [] : normalizeEstimateOptionsFromJson(row.options_snapshot)
  const accepted = row.status === 'customer_accepted'
  const frozen = normalizeEstimateLineItemsFromJson(row.line_items_snapshot, { allowNegative: isCo })
  const totalLabel = experience?.docTotalLabel ?? (isCo ? 'Net change to contract' : 'Total')
  const totalMoney = isCo ? formatSignedCentsUsd(row.total_cents) : formatPaperMoney(row.total_cents)

  let linesHeading = experience?.docLineItemsHeading ?? (isCo ? 'Impact on cost' : 'Line items')
  let blocks: EstimatePaperBlock[]
  let totalNote: string | null = null
  if (options.length >= 2 && !accepted) {
    const view = estimateOfferedOptionsView(options, formatPaperMoney, { accepted: true })
    linesHeading = view.heading
    blocks = view.blocks.map((b) => ({ heading: b.heading, tags: b.chips, pitch: b.pitch, lines: paperLines(b.lines), total: b.money }))
    const rec = options.find((o) => o.recommended)
    totalNote = rec
      ? `The recommended option, "${rec.name.trim() || 'Option'}". The customer chooses on the acceptance page.`
      : 'The customer chooses on the acceptance page.'
  } else if (options.length >= 2 && accepted) {
    const keys = acceptedEstimateOptionKeys(row)
    const picked = options.filter((o) => keys.includes(o.key))
    blocks = picked.map((o) => ({
      heading: o.name.trim() || 'Option',
      tags: ['Accepted'],
      pitch: o.description.trim(),
      lines: paperLines(o.line_items),
      total: formatPaperMoney(estimateOptionTotalCents(o)),
    }))
    if (blocks.length === 0) blocks = [{ heading: '', tags: [], pitch: '', lines: paperLines(frozen), total: '' }]
    const record = describeAcceptedEstimateRecord(options, keys, formatPaperMoney, row.total_cents)
    totalNote = record.headline ? `${record.headline} ${record.offeredNote}` : null
  } else {
    blocks = [{ heading: '', tags: [], pitch: '', lines: paperLines(frozen), total: '' }]
  }

  const acceptedDay = dayWords(row.acceptor_consented_at ?? null)
  const acceptedLine = accepted
    ? `Accepted${row.acceptor_printed_name?.trim() ? ` by ${row.acceptor_printed_name.trim()}` : ''}${acceptedDay ? ` on ${acceptedDay}` : ''}.`
    : null

  const footer = (experience?.acceptPageFooter ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  return {
    fileName: estimatePdfFileName(row.estimate_number, input.customerName, row.doc_kind),
    copyTitle: `${isCo ? 'Change order' : 'Estimate'} ${row.estimate_number}${input.customerName?.trim() ? ` · ${input.customerName.trim()}` : ''}`,
    company,
    brand,
    title,
    kindLine,
    forLine,
    goodThrough,
    changeOrder,
    linesHeading,
    blocks,
    totalLine: `${totalLabel} ${totalMoney}`,
    totalNote,
    acceptedLine,
    termsHeading: experience?.docTermsHeading ?? 'Terms',
    terms: termsParagraphs(row.terms_snapshot),
    termsLink: input.termsHref ? `This ${isCo ? 'change order' : 'estimate'} is subject to our Terms and Conditions: ${input.termsHref}` : null,
    approve: approveWords(row, isCo),
    footer,
  }
}
