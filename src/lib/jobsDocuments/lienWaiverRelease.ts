import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { PhysicalInvoiceIssuer } from '../physicalInvoiceIssuer'
import { loadJsPDF } from '../loadJsPDF'

/**
 * Lien waiver-and-release documents issued from the Jobs board (v2.2579):
 * the owner-drafted three-form family — conditional/unconditional on progress
 * payment, unconditional on final payment. Pure builders (paragraph model →
 * HTML / text / PDF) so content is unit-testable without jsPDF; prefill maps
 * job + invoice data into the fields. Print/copy documents stay light like
 * every customer-facing paper.
 */

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

export type LienWaiverFormType = 'conditional_progress' | 'unconditional_progress' | 'unconditional_final'

export const LIEN_WAIVER_FORM_TYPES: readonly LienWaiverFormType[] = [
  'conditional_progress',
  'unconditional_progress',
  'unconditional_final',
]

export const LIEN_WAIVER_FORM_SHORT_LABELS: Record<LienWaiverFormType, string> = {
  conditional_progress: 'Conditional · progress',
  unconditional_progress: 'Unconditional · progress',
  unconditional_final: 'Unconditional · final',
}

export function lienWaiverTitle(formType: LienWaiverFormType): string {
  switch (formType) {
    case 'conditional_progress':
      return 'Conditional Waiver and Release on Progress Payment'
    case 'unconditional_progress':
      return 'Unconditional Waiver and Release on Progress Payment'
    case 'unconditional_final':
      return 'Unconditional Waiver and Release on Final Payment'
    default: {
      const _e: never = formType
      return _e
    }
  }
}

export type LienWaiverFields = {
  /** Contractor / releasing party (signature block + body). */
  companyName: string
  /** Owner / payor the check comes from (conditional form only). */
  checkFrom: string
  /** Payment amount — raw user string; formatted for display via lienWaiverMoney. */
  amount: string
  /** Project name + address as one description line. */
  projectDescription: string
  /** YYYY-MM-DD — progress payments covered through (progress forms only). */
  throughDate: string
  /** YYYY-MM-DD — the date on the signature block. */
  signedDate: string
  signerName: string
  signerTitle: string
}

/** Which fields the form type actually uses (drives the modal's field list). */
export function lienWaiverUsesField(formType: LienWaiverFormType, field: keyof LienWaiverFields): boolean {
  if (field === 'checkFrom') return formType === 'conditional_progress'
  if (field === 'throughDate') return formType !== 'unconditional_final'
  return true
}

/** "$2,200.00" from "2200", "2,200.00", "$2200" — unparseable input passes through. */
export function lienWaiverMoney(input: string): string {
  const cleaned = (input ?? '').replace(/[$,\s]/g, '')
  if (!cleaned) return '$—'
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return input
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/** "August 29, 2026" from "2026-08-29" — anything else passes through ('' → '—'). */
export function lienWaiverDate(ymd: string): string {
  const d = (ymd ?? '').trim()
  if (!d) return '—'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  const parsed = new Date(d + 'T00:00:00')
  if (Number.isNaN(parsed.getTime())) return d
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

/**
 * The document body, one string per paragraph — the owner-drafted language
 * (2026-09-01 doc), values interpolated. Signature block is separate.
 */
export function buildLienWaiverParagraphs(formType: LienWaiverFormType, f: LienWaiverFields): string[] {
  const amount = lienWaiverMoney(f.amount)
  const company = f.companyName.trim() || '—'
  const project = f.projectDescription.trim() || '—'
  const through = lienWaiverDate(f.throughDate)
  switch (formType) {
    case 'conditional_progress':
      return [
        `Upon receipt by the undersigned of a check from ${f.checkFrom.trim() || '—'} in the sum of ${amount} payable to ${company} and when the check has been properly endorsed and has cleared the bank, this document shall become effective to waive and release any lien, stop payment notice, or bond right the undersigned has on the project described as:`,
        `${project}, to the following extent:`,
        `This release covers progress payments through: ${through}, only and does not cover any retentions, unpaid changes, or items furnished after that date.`,
        `This release is conditional upon actual receipt and clearance of the above payment.`,
      ]
    case 'unconditional_progress':
      return [
        `The undersigned has been paid and has received progress payment(s) totaling ${amount} for all labor, services, equipment, or materials furnished to the property located at:`,
        `${project}, through ${through}, and does hereby waive and release any right to file a mechanic's lien, stop notice, or claim on any bond for that portion of the work.`,
        `This release does not affect any retainage, pending change orders, or disputed claims for extra work.`,
      ]
    case 'unconditional_final':
      return [
        `The undersigned has been paid in full for all work, labor, materials, and services provided on the project located at:`,
        `${project}.`,
        `In consideration of this final payment of ${amount}, the undersigned hereby fully and unconditionally waives, releases, and discharges any and all rights to a mechanic's lien, stop payment notice, or claim against a payment bond related to this project.`,
        `This release covers all amounts due through the date below and confirms all contractual obligations are satisfied.`,
      ]
    default: {
      const _e: never = formType
      return _e
    }
  }
}

export type LienWaiverSignatureLine = { label: string; value: string }

export function buildLienWaiverSignatureLines(f: LienWaiverFields): LienWaiverSignatureLine[] {
  return [
    { label: 'Date', value: lienWaiverDate(f.signedDate) },
    { label: 'Contractor', value: f.companyName.trim() || '—' },
    { label: 'By', value: f.signerName.trim() },
    { label: 'Title', value: f.signerTitle.trim() },
  ]
}

// ---------- prefill ----------

export type LienWaiverPrefillContext = {
  job: JobWithDetails
  /** The bill line(s) this release covers — [] falls back to job-level totals. */
  invoices: JobsLedgerInvoice[]
  issuer: PhysicalInvoiceIssuer | null
  /** From job_property_owners when present; falls back to the job's customer. */
  ownerName: string | null
  signerName: string
}

function sumAppliedToInvoice(job: JobWithDetails, invoiceId: string): number {
  let s = 0
  for (const p of job.payments ?? []) {
    if (p.invoice_id === invoiceId) s += Number(p.amount ?? 0)
  }
  return s
}

/** Open remaining on one bill line (never negative). */
export function lienWaiverInvoiceOpenRemaining(job: JobWithDetails, inv: JobsLedgerInvoice): number {
  return Math.max(0, Number(inv.amount ?? 0) - sumAppliedToInvoice(job, inv.id))
}

function ymdFromIso(iso: string | null | undefined): string {
  const d = (iso ?? '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : ''
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

function moneyInputStr(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

/**
 * Amount by form type: conditional + final release the check being waited on /
 * handed over → open remaining on the selection; unconditional progress
 * acknowledges money already received → applied payments (falling back to the
 * lines' full amounts when nothing is recorded yet). Empty selection falls
 * back to job-level revenue/payments totals.
 */
export function lienWaiverPrefillAmount(
  formType: LienWaiverFormType,
  job: JobWithDetails,
  invoices: JobsLedgerInvoice[],
): number {
  if (invoices.length === 0) {
    const revenue = Number(job.revenue ?? 0)
    const paid = Number(job.payments_made ?? 0)
    return formType === 'unconditional_progress' ? Math.max(0, paid) : Math.max(0, revenue - paid)
  }
  if (formType === 'unconditional_progress') {
    const applied = invoices.reduce((s, inv) => s + sumAppliedToInvoice(job, inv.id), 0)
    if (applied > 0) return applied
    return invoices.reduce((s, inv) => s + Number(inv.amount ?? 0), 0)
  }
  return invoices.reduce((s, inv) => s + lienWaiverInvoiceOpenRemaining(job, inv), 0)
}

export function buildLienWaiverPrefill(formType: LienWaiverFormType, ctx: LienWaiverPrefillContext): LienWaiverFields {
  const { job, invoices, issuer, ownerName, signerName } = ctx
  const name = (job.job_name ?? '').trim()
  const address = (job.job_address ?? '').trim()
  const projectDescription = name && address ? `${name} — ${address}` : name || address
  const throughDate =
    invoices.map((i) => ymdFromIso(i.billed_at) || ymdFromIso(i.created_at)).filter(Boolean).sort().pop() ??
    (ymdFromIso(job.last_work_date) || todayYmd())
  return {
    companyName: (issuer?.companyName ?? '').trim() || 'ClickConstruction LLC',
    checkFrom: (ownerName ?? '').trim() || (job.gcCustomer?.name ?? '').trim() || (job.customer_name ?? '').trim(),
    amount: moneyInputStr(lienWaiverPrefillAmount(formType, job, invoices)),
    projectDescription,
    throughDate,
    signedDate: todayYmd(),
    signerName: signerName.trim(),
    signerTitle: '',
  }
}

// ---------- HTML (print + clipboard) ----------

function esc(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Body fragment shared by print and copy-for-email (inline styles only). */
export function buildLienWaiverEmailHtml(formType: LienWaiverFormType, f: LienWaiverFields): string {
  const title = `<p style="text-align:center;margin:0 0 1em 0;font-weight:700;text-transform:uppercase;letter-spacing:0.04em">${esc(lienWaiverTitle(formType))}</p>`
  const body = buildLienWaiverParagraphs(formType, f)
    .map((p) => `<p style="margin:0 0 0.75em 0">${esc(p)}</p>`)
    .join('')
  const sig = buildLienWaiverSignatureLines(f)
    .map((l) => `<p style="margin:1.25em 0 0 0">${esc(l.label)}: ${l.value ? '<strong>' + esc(l.value) + '</strong>' : '______________________'}</p>`)
    .join('')
  return title + body + sig
}

export function buildLienWaiverEmailText(formType: LienWaiverFormType, f: LienWaiverFields): string {
  const sig = buildLienWaiverSignatureLines(f)
    .map((l) => `${l.label}: ${l.value || '______________________'}`)
    .join('\n\n')
  return [lienWaiverTitle(formType).toUpperCase(), '', ...buildLienWaiverParagraphs(formType, f), '', sig].join('\n\n')
}

// ---------- electronic signature (v2.2619, the signing loop) ----------

export type LienWaiverSignature = {
  mode: 'type' | 'draw'
  printedName: string
  /** PNG data URL for draw-mode signatures; ignored for typed. */
  pngDataUrl?: string | null
  /** The one-line audit stamp (see lienReleaseSignatureAuditLine) rendered under the signature. */
  auditLine: string
}

/** The signature block appended to every rendering of a signed release. */
export function buildLienWaiverSignatureHtml(sig: LienWaiverSignature): string {
  const name =
    sig.mode === 'draw' && sig.pngDataUrl
      ? `<img src="${sig.pngDataUrl}" alt="Signature of ${esc(sig.printedName)}" style="display:block;max-width:280px;max-height:110px" />`
      : `<div style="font-family:'Great Vibes', cursive; font-size:2.1em; line-height:1.15">${esc(sig.printedName)}</div>`
  return (
    `<div style="margin-top:1.4em">${name}` +
    `<div style="border-top:1px solid #1a1a1a; width:280px; margin-top:0.2em; padding-top:0.2em; font-size:0.85em">${esc(sig.printedName)}</div>` +
    `<p style="margin:0.5em 0 0; font-family:system-ui,sans-serif; font-size:0.7em; color:#6b7280">${esc(sig.auditLine)}</p></div>`
  )
}

/** Full standalone print document — pinned light like all customer-facing paper. Signed releases carry the signature block. */
export function buildLienWaiverPrintHtml(
  formType: LienWaiverFormType,
  f: LienWaiverFields,
  jobNumber: string,
  signature?: LienWaiverSignature | null,
): string {
  const fontLink =
    signature && signature.mode === 'type'
      ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap">`
      : ''
  const sigHtml = signature ? buildLienWaiverSignatureHtml(signature) : ''
  return `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>${esc(lienWaiverTitle(formType))} — Job ${esc(jobNumber)}</title>${fontLink}
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; background: #fff; max-width: 42rem; margin: 2.5rem auto; padding: 0 1.5rem; font-size: 0.95rem; line-height: 1.75; }
  @media print { body { margin: 0.5in auto; } }
</style></head><body>${buildLienWaiverEmailHtml(formType, f)}${sigHtml}</body></html>`
}

// ---------- PDF ----------

export type LienWaiverPdfBlock =
  | { kind: 'title'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'signature'; label: string; value: string }

export function buildLienWaiverPdfModel(formType: LienWaiverFormType, f: LienWaiverFields): LienWaiverPdfBlock[] {
  return [
    { kind: 'title', text: lienWaiverTitle(formType) },
    ...buildLienWaiverParagraphs(formType, f).map((text): LienWaiverPdfBlock => ({ kind: 'paragraph', text })),
    ...buildLienWaiverSignatureLines(f).map((l): LienWaiverPdfBlock => ({ kind: 'signature', label: l.label, value: l.value })),
  ]
}

export function lienWaiverPdfFilename(formType: LienWaiverFormType, jobNumber: string): string {
  const slug = jobNumber.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'job'
  return `lien-release-${formType.replace(/_/g, '-')}-${slug}.pdf`
}

const PAGE_MARGIN = 22
const MAX_TEXT_WIDTH_MM = 172
const PAGE_CONTENT_MAX_Y = 265

export async function buildLienWaiverPdfBlob(
  formType: LienWaiverFormType,
  f: LienWaiverFields,
  signature?: LienWaiverSignature | null,
): Promise<Blob> {
  const JsPDF = await loadJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'letter' })
  let y = PAGE_MARGIN + 8

  const ensureRoom = (needed: number) => {
    if (y + needed > PAGE_CONTENT_MAX_Y) {
      doc.addPage()
      y = PAGE_MARGIN
    }
  }

  const writeWrapped = (text: string, lineHeight: number, opts?: { center?: boolean }) => {
    const lines = doc.splitTextToSize(text, MAX_TEXT_WIDTH_MM) as string[]
    for (const line of lines) {
      ensureRoom(lineHeight)
      if (opts?.center) {
        doc.text(line, PAGE_MARGIN + MAX_TEXT_WIDTH_MM / 2, y, { align: 'center' })
      } else {
        doc.text(line, PAGE_MARGIN, y)
      }
      y += lineHeight
    }
  }

  for (const block of buildLienWaiverPdfModel(formType, f)) {
    switch (block.kind) {
      case 'title':
        doc.setFont('times', 'bold')
        doc.setFontSize(14)
        writeWrapped(block.text.toUpperCase(), 7, { center: true })
        y += 6
        break
      case 'paragraph':
        doc.setFont('times', 'normal')
        doc.setFontSize(11.5)
        writeWrapped(block.text, 6.2)
        y += 3
        break
      case 'signature': {
        y += 7
        ensureRoom(8)
        doc.setFont('times', 'normal')
        doc.setFontSize(11.5)
        if (block.value) {
          doc.text(`${block.label}: ${block.value}`, PAGE_MARGIN, y)
        } else {
          doc.text(`${block.label}: `, PAGE_MARGIN, y)
          const labelWidth = doc.getTextWidth(`${block.label}: `)
          doc.setDrawColor(26, 26, 26)
          doc.line(PAGE_MARGIN + labelWidth, y + 1, PAGE_MARGIN + labelWidth + 70, y + 1)
        }
        break
      }
    }
  }

  if (signature) {
    y += 10
    // Draw-mode embeds the captured PNG; typed renders the name in italic
    // serif (jsPDF has no webfont — the cursive face is a screen nicety, the
    // printed name + audit line are what carry legal weight).
    if (signature.mode === 'draw' && signature.pngDataUrl) {
      ensureRoom(30)
      try {
        doc.addImage(signature.pngDataUrl, 'PNG', PAGE_MARGIN, y, 62, 24)
        y += 26
      } catch {
        // Bad image data — fall through to the typed rendering below.
        doc.setFont('times', 'italic')
        doc.setFontSize(19)
        writeWrapped(signature.printedName, 9)
      }
    } else {
      ensureRoom(12)
      doc.setFont('times', 'italic')
      doc.setFontSize(19)
      writeWrapped(signature.printedName, 9)
    }
    ensureRoom(12)
    doc.setDrawColor(26, 26, 26)
    doc.line(PAGE_MARGIN, y, PAGE_MARGIN + 70, y)
    y += 5
    doc.setFont('times', 'normal')
    doc.setFontSize(10)
    doc.text(signature.printedName, PAGE_MARGIN, y)
    y += 5.5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(107, 114, 128)
    doc.text(signature.auditLine, PAGE_MARGIN, y)
    doc.setTextColor(26, 26, 26)
  }

  return doc.output('blob')
}
