import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { PhysicalInvoiceIssuer } from '../physicalInvoiceIssuer'
import type { PhysicalInvoiceDocument } from '../physicalInvoiceDocument'
import type { StripeInvoiceLineDetail } from '../stripeInvoiceDetailsResponse'
import { effectiveInvoiceParty, type EffectiveBillParty } from '../../../supabase/functions/_shared/billToParty'
import { enclosuresLine, exhibitsSentence, type DemandExhibit } from './demandLetterPacket'
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

/** One line of the bill as the customer saw it (v2.3425). Money as raw dollar strings. */
export type DemandStatementLine = { description: string; qty: string; amount: string }

/**
 * One covered invoice, read from the bill itself (v2.3425): the number the
 * customer saw, when it went out and was due, its lines, and the money.
 * The letter's "statement of account" is one of these per invoice — Rule 185
 * wants the name, date and charge of each item with credits allowed, and
 * Findlay v. Cave wants the demand to equal the bill, so nothing here is
 * typed by hand.
 */
export type DemandStatementInvoice = {
  invoiceNumber: string
  /** YYYY-MM-DD; '' when unknown. */
  sentYmd: string
  dueYmd: string
  lines: DemandStatementLine[]
  total: string
  paid: string
  balance: string
}

export type DemandLetterFields = {
  businessName: string
  senderName: string
  /** Multiline office address block. */
  businessAddress: string
  businessPhone: string
  businessEmail: string
  /** License line from the invoice-issuer settings (v2.2663 letterhead). */
  businessLicense?: string
  recipientName: string
  recipientEmail: string
  recipientAddress: string
  /** Who the bill was addressed to, from the invoice's own who-pays rule (v2.3425); absent on older snapshots. */
  debtorParty?: EffectiveBillParty
  /** The bill, invoice by invoice (v2.3425). Absent on snapshots recorded before it; the four fields below still render those. */
  statement?: DemandStatementInvoice[]
  /** The job address the work went into (v2.3425). */
  serviceAddress?: string
  /** What goes out behind the letter (v2.3429): the invoice as Exhibit A, the agreement as B, the delivery record as C. */
  enclosures?: DemandExhibit[]
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
  | { kind: 'statement'; invoices: DemandStatementInvoice[]; balance: string }
  | { kind: 'notarial' }

/** "Invoice #A" / "Invoices #A and #B" / "Invoices #A, #B and #C". */
export function demandInvoicesPhrase(statement: DemandStatementInvoice[]): string {
  const nums = statement.map((i) => i.invoiceNumber.trim()).filter((n) => n)
  if (nums.length === 0) return 'Invoice #—'
  if (nums.length === 1) return `Invoice ${nums[0]}`
  return `Invoices ${nums.slice(0, -1).join(', ')} and ${nums[nums.length - 1]}`
}

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
  const statement = (f.statement ?? []).filter((i) => i.lines.length > 0 || i.invoiceNumber.trim())
  if (statement.length > 0) {
    // v2.3425: the letter reads the bill. The Re line carries the number the
    // customer saw, the opening names the dates, and the debt is a statement
    // of account, one block per invoice — never a retyped summary.
    blocks.push({ kind: 'reLine', text: `Re: Final Demand for Payment — ${demandInvoicesPhrase(statement)} · ${out}` })
    const first = statement[0]!
    const sentDates = statement.map((i) => i.sentYmd).filter((d) => d)
    const dueDates = statement.map((i) => i.dueYmd).filter((d) => d)
    const where = (f.serviceAddress ?? '').trim()
    const billedClause =
      statement.length === 1
        ? `You were billed ${demandMoney(first.total)}${first.sentYmd ? ` on ${demandDate(first.sentYmd)}` : ''} for the work below${where ? ` at ${where}` : ''}.${first.dueYmd ? ` The bill was due ${demandDate(first.dueYmd)}.` : ''}`
        : `You were billed ${statement.length} invoices totaling ${demandMoney(String(statement.reduce((a, i) => a + Number(i.total || 0), 0)))}${sentDates.length > 0 ? ` between ${demandDate(sentDates.slice().sort()[0]!)} and ${demandDate(sentDates.slice().sort()[sentDates.length - 1]!)}` : ''} for the work below${where ? ` at ${where}` : ''}.${dueDates.length > 0 ? ` The last of them was due ${demandDate(dueDates.slice().sort()[dueDates.length - 1]!)}.` : ''}`
    const paidTotal = statement.reduce((a, i) => a + Number(i.paid || 0), 0)
    blocks.push({
      kind: 'paragraph',
      text: `${billedClause} ${paidTotal > 0 ? `${demandMoney(String(paidTotal))} has been paid and ${out} remains.` : 'Nothing has been paid.'} This letter is ${f.businessName.trim() || 'our'} final formal demand for the balance of ${out}, and our presentment of the claim.`,
    })
    blocks.push({ kind: 'heading', text: 'Statement of account' })
    blocks.push({ kind: 'statement', invoices: statement, balance: out })
    const exhibitsText = exhibitsSentence(f.enclosures ?? [])
    blocks.push({ kind: 'paragraph', text: `${exhibitsText ? `${exhibitsText} ` : ''}All payments and credits have been allowed.` })
  } else {
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
  }
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
  const enclosures = enclosuresLine(f.enclosures ?? [])
  if (enclosures) blocks.push({ kind: 'meta', text: enclosures })
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
      case 'statement':
        parts.push(statementHtml(b))
        break
      case 'notarial':
        parts.push(`<p style="margin:2em 0 0 0">${NOTARIAL_TEXT_LINES.map(esc).join('<br/>')}</p>`)
        break
    }
  }
  return parts.join('')
}

/** The statement rows in reading order — shared by the HTML, text and PDF renderers. */
export function statementRows(b: { invoices: DemandStatementInvoice[]; balance: string }): Array<{ kind: 'invoice' | 'line' | 'paid' | 'balance' | 'total'; left: string; right: string }> {
  const rows: Array<{ kind: 'invoice' | 'line' | 'paid' | 'balance' | 'total'; left: string; right: string }> = []
  for (const inv of b.invoices) {
    const dates = [inv.sentYmd ? `sent ${demandDate(inv.sentYmd)}` : '', inv.dueYmd ? `due ${demandDate(inv.dueYmd)}` : ''].filter((d) => d).join(' · ')
    rows.push({ kind: 'invoice', left: `${inv.invoiceNumber.trim() || 'Invoice'}${dates ? ` — ${dates}` : ''}`, right: '' })
    for (const l of inv.lines) {
      rows.push({ kind: 'line', left: `${l.description.trim() || '—'}${l.qty.trim() ? ` · Qty ${l.qty.trim()}` : ''}`, right: demandMoney(l.amount) })
    }
    rows.push({ kind: 'paid', left: 'Payments and credits', right: Number(inv.paid || 0) > 0 ? `−${demandMoney(inv.paid)}` : demandMoney('0') })
    rows.push({ kind: 'balance', left: b.invoices.length > 1 ? 'Balance on this invoice' : 'Balance due', right: demandMoney(inv.balance) })
  }
  if (b.invoices.length > 1) rows.push({ kind: 'total', left: 'Balance due', right: demandMoney(b.balance) })
  return rows
}

function statementHtml(b: { invoices: DemandStatementInvoice[]; balance: string }): string {
  const tr = (left: string, right: string, style: string) =>
    `<tr><td style="padding:0.25em 0.4em 0.25em 0;border-bottom:1px solid #e3ded2;${style}">${esc(left)}</td><td style="padding:0.25em 0 0.25em 0.6em;border-bottom:1px solid #e3ded2;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;${style}">${esc(right)}</td></tr>`
  const rows = statementRows(b).map((r) => {
    if (r.kind === 'invoice') return tr(r.left, r.right, 'font-weight:700;padding-top:0.6em')
    if (r.kind === 'line') return tr(r.left, r.right, '')
    if (r.kind === 'paid') return tr(r.left, r.right, 'color:#555')
    if (r.kind === 'balance') return tr(r.left, r.right, b.invoices.length > 1 ? 'font-weight:600' : 'font-weight:700;border-bottom:2px solid #333')
    return tr(r.left, r.right, 'font-weight:700;border-bottom:2px solid #333')
  })
  return `<table style="border-collapse:collapse;width:100%;margin:0.3em 0 0.8em 0;font-size:0.95em">${rows.join('')}</table>`
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
      case 'statement':
        lines.push(
          statementRows(b)
            .map((r) => (r.kind === 'invoice' ? r.left : `  ${r.kind === 'line' ? '' : '  '}${r.left}${r.right ? ` ${'.'.repeat(Math.max(2, 58 - r.left.length - r.right.length))} ${r.right}` : ''}`))
            .join('\n'),
        )
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
      case 'statement': {
        // Two columns: the item wraps in the left 138 mm, the money sits right-aligned.
        const rightX = PAGE_MARGIN + MAX_TEXT_WIDTH_MM
        const leftW = MAX_TEXT_WIDTH_MM - 38
        y += 1
        for (const r of statementRows(b)) {
          const bold = r.kind === 'invoice' || r.kind === 'total' || (r.kind === 'balance' && b.invoices.length === 1)
          doc.setFont('times', bold ? 'bold' : 'normal')
          doc.setFontSize(r.kind === 'invoice' ? 10.5 : 10)
          doc.setTextColor(r.kind === 'paid' ? 90 : 28, r.kind === 'paid' ? 90 : 26, r.kind === 'paid' ? 90 : 23)
          if (r.kind === 'invoice') y += 1.5
          const indent = r.kind === 'line' ? 4 : r.kind === 'invoice' ? 0 : 4
          const wrapped = doc.splitTextToSize(r.left, leftW - indent) as string[]
          ensureRoom(5 * wrapped.length + 1.5)
          const top = y
          for (const line of wrapped) {
            doc.text(line, PAGE_MARGIN + indent, y)
            y += 5
          }
          if (r.right) doc.text(r.right, rightX, top, { align: 'right' })
          doc.setDrawColor(r.kind === 'total' || (r.kind === 'balance' && b.invoices.length === 1) ? 51 : 227, r.kind === 'total' || (r.kind === 'balance' && b.invoices.length === 1) ? 51 : 222, r.kind === 'total' || (r.kind === 'balance' && b.invoices.length === 1) ? 51 : 210)
          doc.setLineWidth(r.kind === 'total' || (r.kind === 'balance' && b.invoices.length === 1) ? 0.5 : 0.2)
          doc.line(PAGE_MARGIN, y - 1.6, rightX, y - 1.6)
          y += 0.6
        }
        doc.setTextColor(28, 26, 23)
        y += 2
        break
      }
      case 'notarial':
        y += 8
        doc.setFont('times', 'normal')
        doc.setFontSize(10.5)
        for (const l of NOTARIAL_TEXT_LINES) writeWrapped(l, 5.4)
        break
    }
  }
  // Page footer (v2.2663): sender identity left, page number right, every page.
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

// ---------- Exhibit C: the delivery record (v2.3429) ----------

/**
 * One page: every dated send and touch the letter cites, as a record the
 * debtor can check against their own inbox. Built from the same rows as the
 * letter's Notice History, so the two never disagree.
 */
export async function buildDeliveryRecordPdfBlob(input: {
  businessName: string
  invoicesPhrase: string
  recipientName: string
  rows: DemandPriorNotice[]
  todayYmd: string
}): Promise<Blob> {
  const JsPDF = await loadJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'letter' })
  let y = PAGE_MARGIN + 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(28, 26, 23)
  doc.text('Delivery record', PAGE_MARGIN, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90, 90, 90)
  doc.text(`${input.invoicesPhrase} · ${input.recipientName || '—'} · prepared ${demandDate(input.todayYmd)} by ${input.businessName || '—'}`, PAGE_MARGIN, y)
  y += 4
  doc.setDrawColor(207, 203, 194)
  doc.setLineWidth(0.25)
  doc.line(PAGE_MARGIN, y, PAGE_MARGIN + MAX_TEXT_WIDTH_MM, y)
  y += 7
  doc.setTextColor(28, 26, 23)
  doc.setFont('times', 'normal')
  doc.setFontSize(11)
  if (input.rows.length === 0) {
    doc.text('No sends or contacts are on record beyond the invoice itself.', PAGE_MARGIN, y)
  }
  for (const r of input.rows) {
    if (y > PAGE_CONTENT_MAX_Y) {
      doc.addPage()
      y = PAGE_MARGIN
    }
    doc.setFont('times', 'bold')
    doc.text(demandDate(r.date), PAGE_MARGIN, y)
    doc.setFont('times', 'normal')
    const lines = doc.splitTextToSize(r.label, MAX_TEXT_WIDTH_MM - 46) as string[]
    for (const line of lines) {
      doc.text(line, PAGE_MARGIN + 46, y)
      y += 5.6
    }
    y += 1
  }
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(90, 90, 90)
  doc.text('Dates are from the sending system\u2019s own log (email sends, Stripe delivery events, recorded calls and promises).', PAGE_MARGIN, y)
  return doc.output('blob')
}

// ---------- prefill ----------

/**
 * What the modal knows about one covered invoice beyond its ledger row
 * (v2.3425): the app's own document model (lines, number, dates) and, for a
 * Stripe-hosted bill, what Stripe rendered — the number the customer saw and
 * the lines as they saw them. Either may be missing; the statement degrades
 * to the ledger row (one line: the memo, the amount).
 */
export type DemandInvoiceSource = {
  inv: JobsLedgerInvoice
  doc: PhysicalInvoiceDocument | null
  stripe: { invoiceNumber: string | null; lines: StripeInvoiceLineDetail[] } | null
}

function ymdOf(raw: string | null | undefined): string {
  const t = (raw ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : ''
}

/** The bill, invoice by invoice, as the customer saw it — never typed. */
export function buildDemandStatement(job: JobWithDetails, sources: DemandInvoiceSource[]): DemandStatementInvoice[] {
  return sources.map(({ inv, doc, stripe }) => {
    const total = Number(inv.amount ?? 0)
    const paid = sumApplied(job, inv.id)
    const stripeLines = (stripe?.lines ?? []).filter((l) => (l.description ?? '').trim())
    let lines: DemandStatementLine[]
    if (stripeLines.length > 0) {
      lines = stripeLines.map((l) => ({
        description: l.description.trim(),
        qty: l.quantity != null && l.quantity !== 1 ? String(l.quantity) : '',
        amount: moneyInput(l.amount / 100),
      }))
    } else if (doc && doc.layout === 'detailed' && doc.serviceLines.length + doc.materialLines.length > 0) {
      lines = [...doc.serviceLines, ...doc.materialLines].map((l) => ({
        description: l.description.trim(),
        qty: l.qty !== 1 ? String(l.qty) : '',
        amount: moneyInput(l.amount),
      }))
    } else {
      const memo = (doc?.lineDescription ?? '').trim() || (inv.stripe_invoice_memo ?? '').trim() || (job.job_name ?? '').trim() || 'Plumbing services'
      lines = [{ description: memo, qty: '', amount: moneyInput(total) }]
    }
    const stripeNumber = (stripe?.invoiceNumber ?? '').trim()
    const docNumber = (doc?.invoiceNumberDisplay ?? '').trim()
    const invoiceNumber = stripeNumber ? `#${stripeNumber.replace(/^#/, '')}` : docNumber && docNumber !== '—' ? docNumber : `#${inv.sequence_order}`
    return {
      invoiceNumber,
      sentYmd: ymdOf(inv.sent_to_customer_at) || ymdOf(inv.billed_at) || ymdOf(inv.created_at),
      dueYmd: ymdOf(inv.estimated_bill_date),
      lines,
      total: moneyInput(total),
      paid: moneyInput(paid),
      balance: moneyInput(Math.max(0, total - paid)),
    }
  })
}

/** Where the demand goes: the party the bill was addressed to, by the invoice's own rule (v2.3425). One letter per payer. */
export function demandDebtorParty(job: JobWithDetails, invoices: JobsLedgerInvoice[]): EffectiveBillParty {
  const first = invoices[0]
  if (!first) return 'customer'
  return effectiveInvoiceParty(
    { gc_customer_id: job.gc_customer_id ?? null, customer_id: job.customer_id ?? null, bill_to_party: job.bill_to_party ?? null },
    { bill_to_email: first.bill_to_email ?? null, bill_to_party: first.bill_to_party ?? null },
  )
}

export type DemandLetterPrefillContext = {
  job: JobWithDetails
  invoices: JobsLedgerInvoice[]
  /** The covered invoices with what the app and Stripe know about each (v2.3425). Omit to keep the older four-field debt block. */
  sources?: DemandInvoiceSource[]
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
  const statement = ctx.sources ? buildDemandStatement(job, ctx.sources.filter((src) => invoices.some((i) => i.id === src.inv.id))) : []
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
    debtorParty: demandDebtorParty(job, invoices),
    statement,
    serviceAddress: (job.job_address ?? '').trim(),
    invoiceNumber: statement.length > 0 ? statement.map((i) => i.invoiceNumber).join(', ') : hcp ? `${hcp}` : `#${invoices[0]?.sequence_order ?? 1}`,
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
