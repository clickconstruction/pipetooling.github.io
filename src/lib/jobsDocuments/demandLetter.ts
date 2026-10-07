import { paymentsAppliedToBill } from '../jobs/paymentAttribution'
import { cleanStoredAddress } from '../displayAddress'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { PhysicalInvoiceIssuer } from '../physicalInvoiceIssuer'
import type { PhysicalInvoiceDocument } from '../physicalInvoiceDocument'
import type { StripeInvoiceLineDetail } from '../stripeInvoiceDetailsResponse'
import type { PayPageAssets } from '../jobs/lienNoticePayPage'
import { payLinkDisplay } from '../billing/payLink'
import { effectiveInvoiceParty, type EffectiveBillParty } from '../../../supabase/functions/_shared/billToParty'
import { enclosureEntries, enclosuresLine, exhibitsSentence, type DemandExhibit } from './demandLetterPacket'
import { loadJsPDF } from '../loadJsPDF'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

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
  /** The bill's row id (v2.4849): the pay code's address is `/pay/<id>`. Absent on a sample or a letter recorded before. */
  invoiceId?: string
  /** A Stripe bill has a payment page, so a code; a paper bill gets its row without one. */
  payable?: boolean
}

/** One code on the letter (v2.4849): the bill, its balance, the address the code opens, and the code itself when the assets are in. */
export type DemandPayCodeRow = { invoiceId: string; label: string; amount: string; address: string; svg: string | null; png: string | null }

/** What the renderers take beside the fields (v2.4849): the codes drawn in the browser (`lienNoticePayPageAssets.ts`), by bill id. */
export type DemandLetterRenderOptions = { payAssets?: PayPageAssets }

/** The pay codes the letter carries: one per covered Stripe bill with money open, in the statement's order; a paper bill has no page and so no row. */
export function demandPayCodeRows(statement: readonly DemandStatementInvoice[], assets: PayPageAssets = {}): DemandPayCodeRow[] {
  const out: DemandPayCodeRow[] = []
  for (const i of statement) {
    if (!i.payable || !i.invoiceId) continue
    if (!(Number(i.balance || 0) > 0)) continue
    const a = assets[i.invoiceId]
    out.push({ invoiceId: i.invoiceId, label: `Invoice ${i.invoiceNumber.trim()}`, amount: demandMoney(i.balance), address: payLinkDisplay(i.invoiceId), svg: a?.svg ?? null, png: a?.png ?? null })
  }
  return out
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
  /** What goes out behind the letter (v2.3429): each invoice, the signed agreement, the delivery record — labelled by `exhibitLabels`. */
  enclosures?: DemandExhibit[]
  /** YYYY-MM-DD — 30 days after the letter: when attorney's fees become recoverable under CPRC § 38.002 (v2.3433). */
  feeClockYmd?: string
  /** Which statute the interest line rests on (v2.3433): ch. 28 after a written payment request, the legal rate otherwise, none when neither applies. */
  interestBasis?: DemandInterestBasis
  /** YYYY-MM-DD — the day interest starts under that basis. */
  interestFromYmd?: string
  /** Why the Chapter 53 line may not be offered (v2.3433): '' when a lien can be filed today. */
  lienBlockedReason?: string
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
  /** Pay codes under the amount box (v2.4849): one per covered Stripe bill, ON by default; absent on letters saved before. */
  includePayCodes?: boolean
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

export type DemandInterestBasis = 'ch28' | 'legal_rate' | 'none'

/** ymd + n calendar days. */
export function addCalendarDays(ymd: string, days: number): string {
  const base = new Date(ymd + 'T12:00:00')
  if (Number.isNaN(base.getTime())) return ymd
  base.setDate(base.getDate() + days)
  return base.toISOString().slice(0, 10)
}

/** CPRC § 38.002(3): fees follow a claim unpaid 30 days after it is presented — the letter is the presentment. */
export function feeClockDate(todayYmd: string): string {
  return addCalendarDays(todayYmd, 30)
}

/**
 * The interest line's basis (v2.3433). A bill that went out is a written
 * payment request under Prop. Code ch. 28 — owner or GC alike, the chapter
 * has no residential carve-out — due by the 35th day after receipt, and
 * § 28.004 runs 1.5 % a month from the day after. A bill that was never sent
 * falls to the legal rate: 6 % a year from the 30th day after it was due
 * (Fin. Code § 302.002). Neither date → no interest line at all; the letter
 * never asserts a charge it cannot name (Fin. Code § 392.303(a)(2)).
 */
export function interestBasisFor(statement: readonly DemandStatementInvoice[]): { basis: DemandInterestBasis; fromYmd: string } {
  const sent = statement.map((i) => i.sentYmd).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()[0]
  if (sent) return { basis: 'ch28', fromYmd: addCalendarDays(sent, 36) }
  const due = statement.map((i) => i.dueYmd).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()[0]
  if (due) return { basis: 'legal_rate', fromYmd: addCalendarDays(due, 30) }
  return { basis: 'none', fromYmd: '' }
}

/** Justice court hears claims to $20,000 exclusive of interest (Gov't Code § 27.031). */
export const JUSTICE_COURT_LIMIT = 20_000

export function courtLineText(outstanding: string): string {
  const n = Number((outstanding ?? '').replace(/[$,\s]/g, ''))
  return Number.isFinite(n) && n <= JUSTICE_COURT_LIMIT ? 'Filing suit in justice court, which hears claims to $20,000' : 'Filing suit in county or district court'
}

/**
 * Whether the letter may threaten a Chapter 53 lien today (v2.3433) — a
 * threatened action that is not available is what Fin. Code § 392.301(a)(8)
 * forbids. '' when it can; else the reason, shown beside the switch.
 */
export function lienLineBlockedReason(input: { lienFilingDeadline: string; todayYmd: string; homestead: boolean; hasWorkMonth: boolean }): string {
  if (input.homestead) return 'the property is a homestead — a homestead lien needs a contract signed by both spouses and recorded before the work; talk to the attorney'
  if (!input.hasWorkMonth) return 'no approved work month on the job yet — the filing window cannot be computed'
  if (!input.lienFilingDeadline) return 'no filing window on record'
  if (input.lienFilingDeadline < input.todayYmd) return `the filing window closed ${demandDate(input.lienFilingDeadline)}`
  return ''
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
  /** Who it goes to, as an envelope reads it, with the letter's date beside it. */
  | { kind: 'addressBlock'; recipient: string[]; date: string }
  /** The label over the subject, the subject, the line under it, and the one-line "Re:" the plain-text letter carries. */
  | { kind: 'subject'; kicker: string; text: string; detail: string; re: string }
  /** How much and by when — the two facts the reader must not have to look for. */
  | { kind: 'amountBox'; balance: string; deadline: string }
  | { kind: 'payCodes'; rows: DemandPayCodeRow[] }
  | { kind: 'paragraph'; text: string }
  /** `keepMm`: start a new page unless this much room is left, so a section is not split across the fold. */
  | { kind: 'heading'; text: string; keepMm?: number }
  /** `n` numbers the item (the remedies); `lead` is a first column (a notice's date) and the item draws no bullet; with neither it is a bullet. */
  | { kind: 'listItem'; text: string; n?: number; lead?: string }
  | { kind: 'signature'; lines: string[] }
  | { kind: 'statement'; invoices: DemandStatementInvoice[]; balance: string }
  | { kind: 'enclosures'; items: Array<{ label: string; text: string }>; line: string }
  | { kind: 'notarial' }

/** "Invoice #A" / "Invoices #A and #B" / "Invoices #A, #B and #C". */
export function demandInvoicesPhrase(statement: DemandStatementInvoice[]): string {
  const nums = statement.map((i) => i.invoiceNumber.trim()).filter((n) => n)
  if (nums.length === 0) return 'Invoice #—'
  if (nums.length === 1) return `Invoice ${nums[0]}`
  return `Invoices ${nums.slice(0, -1).join(', ')} and ${nums[nums.length - 1]}`
}

/** Letterhead contact column: one entry per address line, then phone, then email (blanks dropped). */
export function letterheadContactLines(address: string, phone: string, email: string): string[] {
  return [...address.split(/\r?\n/).map((l) => l.trim()), phone.trim(), email.trim()].filter((l) => l)
}

/** The addressee as an envelope reads it: the name, then the address a line at a time (a one-line address breaks after its street). */
export function recipientLines(name: string, address: string): string[] {
  const a = address.trim()
  const typed = a.split(/\r?\n/).map((l) => l.trim()).filter((l) => l)
  const comma = a.indexOf(', ')
  const addressLines = typed.length > 1 ? typed : comma > 0 ? [a.slice(0, comma), a.slice(comma + 2)] : typed
  return [name.trim() || '—', ...addressLines]
}

const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

/** The subject under "Final demand for payment": where the work was, and under it how many bills or the one bill's number. Two lines, never one joined by a dash. */
export function demandSubject(statement: DemandStatementInvoice[], serviceAddress: string): { text: string; detail: string } {
  const where = serviceAddress.trim()
  const count = COUNT_WORDS[statement.length] ?? String(statement.length)
  const what = statement.length > 1 ? `${count.charAt(0).toUpperCase()}${count.slice(1)} unpaid invoices` : demandInvoicesPhrase(statement)
  return where ? { text: where, detail: what } : { text: what, detail: '' }
}

export function buildDemandLetterModel(f: DemandLetterFields, todayYmd: string, opts: DemandLetterRenderOptions = {}): DemandLetterBlock[] {
  const out = demandMoney(f.outstanding)
  const blocks: DemandLetterBlock[] = []
  blocks.push({
    kind: 'senderBlock',
    company: f.businessName.trim() || f.senderName.trim(),
    licenseLine: (f.businessLicense ?? '').trim(),
    // v2.3474: a return address, line for line as typed in Settings — street,
    // city/state/ZIP, phone, email — never joined and re-wrapped by the column.
    // The sender's name is not up here; it signs the letter at the bottom.
    contactLines: letterheadContactLines(f.businessAddress, f.businessPhone, f.businessEmail),
  })
  blocks.push({ kind: 'addressBlock', recipient: recipientLines(f.recipientName, f.recipientAddress), date: demandDate(todayYmd) })
  const KICKER = 'Final demand for payment'
  const box: DemandLetterBlock = { kind: 'amountBox', balance: out, deadline: demandDate(f.deadlineDate) }
  // The codes sit under the box (v2.4849): the debtor pays a bill from the letter in hand. Off by the tick; no row when no covered bill is a Stripe bill.
  const pushPayCodes = () => {
    if (f.includePayCodes === false) return
    const rows = demandPayCodeRows(f.statement ?? [], opts.payAssets)
    if (rows.length) blocks.push({ kind: 'payCodes', rows })
  }
  const statement = (f.statement ?? []).filter((i) => i.lines.length > 0 || i.invoiceNumber.trim())
  if (statement.length > 0) {
    // v2.3425: the letter reads the bill. The Re line carries the number the
    // customer saw, the opening names the dates, and the debt is a statement
    // of account, one block per invoice — never a retyped summary.
    blocks.push({ kind: 'subject', kicker: KICKER, ...demandSubject(statement, f.serviceAddress ?? ''), re: `Re: Final Demand for Payment — ${demandInvoicesPhrase(statement)} · ${out}` })
    blocks.push(box)
    pushPayCodes()
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
      text: `${billedClause} ${paidTotal > 0 ? `${demandMoney(String(paidTotal))} has been paid and ${out} remains.` : 'Nothing has been paid.'} This letter is ${f.businessName.trim() ? `${f.businessName.trim()}'s` : 'our'} final formal demand for the balance of ${out}, and our presentment of the claim.`,
    })
    blocks.push({ kind: 'heading', text: 'Statement of account' })
    blocks.push({ kind: 'statement', invoices: statement, balance: out })
    const exhibitsText = exhibitsSentence(f.enclosures ?? [])
    blocks.push({ kind: 'paragraph', text: `${exhibitsText ? `${exhibitsText} ` : ''}All payments and credits have been allowed.` })
  } else {
    blocks.push({ kind: 'subject', kicker: KICKER, text: `Invoice #${f.invoiceNumber.trim() || '—'}`, detail: '', re: `Re: Final Demand for Payment — Invoice #${f.invoiceNumber.trim() || '—'}` })
    blocks.push(box)
    pushPayCodes()
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
  blocks.push({ kind: 'heading', text: 'Demand', keepMm: 72 })
  blocks.push({
    kind: 'paragraph',
    text: `Unless payment in full is received by ${demandDate(f.deadlineDate)}, we will pursue all legal remedies available, including but not limited to:`,
  })
  // The remedies are numbered, in the order they are named.
  let remedy = 0
  if (f.includeSmallClaims) blocks.push({ kind: 'listItem', n: ++remedy, text: f.feeClockYmd ? courtLineText(f.outstanding) : 'Initiating a small claims lawsuit' })
  if (f.includeLien && !(f.lienBlockedReason ?? '')) {
    blocks.push({
      kind: 'listItem',
      n: ++remedy,
      text:
        `Filing a mechanic's lien under Chapter 53 of the Texas Property Code` +
        (f.lienFilingDeadline ? ` (our filing window for this work runs through ${demandDate(f.lienFilingDeadline)})` : ''),
    })
  }
  if (f.includeTheftOfServices) {
    blocks.push({
      kind: 'listItem',
      n: ++remedy,
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
  if (f.feeClockYmd) {
    // CPRC § 38.001–.002: presented today; fees follow if unpaid 30 days on. "Seek", never "will be added" (Fin. Code § 392.304(a)(13)).
    blocks.push({
      kind: 'paragraph',
      text: `If the claim remains unpaid 30 days after this letter, on ${demandDate(f.feeClockYmd)}, we will also seek our attorney's fees under Texas Civil Practice and Remedies Code § 38.001.`,
    })
  }
  if (f.includeLateFees) {
    const basis = f.interestBasis ?? (f.feeClockYmd ? 'none' : 'legacy')
    if (basis === 'ch28' && f.interestFromYmd) {
      blocks.push({
        kind: 'paragraph',
        text: `The invoice was a written payment request under Texas Property Code chapter 28; the unpaid amount bears interest at 1.5 percent per month from ${demandDate(f.interestFromYmd)} under § 28.004 until it is paid.`,
      })
    } else if (basis === 'legal_rate' && f.interestFromYmd) {
      blocks.push({
        kind: 'paragraph',
        text: `No rate of interest was agreed, so the unpaid amount bears interest at the legal rate of 6 percent a year from ${demandDate(f.interestFromYmd)} under Texas Finance Code § 302.002.`,
      })
    } else if (basis === 'legacy') {
      blocks.push({
        kind: 'paragraph',
        text: 'Note: late fees and interest may continue to accrue on the unpaid balance until payment is received in full.',
      })
    }
  }
  blocks.push({ kind: 'heading', text: 'Notice history' })
  if (f.priorNotices.length === 0) {
    blocks.push({ kind: 'listItem', text: `Invoiced on ${demandDate(f.invoiceDate)}` })
  }
  for (const n of f.priorNotices) {
    blocks.push({ kind: 'listItem', lead: demandDate(n.date), text: n.label })
  }
  blocks.push({
    kind: 'signature',
    lines: ['Sincerely,', f.senderName.trim() || '—', f.businessName.trim(), f.businessPhone.trim(), f.businessEmail.trim()].filter(
      (l) => l,
    ),
  })
  const enclosures = enclosuresLine(f.enclosures ?? [])
  if (enclosures) blocks.push({ kind: 'enclosures', items: enclosureEntries(f.enclosures ?? []), line: enclosures })
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

const INK = '#1c1a17'
const MUTED = '#5f5a52'
const HAIR = '#d3d1c7'
const ALERT = '#791f1f'
const SANS = "'Helvetica Neue',Arial,sans-serif"
const LABEL_STYLE = `font-family:${SANS};font-size:0.72em;letter-spacing:0.08em;text-transform:uppercase`

export function buildDemandLetterEmailHtml(f: DemandLetterFields, todayYmd: string, opts: DemandLetterRenderOptions = {}): string {
  const parts: string[] = []
  for (const b of buildDemandLetterModel(f, todayYmd, opts)) {
    switch (b.kind) {
      case 'senderBlock':
        parts.push(
          `<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:1.5rem;margin:0 0 1.4em 0;padding-bottom:0.6em;border-bottom:2px solid ${INK}">` +
            `<div><div style="font-family:${SANS};font-weight:700;font-size:1.35em;letter-spacing:0.01em">${esc(b.company)}</div>` +
            (b.licenseLine ? `<div style="font-family:${SANS};font-size:0.72em;color:#7a756c;margin-top:0.15em">${esc(b.licenseLine)}</div>` : '') +
            `</div>` +
            `<div style="font-family:${SANS};flex:0 0 auto;white-space:nowrap;text-align:right;font-size:0.78em;color:${MUTED};line-height:1.45">${b.contactLines.map(esc).join('<br/>')}</div>` +
            `</div>`,
        )
        break
      case 'addressBlock':
        parts.push(
          `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1.5rem;margin:0 0 1.4em 0;line-height:1.5">` +
            `<div>${b.recipient.map(esc).join('<br/>')}</div><div style="flex:0 0 auto;white-space:nowrap;text-align:right">${esc(b.date)}</div></div>`,
        )
        break
      case 'subject':
        parts.push(
          `<div style="${LABEL_STYLE};color:${ALERT};margin:0 0 0.2em 0">${esc(b.kicker)}</div>` +
            `<div style="font-weight:700;font-size:1.12em;line-height:1.35;margin:0 0 ${b.detail ? '0.1em' : '0.9em'} 0">${esc(b.text)}</div>` +
            (b.detail ? `<div style="font-family:${SANS};font-size:0.86em;color:${MUTED};margin:0 0 1em 0">${esc(b.detail)}</div>` : ''),
        )
        break
      case 'amountBox': {
        const cell = (label: string, value: string, rule: boolean) =>
          `<td style="width:50%;padding:0.6em 0.9em;${rule ? `border-right:1px solid ${INK};` : ''}font-family:${SANS}">` +
          `<div style="font-size:0.75em;color:${MUTED}">${esc(label)}</div><div style="font-size:1.55em;font-weight:700;line-height:1.3;font-variant-numeric:tabular-nums">${esc(value)}</div></td>`
        parts.push(`<table data-demand-amount-box style="border-collapse:collapse;width:100%;border:1px solid ${INK};margin:0 0 1.1em 0"><tr>${cell('Balance due', b.balance, true)}${cell('Pay in full by', b.deadline, false)}</tr></table>`)
        break
      }
      case 'payCodes': {
        const code = (r: DemandPayCodeRow) =>
          `<td data-demand-pay-code="${esc(r.invoiceId)}" style="vertical-align:top;padding:0.5em 0.6em 0.6em 0;font-family:${SANS};width:${Math.floor(100 / Math.min(4, Math.max(1, b.rows.length)))}%">` +
          `<div style="width:84px;height:84px;line-height:0;margin-bottom:0.35em">${r.svg ?? `<div style="width:84px;height:84px;border:1px dashed ${MUTED};box-sizing:border-box"></div>`}</div>` +
          `<div style="font-size:0.78em;font-weight:700;line-height:1.3">${esc(r.label)}</div>` +
          `<div style="font-size:0.78em;line-height:1.3;font-variant-numeric:tabular-nums">${esc(r.amount)}</div>` +
          `<div style="font-size:0.7em;color:${MUTED};line-height:1.3;word-break:break-all">${esc(r.address)}</div></td>`
        const rows: string[] = []
        for (let i = 0; i < b.rows.length; i += 4) rows.push(`<tr>${b.rows.slice(i, i + 4).map(code).join('')}</tr>`)
        parts.push(
          `<div data-demand-pay-codes style="margin:0 0 1.1em 0">` +
            `<div style="${LABEL_STYLE};color:${MUTED};margin:0 0 0.2em 0">Pay online</div>` +
            `<div style="font-family:${SANS};font-size:0.82em;color:${MUTED};margin:0 0 0.2em 0">Scan a code with a phone camera, or type its address. Each opens that bill's own payment page.</div>` +
            `<table style="border-collapse:collapse;width:100%">${rows.join('')}</table></div>`,
        )
        break
      }
      case 'heading':
        parts.push(`<div style="${LABEL_STYLE};color:${MUTED};margin:1.5em 0 0.45em 0">${esc(b.text)}</div>`)
        break
      case 'paragraph':
        parts.push(`<p style="margin:0 0 0.7em 0">${esc(b.text)}</p>`)
        break
      case 'listItem':
        if (b.lead) parts.push(`<div style="display:flex;gap:1em;margin:0 0 0.3em 0"><span style="flex:0 0 11.5em">${esc(b.lead)}</span><span>${esc(b.text)}</span></div>`)
        else parts.push(`<p style="margin:0 0 0.3em 0;padding-left:1.6em;text-indent:-1.2em">${b.n ? `${b.n}.` : '•'}&nbsp;&nbsp;${esc(b.text)}</p>`)
        break
      case 'signature':
        // The first line closes the letter; the gap under it is where the ink goes.
        parts.push(`<p style="margin:1.6em 0 0 0">${esc(b.lines[0] ?? '')}</p><p style="margin:2.6em 0 0 0;line-height:1.5">${b.lines.slice(1).map(esc).join('<br/>')}</p>`)
        break
      case 'statement':
        parts.push(statementHtml(b))
        break
      case 'enclosures':
        parts.push(
          `<div style="${LABEL_STYLE};color:${MUTED};margin:1.8em 0 0.3em 0">Enclosure${b.items.length > 1 ? 's' : ''}</div>` +
            `<div style="font-family:${SANS};font-size:0.82em;color:${MUTED};line-height:1.55">${b.items.map((e) => `<div style="display:flex;gap:1em"><span style="flex:0 0 6.5em;color:${INK}">${esc(e.label)}</span><span>${esc(e.text)}</span></div>`).join('')}</div>`,
        )
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

/** "Sep 16, 2026" — a table's date. */
export function demandShortDate(ymd: string): string {
  const d = (ymd ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d || '—'
  const parsed = new Date(d + 'T00:00:00')
  if (Number.isNaN(parsed.getTime())) return d
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export type DemandStatementTableRow = {
  invoice: string
  /** What the bill was for, a line of the bill per entry; a bill of several lines carries each line's charge ('' on a bill of one line: the row's own figures are its charge). */
  lines: Array<{ text: string; amount: string }>
  sent: string
  due: string
  billed: string
  paid: string
  balance: string
}

/**
 * The statement as the letter prints it: one row per invoice, read across —
 * what it was for, when it went out and was due, and what is still owed. The
 * Billed and Paid columns appear only when something was paid (the day it went
 * out then sits under the invoice's number, to leave the room); with nothing
 * paid every balance is the bill. Each charge of a bill of several lines is
 * named in its row (Rule 185: the name, date and charge of each item).
 */
export function statementTable(b: { invoices: DemandStatementInvoice[]; balance: string }): { hasPaid: boolean; rows: DemandStatementTableRow[]; total: string } {
  const hasPaid = b.invoices.some((i) => Number(i.paid || 0) > 0)
  const rows = b.invoices.map((inv) => {
    const named = (l: DemandStatementLine) => `${l.description.trim() || '—'}${l.qty.trim() ? ` · Qty ${l.qty.trim()}` : ''}`
    return {
      invoice: inv.invoiceNumber.trim() || 'Invoice',
      lines: inv.lines.map((l) => ({ text: named(l), amount: inv.lines.length > 1 ? demandMoney(l.amount) : '' })),
      sent: inv.sentYmd ? demandShortDate(inv.sentYmd) : '—',
      due: inv.dueYmd ? demandShortDate(inv.dueYmd) : '—',
      billed: demandMoney(inv.total),
      paid: Number(inv.paid || 0) > 0 ? `−${demandMoney(inv.paid)}` : demandMoney('0'),
      balance: demandMoney(inv.balance),
    }
  })
  return { hasPaid, rows, total: demandMoney(b.balance) }
}

function statementHtml(b: { invoices: DemandStatementInvoice[]; balance: string }): string {
  const t = statementTable(b)
  const money = 'text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums'
  const th = (text: string, style = '') => `<th style="padding:0.35em 0.6em 0.35em 0;border-bottom:1px solid ${INK};font-weight:400;font-size:0.9em;color:${MUTED};text-align:left;${style}">${esc(text)}</th>`
  const td = (html: string, last: boolean, style = '') => `<td style="padding:0.45em 0.6em 0.45em 0;border-bottom:${last ? `1px solid ${INK}` : `1px solid ${HAIR}`};vertical-align:top;${style}">${html}</td>`
  const head = [th('Invoice'), th('For'), ...(t.hasPaid ? [] : [th('Sent')]), th('Due'), ...(t.hasPaid ? [th('Billed', money), th('Paid', money)] : []), th('Balance', `${money};padding-right:0`)].join('')
  const body = t.rows
    .map((r, i) => {
      const last = i === t.rows.length - 1
      return `<tr>${[
        td(`${esc(r.invoice)}${t.hasPaid ? `<br/><span style="font-size:0.9em;color:${MUTED}">sent ${esc(r.sent)}</span>` : ''}`, last, 'white-space:nowrap'),
        td(r.lines.map((l) => (l.amount ? `<div style="display:flex;justify-content:space-between;gap:1.2em"><span>${esc(l.text)}</span><span style="color:${MUTED};${money}">${esc(l.amount)}</span></div>` : `<div>${esc(l.text)}</div>`)).join(''), last),
        ...(t.hasPaid ? [] : [td(esc(r.sent), last, 'white-space:nowrap')]),
        td(esc(r.due), last, 'white-space:nowrap'),
        ...(t.hasPaid ? [td(esc(r.billed), last, money), td(esc(r.paid), last, money)] : []),
        td(esc(r.balance), last, `${money};padding-right:0`),
      ].join('')}</tr>`
    })
    .join('')
  const span = t.hasPaid ? 5 : 4
  const total = `<tr><td colspan="${span}" style="padding:0.5em 0;font-weight:700">Balance due</td><td style="padding:0.5em 0;font-weight:700;font-size:1.08em;${money}">${esc(t.total)}</td></tr>`
  return `<table data-demand-statement-table style="border-collapse:collapse;width:100%;margin:0 0 0.8em 0;font-family:${SANS};font-size:0.86em;line-height:1.45"><thead><tr>${head}</tr></thead><tbody>${body}${total}</tbody></table>`
}

export function buildDemandLetterText(f: DemandLetterFields, todayYmd: string, opts: DemandLetterRenderOptions = {}): string {
  const lines: string[] = []
  for (const b of buildDemandLetterModel(f, todayYmd, opts)) {
    switch (b.kind) {
      case 'senderBlock':
        lines.push([b.company, b.licenseLine, ...b.contactLines].filter((l) => l).join('\n'))
        break
      case 'addressBlock':
        lines.push(`Date: ${b.date}`, `TO: ${b.recipient[0] ?? '—'}${b.recipient.length > 1 ? ` — ${b.recipient.slice(1).join(', ')}` : ''}`)
        break
      case 'subject':
        lines.push(b.re)
        break
      case 'amountBox':
        lines.push(`Balance due: ${b.balance} · Pay in full by: ${b.deadline}`)
        break
      case 'payCodes':
        lines.push(`Pay online — each address opens that bill's own payment page:\n${b.rows.map((r) => `  ${r.label} · ${r.amount} · ${r.address}`).join('\n')}`)
        break
      case 'signature':
        lines.push(b.lines.join('\n'))
        break
      case 'listItem':
        lines.push(`  ${b.n ? `${b.n}.` : '•'} ${b.lead ? `${b.lead} — ` : ''}${b.text}`)
        break
      case 'statement':
        lines.push(
          statementRows(b)
            .map((r) => (r.kind === 'invoice' ? r.left : `  ${r.kind === 'line' ? '' : '  '}${r.left}${r.right ? ` ${'.'.repeat(Math.max(2, 58 - r.left.length - r.right.length))} ${r.right}` : ''}`))
            .join('\n'),
        )
        break
      case 'enclosures':
        lines.push(b.line)
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
export function buildDemandLetterPrintHtml(f: DemandLetterFields, todayYmd: string, jobNumber: string, opts: DemandLetterRenderOptions = {}): string {
  return `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>Final Demand for Payment — Job ${esc(jobNumber)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: ${INK}; background: #fff; max-width: 44rem; margin: 2.5rem auto; padding: 0 1.5rem; font-size: 0.95rem; line-height: 1.6; }
  @media print { body { margin: 0.5in auto; } }
</style></head><body>${buildDemandLetterEmailHtml(f, todayYmd, opts)}</body></html>`
}

// ---------- PDF ----------

export function demandLetterPdfFilename(jobNumber: string): string {
  const slug = jobNumber.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'job'
  return `final-demand-letter-${slug}.pdf`
}

const PAGE_MARGIN = 20
const MAX_TEXT_WIDTH_MM = 176
const PAGE_CONTENT_MAX_Y = 264

export async function buildDemandLetterPdfBlob(f: DemandLetterFields, todayYmd: string, opts: DemandLetterRenderOptions = {}): Promise<Blob> {
  const JsPDF = await loadJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'letter' })
  const rightX = PAGE_MARGIN + MAX_TEXT_WIDTH_MM
  let y = PAGE_MARGIN + 4

  const ink = () => doc.setTextColor(28, 26, 23)
  const muted = () => doc.setTextColor(95, 90, 82)
  const ensureRoom = (needed: number) => {
    if (y + needed > PAGE_CONTENT_MAX_Y) {
      doc.addPage()
      y = PAGE_MARGIN + 2
    }
  }
  const writeWrapped = (text: string, lh: number, opts?: { indent?: number; hang?: string }) => {
    const indent = opts?.indent ?? 0
    const lines = doc.splitTextToSize(text, MAX_TEXT_WIDTH_MM - indent) as string[]
    lines.forEach((line, i) => {
      ensureRoom(lh)
      if (i === 0 && opts?.hang) doc.text(opts.hang, PAGE_MARGIN + indent - 6, y)
      doc.text(line, PAGE_MARGIN + indent, y)
      y += lh
    })
  }
  /** A small spaced capital label: the section names, the subject's kicker. */
  const label = (text: string, rgb: [number, number, number]) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(rgb[0], rgb[1], rgb[2])
    doc.text(text.toUpperCase(), PAGE_MARGIN, y, { charSpace: 0.35 })
    ink()
  }

  for (const b of buildDemandLetterModel(f, todayYmd, opts)) {
    switch (b.kind) {
      case 'senderBlock': {
        const contactH = b.contactLines.length * 3.7
        const bottom = y + Math.max(contactH, b.licenseLine ? 9.5 : 6)
        // Both columns sit on the rule: the name on the last line, the contact column ending beside it.
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(15)
        ink()
        doc.text(b.company, PAGE_MARGIN, b.licenseLine ? bottom - 4.2 : bottom - 0.6)
        if (b.licenseLine) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7.5)
          doc.setTextColor(122, 117, 108)
          doc.text(b.licenseLine, PAGE_MARGIN, bottom - 0.4)
        }
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        muted()
        b.contactLines.forEach((l, i) => doc.text(l, rightX, bottom - 0.4 - (b.contactLines.length - 1 - i) * 3.7, { align: 'right' }))
        y = bottom + 2.6
        doc.setDrawColor(28, 26, 23)
        doc.setLineWidth(0.6)
        doc.line(PAGE_MARGIN, y, rightX, y)
        ink()
        y += 10
        break
      }
      case 'addressBlock': {
        doc.setFont('times', 'normal')
        doc.setFontSize(11)
        doc.text(b.date, rightX, y, { align: 'right' })
        for (const l of b.recipient) {
          const wrapped = doc.splitTextToSize(l, MAX_TEXT_WIDTH_MM - 50) as string[]
          for (const line of wrapped) {
            doc.text(line, PAGE_MARGIN, y)
            y += 5.2
          }
        }
        y += 5.5
        break
      }
      case 'subject':
        label(b.kicker, [121, 31, 31])
        y += 5.4
        doc.setFont('times', 'bold')
        doc.setFontSize(13)
        writeWrapped(b.text, 6)
        if (b.detail) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          muted()
          doc.text(b.detail, PAGE_MARGIN, y - 0.6)
          ink()
          y += 4.4
        }
        y += 1.5
        break
      case 'amountBox': {
        const h = 17
        ensureRoom(h + 4)
        const top = y - 2.5
        const mid = PAGE_MARGIN + MAX_TEXT_WIDTH_MM / 2
        doc.setDrawColor(28, 26, 23)
        doc.setLineWidth(0.35)
        doc.rect(PAGE_MARGIN, top, MAX_TEXT_WIDTH_MM, h)
        doc.line(mid, top, mid, top + h)
        const cell = (x: number, name: string, value: string) => {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          muted()
          doc.text(name, x + 4.5, top + 5.6)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(16)
          ink()
          doc.text(value, x + 4.5, top + 13)
        }
        cell(PAGE_MARGIN, 'Balance due', b.balance)
        cell(mid, 'Pay in full by', b.deadline)
        y = top + h + 8
        break
      }
      case 'payCodes': {
        // One row of up to four codes, 22 mm each with three lines under; a fifth starts a new row.
        const perRow = 4
        const colW = MAX_TEXT_WIDTH_MM / perRow
        const qr = 22
        const rowH = qr + 13
        ensureRoom(8 + rowH)
        label('Pay online', [95, 90, 82])
        y += 4
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        muted()
        doc.text("Scan a code with a phone camera, or type its address. Each opens that bill's own payment page.", PAGE_MARGIN, y)
        y += 3.5
        for (let i = 0; i < b.rows.length; i += perRow) {
          ensureRoom(rowH)
          b.rows.slice(i, i + perRow).forEach((r, j) => {
            const x = PAGE_MARGIN + j * colW
            if (r.png) doc.addImage(r.png, 'PNG', x, y, qr, qr)
            else {
              doc.setDrawColor(150, 145, 136)
              doc.setLineWidth(0.25)
              doc.rect(x, y, qr, qr)
            }
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8)
            ink()
            doc.text(r.label, x, y + qr + 3.6)
            doc.setFont('helvetica', 'normal')
            doc.text(r.amount, x, y + qr + 7.2)
            doc.setFontSize(7)
            muted()
            doc.text(r.address, x, y + qr + 10.6)
            ink()
          })
          y += rowH + 2
        }
        y += 3
        break
      }
      case 'heading':
        y += 4
        ensureRoom(b.keepMm ?? 16)
        label(b.text, [95, 90, 82])
        y += 5.2
        break
      case 'paragraph':
        doc.setFont('times', 'normal')
        doc.setFontSize(11)
        writeWrapped(b.text, 5.4)
        y += 1.8
        break
      case 'listItem':
        doc.setFont('times', 'normal')
        doc.setFontSize(11)
        if (b.lead) {
          // Two columns: the day, then what happened on it.
          ensureRoom(5.4)
          doc.text(b.lead, PAGE_MARGIN, y)
          writeWrapped(b.text, 5.4, { indent: 46 })
        } else writeWrapped(b.text, 5.4, { indent: 8, hang: b.n ? `${b.n}.` : '•' })
        y += 0.8
        break
      case 'signature':
        // "Sincerely," — then room for the ink — then who signed.
        ensureRoom(18 + b.lines.length * 5.2)
        y += 5
        doc.setFont('times', 'normal')
        doc.setFontSize(11)
        b.lines.forEach((l, i) => {
          writeWrapped(l, 5.2)
          if (i === 0) y += 11
        })
        break
      case 'statement': {
        const t = statementTable(b)
        // Fixed columns from the right edge; the For column takes what is left.
        const W = { invoice: 33, sent: 23, due: 23, billed: 22, paid: 21, balance: t.hasPaid ? 23 : 25 }
        const xBalance = rightX
        const xPaid = xBalance - W.balance
        const xBilled = xPaid - (t.hasPaid ? W.paid : 0)
        const moneyLeft = xBilled - (t.hasPaid ? W.billed : 0)
        const xDue = moneyLeft - W.due
        const xSent = xDue - (t.hasPaid ? 0 : W.sent)
        const xFor = PAGE_MARGIN + W.invoice
        const forW = xSent - xFor - 3
        const rule = (strong: boolean) => {
          doc.setDrawColor(strong ? 28 : 211, strong ? 26 : 209, strong ? 23 : 199)
          doc.setLineWidth(strong ? 0.35 : 0.2)
          doc.line(PAGE_MARGIN, y, rightX, y)
        }
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        muted()
        doc.text('Invoice', PAGE_MARGIN, y)
        doc.text('For', xFor, y)
        if (!t.hasPaid) doc.text('Sent', xSent, y)
        doc.text('Due', xDue, y)
        if (t.hasPaid) {
          doc.text('Billed', xBilled, y, { align: 'right' })
          doc.text('Paid', xPaid, y, { align: 'right' })
        }
        doc.text('Balance', xBalance, y, { align: 'right' })
        y += 1.8
        rule(true)
        ink()
        doc.setFontSize(9)
        t.rows.forEach((r, i) => {
          // A charge sits at the right of its line's first row, inside the For column.
          const wrapped = r.lines.flatMap((l) => (doc.splitTextToSize(l.text, forW - (l.amount ? 19 : 0)) as string[]).map((text, k) => ({ text, amount: k === 0 ? l.amount : '' })))
          const rowH = Math.max(t.hasPaid ? 2 : 1, wrapped.length) * 4.3 + 3.2
          if (y + rowH > PAGE_CONTENT_MAX_Y) {
            doc.addPage()
            y = PAGE_MARGIN + 2
          }
          const base = y + 4.6
          doc.text(r.invoice, PAGE_MARGIN, base)
          wrapped.forEach((l, k) => {
            doc.text(l.text, xFor, base + k * 4.3)
            if (l.amount) {
              muted()
              doc.text(l.amount, xFor + forW, base + k * 4.3, { align: 'right' })
              ink()
            }
          })
          if (t.hasPaid) {
            doc.setFontSize(8)
            muted()
            doc.text(`sent ${r.sent}`, PAGE_MARGIN, base + 4.3)
            doc.setFontSize(9)
            ink()
          } else doc.text(r.sent, xSent, base)
          doc.text(r.due, xDue, base)
          if (t.hasPaid) {
            doc.text(r.billed, xBilled, base, { align: 'right' })
            // The built-in fonts have no U+2212; a hyphen is the minus on paper.
            doc.text(r.paid.replace('−', '-'), xPaid, base, { align: 'right' })
          }
          doc.text(r.balance, xBalance, base, { align: 'right' })
          y += rowH
          rule(i === t.rows.length - 1)
        })
        ensureRoom(9)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9.5)
        doc.text('Balance due', PAGE_MARGIN, y + 5.2)
        doc.setFontSize(10.5)
        doc.text(t.total, xBalance, y + 5.2, { align: 'right' })
        y += 13.5
        break
      }
      case 'enclosures':
        ensureRoom(8 + b.items.length * 4)
        y += 6
        label(`Enclosure${b.items.length > 1 ? 's' : ''}`, [95, 90, 82])
        y += 4.4
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        muted()
        for (const item of b.items) {
          ensureRoom(4)
          ink()
          doc.text(item.label, PAGE_MARGIN, y)
          muted()
          writeWrapped(item.text, 4, { indent: 21 })
        }
        ink()
        break
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
    doc.line(PAGE_MARGIN, 270, rightX, 270)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(122, 117, 108)
    if (footerLeft) doc.text(footerLeft, PAGE_MARGIN, 274)
    doc.text(`Page ${p} of ${pages}`, rightX, 274, { align: 'right' })
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
 * The invoice exhibit says what the letter says: the number the customer saw
 * and the day the bill was due, taken from the statement's row for that bill.
 * The app's own rendering of a Stripe-hosted bill knows only its sequence
 * ("#2") and falls back to the send day when no due day was recorded — a
 * letter citing one number and due day over an exhibit printing others is a
 * legal paper contradicting its own attachment.
 */
export function exhibitInvoiceDocument(doc: PhysicalInvoiceDocument, st: Pick<DemandStatementInvoice, 'invoiceNumber' | 'dueYmd'>): PhysicalInvoiceDocument {
  const number = st.invoiceNumber.trim()
  return {
    ...doc,
    ...(number ? { invoiceNumberDisplay: number } : {}),
    ...(/^\d{4}-\d{2}-\d{2}$/.test(st.dueYmd) ? { dueDateDisplay: demandDate(st.dueYmd) } : {}),
  }
}


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
  /** What Stripe rendered (v2.3445: the due date too, for a row that never recorded one). */
  stripe: { invoiceNumber: string | null; lines: StripeInvoiceLineDetail[]; dueYmd?: string | null } | null
}

/** The number a bill shows when nothing better is known: its sequence, or the job number for the primary bill (sequence 0) — never "#0" (v2.3445). */
export function fallbackInvoiceNumber(inv: Pick<JobsLedgerInvoice, 'sequence_order'>, hcp: string | null | undefined): string {
  if (inv.sequence_order > 0) return `#${inv.sequence_order}`
  const h = (hcp ?? '').trim()
  return h ? `#${h}` : '#1'
}

/** A `date` column's day. An instant's day is `calendarYmdInAppTzFromIso` (its first ten characters are the UTC date). */
function ymdOf(raw: string | null | undefined): string {
  const t = (raw ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : ''
}

/** The bill, invoice by invoice, as the customer saw it — never typed. */
export function buildDemandStatement(job: JobWithDetails, sources: DemandInvoiceSource[]): DemandStatementInvoice[] {
  return sources.map(({ inv, doc, stripe }) => {
    const total = Number(inv.amount ?? 0)
    const paid = paymentsAppliedToInvoice(job, inv.id)
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
    const invoiceNumber = stripeNumber ? `#${stripeNumber.replace(/^#/, '')}` : docNumber && docNumber !== '—' && docNumber !== '#0' ? docNumber : fallbackInvoiceNumber(inv, job.hcp_number)
    return {
      invoiceNumber,
      // The day the bill went out (billed_at), not the day it was later delivered or re-sent (v2.3445).
      sentYmd: calendarYmdInAppTzFromIso(inv.billed_at ?? '') || calendarYmdInAppTzFromIso(inv.sent_to_customer_at ?? '') || calendarYmdInAppTzFromIso(inv.created_at ?? ''),
      dueYmd: ymdOf(inv.estimated_bill_date) || ymdOf(stripe?.dueYmd ?? null),
      lines,
      total: moneyInput(total),
      paid: moneyInput(paid),
      balance: moneyInput(Math.max(0, total - paid)),
      invoiceId: inv.id,
      payable: Boolean(inv.stripe_invoice_id),
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
  /** The linked property record's homestead flag (v2.3433) — blocks the Chapter 53 line. */
  homestead?: boolean
  todayYmd: string
}

/**
 * What has been paid against one bill — the single answer for the letter's claim, its statement of
 * account, and which bills a letter covers (v2.3515).
 *
 * A payment linked to this bill always counts; one linked to a different bill never does. A payment
 * recorded on the job with no bill attached counts ONLY when the job has exactly one sent bill —
 * there is nothing else it could be paying. Job 102 is that shape: one $5,355 bill, one unlinked
 * $3,000 check. The enclosed invoice (Exhibit A) already read "Balance due $2,355" while the letter
 * around it said "Nothing has been paid" and demanded $5,355 — a legal instrument contradicting its
 * own attachment.
 *
 * On a job with several bills, unlinked money is applied oldest bill first (the owner's rule,
 * 2026-09-18, v2.3592) — never smeared onto every bill (the double credit v2.3498 removed).
 *
 * Unlinked money pays the part of the job on no bill before it pays a bill (v2.4534): the job's
 * total (`revenue`) goes to the kernel. Job 273's letter claimed $0.00 beside a § 53.056 notice
 * for $17,585, because $38,780 paid before its three bills existed was counted against them.
 */
export function paymentsAppliedToInvoice(job: Pick<JobWithDetails, 'payments' | 'invoices'> & { revenue?: number | string | null }, invoiceId: string): number {
  // v2.3592: oldest bill first — the same kernel the invoice's payment history, the Bill tab and the
  // portal read, so the letter, its exhibit and the statement of account cannot disagree.
  return paymentsAppliedToBill(job.invoices ?? [], job.payments ?? [], invoiceId, job.revenue)
}

/**
 * Owner rule (2026-09-02): a § 31.04 theft-of-services report is off the table once the client has
 * paid ANYTHING on the job — a partial payment defeats it. That is every payment on the job, on any
 * bill or on none; not the letter's own claim arithmetic, which counts only what its covered bills
 * can attribute. Job 258 had $8,000 paid on an earlier bill and still read "no payments made".
 */
export function jobHasAnyPayment(job: Pick<JobWithDetails, 'payments'>): boolean {
  return (job.payments ?? []).some((p) => Number(p.amount ?? 0) > 0)
}

function moneyInput(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

export function buildDemandLetterPrefill(ctx: DemandLetterPrefillContext): DemandLetterFields {
  const { job, invoices, issuer, senderName, senderEmailFallback, recipient, priorNotices, propertyKind, todayYmd } = ctx
  const statement = ctx.sources ? buildDemandStatement(job, ctx.sources.filter((src) => invoices.some((i) => i.id === src.inv.id))) : []
  const total = invoices.reduce((s, i) => s + Number(i.amount ?? 0), 0)
  const applied = invoices.reduce((s, i) => s + paymentsAppliedToInvoice(job, i.id), 0)
  const outstanding = Math.max(0, total - applied)
  const hcp = (job.hcp_number ?? '').trim()
  const firstBilled = invoices
    .map((i) => calendarYmdInAppTzFromIso(i.billed_at ?? i.created_at ?? ''))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()[0]
  const lastWork = (job.last_work_date ?? '').slice(0, 10)
  const hasWorkMonth = /^\d{4}-\d{2}-\d{2}$/.test(lastWork)
  const lienFilingDeadline = hasWorkMonth ? lienFilingDeadlineForMonth(lastWork, propertyKind) : ''
  const lienBlockedReason = lienLineBlockedReason({ lienFilingDeadline, todayYmd, homestead: Boolean(ctx.homestead), hasWorkMonth })
  const interest = interestBasisFor(statement)
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
    serviceAddress: cleanStoredAddress(job.job_address),
    invoiceNumber: statement.length > 0 ? statement.map((i) => i.invoiceNumber).join(', ') : hcp ? `${hcp}` : `#${invoices[0]?.sequence_order ?? 1}`,
    invoiceDate: firstBilled ?? todayYmd,
    serviceDescription: (job.job_name ?? '').trim() || 'Plumbing services',
    invoiceTotal: moneyInput(total),
    paymentsReceived: moneyInput(applied),
    outstanding: moneyInput(outstanding),
    deadlineDate: addBusinessDays(todayYmd, 10),
    paymentMethod: '',
    includeSmallClaims: true,
    includeLien: !lienBlockedReason,
    lienFilingDeadline,
    lienBlockedReason,
    feeClockYmd: feeClockDate(todayYmd),
    interestBasis: interest.basis,
    interestFromYmd: interest.fromYmd,
    includeTheftOfServices: false,
    includeLateFees: interest.basis !== 'none',
    includeNotarial: false,
    includePayCodes: true,
    priorNotices,
  }
}
