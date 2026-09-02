import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { PhysicalInvoiceIssuer } from '../physicalInvoiceIssuer'
import { loadJsPDF } from '../loadJsPDF'

/**
 * Final demand letter (v2.2640, Lien Instruments phase 2): the lientooling.com
 * letter structure, upgraded with what the app actually knows — a DATED list
 * of prior notices (invoice sends, resends, recorded collection calls) instead
 * of "despite prior communication", and a Chapter 53 escalation line that can
 * quote this job's real lien-filing deadline. Pure paragraph model → HTML /
 * text / PDF; the § 31.04 theft-of-services line is a toggle, OFF by default
 * until the attorney package clears it.
 */

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

export type DemandPriorNotice = { date: string; label: string }

export type DemandLetterFields = {
  businessName: string
  senderName: string
  /** Multiline office address block. */
  businessAddress: string
  businessPhone: string
  businessEmail: string
  /** License line from the invoice-issuer settings (v2.2661 letterhead). */
  businessLicense?: string
  recipientName: string
  recipientEmail: string
  recipientAddress: string
  invoiceNumber: string
  /** YYYY-MM-DD */
  invoiceDate: string
  serviceDescription: string
  /** Raw dollar strings — formatted via demandMoney. */
  invoiceTotal: string
  paymentsReceived: string
  outstanding: string
  /** YYYY-MM-DD — the deadline the letter names. */
  deadlineDate: string
  paymentMethod: string
  includeSmallClaims: boolean
  includeLien: boolean
  /** YYYY-MM-DD — when set, the Chapter 53 line quotes it. */
  lienFilingDeadline: string
  /** Tex. Penal Code § 31.04 — OFF until attorney sign-off. */
  includeTheftOfServices: boolean
  includeLateFees: boolean
  includeNotarial: boolean
  priorNotices: DemandPriorNotice[]
}

export function demandMoney(input: string): string {
  const cleaned = (input ?? '').replace(/[$,\s]/g, '')
  if (!cleaned) return '$—'
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return input
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function demandDate(ymd: string): string {
  const d = (ymd ?? '').trim()
  if (!d) return '—'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  const parsed = new Date(d + 'T00:00:00')
  if (Number.isNaN(parsed.getTime())) return d
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

/** ymd + n business days (Sat/Sun skipped; legal holidays are not modeled). */
export function addBusinessDays(ymd: string, days: number): string {
  const base = new Date(ymd + 'T12:00:00')
  if (Number.isNaN(base.getTime())) return ymd
  let left = days
  while (left > 0) {
    base.setDate(base.getDate() + 1)
    const dow = base.getDay()
    if (dow !== 0 && dow !== 6) left--
  }
  return base.toISOString().slice(0, 10)
}

/**
 * Chapter 53 affidavit deadline for one furnishing month: the 15th day of the
 * 3rd (residential) / 4th (non-residential) month after it (§ 53.052), rolled
 * forward past Saturday/Sunday (§ 53.003 also rolls legal holidays — not
 * modeled here, so a holiday 15th shows the earlier, safe date).
 */
export function lienFilingDeadlineForMonth(furnishYmd: string, propertyKind: string): string {
  const d = (furnishYmd ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return ''
  const months = propertyKind === 'residential' ? 3 : 4
  const base = new Date(d.slice(0, 7) + '-15T12:00:00')
  if (Number.isNaN(base.getTime())) return ''
  base.setMonth(base.getMonth() + months)
  while (base.getDay() === 0 || base.getDay() === 6) base.setDate(base.getDate() + 1)
  return base.toISOString().slice(0, 10)
}

// ---------- document model ----------

export type DemandLetterBlock =
  | { kind: 'senderBlock'; company: string; licenseLine: string; contactLines: string[] }
  | { kind: 'meta'; text: string }
  | { kind: 'reLine'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'listItem'; text: string }
  | { kind: 'signature'; lines: string[] }
  | { kind: 'notarial' }

export function buildDemandLetterModel(f: DemandLetterFields, todayYmd: string): DemandLetterBlock[] {
  const out = demandMoney(f.outstanding)
  const blocks: DemandLetterBlock[] = []
  blocks.push({
    kind: 'senderBlock',
    company: f.businessName.trim() || f.senderName.trim(),
    licenseLine: (f.businessLicense ?? '').trim(),
    contactLines: [
      f.businessName.trim() ? f.senderName.trim() : '',
      f.businessAddress.replace(/\r?\n/g, ', ').trim(),
      [f.businessPhone.trim(), f.businessEmail.trim()].filter((l) => l).join(' · '),
    ].filter((l) => l),
  })
  blocks.push({ kind: 'meta', text: `Date: ${demandDate(todayYmd)}` })
  blocks.push({
    kind: 'meta',
    text: `TO: ${f.recipientName.trim() || '—'}${f.recipientAddress.trim() ? ` — ${f.recipientAddress.trim()}` : ''}`,
  })
  blocks.push({ kind: 'reLine', text: `Re: Final Demand for Payment — Invoice #${f.invoiceNumber.trim() || '—'}` })
  blocks.push({
    kind: 'paragraph',
    text: `Dear ${f.recipientName.trim() || '—'}, this letter serves as a final formal demand for payment in the amount of ${out} for services rendered by ${f.businessName.trim() || '—'}, as agreed upon between the parties. Despite the notices listed below, this balance remains unpaid.`,
  })
  blocks.push({ kind: 'heading', text: 'Details of Debt' })
  blocks.push({ kind: 'listItem', text: `Service provided: ${f.serviceDescription.trim() || '—'}` })
  blocks.push({ kind: 'listItem', text: `Invoice total: ${demandMoney(f.invoiceTotal)}` })
  blocks.push({ kind: 'listItem', text: `Payments received: ${demandMoney(f.paymentsReceived)}` })
  blocks.push({ kind: 'listItem', text: `Outstanding balance: ${out}` })
  blocks.push({ kind: 'heading', text: 'Notice History' })
  if (f.priorNotices.length === 0) {
    blocks.push({ kind: 'listItem', text: `Invoiced on ${demandDate(f.invoiceDate)}` })
  }
  for (const n of f.priorNotices) {
    blocks.push({ kind: 'listItem', text: `${demandDate(n.date)} — ${n.label}` })
  }
  blocks.push({ kind: 'heading', text: 'Demand' })
  blocks.push({
    kind: 'paragraph',
    text: `Unless payment in full is received by ${demandDate(f.deadlineDate)}, we will pursue all legal remedies available, including but not limited to:`,
  })
  if (f.includeSmallClaims) blocks.push({ kind: 'listItem', text: 'Initiating a small claims lawsuit' })
  if (f.includeLien) {
    blocks.push({
      kind: 'listItem',
      text:
        `Filing a mechanic's lien under Chapter 53 of the Texas Property Code` +
        (f.lienFilingDeadline ? ` (our filing window for this work runs through ${demandDate(f.lienFilingDeadline)})` : ''),
    })
  }
  if (f.includeTheftOfServices) {
    blocks.push({
      kind: 'listItem',
      text: 'Filing a theft of services report with local law enforcement under Texas Penal Code § 31.04',
    })
  }
  blocks.push({
    kind: 'paragraph',
    text: 'We would prefer to resolve this matter without legal action. Please treat this letter as a final opportunity to remit payment voluntarily.',
  })
  blocks.push({
    kind: 'paragraph',
    text:
      (f.paymentMethod.trim() ? `${f.paymentMethod.trim()} ` : '') +
      'If you believe this balance is incorrect or disputed, you must notify us in writing before the deadline above.',
  })
  if (f.includeLateFees) {
    blocks.push({
      kind: 'paragraph',
      text: 'Note: late fees and interest may continue to accrue on the unpaid balance until payment is received in full.',
    })
  }
  blocks.push({
    kind: 'signature',
    lines: ['Sincerely,', f.senderName.trim() || '—', f.businessName.trim(), f.businessPhone.trim(), f.businessEmail.trim()].filter(
      (l) => l,
    ),
  })
  if (f.includeNotarial) blocks.push({ kind: 'notarial' })
  return blocks
}

// ---------- HTML / text ----------

function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const NOTARIAL_TEXT_LINES = [
  'STATE OF TEXAS',
  'COUNTY OF ___________',
  'SWORN TO AND SUBSCRIBED BEFORE ME on this _____ day of _____________, ______.',
  '________________________________',
  'Notary Public, State of Texas',
]

export function buildDemandLetterEmailHtml(f: DemandLetterFields, todayYmd: string): string {
  const parts: string[] = []
  for (const b of buildDemandLetterModel(f, todayYmd)) {
    switch (b.kind) {
      case 'senderBlock':
        parts.push(
          `<div style="display:flex;justify-content:space-between;gap:1.5rem;margin:0 0 1em 0;padding-bottom:0.6em;border-bottom:1px solid #cfcbc2">` +
            `<div><div style="font-weight:700;font-size:1.12em">${esc(b.company)}</div>` +
            (b.licenseLine ? `<div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:0.72em;color:#7a756c;margin-top:0.15em">${esc(b.licenseLine)}</div>` : '') +
            `</div>` +
            `<div style="font-family:'Helvetica Neue',Arial,sans-serif;text-align:right;font-size:0.74em;color:#7a756c;line-height:1.5">${b.contactLines.map(esc).join('<br/>')}</div>` +
            `</div>`,
        )
        break
      case 'meta':
        parts.push(`<p style="margin:0 0 0.5em 0">${esc(b.text)}</p>`)
        break
      case 'reLine':
        parts.push(`<p style="text-align:center;margin:0.8em 0;font-weight:700">${esc(b.text)}</p>`)
        break
      case 'heading':
        parts.push(`<p style="margin:0.9em 0 0.3em 0;font-weight:700">${esc(b.text)}</p>`)
        break
      case 'paragraph':
        parts.push(`<p style="margin:0 0 0.7em 0">${esc(b.text)}</p>`)
        break
      case 'listItem':
        parts.push(`<p style="margin:0 0 0.25em 1.2em">• ${esc(b.text)}</p>`)
        break
      case 'signature':
        parts.push(`<p style="margin:1.2em 0 0 0">${b.lines.map(esc).join('<br/>')}</p>`)
        break
      case 'notarial':
        parts.push(`<p style="margin:2em 0 0 0">${NOTARIAL_TEXT_LINES.map(esc).join('<br/>')}</p>`)
        break
    }
  }
  return parts.join('')
}

export function buildDemandLetterText(f: DemandLetterFields, todayYmd: string): string {
  const lines: string[] = []
  for (const b of buildDemandLetterModel(f, todayYmd)) {
    switch (b.kind) {
      case 'senderBlock':
        lines.push([b.company, b.licenseLine, ...b.contactLines].filter((l) => l).join('\n'))
        break
      case 'signature':
        lines.push(b.lines.join('\n'))
        break
      case 'listItem':
        lines.push(`  • ${b.text}`)
        break
      case 'notarial':
        lines.push(NOTARIAL_TEXT_LINES.join('\n'))
        break
      default:
        lines.push(b.text)
    }
  }
  return lines.join('\n\n')
}

/** Full standalone print document — pinned light like all customer-facing paper. */
export function buildDemandLetterPrintHtml(f: DemandLetterFields, todayYmd: string, jobNumber: string): string {
  return `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>Final Demand for Payment — Job ${esc(jobNumber)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; background: #fff; max-width: 44rem; margin: 2.5rem auto; padding: 0 1.5rem; font-size: 0.95rem; line-height: 1.7; }
  @media print { body { margin: 0.5in auto; } }
</style></head><body>${buildDemandLetterEmailHtml(f, todayYmd)}</body></html>`
}

// ---------- PDF ----------

export function demandLetterPdfFilename(jobNumber: string): string {
  const slug = jobNumber.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'job'
  return `final-demand-letter-${slug}.pdf`
}

const PAGE_MARGIN = 20
const MAX_TEXT_WIDTH_MM = 176
const PAGE_CONTENT_MAX_Y = 266

export async function buildDemandLetterPdfBlob(f: DemandLetterFields, todayYmd: string): Promise<Blob> {
  const JsPDF = await loadJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'letter' })
  let y = PAGE_MARGIN + 4

  const ensureRoom = (needed: number) => {
    if (y + needed > PAGE_CONTENT_MAX_Y) {
      doc.addPage()
      y = PAGE_MARGIN
    }
  }
  const writeWrapped = (text: string, lh: number, opts?: { indent?: number; align?: 'right' | 'center' }) => {
    const indent = opts?.indent ?? 0
    const lines = doc.splitTextToSize(text, MAX_TEXT_WIDTH_MM - indent) as string[]
    for (const line of lines) {
      ensureRoom(lh)
      if (opts?.align === 'right') doc.text(line, PAGE_MARGIN + MAX_TEXT_WIDTH_MM, y, { align: 'right' })
      else if (opts?.align === 'center') doc.text(line, PAGE_MARGIN + MAX_TEXT_WIDTH_MM / 2, y, { align: 'center' })
      else doc.text(line, PAGE_MARGIN + indent, y)
      y += lh
    }
  }

  for (const b of buildDemandLetterModel(f, todayYmd)) {
    switch (b.kind) {
      case 'senderBlock': {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.setTextColor(28, 26, 23)
        doc.text(b.company, PAGE_MARGIN, y + 4.5)
        let leftY = y + 4.5
        if (b.licenseLine) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7.5)
          doc.setTextColor(122, 117, 108)
          leftY += 4
          doc.text(b.licenseLine, PAGE_MARGIN, leftY)
        }
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(122, 117, 108)
        let rightY = y + 3
        for (const l of b.contactLines) {
          doc.text(l, PAGE_MARGIN + MAX_TEXT_WIDTH_MM, rightY, { align: 'right' })
          rightY += 3.6
        }
        y = Math.max(leftY, rightY - 3.6) + 4
        doc.setDrawColor(207, 203, 194)
        doc.setLineWidth(0.25)
        doc.line(PAGE_MARGIN, y, PAGE_MARGIN + MAX_TEXT_WIDTH_MM, y)
        doc.setTextColor(28, 26, 23)
        y += 7
        break
      }
      case 'meta':
        doc.setFont('times', 'normal')
        doc.setFontSize(11)
        writeWrapped(b.text, 5.6)
        break
      case 'reLine':
        y += 2
        doc.setFont('times', 'bold')
        doc.setFontSize(11.5)
        writeWrapped(b.text, 6, { align: 'center' })
        y += 2
        break
      case 'heading':
        y += 2.5
        doc.setFont('times', 'bold')
        doc.setFontSize(11)
        writeWrapped(b.text, 5.6)
        break
      case 'paragraph':
        doc.setFont('times', 'normal')
        doc.setFontSize(11)
        writeWrapped(b.text, 5.6)
        y += 1.5
        break
      case 'listItem':
        doc.setFont('times', 'normal')
        doc.setFontSize(11)
        writeWrapped(`• ${b.text}`, 5.6, { indent: 5 })
        break
      case 'signature':
        y += 4
        doc.setFont('times', 'normal')
        doc.setFontSize(11)
        for (const l of b.lines) writeWrapped(l, 5.4)
        break
      case 'notarial':
        y += 8
        doc.setFont('times', 'normal')
        doc.setFontSize(10.5)
        for (const l of NOTARIAL_TEXT_LINES) writeWrapped(l, 5.4)
        break
    }
  }
  // Page footer (v2.2661): sender identity left, page number right, every page.
  const pages = doc.getNumberOfPages()
  const footerLeft = [f.businessName.trim(), f.businessPhone.trim()].filter((l) => l).join(' · ')
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(207, 203, 194)
    doc.setLineWidth(0.25)
    doc.line(PAGE_MARGIN, 270, PAGE_MARGIN + MAX_TEXT_WIDTH_MM, 270)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(122, 117, 108)
    if (footerLeft) doc.text(footerLeft, PAGE_MARGIN, 274)
    doc.text(`Page ${p} of ${pages}`, PAGE_MARGIN + MAX_TEXT_WIDTH_MM, 274, { align: 'right' })
  }
  return doc.output('blob')
}

// ---------- prefill ----------

export type DemandLetterPrefillContext = {
  job: JobWithDetails
  invoices: JobsLedgerInvoice[]
  issuer: PhysicalInvoiceIssuer | null
  senderName: string
  senderEmailFallback: string
  /** Bill-to override from the covered line when one exists; else the job customer. */
  recipient: { name: string; email: string; address: string }
  priorNotices: DemandPriorNotice[]
  /** '' | 'residential' | 'non_residential' from the linked property record. */
  propertyKind: string
  todayYmd: string
}

function sumApplied(job: JobWithDetails, invoiceId: string): number {
  let s = 0
  for (const p of job.payments ?? []) if (p.invoice_id === invoiceId) s += Number(p.amount ?? 0)
  return s
}

function moneyInput(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

export function buildDemandLetterPrefill(ctx: DemandLetterPrefillContext): DemandLetterFields {
  const { job, invoices, issuer, senderName, senderEmailFallback, recipient, priorNotices, propertyKind, todayYmd } = ctx
  const total = invoices.reduce((s, i) => s + Number(i.amount ?? 0), 0)
  const applied = invoices.reduce((s, i) => s + sumApplied(job, i.id), 0)
  const outstanding = Math.max(0, total - applied)
  const hcp = (job.hcp_number ?? '').trim()
  const firstBilled = invoices
    .map((i) => (i.billed_at ?? i.created_at ?? '').slice(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()[0]
  const lastWork = (job.last_work_date ?? '').slice(0, 10)
  return {
    businessName: (issuer?.companyName ?? '').trim(),
    senderName: senderName.trim(),
    businessAddress: (issuer?.addressText ?? '').trim(),
    businessPhone: (issuer?.phone ?? '').trim(),
    businessEmail: (issuer?.email ?? '').trim() || senderEmailFallback.trim(),
    businessLicense: (issuer?.licenseLine ?? '').trim(),
    recipientName: recipient.name.trim(),
    recipientEmail: recipient.email.trim(),
    recipientAddress: recipient.address.trim(),
    invoiceNumber: hcp ? `${hcp}` : invoices[0]?.id?.slice(0, 8) ?? '',
    invoiceDate: firstBilled ?? todayYmd,
    serviceDescription: (job.job_name ?? '').trim() || 'Plumbing services',
    invoiceTotal: moneyInput(total),
    paymentsReceived: moneyInput(applied),
    outstanding: moneyInput(outstanding),
    deadlineDate: addBusinessDays(todayYmd, 10),
    paymentMethod: '',
    includeSmallClaims: true,
    includeLien: true,
    lienFilingDeadline: /^\d{4}-\d{2}-\d{2}$/.test(lastWork) ? lienFilingDeadlineForMonth(lastWork, propertyKind) : '',
    includeTheftOfServices: false,
    includeLateFees: true,
    includeNotarial: false,
    priorNotices,
  }
}
