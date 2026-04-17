import { PHYSICAL_INVOICE_FOOTER_MAX_CHARS } from './physicalInvoiceFooter'
import { getPhysicalInvoiceIssuerForDocument, type PhysicalInvoiceIssuer } from './physicalInvoiceIssuer'
import {
  filterPaymentsForPhysicalInvoiceHistory,
  formatPaymentHistoryRows,
  resolvePhysicalInvoiceLinePresentation,
  totalMaterialLines,
  totalServiceLines,
  type PhysicalInvoiceFixtureInput,
  type PhysicalInvoiceMaterialInput,
  type PhysicalInvoiceMaterialLine,
  type PhysicalInvoicePaymentHistoryRow,
  type PhysicalInvoicePaymentInput,
  type PhysicalInvoiceServiceLine,
} from './physicalInvoiceLineItems'
import { APP_CALENDAR_TZ, referenceDateForWorkDateYmd } from '../utils/dateUtils'

export type {
  PhysicalInvoiceFixtureInput,
  PhysicalInvoiceMaterialInput,
  PhysicalInvoiceMaterialLine,
  PhysicalInvoicePaymentHistoryRow,
  PhysicalInvoicePaymentInput,
  PhysicalInvoiceServiceLine,
} from './physicalInvoiceLineItems'

/** Looks like pasted HTML: closing tags or a line-break tag. */
function physicalInvoiceFooterLooksLikeMinimalHtml(raw: string): boolean {
  return raw.includes('</') || /<br\b/i.test(raw)
}

/**
 * Normalize physical-invoice footer plain text for preview/PDF/email: line endings, strip BOM and
 * format/invisible characters, NFKC (fullwidth Latin etc.). Outer whitespace only; internal
 * newlines and blank lines are preserved. NFKC can change rare symbols—footers are expected to be
 * plain prose.
 */
export function normalizePhysicalInvoiceFooterPlainText(raw: string): string {
  let s = raw
  if (physicalInvoiceFooterLooksLikeMinimalHtml(s)) {
    s = s
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  }
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\u2028/g, '\n').replace(/\u2029/g, '\n')
  s = s.replace(/\p{Cf}/gu, '')
  s = s.normalize('NFKC')
  s = s.trim()
  return s
}

export type PhysicalInvoiceJobContext = {
  customer_name: string | null
  customer_email: string | null
  job_name: string | null
  hcp_number: string | null
  job_address?: string | null
  customer_phone?: string | null
  last_work_date?: string | null
}

export type PhysicalInvoiceDetailFromJob = {
  fixtures: PhysicalInvoiceFixtureInput[]
  materials: PhysicalInvoiceMaterialInput[]
  payments: PhysicalInvoicePaymentInput[]
  billingKind: 'job' | 'invoice'
  invoiceId: string | null
  invoiceSequenceOrder: number | null
}

export type PhysicalInvoiceDocument = {
  layout: 'simple' | 'detailed'
  /** True when job fixture+material totals matched the bill amount (else one synthetic service line). */
  breakdownMatches: boolean
  issuer: PhysicalInvoiceIssuer
  customerName: string
  customerEmail: string
  customerPhone: string
  jobName: string
  hcpLabel: string
  serviceAddress: string
  invoiceNumberDisplay: string
  paymentTerms: string
  serviceDateDisplay: string
  /** Hero narrative (same source as line description). */
  narrativeTitle: string
  amountFormatted: string
  subtotalFormatted: string
  lineDescription: string
  serviceLines: PhysicalInvoiceServiceLine[]
  materialLines: PhysicalInvoiceMaterialLine[]
  paymentHistory: PhysicalInvoicePaymentHistoryRow[]
  memo: string
  /** Trimmed legal/terms paragraph; empty omits that block only (issuer tagline/license may still show). */
  footer: string
  invoiceDateDisplay: string
  dueDateDisplay: string
}

function formatUsd(dollars: number): string {
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Long calendar label for a YYYY-MM-DD string (company TZ). */
export function formatPhysicalInvoiceLongDateYmd(ymd: string): string {
  const trimmed = ymd.trim()
  if (!trimmed) return '—'
  const ref = referenceDateForWorkDateYmd(trimmed)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(ref)
}

export function buildPhysicalInvoiceDocument(opts: {
  job: PhysicalInvoiceJobContext
  amountDollars: number
  lineDescription: string
  /** Trimmed Bill Customer "line on bill"; empty => proportional fixture rows like Stripe. */
  physicalLineOnBillRaw?: string
  memo: string
  footer?: string
  invoiceDateYmd: string
  dueDateYmd: string
  /** When set (e.g. Bill Customer with fetched job), use detailed HCP-style layout after reconciliation. */
  detailFromJob?: PhysicalInvoiceDetailFromJob | null
}): PhysicalInvoiceDocument | null {
  const {
    job,
    amountDollars,
    lineDescription,
    physicalLineOnBillRaw,
    memo,
    footer: footerRaw,
    invoiceDateYmd,
    dueDateYmd,
    detailFromJob,
  } = opts
  if (!Number.isFinite(amountDollars) || amountDollars <= 0) return null
  const customerName = (job.customer_name ?? '').trim() || 'Customer'
  const customerEmail = (job.customer_email ?? '').trim()
  const customerPhone = (job.customer_phone ?? '').trim()
  const jobName = (job.job_name ?? '').trim() || '—'
  const hcp = (job.hcp_number ?? '').trim()
  const serviceAddress = (job.job_address ?? '').trim()
  const footer = normalizePhysicalInvoiceFooterPlainText(footerRaw ?? '').slice(
    0,
    PHYSICAL_INVOICE_FOOTER_MAX_CHARS,
  )
  const issuer = getPhysicalInvoiceIssuerForDocument()
  const narrativeTrim = lineDescription.trim()
  const serviceDateYmd = (job.last_work_date ?? '').trim() || invoiceDateYmd
  const serviceDateDisplay = formatPhysicalInvoiceLongDateYmd(serviceDateYmd)
  const paymentTerms = 'Upon receipt'

  let layout: PhysicalInvoiceDocument['layout'] = 'simple'
  let breakdownMatches = false
  let serviceLines: PhysicalInvoiceServiceLine[] = []
  let materialLines: PhysicalInvoiceMaterialLine[] = []
  let paymentHistory: PhysicalInvoicePaymentHistoryRow[] = []
  let invoiceNumberDisplay =
    detailFromJob?.invoiceSequenceOrder != null ? `#${detailFromJob.invoiceSequenceOrder}` : hcp ? `#${hcp}` : '—'

  if (detailFromJob) {
    layout = 'detailed'
    const resolved = resolvePhysicalInvoiceLinePresentation(
      amountDollars,
      (physicalLineOnBillRaw ?? '').trim(),
      narrativeTrim,
      detailFromJob.fixtures,
      detailFromJob.materials,
    )
    breakdownMatches = resolved.breakdownMatches
    serviceLines = resolved.serviceLines
    materialLines = resolved.materialLines
    const payRows = filterPaymentsForPhysicalInvoiceHistory(
      detailFromJob.payments,
      detailFromJob.billingKind,
      detailFromJob.invoiceId,
    )
    paymentHistory = formatPaymentHistoryRows(payRows, formatUsd)
  }

  const subtotal =
    layout === 'detailed'
      ? totalServiceLines(serviceLines) + totalMaterialLines(materialLines)
      : amountDollars

  return {
    layout,
    breakdownMatches,
    issuer,
    customerName,
    customerEmail,
    customerPhone,
    jobName,
    hcpLabel: hcp || '—',
    serviceAddress,
    invoiceNumberDisplay,
    paymentTerms,
    serviceDateDisplay,
    narrativeTitle: narrativeTrim,
    amountFormatted: formatUsd(amountDollars),
    subtotalFormatted: formatUsd(subtotal),
    lineDescription: narrativeTrim,
    serviceLines,
    materialLines,
    paymentHistory,
    memo: memo.trim(),
    footer,
    invoiceDateDisplay: formatPhysicalInvoiceLongDateYmd(invoiceDateYmd),
    dueDateDisplay: formatPhysicalInvoiceLongDateYmd(dueDateYmd),
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function emailMetaRow(label: string, value: string): string {
  return `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top;font-size:13px">${escapeHtml(
    label,
  )}</td><td style="padding:4px 0;font-size:14px;color:#111827">${escapeHtml(value)}</td></tr>`
}

function linesTableText(title: string, rows: PhysicalInvoiceServiceLine[] | PhysicalInvoiceMaterialLine[]): string[] {
  if (!rows.length) return []
  const out: string[] = [ '', title, '---' ]
  for (const r of rows) {
    const desc = r.description.split('\n').join(' ')
    out.push(`${desc} | ${r.qty} × ${formatUsd(r.unitPrice)} = ${formatUsd(r.amount)}`)
  }
  return out
}

/** Plain text + HTML summary for the customer email (PDF is the source of truth for layout). */
export function buildPhysicalInvoiceEmailBodies(doc: PhysicalInvoiceDocument): { text: string; html: string } {
  const tagline = (doc.issuer.tagline ?? '').trim()
  const taglineHtml = tagline
    ? `<p style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#111827;white-space:pre-wrap;margin:0 0 12px"><strong>${escapeHtml(
        tagline,
      )}</strong></p>`
    : ''

  if (doc.layout === 'detailed') {
    const textLines = ['Please find your invoice attached as a PDF.', '']
    if (tagline) {
      textLines.push(tagline, '')
    }
    textLines.push(
      `Invoice ${doc.invoiceNumberDisplay}`,
      `Amount due: ${doc.amountFormatted}`,
      `Bill to: ${doc.customerName}`,
      `Job: ${doc.jobName}`,
      `Invoice date: ${doc.invoiceDateDisplay}`,
      `Due date: ${doc.dueDateDisplay}`,
      `Payment terms: ${doc.paymentTerms}`,
      '',
    )
    if (doc.narrativeTitle.trim()) {
      textLines.push('Scope:', doc.narrativeTitle)
    }
    textLines.push(
      ...linesTableText('Services', doc.serviceLines),
      ...linesTableText('Materials', doc.materialLines),
      '',
      `Subtotal: ${doc.subtotalFormatted}`,
    )
    if (doc.memo) {
      textLines.push('', 'Memo:', doc.memo)
    }
    if (doc.paymentHistory.length) {
      textLines.push('', 'Payment history:')
      for (const p of doc.paymentHistory) {
        textLines.push(` ${p.dateDisplay}  ${p.method}  ${p.amountFormatted}`)
      }
    }
    if (doc.footer) {
      textLines.push('', '----------------------------------------', doc.footer)
    }
    const text = textLines.join('\n')

    const lineRowsHtml = (
      title: string,
      rows: PhysicalInvoiceServiceLine[] | PhysicalInvoiceMaterialLine[],
    ): string => {
      if (!rows.length) return ''
      const head = `<p style="font-family:system-ui,sans-serif;font-size:14px;font-weight:600;color:#374151;margin:16px 0 8px">${escapeHtml(
        title,
      )}</p><table style="border-collapse:collapse;width:100%;font-family:system-ui,sans-serif;font-size:13px;border:1px solid #e5e7eb"><thead><tr style="background:#f9fafb"><th style="text-align:left;padding:6px 8px;border-bottom:1px solid #e5e7eb">Description</th><th style="text-align:right;padding:6px 8px;border-bottom:1px solid #e5e7eb;width:48px">Qty</th><th style="text-align:right;padding:6px 8px;border-bottom:1px solid #e5e7eb">Unit</th><th style="text-align:right;padding:6px 8px;border-bottom:1px solid #e5e7eb">Amount</th></tr></thead><tbody>`
      const body = rows
        .map(
          (r) =>
            `<tr><td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;white-space:pre-wrap">${escapeHtml(
              r.description,
            )}</td><td style="text-align:right;padding:6px 8px;border-bottom:1px solid #f3f4f6">${escapeHtml(
              String(r.qty),
            )}</td><td style="text-align:right;padding:6px 8px;border-bottom:1px solid #f3f4f6">${escapeHtml(
              formatUsd(r.unitPrice),
            )}</td><td style="text-align:right;padding:6px 8px;border-bottom:1px solid #f3f4f6">${escapeHtml(
              formatUsd(r.amount),
            )}</td></tr>`,
        )
        .join('')
      return `${head}${body}</tbody></table>`
    }

    const payHtml =
      doc.paymentHistory.length > 0
        ? `<p style="font-family:system-ui,sans-serif;font-size:14px;font-weight:600;color:#374151;margin:16px 0 8px">Payment history</p><table style="border-collapse:collapse;width:100%;font-size:13px;border:1px solid #e5e7eb">${doc.paymentHistory
            .map(
              (p) =>
                `<tr><td style="padding:6px 8px;border-bottom:1px solid #f3f4f6">${escapeHtml(
                  p.dateDisplay,
                )}</td><td style="padding:6px 8px;border-bottom:1px solid #f3f4f6">${escapeHtml(
                  p.method,
                )}</td><td style="text-align:right;padding:6px 8px;border-bottom:1px solid #f3f4f6">${escapeHtml(
                  p.amountFormatted,
                )}</td></tr>`,
            )
            .join('')}</table>`
        : ''

    const scopeHtml = doc.narrativeTitle.trim()
      ? `<p style="font-family:system-ui,sans-serif;font-size:14px;font-weight:600;color:#374151;margin:16px 0 4px">Scope</p>
<p style="font-family:system-ui,sans-serif;font-size:14px;color:#111827;white-space:pre-wrap;margin:0 0 8px">${escapeHtml(
          doc.narrativeTitle,
        )}</p>`
      : ''
    const html = `<p style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111827">Please find your invoice <strong>attached as a PDF</strong>.</p>${taglineHtml}<table style="border-collapse:collapse;margin:16px 0;font-family:system-ui,sans-serif">${emailMetaRow(
      'Invoice',
      doc.invoiceNumberDisplay,
    )}${emailMetaRow('Amount due', doc.amountFormatted)}${emailMetaRow('Bill to', doc.customerName)}${emailMetaRow(
      'Job',
      doc.jobName,
    )}${emailMetaRow('Invoice date', doc.invoiceDateDisplay)}${emailMetaRow(
      'Due date',
      doc.dueDateDisplay,
    )}${emailMetaRow(
      'Payment terms',
      doc.paymentTerms,
    )}</table>
${scopeHtml}${lineRowsHtml('Services', doc.serviceLines)}${lineRowsHtml('Materials', doc.materialLines)}
<p style="font-family:system-ui,sans-serif;font-size:14px;margin:12px 0 0"><strong>Subtotal:</strong> ${escapeHtml(
      doc.subtotalFormatted,
    )}</p>${
      doc.memo
        ? `<p style="font-family:system-ui,sans-serif;font-size:14px;font-weight:600;color:#374151;margin:16px 0 4px">Memo</p><p style="font-family:system-ui,sans-serif;font-size:14px;color:#111827;white-space:pre-wrap;margin:0">${escapeHtml(
            doc.memo,
          )}</p>`
        : ''
    }${payHtml}${
      doc.footer
        ? `<div style="height:3px;background:#d1d5db;margin:16px 0 12px;border-radius:1px"></div><p style="font-family:system-ui,sans-serif;font-size:14px;color:#111827;white-space:pre-wrap;margin:0">${escapeHtml(
            doc.footer,
          )}</p>`
        : ''
    }`
    return { text, html }
  }

  const textLines = ['Please find your invoice attached as a PDF.', '']
  if (tagline) {
    textLines.push(tagline, '')
  }
  textLines.push(
    `Amount due: ${doc.amountFormatted}`,
    `Bill to: ${doc.customerName}`,
    `Job: ${doc.jobName}`,
    `Job #: ${doc.hcpLabel}`,
    `Invoice date: ${doc.invoiceDateDisplay}`,
    `Due date: ${doc.dueDateDisplay}`,
  )
  if (doc.lineDescription.trim()) {
    textLines.push('', 'Description:', doc.lineDescription)
  }
  if (doc.memo) {
    textLines.push('', 'Memo:', doc.memo)
  }
  if (doc.footer) {
    textLines.push('', '----------------------------------------', doc.footer)
  }
  const text = textLines.join('\n')
  const simpleDescHtml = doc.lineDescription.trim()
    ? `<p style="font-family:system-ui,sans-serif;font-size:14px;font-weight:600;color:#374151;margin:16px 0 4px">Description</p>
<p style="font-family:system-ui,sans-serif;font-size:14px;color:#111827;white-space:pre-wrap;margin:0 0 16px">${escapeHtml(
        doc.lineDescription,
      )}</p>`
    : ''
  const html = `<p style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111827">Please find your invoice <strong>attached as a PDF</strong>.</p>${taglineHtml}<table style="border-collapse:collapse;margin:16px 0;font-family:system-ui,sans-serif">${emailMetaRow(
    'Amount due',
    doc.amountFormatted,
  )}${emailMetaRow('Bill to', doc.customerName)}${emailMetaRow('Job', doc.jobName)}${emailMetaRow(
    'Job #',
    doc.hcpLabel,
  )}${emailMetaRow('Invoice date', doc.invoiceDateDisplay)}${emailMetaRow('Due date', doc.dueDateDisplay)}</table>
${simpleDescHtml}${
    doc.memo
      ? `<p style="font-family:system-ui,sans-serif;font-size:14px;font-weight:600;color:#374151;margin:16px 0 4px">Memo</p><p style="font-family:system-ui,sans-serif;font-size:14px;color:#111827;white-space:pre-wrap;margin:0">${escapeHtml(
          doc.memo,
        )}</p>`
      : ''
  }${
    doc.footer
      ? `<div style="height:3px;background:#d1d5db;margin:16px 0 12px;border-radius:1px"></div><p style="font-family:system-ui,sans-serif;font-size:14px;color:#111827;white-space:pre-wrap;margin:0">${escapeHtml(
          doc.footer,
        )}</p>`
      : ''
  }`
  return { text, html }
}

export function physicalInvoiceEmailSubject(doc: PhysicalInvoiceDocument): string {
  const id =
    doc.invoiceNumberDisplay && doc.invoiceNumberDisplay !== '—'
      ? doc.invoiceNumberDisplay
      : doc.hcpLabel && doc.hcpLabel !== '—'
        ? `#${doc.hcpLabel}`
        : '—'
  return `Click Plumbing Invoice [${id}]`
}
