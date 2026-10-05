import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { PhysicalInvoiceIssuer } from '../physicalInvoiceIssuer'
import { loadJsPDF } from '../loadJsPDF'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../utils/dateUtils'
import { billCheckClearsYmd } from '../jobs/checkClearing'
import { isUnfinishedDate } from '../autosaveDateHold'
import { unfinishedDateStopsMessage } from '../dateBoxEntry'

/**
 * Lien waiver-and-release documents issued from the Jobs board (v2.2579):
 * the owner-drafted form family — conditional/unconditional on progress
 * payment, conditional (v2.4274) / unconditional on final payment. Pure
 * builders (paragraph model → HTML / text / PDF) so content is unit-testable
 * without jsPDF; prefill maps job + invoice data into the fields. Print/copy
 * documents stay light like every customer-facing paper.
 *
 * Two questions pick the form (v2.4274, the same two the sub-side dialog asks
 * of a payment): has the money settled (unconditional) or not (conditional),
 * and is this the last bill (final) or not (progress). `lienWaiverFormFrom`
 * and `lienWaiverToggles` are that grid; `pickLienWaiverForBill` answers both
 * from a bill.
 */

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

export type LienWaiverFormType = 'conditional_progress' | 'unconditional_progress' | 'conditional_final' | 'unconditional_final'

export const LIEN_WAIVER_FORM_TYPES: readonly LienWaiverFormType[] = [
  'conditional_progress',
  'unconditional_progress',
  'conditional_final',
  'unconditional_final',
]

export const LIEN_WAIVER_FORM_SHORT_LABELS: Record<LienWaiverFormType, string> = {
  conditional_progress: 'Conditional · progress',
  unconditional_progress: 'Unconditional · progress',
  conditional_final: 'Conditional · final',
  unconditional_final: 'Unconditional · final',
}

/** The two questions, as the window's toggles read them. */
export type LienWaiverToggles = { conditional: boolean; final: boolean }

export function lienWaiverToggles(formType: LienWaiverFormType): LienWaiverToggles {
  return { conditional: formType.startsWith('conditional'), final: formType.endsWith('final') }
}

export function lienWaiverFormFrom(t: LienWaiverToggles): LienWaiverFormType {
  if (t.conditional) return t.final ? 'conditional_final' : 'conditional_progress'
  return t.final ? 'unconditional_final' : 'unconditional_progress'
}

export function lienWaiverIsConditional(formType: LienWaiverFormType): boolean {
  return lienWaiverToggles(formType).conditional
}

/** Texas Property Code § 53.284's subsection for each statutory form — the cite line. */
export const LIEN_WAIVER_FORM_CITES: Record<LienWaiverFormType, string> = {
  conditional_progress: '§ 53.284(b)',
  unconditional_progress: '§ 53.284(c)',
  conditional_final: '§ 53.284(d)',
  unconditional_final: '§ 53.284(e)',
}

/** One line of why this form, in the words the window says under the toggles. */
export function lienWaiverWhy(formType: LienWaiverFormType, payorName: string): string {
  const who = payorName.trim() || 'their'
  const whose = payorName.trim() ? `${who}’s` : 'their'
  switch (formType) {
    case 'conditional_progress':
      return `Takes effect when ${whose} check clears. Safe to sign now; the unconditional follows when the payment settles.`
    case 'conditional_final':
      return `The last bill. Takes effect when ${whose} check clears and closes the job; the unconditional final follows when it settles.`
    case 'unconditional_progress':
      return 'States this payment has been received. Only after the money has settled — Texas forbids requiring it before payment.'
    case 'unconditional_final':
      return 'States the job is paid in full and releases everything. Only after the last payment has settled.'
    default: {
      const _e: never = formType
      return _e
    }
  }
}

/**
 * What the Release of Lien window asks before the form goes from Conditional to Unconditional
 * (v2.4507, the owner's words). The safe answer is to stay, so that button is the blue one.
 */
export const UNCONDITIONAL_WAIVER_WARNING = {
  title: 'Are you sure you meant to choose Unconditional?',
  message: [
    'Have you spoken to your master plumber?',
    'Most GCs will accept a conditional waiver, even when they ask for an unconditional one.',
    'Signing an unconditional waiver gives up all your rights. It is usually only done at the very end of a job, after you have received 100% of what you asked for.',
  ].join('\n\n'),
  confirmLabel: 'Acknowledge and choose Unconditional',
  cancelLabel: 'Stay conditional',
  danger: true,
  cancelIsSafe: true,
} as const

export function lienWaiverTitle(formType: LienWaiverFormType): string {
  switch (formType) {
    case 'conditional_progress':
      return 'Conditional Waiver and Release on Progress Payment'
    case 'unconditional_progress':
      return 'Unconditional Waiver and Release on Progress Payment'
    case 'conditional_final':
      return 'Conditional Waiver and Release on Final Payment'
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
  const t = lienWaiverToggles(formType)
  if (field === 'checkFrom') return t.conditional
  if (field === 'throughDate') return !t.final
  return true
}

export type LienWaiverDateBox = 'throughDate' | 'signedDate'

/**
 * The date boxes caught half typed, in the order the form shows them. The through date counts
 * only on a form type that has one: a final waiver hides that box.
 */
export function lienWaiverUnfinishedDates(formType: LienWaiverFormType, fields: Pick<LienWaiverFields, LienWaiverDateBox>): LienWaiverDateBox[] {
  return (['throughDate', 'signedDate'] as const).filter((box) => lienWaiverUsesField(formType, box) && isUnfinishedDate(fields[box]))
}

/**
 * True while a date on the form is still being typed — the signature date, or the through date
 * on a form type that has one. The draft autosave waits: both dates are written as columns and
 * again inside the one `fields` object, so there is no writing the rest without them.
 */
export function lienWaiverDatesUnfinished(formType: LienWaiverFormType, fields: Pick<LienWaiverFields, LienWaiverDateBox>): boolean {
  return lienWaiverUnfinishedDates(formType, fields).length > 0
}

/**
 * Why a draft cannot be issued yet, or null. Every output (Mark issued, Print for signature,
 * Download PDF, Request signature) mints the row first and locks it as it reads, so a
 * half-typed date would be on a document of record nobody can edit.
 */
export function lienWaiverUnfinishedDateBlocksIssue(formType: LienWaiverFormType, fields: Pick<LienWaiverFields, LienWaiverDateBox>, thisYear: number): string | null {
  const box = lienWaiverUnfinishedDates(formType, fields)[0]
  if (!box) return null
  return unfinishedDateStopsMessage(box === 'throughDate' ? 'Progress payments through' : 'Signature', 'this is issued', thisYear)
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
    case 'conditional_final':
      return [
        `Upon receipt by the undersigned of a check from ${f.checkFrom.trim() || '—'} in the sum of ${amount} payable to ${company} and when the check has been properly endorsed and has cleared the bank, this document shall become effective to waive and release any lien, stop payment notice, or bond right the undersigned has on the project described as:`,
        `${project}.`,
        `This is the final payment. Upon its clearance the undersigned waives, releases, and discharges any and all rights to a mechanic's lien, stop payment notice, or claim against a payment bond related to this project, for all work, labor, materials, and services provided through the date below.`,
        `This release is conditional upon actual receipt and clearance of the above payment, and does not cover disputed claims for extra work listed in writing before signing.`,
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

/**
 * The foot of the page (v2.4285): one signature block in place of the Date / Contractor / By /
 * Title label stack. Under the rule, the signer of record and the company on one line —
 * "Malachi Whites, Click Plumbing and Electrical" — his title when one is set (never a blank
 * line), and the day he signed. Unsigned, the rule waits for ink and the date is a blank.
 */
export type LienWaiverFoot = {
  /** The signer of record — the signature's printed name once signed, else the window's Signed by. */
  name: string
  company: string
  /** "Owner · Responsible Master Plumber"; null leaves the line out. */
  title: string | null
  /** "Signed September 30, 2026"; null before signing. */
  signed: string | null
}

export function buildLienWaiverFoot(f: LienWaiverFields, signature?: { printedName: string; signedYmd?: string | null } | null): LienWaiverFoot {
  const name = (signature?.printedName ?? '').trim() || f.signerName.trim() || '—'
  const title = f.signerTitle.trim()
  const signedYmd = signature ? (signature.signedYmd ?? '').trim() || f.signedDate.trim() : ''
  return {
    name,
    company: f.companyName.trim() || '—',
    title: title || null,
    signed: signature ? `Signed ${lienWaiverDate(signedYmd)}` : null,
  }
}

/** The foot as plain lines (copy-for-email text, the sample paper). */
export function lienWaiverFootLines(foot: LienWaiverFoot): string[] {
  return [`${foot.name}, ${foot.company}`, ...(foot.title ? [foot.title] : []), foot.signed ?? 'Signed ______________________']
}

// ---------- prefill ----------

export type LienWaiverPrefillContext = {
  job: JobWithDetails
  /** The bill line(s) this release covers — [] falls back to job-level totals. */
  invoices: JobsLedgerInvoice[]
  issuer: PhysicalInvoiceIssuer | null
  /** From job_property_owners when present; falls back to the job's customer. */
  ownerName: string | null
  /** The leader of record — the one picked under Signed by the leader, else the company's signer, else the session's name. */
  signerName: string
  /** v2.4285: his title from Settings → Jobs & billing → Physical invoice (Signs for the company); '' leaves the line off the page. */
  signerTitle?: string
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

/** A `date` column's day (`last_work_date`). An instant's day is `calendarYmdInAppTzFromIso`: its first ten characters are the UTC date. */
function ymdFromIso(iso: string | null | undefined): string {
  const d = (iso ?? '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : ''
}

function todayYmd(): string {
  return todayYmdInAppTz()
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
  if (formType === 'unconditional_final') {
    // Paid in full: the final form states what the whole job came to on the covered lines.
    return invoices.reduce((s, inv) => s + Number(inv.amount ?? 0), 0)
  }
  if (formType === 'unconditional_progress') {
    const applied = invoices.reduce((s, inv) => s + sumAppliedToInvoice(job, inv.id), 0)
    if (applied > 0) return applied
    return invoices.reduce((s, inv) => s + Number(inv.amount ?? 0), 0)
  }
  return invoices.reduce((s, inv) => s + lienWaiverInvoiceOpenRemaining(job, inv), 0)
}

export type LienWaiverBillPick = {
  formType: LienWaiverFormType
  /** Payments applied to the bill reach its amount. */
  settled: boolean
  /** The bill is the job's last: highest in sequence among the minted lines, and together they bill the whole job. */
  final: boolean
  /** The two facts as the window says them under the toggles. */
  facts: string[]
  /** v2.4330: settled by a check that has not cleared yet — the day it clears. */
  clearsYmd?: string | null
}

/**
 * Which waiver a bill calls for (v2.4274) — the sub-side dialog's two questions asked of one of
 * our bills. Settled → unconditional, else conditional. Final when the bill is the last minted
 * line and the minted lines together cover the job's revenue (to the dollar); a job with more to
 * bill, or an earlier line, is a progress payment.
 */
export function pickLienWaiverForBill(
  job: Pick<JobWithDetails, 'invoices' | 'payments' | 'revenue'>,
  invoice: Pick<JobsLedgerInvoice, 'id' | 'amount' | 'sequence_order'> & { status?: string | null },
  today: string = todayYmd(),
): LienWaiverBillPick {
  const applied = (job.payments ?? []).filter((p) => p.invoice_id === invoice.id).reduce((s, p) => s + Number(p.amount ?? 0), 0)
  const amount = Number(invoice.amount ?? 0)
  // v2.4318: a bill marked paid is settled even when its payments name no bill.
  const settled = invoice.status === 'paid' || (amount > 0 && applied >= amount - 0.005)
  const minted = (job.invoices ?? []).filter((i) => i.status === 'billed' || i.status === 'ready_to_bill' || i.status === 'paid')
  const lastSeq = Math.max(...minted.map((i) => Number(i.sequence_order ?? 0)), Number(invoice.sequence_order ?? 0))
  const billedTotal = minted.reduce((s, i) => s + Number(i.amount ?? 0), 0)
  const revenue = Number(job.revenue ?? 0)
  const final = Number(invoice.sequence_order ?? 0) >= lastSeq && (revenue <= 0 || billedTotal >= revenue - 1)
  const n = minted.length
  const idx = minted.filter((i) => Number(i.sequence_order ?? 0) < Number(invoice.sequence_order ?? 0)).length + 1
  // v2.4330: paid by a check that may still come back — the unconditional is the form, but the window says when it clears.
  const clearsYmd = settled ? billCheckClearsYmd(invoice.id, (job.payments ?? []).map((p) => ({ invoice_id: p.invoice_id, amount: p.amount, paid_on: p.paid_on ?? null, payment_type: p.payment_type ?? null })), today) : null
  const clearsWords = clearsYmd ? new Date(`${clearsYmd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : null
  return {
    formType: lienWaiverFormFrom({ conditional: !settled, final }),
    settled,
    final,
    facts: [clearsWords ? `Settled · the check clears about ${clearsWords}` : settled ? 'Settled' : 'Not settled yet', final ? (n > 1 ? `Bill ${idx} of ${n} · the last` : 'The only bill') : n > 1 ? `Bill ${idx} of ${n} · not the last` : 'More to bill'],
    clearsYmd,
  }
}

/**
 * The tick on Bill Customer (v2.4603): the pick for the bill about to go, or null when no
 * tick is drawn. No tick on a direct job, with no bill named, or for a bill not on the job.
 * The hand-off to the Release of Lien window follows the tick, so both read this.
 */
export function lienWaiverTickForBill(
  job: (Pick<JobWithDetails, 'invoices' | 'payments' | 'revenue'> & { gc_customer_id?: string | null }) | null | undefined,
  invoiceId: string | null | undefined,
  today: string = todayYmd(),
): LienWaiverBillPick | null {
  if (!job?.gc_customer_id || !invoiceId) return null
  const invoice = (job.invoices ?? []).find((i) => i.id === invoiceId)
  return invoice ? pickLienWaiverForBill(job, invoice, today) : null
}

export function buildLienWaiverPrefill(formType: LienWaiverFormType, ctx: LienWaiverPrefillContext): LienWaiverFields {
  const { job, invoices, issuer, ownerName, signerName } = ctx
  const name = (job.job_name ?? '').trim()
  const address = (job.job_address ?? '').trim()
  const projectDescription = name && address ? `${name} — ${address}` : name || address
  const throughDate =
    invoices.map((i) => calendarYmdInAppTzFromIso(i.billed_at ?? '') || calendarYmdInAppTzFromIso(i.created_at ?? '')).filter(Boolean).sort().pop() ??
    (ymdFromIso(job.last_work_date) || todayYmd())
  return {
    companyName: (issuer?.companyName ?? '').trim() || 'ClickConstruction LLC',
    checkFrom: (ownerName ?? '').trim() || (job.gcCustomer?.name ?? '').trim() || (job.customer_name ?? '').trim(),
    amount: moneyInputStr(lienWaiverPrefillAmount(formType, job, invoices)),
    projectDescription,
    throughDate,
    signedDate: todayYmd(),
    signerName: signerName.trim(),
    signerTitle: (ctx.signerTitle ?? '').trim(),
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

// ---------- electronic signature (v2.2619, the signing loop) ----------

export type LienWaiverSignature = {
  mode: 'type' | 'draw'
  printedName: string
  /** PNG data URL for draw-mode signatures; ignored for typed. */
  pngDataUrl?: string | null
  /** The audit sentence (see lienReleaseSignatureAuditLine) under the block: who, how, when, whose screen. */
  auditLine: string
  /** v2.4285: the day signed (app calendar), for the foot's "Signed …" line; the fields' signature date when absent. */
  signedYmd?: string | null
}

/** The second grey line under every signed rendering (v2.4285) — the two statutes, once, a shade lighter. */
export const LIEN_WAIVER_ESIGN_LINE = 'Binding as a signature in ink under the ESIGN Act (15 U.S.C. § 7001) and the Texas UETA (Bus. & Com. Code ch. 322).'

/**
 * The foot of the page as HTML (v2.4285): the signature — drawn PNG, or the typed name in the
 * cursive face — above the rule; under it the name and company, the title, the day signed; then
 * the audit sentence and the statute line in grey. Unsigned: the rule waits, the date is a blank.
 */
export function buildLienWaiverFootHtml(f: LienWaiverFields, signature?: LienWaiverSignature | null): string {
  const foot = buildLienWaiverFoot(f, signature)
  const ink = signature
    ? signature.mode === 'draw' && signature.pngDataUrl
      ? `<img src="${signature.pngDataUrl}" alt="Signature of ${esc(signature.printedName)}" style="display:block;height:64px;width:auto;max-width:320px;object-fit:contain;object-position:left bottom" />`
      : `<div style="font-family:'Great Vibes', cursive; font-size:2.1em; line-height:1.15">${esc(signature.printedName)}</div>`
    : `<div style="height:3.2em"></div>`
  const lines =
    `<div style="border-top:1px solid #1a1a1a; width:min(420px,100%); margin-top:0.2em; padding-top:0.4em; line-height:1.45"><strong>${esc(foot.name)}</strong>, ${esc(foot.company)}</div>` +
    (foot.title ? `<div style="font-size:0.9em; line-height:1.5; color:#3d3d3d">${esc(foot.title)}</div>` : '') +
    `<div style="font-size:0.9em; line-height:1.5; color:#3d3d3d">${foot.signed ? esc(foot.signed) : 'Signed ______________________'}</div>`
  const audit = signature
    ? `<p style="margin:1.4em 0 0; font-family:system-ui,sans-serif; font-size:0.7em; line-height:1.6; color:#5b6168; max-width:640px">${esc(signature.auditLine)}<br><span style="color:#7a7f86">${esc(LIEN_WAIVER_ESIGN_LINE)}</span></p>`
    : ''
  return `<div style="margin-top:2.2em">${ink}${lines}${audit}</div>`
}

/** Body fragment shared by print and copy-for-email (inline styles only); signed releases carry the signature in the foot. */
export function buildLienWaiverEmailHtml(formType: LienWaiverFormType, f: LienWaiverFields, signature?: LienWaiverSignature | null): string {
  const title = `<p style="text-align:center;margin:0 0 1em 0;font-weight:700;text-transform:uppercase;letter-spacing:0.04em">${esc(lienWaiverTitle(formType))}</p>`
  const body = buildLienWaiverParagraphs(formType, f)
    .map((p) => `<p style="margin:0 0 0.75em 0">${esc(p)}</p>`)
    .join('')
  return title + body + buildLienWaiverFootHtml(f, signature)
}

export function buildLienWaiverEmailText(formType: LienWaiverFormType, f: LienWaiverFields): string {
  const sig = lienWaiverFootLines(buildLienWaiverFoot(f, null)).join('\n')
  return [lienWaiverTitle(formType).toUpperCase(), '', ...buildLienWaiverParagraphs(formType, f), '', '______________________________', sig].join('\n\n')
}

/** Full standalone print document — pinned light like all customer-facing paper. Signed releases carry the signature block. */
export function buildLienWaiverPrintHtml(
  formType: LienWaiverFormType,
  f: LienWaiverFields,
  jobNumber: string,
  signature?: LienWaiverSignature | null,
): string {
  const fontLink =
    signature && !(signature.mode === 'draw' && signature.pngDataUrl)
      ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap">`
      : ''
  // Company letterhead line (v2.2663) — same family look as the lien filings.
  const letterhead = f.companyName.trim()
    ? `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:1.5rem;margin:0 0 1.2em;padding-bottom:0.5em;border-bottom:1px solid #cfcbc2"><div style="font-weight:700;font-size:1.12em">${esc(f.companyName.trim())}</div><div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:0.7em;color:#7a756c">Job #${esc(jobNumber)}</div></div>`
    : ''
  return `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>${esc(lienWaiverTitle(formType))} — Job ${esc(jobNumber)}</title>${fontLink}
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; background: #fff; max-width: 42rem; margin: 2.5rem auto; padding: 0 1.5rem; font-size: 0.95rem; line-height: 1.75; }
  @media print { body { margin: 0.5in auto; } }
</style></head><body>${letterhead}${buildLienWaiverEmailHtml(formType, f, signature)}</body></html>`
}

// ---------- PDF ----------

export type LienWaiverPdfBlock =
  | { kind: 'title'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'foot'; foot: LienWaiverFoot }

export function buildLienWaiverPdfModel(formType: LienWaiverFormType, f: LienWaiverFields, signature?: LienWaiverSignature | null): LienWaiverPdfBlock[] {
  return [
    { kind: 'title', text: lienWaiverTitle(formType) },
    ...buildLienWaiverParagraphs(formType, f).map((text): LienWaiverPdfBlock => ({ kind: 'paragraph', text })),
    { kind: 'foot', foot: buildLienWaiverFoot(f, signature) },
  ]
}

export function lienWaiverPdfFilename(formType: LienWaiverFormType, jobNumber: string): string {
  const slug = jobNumber.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'job'
  return `lien-release-${formType.replace(/_/g, '-')}-${slug}.pdf`
}

const PAGE_MARGIN = 22

/** The drawn signature's row above the rule on the PDF, in mm (v2.4335). */
export const LIEN_WAIVER_INK_ROW_MM = 20
const LIEN_WAIVER_INK_HEIGHT_MM = 17
const LIEN_WAIVER_INK_MAX_WIDTH_MM = 80

/**
 * The size a drawn signature prints at on the PDF (v2.4335): 17 mm tall with its own proportions,
 * narrowed to 80 mm when it is very wide. The ink is trimmed to its strokes first
 * (`trimSignatureInk`), so every signature reads the same size on the line, wherever on the pad it
 * was drawn.
 */
export function lienWaiverInkBox(widthPx: number, heightPx: number): { w: number; h: number } {
  if (!(widthPx > 0) || !(heightPx > 0)) return { w: 62, h: LIEN_WAIVER_INK_HEIGHT_MM }
  const aspect = widthPx / heightPx
  let h = LIEN_WAIVER_INK_HEIGHT_MM
  let w = h * aspect
  if (w > LIEN_WAIVER_INK_MAX_WIDTH_MM) {
    w = LIEN_WAIVER_INK_MAX_WIDTH_MM
    h = w / aspect
  }
  return { w: Math.round(w * 100) / 100, h: Math.round(h * 100) / 100 }
}
const MAX_TEXT_WIDTH_MM = 172
const PAGE_CONTENT_MAX_Y = 265

export async function buildLienWaiverPdfBlob(
  formType: LienWaiverFormType,
  f: LienWaiverFields,
  signature?: LienWaiverSignature | null,
): Promise<Blob> {
  const JsPDF = await loadJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'letter' })
  let y = PAGE_MARGIN

  const ensureRoom = (needed: number) => {
    if (y + needed > PAGE_CONTENT_MAX_Y) {
      doc.addPage()
      y = PAGE_MARGIN
    }
  }

  // Company letterhead line (v2.2663) — same family look as the lien filings.
  if (f.companyName.trim()) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(28, 26, 23)
    doc.text(f.companyName.trim(), PAGE_MARGIN, y + 4.5)
    y += 8
    doc.setDrawColor(207, 203, 194)
    doc.setLineWidth(0.25)
    doc.line(PAGE_MARGIN, y, PAGE_MARGIN + MAX_TEXT_WIDTH_MM, y)
    doc.setTextColor(28, 26, 23)
    y += 9
  } else {
    y += 8
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

  for (const block of buildLienWaiverPdfModel(formType, f, signature)) {
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
      case 'foot': {
        // The foot (v2.4285): the signature above one rule, the signer and company under it.
        // The whole block moves to a fresh page rather than split across two.
        ensureRoom(signature ? 62 : 40)
        y += 10
        if (signature) {
          // Draw-mode embeds the captured PNG; typed renders the name in italic
          // serif (jsPDF has no webfont — the cursive face is a screen nicety, the
          // printed name + audit line are what carry legal weight).
          let drawn = false
          if (signature.mode === 'draw' && signature.pngDataUrl) {
            try {
              // v2.4335: its own proportions, bottom on the line (it was the whole pad box, 62×24 mm);
              // compressed, or jsPDF stores the pixels raw (~300 KB a page for a 13 KB drawing).
              const props = doc.getImageProperties(signature.pngDataUrl)
              const box = lienWaiverInkBox(props.width, props.height)
              doc.addImage(signature.pngDataUrl, 'PNG', PAGE_MARGIN + 1, y + LIEN_WAIVER_INK_ROW_MM - box.h, box.w, box.h, undefined, 'FAST')
              y += LIEN_WAIVER_INK_ROW_MM + 1
              drawn = true
            } catch {
              /* bad image data — the typed rendering below */
            }
          }
          if (!drawn) {
            doc.setFont('times', 'italic')
            doc.setFontSize(19)
            writeWrapped(signature.printedName, 9)
          }
        } else {
          y += 18
        }
        doc.setDrawColor(26, 26, 26)
        doc.setLineWidth(0.3)
        doc.line(PAGE_MARGIN, y, PAGE_MARGIN + 110, y)
        y += 5.5
        doc.setTextColor(26, 26, 26)
        doc.setFont('times', 'bold')
        doc.setFontSize(11)
        doc.text(block.foot.name, PAGE_MARGIN, y)
        const nameWidth = doc.getTextWidth(block.foot.name)
        doc.setFont('times', 'normal')
        doc.text(`, ${block.foot.company}`, PAGE_MARGIN + nameWidth, y)
        y += 5.5
        doc.setFontSize(10)
        doc.setTextColor(61, 61, 61)
        if (block.foot.title) {
          doc.text(block.foot.title, PAGE_MARGIN, y)
          y += 5
        }
        doc.text(block.foot.signed ?? 'Signed ______________________', PAGE_MARGIN, y)
        y += 5
        if (signature) {
          y += 4
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7.5)
          doc.setTextColor(91, 97, 104)
          writeWrapped(signature.auditLine, 3.8)
          doc.setTextColor(122, 127, 134)
          writeWrapped(LIEN_WAIVER_ESIGN_LINE, 3.8)
        }
        doc.setTextColor(26, 26, 26)
        break
      }
    }
  }

  // Page footer (v2.2663): form title left, page number right, every page.
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(207, 203, 194)
    doc.setLineWidth(0.25)
    doc.line(PAGE_MARGIN, 270, PAGE_MARGIN + MAX_TEXT_WIDTH_MM, 270)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(122, 117, 108)
    doc.text(lienWaiverTitle(formType), PAGE_MARGIN, 274)
    doc.text(`Page ${p} of ${pages}`, PAGE_MARGIN + MAX_TEXT_WIDTH_MM, 274, { align: 'right' })
  }
  return doc.output('blob')
}
