/**
 * Sub papers (punch list #350): the words and the numbers of three papers a sub is handed, and one check across them.
 *
 *  A. Work statement, one per sub sheet: the lines, each back-charge, each payment, what stays open.
 *  B. Payment record, one per sending: how much went to each sheet, and what stays open after it.
 *  C. Statement of account, one person and a period: every sheet, the last payments, and how it adds up.
 *
 * A part payment reads the same on all three, and `subPapersAddUp` refuses a set that does not agree: a paper is
 * never drawn beside a number that is off. The HTML print (`src/lib/subWorkOrders/subPapersHtml.ts`) and the PDF
 * (`subPapersPdf.ts`) both read these models, so the app, the sub's portal and the tests draw one paper.
 *
 * The inputs arrive resolved: whose a sheet is (`sheetParties`), each money line's day (`paymentDay`), a memo the
 * office hid already blanked. This file reads no table and no clock.
 *
 * NAMES. The papers are a Work statement, a Payment record and a Statement of account, and what we have not paid is
 * *Still open*. No label here says invoice, receipt or owed. Six sentences wait on counsel
 * (`SUB_PAPER_COUNSEL_SENTENCES`): they are drafts, marked wherever they print.
 *
 * Pure, and free of imports, so an edge function can bundle it.
 */

const cents = (n: number): number => Math.round(n * 100) / 100
const YMD = /^\d{4}-\d{2}-\d{2}$/
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const paperMoney = (n: number): string => `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** `Oct 28, 2026`. '' for a day that is not one. */
export function paperDay(ymd: string | null | undefined): string {
  const d = (ymd ?? '').slice(0, 10)
  if (!YMD.test(d)) return ''
  const [y, m, day] = d.split('-').map(Number)
  return `${MONTHS[(m ?? 1) - 1]} ${day}, ${y}`
}

/** `Nov 12, 2026`, or `recorded Oct 28, 2026` for a line with no Date sent. */
export function paperMoneyDay(l: { ymd: string; recorded: boolean }): string {
  const day = paperDay(l.ymd)
  if (!day) return 'no date'
  return l.recorded ? `recorded ${day}` : day
}

// ── The sentences that wait on counsel ───────────────────────────────────────────────────────────────────────

export type CounselSentenceKey = 'notAnInvoice' | 'confirmMeans' | 'workOrderTerms' | 'notARelease' | 'notATaxForm' | 'openUnderTerms'

/** Drafts in plain words. `{company}` and `{sub}` are filled when a paper is built. Counsel's words replace them. */
export const SUB_PAPER_COUNSEL_SENTENCES: Record<CounselSentenceKey, string> = {
  notAnInvoice: '{company} prepared this statement from its own records. It is not an invoice from {sub}.',
  confirmMeans: 'By confirming, {sub} agrees that the statement is its bill to {company} for this work.',
  workOrderTerms: 'Payment follows the terms of the work order for this job.',
  notARelease: 'This record shows a payment {company} sent. It is not a release or a waiver of any lien right. A waiver is a separate paper.',
  notATaxForm: 'This figure is for your records. It is not a tax form.',
  openUnderTerms: "Open amounts are paid under the terms of each job's work order.",
}

/** True while the six sentences are still the drafts: every print marks them. */
export const SUB_PAPER_COUNSEL_PENDING = true

/**
 * Whether a sub can confirm a work statement from their page (the card's PR 7). Off: the press is not drawn and
 * the page's function refuses the answer. What a confirm means is counsel's, and their words for it are not in
 * hand (sentence 2, `confirmMeans`). Turning it on is a deploy of the client and of `sub-portal`, both of which
 * read this one line. A confirm already on record prints whatever this says.
 */
export const SUB_PAPER_CONFIRM_LIVE = false

export type CounselSentence = { key: CounselSentenceKey; text: string; pending: boolean }

function counsel(key: CounselSentenceKey, company: string, sub: string): CounselSentence {
  return { key, text: SUB_PAPER_COUNSEL_SENTENCES[key].replace(/\{company\}/g, company).replace(/\{sub\}/g, sub), pending: SUB_PAPER_COUNSEL_PENDING }
}

// ── Inputs ───────────────────────────────────────────────────────────────────────────────────────────────────

export type PaperMoneyLine = {
  id: string
  /** As stored: above zero for a payment, below for a back-charge. */
  amount: number
  /** `YYYY-MM-DD`: the Date sent, else the day it was recorded; '' when it has neither. */
  ymd: string
  recorded: boolean
  /** The recorded instant, to order two lines of one day. */
  at: string
  /** `Check 1182`, `Zelle`; '' when none was picked. */
  how: string
  /** What the sub reads: '' when the office hid the memo. */
  memo: string
  sendingId: string | null
  sendingNo: number | null
  /** Paid from their credit: no money left the bank. */
  fromCredit: boolean
  /** Credit kept with this line: what the same sending carried past what the sheets needed. */
  creditKept: number
  /** Not our money: the customer paid the sub. Left out of *Paid this year*. */
  clientDirect: boolean
}

export type PaperConfirm = { revision: number; amount: number; at: string; from: string }

export type PaperSheet = {
  id: string
  /** `WS-2041-1` once the register has minted one; '' before then. */
  number: string
  revision: number
  /** The day the copy this revision replaces was issued; '' for a first revision. */
  replacesCopyOf: string
  jobNumber: string
  jobName: string
  address: string
  /** The day the work is dated. */
  day: string
  /** When the sheet was typed, an ISO instant; absent where the reader does not hand it in. Only a statement that carries late work reads it. */
  at?: string
  lines: ReadonlyArray<{ label: string; amount: number }>
  money: ReadonlyArray<PaperMoneyLine>
  confirm: PaperConfirm | null
}

export type PaperCompany = { name: string; lines: readonly string[] }
export type PaperParty = { name: string; lines: readonly string[] }

export type PaperContext = {
  company: PaperCompany
  sub: PaperParty
  /** `YYYY-MM-DD`, today in the app's zone. */
  today: string
  /** `Nov 13, 2026 at 2:40 pm`, the moment it was prepared, in the app's zone. */
  preparedAt: string
  /** The zone's name as the paper says it. */
  zone: string
}

// ── One sheet's sums ─────────────────────────────────────────────────────────────────────────────────────────

/** The sheet's money lines, oldest first. A line with no day sorts last. */
function ordered(sheet: PaperSheet): PaperMoneyLine[] {
  return sheet.money.filter((m) => Number.isFinite(m.amount) && m.amount !== 0).slice().sort((a, b) => (a.ymd || '9999').localeCompare(b.ymd || '9999') || a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
}

export type SheetSums = { agreed: number; backcharged: number; comesTo: number; paid: number; stillOpen: number; over: number }

/** The sums of a sheet over the money lines given (all of them by default). Agreed is read back from the money when no line is priced, as `subLaborJobBalance` does. */
export function paperSheetSums(sheet: PaperSheet, lines: readonly PaperMoneyLine[] = ordered(sheet)): SheetSums {
  const all = ordered(sheet)
  const priced = cents(sheet.lines.reduce((n, l) => n + l.amount, 0))
  const allPaid = cents(all.filter((m) => m.amount > 0).reduce((n, m) => n + m.amount, 0))
  const allBack = cents(all.filter((m) => m.amount < 0).reduce((n, m) => n - m.amount, 0))
  const agreed = priced === 0 && (allPaid > 0 || allBack > 0) ? cents(allPaid + allBack) : priced
  const paid = cents(lines.filter((m) => m.amount > 0).reduce((n, m) => n + m.amount, 0))
  const backcharged = cents(lines.filter((m) => m.amount < 0).reduce((n, m) => n - m.amount, 0))
  const comesTo = cents(agreed - backcharged)
  const net = cents(comesTo - paid)
  return { agreed, backcharged, comesTo, paid, stillOpen: Math.max(0, net), over: Math.max(0, cents(-net)) }
}

/** What a sheet is called on a paper: its number, else `Sheet of Oct 28, 2026`. */
export function paperSheetName(s: Pick<PaperSheet, 'number' | 'day'>): string {
  return s.number || (paperDay(s.day) ? `Sheet of ${paperDay(s.day)}` : 'Sheet with no date')
}

export function paperJobLabel(s: Pick<PaperSheet, 'jobNumber' | 'jobName' | 'address'>): string {
  return [s.jobNumber ? `#${s.jobNumber}` : '', s.jobName || s.address].filter(Boolean).join(' ')
}

/** `PR-0231`; '' for a payment recorded before sendings had numbers. */
export function paymentRecordNumber(sendingNo: number | null | undefined): string {
  return sendingNo != null && Number.isFinite(sendingNo) ? `PR-${String(sendingNo).padStart(4, '0')}` : ''
}

// ── A. Work statement ────────────────────────────────────────────────────────────────────────────────────────

export type WorkStatement = {
  kind: 'work_statement'
  title: 'Work statement'
  sheetId: string
  number: string
  revision: number
  issued: string
  company: PaperCompany
  sub: PaperParty
  job: { label: string; address: string; day: string }
  lines: Array<{ label: string; amount: number }>
  /** True when no line is priced and the total is read back from the money moved. */
  reconstructed: boolean
  agreed: number
  backcharges: Array<{ id: string; day: string; reason: string; amount: number }>
  comesTo: number
  payments: Array<{ id: string; day: string; words: 'part payment' | 'paid in full' | 'from your credit'; how: string; recordNo: string; amount: number; openAfter: number }>
  paidSoFar: number
  stillOpen: number
  /** Paid past what the statement comes to: it sits with us as a credit. */
  over: number
  confirm: { words: string; current: boolean } | null
  sentences: CounselSentence[]
  foot: string
}

export function buildWorkStatement(sheet: PaperSheet, ctx: PaperContext): WorkStatement {
  const lines = ordered(sheet)
  const sums = paperSheetSums(sheet)
  const priced = cents(sheet.lines.reduce((n, l) => n + l.amount, 0))
  // What the sheet still had open after each payment, with every back-charge counted: a payment that leaves
  // nothing reads "paid in full" even when a back-charge is dated after it.
  let left = sums.comesTo
  const payments: WorkStatement['payments'] = []
  for (const m of lines) {
    if (m.amount <= 0) continue
    left = cents(left - m.amount)
    payments.push({ id: m.id, day: paperMoneyDay(m), words: m.fromCredit ? 'from your credit' : left > 0 ? 'part payment' : 'paid in full', how: m.fromCredit ? 'Credit' : m.how, recordNo: paymentRecordNumber(m.sendingNo), amount: m.amount, openAfter: Math.max(0, left) })
  }
  const c = sheet.confirm
  const confirm = c
    ? {
        current: c.revision === sheet.revision && Math.abs(c.amount - sums.comesTo) < 0.005,
        words:
          c.revision === sheet.revision && Math.abs(c.amount - sums.comesTo) < 0.005
            ? `${ctx.sub.name} confirmed revision ${c.revision} of this statement, at ${paperMoney(c.amount)}, on ${c.at}, from ${c.from}.`
            : `${ctx.sub.name} confirmed revision ${c.revision} of this statement, at ${paperMoney(c.amount)}, on ${c.at}, from ${c.from}. It has changed since, and this revision has not been confirmed.`,
      }
    : null
  return {
    kind: 'work_statement',
    title: 'Work statement',
    sheetId: sheet.id,
    number: sheet.number,
    revision: sheet.revision,
    issued: paperDay(ctx.today),
    company: ctx.company,
    sub: ctx.sub,
    job: { label: paperJobLabel(sheet), address: sheet.address, day: paperDay(sheet.day) },
    lines: sheet.lines.map((l) => ({ label: l.label, amount: cents(l.amount) })),
    reconstructed: priced === 0 && sums.agreed > 0,
    agreed: sums.agreed,
    backcharges: lines.filter((m) => m.amount < 0).map((m) => ({ id: m.id, day: paperMoneyDay(m), reason: m.memo, amount: cents(-m.amount) })),
    comesTo: sums.comesTo,
    payments,
    paidSoFar: sums.paid,
    stillOpen: sums.stillOpen,
    over: sums.over,
    confirm,
    sentences: [counsel('notAnInvoice', ctx.company.name, ctx.sub.name), ...(confirm ? [counsel('confirmMeans', ctx.company.name, ctx.sub.name)] : []), counsel('workOrderTerms', ctx.company.name, ctx.sub.name)],
    foot: [sheet.number || `Prepared ${ctx.preparedAt} ${ctx.zone}`, sheet.number && sheet.revision > 1 ? `revision ${sheet.revision}` : '', sheet.replacesCopyOf ? `replaces the copy of ${paperDay(sheet.replacesCopyOf)}` : ''].filter(Boolean).join(' · '),
  }
}

// ── B. Payment record ────────────────────────────────────────────────────────────────────────────────────────

export type PaperSending = {
  /** The sending's id, or `row:<payment id>` for a payment recorded before sendings: one record per row. */
  key: string
  number: string
  ymd: string
  recorded: boolean
  at: string
  how: string
  /** The office's note to the sub, from the first row that has one. */
  note: string
  rows: Array<{ sheetId: string; moneyId: string; amount: number }>
  creditKept: number
  /** What left the bank: the rows and the credit kept. */
  amount: number
  clientDirect: boolean
}

/** Every sending across the sheets: rows that share a sending are one, a row with none is its own. A line paid from credit is not a sending. */
export function paperSendings(sheets: readonly PaperSheet[]): PaperSending[] {
  const byKey = new Map<string, PaperSending>()
  for (const s of sheets) {
    for (const m of ordered(s)) {
      if (m.amount <= 0 || m.fromCredit) continue
      const key = m.sendingId ?? `row:${m.id}`
      const snd = byKey.get(key) ?? { key, number: paymentRecordNumber(m.sendingNo), ymd: m.ymd, recorded: m.recorded, at: m.at, how: m.how, note: '', rows: [], creditKept: 0, amount: 0, clientDirect: m.clientDirect }
      snd.rows.push({ sheetId: s.id, moneyId: m.id, amount: m.amount })
      snd.creditKept = cents(snd.creditKept + Math.max(0, m.creditKept))
      if (!snd.note && m.memo) snd.note = m.memo
      if (!snd.how && m.how) snd.how = m.how
      if (m.at && (!snd.at || m.at < snd.at)) snd.at = m.at
      byKey.set(key, snd)
    }
  }
  const out = [...byKey.values()]
  for (const snd of out) snd.amount = cents(snd.rows.reduce((n, r) => n + r.amount, 0) + snd.creditKept)
  return out.sort((a, b) => (a.ymd || '9999').localeCompare(b.ymd || '9999') || a.at.localeCompare(b.at) || a.key.localeCompare(b.key))
}

export type PaymentRecord = {
  kind: 'payment_record'
  title: 'Payment record'
  key: string
  number: string
  sentOn: string
  company: PaperCompany
  sub: PaperParty
  how: string
  amountSent: number
  applied: Array<{ sheetId: string; sheetName: string; job: string; day: string; openBefore: number; thisPayment: number; openAfter: number; words: 'Part payment' | 'Paid in full' }>
  appliedTotal: number
  /** Sent past what the sheets needed, kept as their credit. */
  creditKept: number
  after: Array<{ sheetId: string; sheetName: string; job: string; open: number }>
  stillOpenAfter: number
  note: string
  received: string
  sentences: CounselSentence[]
  foot: string
}

/**
 * One sending as a paper. *Open before* and *open after* are the sheet's own running figures, back-charges
 * counted. *After this payment* is every sheet of the person's as it stood once this sending and all money dated
 * up to its day had landed.
 */
export function buildPaymentRecord(sending: PaperSending, sheets: readonly PaperSheet[], ctx: PaperContext, received: { at: string } | null = null): PaymentRecord {
  const mine = new Set(sending.rows.map((r) => r.moneyId))
  const cutDay = sending.ymd || '9999'
  // Landed by the time this sending did: its own rows, and any payment dated before it or earlier the same day.
  const landed = (m: PaperMoneyLine) => mine.has(m.id) || (m.ymd || '9999') < cutDay || ((m.ymd || '9999') === cutDay && m.at <= sending.at)
  const applied: PaymentRecord['applied'] = []
  const after: PaymentRecord['after'] = []
  for (const s of sheets) {
    const sums = paperSheetSums(s)
    // The sheet's own run: every back-charge counts from the start, payments in order.
    let left = sums.comesTo
    let paidOnIt = false
    for (const m of ordered(s)) {
      if (m.amount <= 0) continue
      const before = left
      left = cents(left - m.amount)
      if (!mine.has(m.id)) continue
      paidOnIt = true
      applied.push({ sheetId: s.id, sheetName: paperSheetName(s), job: paperJobLabel(s), day: paperDay(s.day), openBefore: Math.max(0, before), thisPayment: m.amount, openAfter: Math.max(0, left), words: left > 0 ? 'Part payment' : 'Paid in full' })
    }
    const openThen = cents(sums.comesTo - ordered(s).filter((m) => m.amount > 0 && landed(m)).reduce((n, m) => n + m.amount, 0))
    // A sheet dated after the sending had not been written yet, unless this sending paid on it.
    const existed = paidOnIt || !s.day || !sending.ymd || s.day <= sending.ymd
    if (existed && openThen > 0) after.push({ sheetId: s.id, sheetName: paperSheetName(s), job: paperJobLabel(s), open: openThen })
  }
  applied.sort((a, b) => a.openAfter - b.openAfter || a.sheetName.localeCompare(b.sheetName))
  const appliedTotal = cents(applied.reduce((n, a) => n + a.thisPayment, 0))
  return {
    kind: 'payment_record',
    title: 'Payment record',
    key: sending.key,
    number: sending.number,
    sentOn: paperMoneyDay(sending),
    company: ctx.company,
    sub: ctx.sub,
    how: sending.how || 'Not recorded',
    amountSent: sending.amount,
    applied,
    appliedTotal,
    creditKept: sending.creditKept,
    after,
    stillOpenAfter: cents(after.reduce((n, a) => n + a.open, 0)),
    note: sending.note,
    received: received ? `${ctx.sub.name} marked this received on ${received.at}.` : `Not marked yet. ${ctx.sub.name} can press Got it on their page.`,
    sentences: [counsel('notARelease', ctx.company.name, ctx.sub.name)],
    foot: sending.number || `Prepared ${ctx.preparedAt} ${ctx.zone}`,
  }
}

// ── C. Statement of account ──────────────────────────────────────────────────────────────────────────────────

/**
 * A statement's period. `lateAfter` is the moment the statement before this period was made, an ISO instant, and
 * only *Since the last statement* hands it in. A period is cut by the date on a payment (the owner, 2026-11-21).
 * But a line typed after that moment and dated before `from` was on no statement: the one before was made
 * without it, and this one would start after it. So it is carried into this period, under its own date, and the
 * statement opens on what the last one closed on.
 */
export type StatementRange = { from: string | null; to: string | null; lateAfter?: string | null }

export type StatementOfAccount = {
  kind: 'statement_of_account'
  title: 'Statement of account'
  number: string
  period: string
  preparedOn: string
  zone: string
  company: PaperCompany
  sub: PaperParty
  /** The closing day: the period's end, else today. */
  closingDay: string
  stillOpen: number
  rows: Array<{ sheetId: string; section: 'forward' | 'period'; sheetName: string; job: string; words: string; comesTo: number; paid: number; open: number }>
  totals: { comesTo: number; paid: number; open: number }
  /** `late` is a payment dated before the period and recorded after the last statement was made: carried into this one. */
  lastPayments: Array<{ key: string; day: string; how: string; number: string; amount: number; late?: boolean }>
  /** What this statement carries from before its period, each recorded after the last statement was made. Absent when nothing is. */
  late?: { payments: number; backcharges: number; sheets: number } | null
  paidInPeriod: number
  /** Open at the start, plus new work, less back-charges, less payments, is what is open at the end. */
  adds: { opening: number; newWork: number; backcharges: number; payments: number; closing: number }
  /** Money with us past what the sheets came to: over-payments and credit kept, less credit used. */
  credit: number
  paidThisYear: { year: string; amount: number } | null
  /** Money lines with no day at all: left off a statement that has a period, and said. */
  undated: number
  sentences: CounselSentence[]
  foot: string
}

/** The day a sheet counts from: its own, or its first payment when that came earlier, so a deposit never reads as money for nothing. */
function effectiveDay(s: PaperSheet): string {
  const first = ordered(s).map((m) => m.ymd).filter(Boolean)[0] ?? ''
  const dated = (s.day ?? '').slice(0, 10)
  return dated && first ? (dated < first ? dated : first) : dated || first
}

export function statementPeriodWords(range: StatementRange, today: string): string {
  if (range.from && range.to) return `${paperDay(range.from)} to ${paperDay(range.to)}`
  if (range.from) return `${paperDay(range.from)} to ${paperDay(today)}`
  if (range.to) return `To ${paperDay(range.to)}`
  return `To date, ${paperDay(today)}`
}

export function buildStatementOfAccount(sheets: readonly PaperSheet[], range: StatementRange, ctx: PaperContext, opts: { number?: string } = {}): StatementOfAccount {
  const from = range.from && YMD.test(range.from) ? range.from : null
  const to = range.to && YMD.test(range.to) ? range.to : null
  const edged = !!from || !!to
  // A line counts up to the period's end. One with no day counts only on a statement of every date.
  const upToEnd = (m: PaperMoneyLine) => (m.ymd ? !to || m.ymd <= to : !edged)
  // Late: typed after the statement before this period was made. Dated before the period, it was on no statement.
  const lateAfter = from && range.lateAfter ? Date.parse(range.lateAfter) : NaN
  const typedLate = (at: string | undefined) => Number.isFinite(lateAfter) && !!at && Date.parse(at) > lateAfter
  const carried = (m: PaperMoneyLine) => !!from && !!m.ymd && m.ymd < from && typedLate(m.at)
  const beforeStart = (m: PaperMoneyLine) => !!from && !!m.ymd && m.ymd < from && !carried(m)
  const inPeriod = (m: PaperMoneyLine) => upToEnd(m) && !beforeStart(m)
  const late = { payments: 0, backcharges: 0, sheets: 0 }

  const rows: StatementOfAccount['rows'] = []
  let opening = 0
  let newWork = 0
  let backcharges = 0
  let payments = 0
  let credit = 0
  let undated = 0
  for (const s of sheets) {
    const day = effectiveDay(s)
    const all = ordered(s)
    undated += edged ? all.filter((m) => !m.ymd).length : 0
    // A sheet with no day at all is on a statement of every date only.
    if (day ? !!to && day > to : edged) continue
    const priced = paperSheetSums(s).agreed
    const linesToEnd = all.filter(upToEnd)
    // A sheet dated before the period and typed after the last statement was made is new work on this one, with
    // every line it has: the statement before knew nothing of it.
    const lateSheet = !!from && !!day && day < from && typedLate(s.at)
    const linesBefore = lateSheet ? [] : all.filter(beforeStart)
    const atEnd = paperSheetSums(s, linesToEnd)
    const forward = !!from && !!day && day < from && !lateSheet
    const moved = lateSheet ? linesToEnd : all.filter(inPeriod)
    if (lateSheet) late.sheets += 1
    late.backcharges += moved.filter((m) => m.amount < 0 && !!from && !!m.ymd && m.ymd < from).length
    // The credit a set of lines leaves with us: kept with a payment, less what was used from it.
    const heldOver = (lines: readonly PaperMoneyLine[]) => cents(lines.reduce((n, m) => n + (m.amount > 0 && !m.fromCredit ? Math.max(0, m.creditKept) : 0) - (m.fromCredit && m.amount > 0 ? m.amount : 0), 0))
    let history = false
    if (forward) {
      const atStart = paperSheetSums(s, linesBefore)
      opening = cents(opening + (atStart.comesTo - atStart.paid) - heldOver(linesBefore))
      // Settled before the period and untouched in it: history, not a row on this statement.
      history = atStart.stillOpen <= 0 && atStart.over <= 0 && moved.length === 0
    } else {
      newWork = cents(newWork + priced)
    }
    for (const m of moved) {
      if (m.amount < 0) backcharges = cents(backcharges - m.amount)
      else if (!m.fromCredit) payments = cents(payments + m.amount + Math.max(0, m.creditKept))
    }
    credit = cents(credit + atEnd.over + heldOver(linesToEnd))
    if (history) continue
    const paidLines = linesToEnd.filter((m) => m.amount > 0)
    const lastPaid = paidLines[paidLines.length - 1]
    const words =
      atEnd.over > 0
        ? `Paid ${paperMoney(atEnd.over)} past what it comes to`
        : atEnd.stillOpen <= 0 && lastPaid
          ? `Paid in full ${paperMoneyDay(lastPaid)}`
          : [atEnd.backcharged > 0 ? `${paperMoney(atEnd.agreed)} agreed, less a ${paperMoney(atEnd.backcharged)} back-charge` : '', paidLines.length === 0 ? 'Nothing paid yet' : `${paidLines.length} part ${paidLines.length === 1 ? 'payment' : 'payments'}`].filter(Boolean).join(' · ')
    rows.push({ sheetId: s.id, section: forward ? 'forward' : 'period', sheetName: paperSheetName(s), job: paperJobLabel(s), words, comesTo: atEnd.comesTo, paid: atEnd.paid, open: atEnd.stillOpen })
  }
  const order = new Map(sheets.map((s, i) => [s.id, `${effectiveDay(s) || '9999'}:${String(i).padStart(5, '0')}`]))
  rows.sort((a, b) => (a.section === b.section ? 0 : a.section === 'forward' ? -1 : 1) || (order.get(a.sheetId) ?? '').localeCompare(order.get(b.sheetId) ?? ''))

  // A credit used is no money sent, so it is in no payment total; it lowers the credit they hold and the sheet alike.
  // A sending dated before the period is listed when it was recorded after the last statement was made.
  const lateSending = (snd: PaperSending) => !!from && !!snd.ymd && snd.ymd < from && typedLate(snd.at)
  const sendings = paperSendings(sheets).filter((snd) => (snd.ymd ? (!to || snd.ymd <= to) && (!from || snd.ymd >= from || lateSending(snd)) : !edged))
  const lastPayments = sendings.slice().reverse().map((snd) => ({ key: snd.key, day: paperMoneyDay(snd), how: snd.how || 'Not recorded', number: snd.number, amount: snd.amount, ...(lateSending(snd) ? { late: true } : {}) }))
  late.payments = lastPayments.filter((p) => p.late).length
  const paidInPeriod = cents(sendings.reduce((n, snd) => n + snd.amount, 0))
  const stillOpen = cents(rows.reduce((n, r) => n + r.open, 0))
  const closingDay = to ?? ctx.today
  const year = closingDay.slice(0, 4)
  const paidYear = cents(paperSendings(sheets).filter((snd) => snd.ymd.startsWith(year) && snd.ymd <= closingDay && !snd.clientDirect).reduce((n, snd) => n + snd.amount, 0))
  return {
    kind: 'statement_of_account',
    title: 'Statement of account',
    number: opts.number ?? '',
    period: statementPeriodWords({ from, to }, ctx.today),
    preparedOn: paperDay(ctx.today),
    zone: ctx.zone,
    company: ctx.company,
    sub: ctx.sub,
    closingDay: paperDay(closingDay),
    stillOpen,
    rows,
    totals: { comesTo: cents(rows.reduce((n, r) => n + r.comesTo, 0)), paid: cents(rows.reduce((n, r) => n + r.paid, 0)), open: stillOpen },
    lastPayments,
    ...(late.payments + late.backcharges + late.sheets > 0 ? { late } : {}),
    paidInPeriod,
    adds: { opening, newWork, backcharges, payments, closing: cents(opening + newWork - backcharges - payments) },
    credit,
    paidThisYear: paidYear > 0 ? { year, amount: paidYear } : null,
    undated,
    sentences: [...(paidYear > 0 ? [counsel('notATaxForm', ctx.company.name, ctx.sub.name)] : []), counsel('openUnderTerms', ctx.company.name, ctx.sub.name)],
    foot: [opts.number || `Prepared ${ctx.preparedAt} ${ctx.zone}`, `${rows.length} ${rows.length === 1 ? 'statement' : 'statements'}`, `${lastPayments.length} ${lastPayments.length === 1 ? 'payment' : 'payments'}`].join(' · '),
  }
}

/** The words beside a payment a statement carries from before its period. */
export const STATEMENT_LATE_PAYMENT_WORDS = 'recorded after the last statement'

/**
 * What a statement says of the lines it carries from before its period, or '' when it carries none:
 * `1 payment and 1 back-charge dated before this period were recorded after the last statement was made, so they are counted in this one.`
 */
export function statementLateWords(c: Pick<StatementOfAccount, 'late'>): string {
  const l = c.late
  if (!l) return ''
  const parts = [l.payments > 0 ? `${l.payments} ${l.payments === 1 ? 'payment' : 'payments'}` : '', l.backcharges > 0 ? `${l.backcharges} ${l.backcharges === 1 ? 'back-charge' : 'back-charges'}` : '', l.sheets > 0 ? `${l.sheets} ${l.sheets === 1 ? 'work statement' : 'work statements'}` : ''].filter(Boolean)
  if (parts.length === 0) return ''
  const one = l.payments + l.backcharges + l.sheets === 1
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  return `${list} dated before this period ${one ? 'was' : 'were'} recorded after the last statement was made, so ${one ? 'it is' : 'they are'} counted in this one.`
}

/** `Open on Oct 1 $1,800.00 + new work $7,900.00 − back-charges $100.00 − payments $5,500.00 = $4,100.00`. */
export function statementAddsWords(c: StatementOfAccount, range: StatementRange): string {
  const a = c.adds
  const start = range.from ? `Open on ${paperDay(range.from)} ${paperMoney(a.opening)} + new work` : 'Work'
  const tail = c.credit > 0 ? `${paperMoney(a.closing)}: ${paperMoney(c.stillOpen)} still open, less ${paperMoney(c.credit)} held as credit` : paperMoney(a.closing)
  return `${start} ${paperMoney(a.newWork)} − back-charges ${paperMoney(a.backcharges)} − payments ${paperMoney(a.payments)} = ${tail}`
}

// ── The check across the three ───────────────────────────────────────────────────────────────────────────────

export type SubPapersCheck = { ok: boolean; problems: string[] }

const off = (a: number, b: number): boolean => Math.abs(cents(a) - cents(b)) >= 0.005

/** One paper's own arithmetic. */
export function subPaperAddsUp(p: WorkStatement | PaymentRecord | StatementOfAccount): SubPapersCheck {
  const problems: string[] = []
  if (p.kind === 'work_statement') {
    const name = p.number || p.job.label
    if (off(p.agreed - p.backcharges.reduce((n, b) => n + b.amount, 0), p.comesTo)) problems.push(`${name}: agreed less back-charges is not what the statement comes to.`)
    if (off(p.payments.reduce((n, x) => n + x.amount, 0), p.paidSoFar)) problems.push(`${name}: the payments do not sum to Paid so far.`)
    if (off(p.comesTo - p.paidSoFar, p.stillOpen - p.over)) problems.push(`${name}: what it comes to less what was paid is not Still open.`)
    if (!p.reconstructed && off(p.lines.reduce((n, l) => n + l.amount, 0), p.agreed)) problems.push(`${name}: the lines do not sum to Agreed.`)
  } else if (p.kind === 'payment_record') {
    const name = p.number || `the payment of ${p.sentOn}`
    if (off(p.appliedTotal + p.creditKept, p.amountSent)) problems.push(`${name}: the parts do not sum to the amount sent.`)
    for (const a of p.applied) if (off(a.openBefore - a.thisPayment, a.openAfter) && a.openBefore >= a.thisPayment) problems.push(`${name}: open before less this payment is not open after on ${a.sheetName}.`)
    if (off(p.after.reduce((n, a) => n + a.open, 0), p.stillOpenAfter)) problems.push(`${name}: the open statements do not sum to Still open.`)
  } else {
    if (off(p.rows.reduce((n, r) => n + r.open, 0), p.stillOpen)) problems.push('The statement of account: the rows do not sum to Still open.')
    if (off(p.adds.opening + p.adds.newWork - p.adds.backcharges - p.adds.payments, p.adds.closing)) problems.push('The statement of account: How it adds up does not add up.')
    if (off(p.adds.closing, p.stillOpen - p.credit)) problems.push('The statement of account: How it adds up does not end on Still open.')
    if (off(p.lastPayments.reduce((n, x) => n + x.amount, 0), p.paidInPeriod)) problems.push('The statement of account: the payments listed do not sum to Paid in this period.')
    if (off(p.paidInPeriod, p.adds.payments)) problems.push('The statement of account: the payments listed are not the payments in How it adds up.')
  }
  return { ok: problems.length === 0, problems }
}

/**
 * The same figure on every paper. `statement` is one of every date (no period), so its Still open is today's. A set
 * that fails is not drawn: the caller shows the problems instead.
 */
export function subPapersAddUp(set: { statement: StatementOfAccount; work: readonly WorkStatement[]; payments: readonly PaymentRecord[] }): SubPapersCheck {
  const problems: string[] = []
  for (const p of [set.statement, ...set.work, ...set.payments]) problems.push(...subPaperAddsUp(p).problems)
  const openOnA = cents(set.work.reduce((n, w) => n + w.stillOpen, 0))
  if (off(openOnA, set.statement.stillOpen)) problems.push(`The work statements leave ${paperMoney(openOnA)} open and the statement of account says ${paperMoney(set.statement.stillOpen)}.`)
  const workById = new Map(set.work.map((w) => [w.sheetId, w]))
  for (const row of set.statement.rows) {
    const w = workById.get(row.sheetId)
    if (w && off(w.stillOpen, row.open)) problems.push(`${row.sheetName}: the work statement leaves ${paperMoney(w.stillOpen)} open and the statement of account says ${paperMoney(row.open)}.`)
  }
  for (const pr of set.payments) {
    for (const a of pr.applied) {
      const w = workById.get(a.sheetId)
      if (!w) continue
      const line = w.payments.find((x) => !off(x.amount, a.thisPayment) && !off(x.openAfter, a.openAfter))
      if (!line) problems.push(`${pr.number || pr.sentOn}: ${paperMoney(a.thisPayment)} on ${a.sheetName} is not a line on its work statement.`)
    }
  }
  return { ok: problems.length === 0, problems }
}

/** Every label a paper prints that is ours, for the test that holds the names: no invoice, no receipt, no owed. */
export const SUB_PAPER_LABELS: readonly string[] = [
  'Work statement', 'Payment record', 'Statement of account', 'Still open', 'Work done by', 'Job', 'Work', 'Amount', 'Agreed for this work', 'Back-charge', 'This statement comes to',
  'Paid on this statement', 'How', 'Paid so far', 'Still open on this statement', 'Confirmed by the sub', 'Paid to', 'How it was sent', 'Amount sent', 'Applied to', 'Open before', 'This payment', 'Open after',
  'Applied', 'Kept as your credit', 'After this payment', 'Note from the office', 'Received', 'Account of', 'Prepared', 'Brought forward', 'Work in this period', 'Comes to', 'Paid', 'Open', 'Totals', 'Last payments',
  'Paid in this period', 'How it adds up', 'Part payment', 'Paid in full',
]
