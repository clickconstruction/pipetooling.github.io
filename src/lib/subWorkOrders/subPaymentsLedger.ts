/**
 * Sub payments as a ledger (punch list #347, PR 2): every payment and back-charge made against a sub sheet as one
 * dated line, newest first, under its month with the month's total.
 *
 * The Pay view is one row per sheet, so reconciling what was paid meant opening sheets one at a time. This reads
 * the same rows the Pay view already holds (each sheet's `payments` and `payment_events`) into lines a person can
 * hold beside a bank statement. Pure: no React, no Supabase. Nothing here stores anything.
 *
 * A line's day is the payment's Date sent; a row with none takes the day it was recorded, flagged (`paymentDay`).
 * A back-charge is a payment row below zero and has no Date sent, so its day is always the recorded one.
 *
 * PR 3 adds the other grouping: one row per person (`ledgerBySub`) and one person's statement with what we owed
 * after each line (`buildSubStatement`). Both read the same sheets. A statement that covers every date ends on
 * what `subLaborJobBalance` says is owed across that person's sheets.
 */
import type { LaborJobPayment, LaborJobPaymentEvent } from '../../types/laborJob'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { escapeCsvField } from '../domTableToCsv'
import { subPayMethodLabel, SUB_PAY_FROM_CREDIT } from './subPaymentWindow'

const YMD = /^\d{4}-\d{2}-\d{2}/

/**
 * One payment's day: its Date sent, else the day the row was recorded in the app's timezone (flagged), else null.
 * The Pay row's dates (`sheetPaymentDates.ts`) read a payment through this too.
 */
export function paymentDay(p: { payment_date?: string | null; created_at?: string | null }): { ymd: string; recorded: boolean } | null {
  const sent = (p.payment_date ?? '').trim()
  if (YMD.test(sent)) return { ymd: sent.slice(0, 10), recorded: false }
  const made = (p.created_at ?? '').trim()
  if (!made) return null
  const ymd = calendarYmdInAppTzFromIso(made)
  return YMD.test(ymd) ? { ymd: ymd.slice(0, 10), recorded: true } : null
}

/** One sheet, already resolved by the Pay view's own rules: whose it is, which job, what was agreed. */
export type LedgerSheet = {
  id: string
  /** The sheet's sub by `sheetParties` (teammates ride along), or the crew's names on a crew sheet. */
  paidTo: string
  paidToKey: string
  /** A crew pay sheet: paid through payroll, never in a sub's balance. */
  crew: boolean
  /** `1048 Tison per plans`: the job's number and name. */
  job: string
  address: string
  /** `subLaborJobBalance(sheet).totalCost`. */
  agreed: number
  /** The day the sheet is dated: its job date, else the day it was made. '' when it has neither. */
  day?: string
  payments: readonly LaborJobPayment[]
  events: readonly LaborJobPaymentEvent[]
}

export type LedgerLine = {
  kind: 'payment' | 'backcharge'
  id: string
  /** `YYYY-MM-DD`, or '' when the row has neither a Date sent nor a recorded time. */
  ymd: string
  /** True when `ymd` is the day the row was recorded, not a Date sent. */
  recorded: boolean
  /** The row's recorded instant, to order two lines of one day. */
  at: string
  sheetId: string
  paidTo: string
  paidToKey: string
  crew: boolean
  job: string
  address: string
  memo: string
  /** How it was sent, as the window's chip reads (`Check`), or '' when none was picked. */
  method: string
  /** The check number, the id or the confirmation typed beside the method. */
  methodRef: string
  /** As stored: above zero for a payment, below for a back-charge. */
  amount: number
  /** v2.7235: paid from the sub's credit. No money left the bank, so it is in no Paid total. */
  fromCredit: boolean
  /** Credit kept with this line: what the same sending carried past what the sheets needed. */
  creditKept: number
  /** The number of the sending this line is part of. Lines that share one were one check or one transfer. */
  sendingNo: number | null
  /** What left the bank with this line: the amount and the credit kept. Zero for a back-charge and for a line paid from credit. */
  sent: number
  /** v2.7237: a line that moved money and so can be ticked against the bank. A back-charge and a line paid from credit cannot. */
  checkable: boolean
  /** When it was ticked, as stored, or '' when it is not checked. */
  checkedAt: string
  checkedBy: string
  /** What the sheet still owed after this line: agreed, less every payment and back-charge up to it. Below zero is over-paid. */
  leftOnSheet: number
}

/** A payment that was moved between sheets or removed, said once (the Pay view says it on each sheet). */
export type LedgerTrace = {
  kind: 'trace'
  id: string
  ymd: string
  at: string
  text: string
  paidToKeys: string[]
}

export type LedgerRow = LedgerLine | LedgerTrace

const money = (n: number): string => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const cents = (n: number): number => Math.round(n * 100) / 100
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** Every payment and back-charge on the sheets given, each with what its sheet owed after it. Unsorted. */
export function buildLedgerLines(sheets: readonly LedgerSheet[]): LedgerLine[] {
  const out: LedgerLine[] = []
  for (const s of sheets) {
    const dated = s.payments
      .map((p) => ({ p, day: paymentDay(p), amount: Number(p.amount) }))
      .filter((x) => Number.isFinite(x.amount) && x.amount !== 0)
      // Oldest first within the sheet, so each line's "left" counts what came before it. A row with no day sorts last.
      .sort((a, b) => (a.day?.ymd ?? '9999').localeCompare(b.day?.ymd ?? '9999') || (a.p.created_at ?? '').localeCompare(b.p.created_at ?? ''))
    let left = s.agreed
    for (const { p, day, amount } of dated) {
      left = cents(left - Math.abs(amount))
      const fromCredit = p.method === SUB_PAY_FROM_CREDIT
      const creditKept = amount > 0 && !fromCredit ? Math.max(0, cents(Number(p.credit_kept) || 0)) : 0
      out.push({
        kind: amount < 0 ? 'backcharge' : 'payment',
        id: p.id,
        ymd: day?.ymd ?? '',
        recorded: day ? day.recorded : false,
        at: p.created_at ?? '',
        sheetId: s.id,
        paidTo: s.paidTo,
        paidToKey: s.paidToKey,
        crew: s.crew,
        job: s.job,
        address: s.address,
        memo: (p.memo ?? '').trim(),
        method: subPayMethodLabel(p.method),
        methodRef: subPayMethodLabel(p.method) ? (p.method_ref ?? '').trim() : '',
        amount,
        fromCredit,
        creditKept,
        sendingNo: p.sending_no ?? null,
        sent: amount > 0 && !fromCredit ? cents(amount + creditKept) : 0,
        checkable: amount > 0 && !fromCredit,
        checkedAt: amount > 0 && !fromCredit ? (p.checked_at ?? '') : '',
        checkedBy: amount > 0 && !fromCredit && p.checked_at ? (p.checked_by_name ?? '').trim() : '',
        leftOnSheet: left,
      })
    }
  }
  return out
}

/** The moves and removals across the sheets, each event once. A removal that was restored is history and draws nothing. */
export function buildLedgerTraces(sheets: readonly LedgerSheet[]): LedgerTrace[] {
  const byId = new Map(sheets.map((s) => [s.id, s]))
  const label = (id: string | null): string => (id ? (byId.get(id)?.job ?? '') : '') || 'another sheet'
  const seen = new Set<string>()
  const out: LedgerTrace[] = []
  for (const s of sheets) {
    for (const e of s.events) {
      if (seen.has(e.id)) continue
      seen.add(e.id)
      const tail = [(e.actor_name ?? '').trim(), (e.reason ?? '').trim() ? `"${(e.reason ?? '').trim()}"` : ''].filter(Boolean).join(' · ')
      let text = ''
      if (e.kind === 'moved') text = `Moved ${money(e.amount)} from ${label(e.from_job_id)} to ${label(e.to_job_id)}`
      else if (e.kind === 'removed' && !e.restored_event_id) text = `Removed ${money(e.amount)} from ${label(e.from_job_id)}`
      if (!text) continue
      const keys = [e.from_job_id, e.to_job_id].map((id) => (id ? byId.get(id)?.paidToKey : undefined)).filter((k): k is string => !!k)
      out.push({ kind: 'trace', id: e.id, ymd: calendarYmdInAppTzFromIso(e.created_at) || '', at: e.created_at, text: [text, tail].filter(Boolean).join(' · '), paidToKeys: [...new Set(keys)] })
    }
  }
  return out
}

export type LedgerPeriodKey = 'month' | 'last-month' | 'quarter' | 'year' | 'all' | 'custom'

export const LEDGER_PERIODS: ReadonlyArray<{ key: Exclude<LedgerPeriodKey, 'custom'>; label: string }> = [
  { key: 'month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'quarter', label: 'This quarter' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All' },
]

const pad = (n: number): string => String(n).padStart(2, '0')

/** The first and last day a period covers, as `YYYY-MM-DD` (null is open). The last day of a month is written `-31`: days compare as text. */
export function ledgerPeriodRange(key: LedgerPeriodKey, todayYmd: string, custom?: { from?: string | null; to?: string | null }): { from: string | null; to: string | null } {
  const y = Number(todayYmd.slice(0, 4))
  const m = Number(todayYmd.slice(5, 7))
  if (key === 'month') return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-31` }
  if (key === 'last-month') {
    const [ly, lm] = m === 1 ? [y - 1, 12] : [y, m - 1]
    return { from: `${ly}-${pad(lm)}-01`, to: `${ly}-${pad(lm)}-31` }
  }
  if (key === 'quarter') {
    const first = Math.floor((m - 1) / 3) * 3 + 1
    return { from: `${y}-${pad(first)}-01`, to: `${y}-${pad(first + 2)}-31` }
  }
  if (key === 'year') return { from: `${y}-01-01`, to: `${y}-12-31` }
  if (key === 'custom') return { from: (custom?.from ?? '').trim() || null, to: (custom?.to ?? '').trim() || null }
  return { from: null, to: null }
}

export type LedgerFilter = {
  from?: string | null
  to?: string | null
  paidToKey?: string | null
  search?: string | null
  /** v2.7237: `unchecked` keeps the lines still to tick against the bank, `checked` the ticked ones. */
  check?: 'unchecked' | 'checked' | null
  /** A method's label as the chip reads (`Check`), or `none` for a payment with no method. */
  method?: string | null
}

/** `none`: the How paid filter's pick for payments nobody gave a method. */
export const LEDGER_NO_METHOD = 'none'

function haystack(r: LedgerRow): string {
  if (r.kind === 'trace') return r.text.toLowerCase()
  const plain = Math.abs(r.amount).toFixed(2)
  return [r.paidTo, r.job, r.address, r.memo, r.method, r.methodRef, r.sendingNo ? `sending ${r.sendingNo} #${r.sendingNo}` : '', r.creditKept ? `credit ${r.sent.toFixed(2)} ${money(r.sent)}` : '', plain, money(r.amount), r.kind === 'backcharge' ? 'back-charge backcharge' : 'payment', r.crew ? 'crew' : ''].join(' ').toLowerCase()
}

/** The rows a period, a person and a search leave. A row with no day shows only when the period is open at both ends. */
export function filterLedger<T extends LedgerRow>(rows: readonly T[], f: LedgerFilter): T[] {
  const words = (f.search ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  return rows.filter((r) => {
    if (f.from || f.to) {
      if (!r.ymd) return false
      if (f.from && r.ymd < f.from) return false
      if (f.to && r.ymd > f.to) return false
    }
    if (f.paidToKey && (r.kind === 'trace' ? !r.paidToKeys.includes(f.paidToKey) : r.paidToKey !== f.paidToKey)) return false
    // The two bank filters are about payments: a trace is neither checked nor sent by a method.
    if (f.check) {
      if (r.kind === 'trace' || !r.checkable) return false
      if (f.check === 'unchecked' ? !!r.checkedAt : !r.checkedAt) return false
    }
    if (f.method) {
      if (r.kind !== 'payment') return false
      if (f.method === LEDGER_NO_METHOD ? !!r.method : r.method !== f.method) return false
    }
    if (words.length > 0) {
      const hay = haystack(r)
      if (!words.every((w) => hay.includes(w))) return false
    }
    return true
  })
}

export type LedgerTotals = {
  payments: number
  paidTotal: number
  backcharges: number
  backchargeTotal: number
  /** How many different people the payments went to. */
  people: number
  /** Payments with no Date sent, shown by the day they were recorded. */
  undated: number
  /** Kept as credit, inside `paidTotal`. */
  creditKept: number
  /** Paid from credit: lines that are in no `paidTotal`. */
  creditUsed: number
  /** v2.7237: payments ticked against the bank, out of `payments`, and what is left to tick. */
  checked: number
  uncheckedTotal: number
}

export function ledgerTotals(rows: readonly LedgerRow[]): LedgerTotals {
  const t: LedgerTotals = { payments: 0, paidTotal: 0, backcharges: 0, backchargeTotal: 0, people: 0, undated: 0, creditKept: 0, creditUsed: 0, checked: 0, uncheckedTotal: 0 }
  const people = new Set<string>()
  for (const r of rows) {
    if (r.kind === 'payment' && r.fromCredit) {
      // No money moved: it is counted apart and never as a payment made.
      t.creditUsed = cents(t.creditUsed + r.amount)
    } else if (r.kind === 'payment') {
      t.payments += 1
      t.paidTotal = cents(t.paidTotal + r.sent)
      t.creditKept = cents(t.creditKept + r.creditKept)
      if (r.checkedAt) t.checked += 1
      else t.uncheckedTotal = cents(t.uncheckedTotal + r.sent)
      people.add(r.paidToKey)
      if (r.recorded || !r.ymd) t.undated += 1
    } else if (r.kind === 'backcharge') {
      t.backcharges += 1
      t.backchargeTotal = cents(t.backchargeTotal + Math.abs(r.amount))
    }
  }
  t.people = people.size
  return t
}

/** `6 of 8 checked` and `2 left · $3,600.00`, or `all checked`: the bank tile's two lines. */
export function ledgerCheckedWords(t: LedgerTotals): { head: string; sub: string } {
  if (t.payments === 0) return { head: '0 of 0', sub: 'nothing to check in this period' }
  const left = t.payments - t.checked
  return { head: `${t.checked} of ${t.payments}`, sub: left === 0 ? 'all checked against the bank' : `${left} left to check · ${money(t.uncheckedTotal)}` }
}

/** The methods the lines carry, as the chips read, for the How paid filter. `none` joins when a payment has no method. */
export function ledgerMethodOptions(lines: readonly LedgerLine[]): Array<{ key: string; label: string }> {
  const seen = new Set<string>()
  let bare = false
  for (const l of lines) {
    if (l.kind !== 'payment') continue
    if (l.method) seen.add(l.method)
    else bare = true
  }
  const out = [...seen].sort((a, b) => a.localeCompare(b)).map((m) => ({ key: m, label: m }))
  if (bare) out.push({ key: LEDGER_NO_METHOD, label: 'No method given' })
  return out
}

/** `8 payments to 5 people`, `1 payment`. */
export function ledgerPaidWords(t: LedgerTotals): string {
  return t.payments === 0 ? 'nothing paid' : t.people > 1 ? `${plural(t.payments, 'payment', 'payments')} to ${t.people} people` : plural(t.payments, 'payment', 'payments')
}

export type LedgerMonth = {
  /** `2026-11`, or '' for rows with no day. */
  ym: string
  /** `November 2026`, or `Undated`. */
  label: string
  totals: LedgerTotals
  /** `5 payments · 1 back-charge`. */
  words: string
  rows: LedgerRow[]
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

/** The rows under their months, newest month first and newest row first. Rows with no day close the list. */
export function ledgerMonths(rows: readonly LedgerRow[]): LedgerMonth[] {
  const sorted = [...rows].sort((a, b) => (b.ymd || '0000').localeCompare(a.ymd || '0000') || b.at.localeCompare(a.at))
  const by = new Map<string, LedgerRow[]>()
  for (const r of sorted) {
    const ym = r.ymd.slice(0, 7)
    const list = by.get(ym)
    if (list) list.push(r)
    else by.set(ym, [r])
  }
  return [...by.entries()].map(([ym, list]) => {
    const totals = ledgerTotals(list)
    const mo = Number(ym.slice(5, 7))
    const words = [totals.payments ? plural(totals.payments, 'payment', 'payments') : '', totals.backcharges ? plural(totals.backcharges, 'back-charge', 'back-charges') : ''].filter(Boolean).join(' · ')
    return { ym, label: ym && mo >= 1 && mo <= 12 ? `${MONTHS[mo - 1]} ${ym.slice(0, 4)}` : 'Undated', totals, words, rows: list }
  })
}

/** Who the lines went to (or whose the sheets are), by name, for the Paid to picker. */
export function ledgerPaidToOptions(lines: ReadonlyArray<Pick<LedgerLine, 'paidToKey' | 'paidTo' | 'crew'>>): Array<{ key: string; label: string; crew: boolean }> {
  const by = new Map<string, { key: string; label: string; crew: boolean }>()
  for (const l of lines) if (l.paidToKey && !by.has(l.paidToKey)) by.set(l.paidToKey, { key: l.paidToKey, label: l.paidTo, crew: l.crew })
  return [...by.values()].sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }))
}

/** `paid in full` · `$1,500.00` · `over by $20.00`: what a sheet owed after a line. */
export function leftOnSheetWords(left: number): string {
  if (left === 0) return 'paid in full'
  return left < 0 ? `over by ${money(left)}` : money(left)
}

/** `Check 1187` · `Zelle` · `From credit` · '': how a line was sent, with its reference. */
export function ledgerHowPaidWords(l: Pick<LedgerLine, 'method' | 'methodRef'>): string {
  return l.method ? [l.method, l.methodRef].filter(Boolean).join(' ') : ''
}

/** `sending 12`: the tag lines of one check or one transfer share. '' for a line with no sending. */
export function sendingTagWords(sendingNo: number | null | undefined): string {
  return sendingNo ? `sending ${sendingNo}` : ''
}

/** A cell a spreadsheet will not run: text that opens like a formula is led with an apostrophe. */
const csvCell = (v: string): string => escapeCsvField(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v)
/** A number cell: left as it is so a column of them adds, and a back-charge keeps its minus sign. */
const csvNumber = (n: number): string => n.toFixed(2)

export const SUB_PAYMENTS_CSV_HEAD: ReadonlyArray<string> = ['Date', 'Date is', 'Paid to', 'Crew pay', 'Job', 'Address', 'Type', 'How paid', 'Reference', 'Memo', 'Amount', 'Left on the sheet', 'Sending', 'Credit kept', 'Checked on', 'Checked by']

/** The lines as a spreadsheet, in the order given. Amounts are plain numbers; a back-charge is below zero. */
export function subPaymentsCsv(lines: readonly LedgerLine[]): string {
  const rows: string[] = [SUB_PAYMENTS_CSV_HEAD.map(csvCell).join(',')]
  for (const l of lines) {
    rows.push(
      [
        csvCell(l.ymd),
        csvCell(!l.ymd ? '' : l.recorded ? 'day recorded' : 'date sent'),
        csvCell(l.paidTo),
        csvCell(l.crew ? 'yes' : 'no'),
        csvCell(l.job),
        csvCell(l.address),
        csvCell(l.kind === 'backcharge' ? 'Back-charge' : l.fromCredit ? 'From credit' : 'Payment'),
        csvCell(l.fromCredit ? '' : l.method),
        csvCell(l.methodRef),
        csvCell(l.memo),
        csvNumber(l.amount),
        csvNumber(l.leftOnSheet),
        l.sendingNo ? String(l.sendingNo) : '',
        l.creditKept ? csvNumber(l.creditKept) : '',
        csvCell(l.checkedAt ? calendarYmdInAppTzFromIso(l.checkedAt) : ''),
        csvCell(l.checkedBy),
      ].join(','),
    )
  }
  return rows.join('\r\n') + '\r\n'
}

/** `sub-payments-2026-11-13.csv`. */
export function subPaymentsCsvFileName(todayYmd: string): string {
  return `sub-payments-${todayYmd}.csv`
}

const esc = (v: string): string => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const MONTH_SHORT = MONTHS.map((m) => m.slice(0, 3))

/** `Nov 12`, with the year only in a print or a list that spans years (`withYear`). */
export function ledgerDayWords(ymd: string, withYear = false): string {
  const mo = Number(ymd.slice(5, 7))
  const d = Number(ymd.slice(8, 10))
  if (!ymd || !(mo >= 1 && mo <= 12) || !d) return 'undated'
  return withYear ? `${MONTH_SHORT[mo - 1]} ${d}, ${ymd.slice(0, 4)}` : `${MONTH_SHORT[mo - 1]} ${d}`
}

/** The list as a page to print: what is shown, under its months, with each month's count and total. */
export function subPaymentsLedgerHtml(months: readonly LedgerMonth[], totals: LedgerTotals, opts: { shownWords: string; printedWords: string }): string {
  const row = (r: LedgerRow): string => {
    if (r.kind === 'trace') return `<tr class="trace"><td class="when">${esc(ledgerDayWords(r.ymd, true))}</td><td colspan="4">${esc(r.text)}</td></tr>`
    const how = ledgerHowPaidWords(r)
    const what = r.kind === 'backcharge' ? `<b>Back-charge</b>${r.memo ? ` · ${esc(r.memo)}` : ''}` : [how ? `<b>${esc(how)}</b>` : '', esc(r.memo)].filter(Boolean).join(' · ')
    const kept = r.creditKept ? `<br><span>+ ${esc(money(r.creditKept))} kept as credit</span>` : ''
    return `<tr><td class="when">${esc(ledgerDayWords(r.ymd, true))}${r.recorded ? '<br><span>recorded</span>' : ''}</td><td><b>${esc(r.paidTo)}</b>${r.crew ? ' <span>crew</span>' : ''}</td><td>${esc(r.job)}${r.address ? `<br><span>${esc(r.address)}</span>` : ''}</td><td>${what}</td><td class="amt">${r.amount < 0 ? '−' : ''}${esc(money(r.amount))}${kept}</td></tr>`
  }
  const block = (m: LedgerMonth): string =>
    `<tr class="month"><td colspan="4"><b>${esc(m.label)}</b> <span>${esc(m.words)}</span></td><td class="amt">${esc(money(m.totals.paidTotal))}</td></tr>${m.rows.map(row).join('')}`
  const sum = [`Paid ${money(totals.paidTotal)} in ${ledgerPaidWords(totals)}`, totals.backcharges ? `back-charged ${money(totals.backchargeTotal)}` : ''].filter(Boolean).join(', ')
  return `<!doctype html><html><head><meta charset="utf-8"><title>Sub payments</title><style>
body{font:12px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;margin:28px}
h1{font-size:18px;margin:0 0 2px}p{margin:3px 0;color:#444}
table{border-collapse:collapse;width:100%;margin-top:10px}td{border-top:1px solid #ccc;padding:5px 8px 5px 0;vertical-align:top}
td.when{white-space:nowrap;width:1%;padding-right:14px;font-weight:600}td.amt{text-align:right;white-space:nowrap;font-weight:600;padding-right:0}
td span{color:#555;font-weight:400}tr.month td{border-top:2px solid #111;padding-top:9px}tr.month span{margin-left:8px}tr.trace td{color:#555}
tr{break-inside:avoid}
</style></head><body>
<h1>Sub payments</h1>
<p>${esc(opts.shownWords)} Newest first. ${esc(sum)}.</p>
${months.length ? `<table>${months.map(block).join('')}</table>` : '<p>Nothing was paid in this period.</p>'}
<p style="margin-top:14px">A date marked recorded is the day the payment was entered, where no Date sent was given. Printed ${esc(opts.printedWords)}.</p>
</body></html>`
}

// ── By sub (PR 3) ────────────────────────────────────────────────────────────────────────────────────────────

/** What a sheet still owes: agreed, less every payment and back-charge. The same sum as `subLaborJobBalance`. */
function sheetOwed(s: LedgerSheet): number {
  let left = s.agreed
  for (const p of s.payments) {
    const amount = Number(p.amount)
    if (Number.isFinite(amount)) left -= Math.abs(amount)
  }
  return cents(left)
}

/** The credit a sheet's payments carry: kept with a payment, less what a from-credit payment used. */
function sheetCredit(s: LedgerSheet): number {
  let credit = 0
  for (const p of s.payments) {
    const amount = Number(p.amount)
    if (!Number.isFinite(amount) || amount <= 0) continue
    if (p.method === SUB_PAY_FROM_CREDIT) credit -= amount
    else credit += Math.max(0, Number(p.credit_kept) || 0)
  }
  return cents(credit)
}

export type LedgerSubRow = {
  key: string
  name: string
  crew: boolean
  /** How many sheets are theirs, paid or not. */
  sheets: number
  /** Payments in the period shown. */
  payments: number
  /** The first and the last day a payment went out in the period. '' when none did. */
  firstYmd: string
  lastYmd: string
  paid: number
  backcharges: number
  backcharged: number
  /**
   * What is still open on their sheets today, whatever the period: the Pay view's *owed* and People → Subs'
   * Balance due. Null on crew pay, which runs through payroll.
   */
  weOwe: number | null
  /** Paid past a sheet's total, summed. It is not taken off `weOwe`: nothing moves it to another sheet today. */
  over: number
  /** v2.7235: the credit they hold today, kept less used, read off their sheets' own payments. */
  credit: number
}

/**
 * One row per person. The period's figures come from the lines shown; *We owe* reads every sheet to today.
 * A person with nothing paid in the period still gets a row while we owe them, so the column foots to the Pay view.
 */
export function ledgerBySub(sheets: readonly LedgerSheet[], shownLines: readonly LedgerLine[], f: { paidToKey?: string | null; search?: string | null } = {}): LedgerSubRow[] {
  const by = new Map<string, LedgerSubRow>()
  for (const s of sheets) {
    if (!s.paidToKey) continue
    let row = by.get(s.paidToKey)
    if (!row) {
      row = { key: s.paidToKey, name: s.paidTo, crew: s.crew, sheets: 0, payments: 0, firstYmd: '', lastYmd: '', paid: 0, backcharges: 0, backcharged: 0, weOwe: s.crew ? null : 0, over: 0, credit: 0 }
      by.set(s.paidToKey, row)
    }
    row.sheets += 1
    const owed = sheetOwed(s)
    if (row.weOwe !== null) {
      if (owed > 0) row.weOwe = cents(row.weOwe + owed)
      else row.over = cents(row.over - owed)
    }
    row.credit = cents(row.credit + sheetCredit(s))
  }
  const touched = new Set<string>()
  for (const l of shownLines) {
    const row = by.get(l.paidToKey)
    if (!row) continue
    touched.add(row.key)
    if (l.kind === 'payment' && l.fromCredit) continue
    if (l.kind === 'payment') {
      row.payments += 1
      row.paid = cents(row.paid + l.sent)
      if (l.ymd) {
        if (!row.firstYmd || l.ymd < row.firstYmd) row.firstYmd = l.ymd
        if (!row.lastYmd || l.ymd > row.lastYmd) row.lastYmd = l.ymd
      }
    } else {
      row.backcharges += 1
      row.backcharged = cents(row.backcharged + Math.abs(l.amount))
    }
  }
  const words = (f.search ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  return [...by.values()]
    .filter((r) => {
      if (f.paidToKey && r.key !== f.paidToKey) return false
      if (touched.has(r.key)) return true
      // Nothing of theirs is in the lines shown: they stay only while we owe them or they hold a credit, and only when a search names them.
      if (!r.weOwe && !r.credit) return false
      const name = r.name.toLowerCase()
      return words.every((w) => name.includes(w))
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
}

export type LedgerBySubTotals = { people: number; payments: number; paid: number; backcharged: number; weOwe: number; over: number; credit: number }

export function ledgerBySubTotals(rows: readonly LedgerSubRow[]): LedgerBySubTotals {
  const t: LedgerBySubTotals = { people: rows.length, payments: 0, paid: 0, backcharged: 0, weOwe: 0, over: 0, credit: 0 }
  for (const r of rows) {
    t.payments += r.payments
    t.paid = cents(t.paid + r.paid)
    t.backcharged = cents(t.backcharged + r.backcharged)
    t.weOwe = cents(t.weOwe + (r.weOwe ?? 0))
    t.over = cents(t.over + r.over)
    t.credit = cents(t.credit + r.credit)
  }
  return t
}

/** `Oct 21` · `Oct 21 to Nov 12` · '': the days a person's payments ran over. */
export function ledgerSpanWords(firstYmd: string, lastYmd: string, withYear = false): string {
  if (!firstYmd) return ''
  return firstYmd === lastYmd ? ledgerDayWords(firstYmd, withYear) : `${ledgerDayWords(firstYmd, withYear)} to ${ledgerDayWords(lastYmd, withYear)}`
}

/** `over by $20.00 on a sheet`: the note under a person's We owe when a sheet of theirs was paid past its total. */
export function overPaidWords(over: number): string {
  return over > 0 ? `over by ${money(over)} on a sheet` : ''
}

/** `$1,200.00` · `settled` · `over by $20.00`: what we owe a person. */
export function weOweWords(n: number): string {
  if (n === 0) return 'settled'
  return n < 0 ? `over by ${money(n)}` : money(n)
}

/**
 * The address a person's statement is opened at: a roster person's own id, else the key as it is.
 * `ledgerSubKeyFromParam` reads it back against the people the ledger knows.
 */
export function ledgerSubParam(key: string): string {
  return key.startsWith('id:') ? key.slice(3) : key
}

export function ledgerSubKeyFromParam(param: string | null | undefined, keys: readonly string[]): string {
  const want = (param ?? '').trim()
  if (!want) return ''
  return keys.find((k) => k === `id:${want}`) ?? keys.find((k) => k === want) ?? ''
}

// ── One person's statement ───────────────────────────────────────────────────────────────────────────────────

export type StatementEntry = {
  /**
   * `sheet` adds what was agreed. A payment, a back-charge and credit kept take away. `credit-used` changes
   * nothing: the sheet owes that much less and so does their credit.
   */
  kind: 'sheet' | 'payment' | 'backcharge' | 'credit-kept' | 'credit-used'
  id: string
  ymd: string
  /** A payment shown by the day it was recorded, having no Date sent. */
  recorded: boolean
  at: string
  sheetId: string
  job: string
  address: string
  memo: string
  method: string
  methodRef: string
  /** Always above zero: what the line adds (a sheet) or takes away (a payment, a back-charge). */
  amount: number
  /** What we owed after this line. Below zero is over-paid. */
  owed: number
}

export type SubStatement = {
  key: string
  name: string
  crew: boolean
  from: string | null
  to: string | null
  /** What we owed before the first day shown. Zero when the statement starts at the beginning. */
  opening: number
  entries: StatementEntry[]
  /** Summed over the lines shown. */
  agreed: number
  paid: number
  payments: number
  backcharged: number
  /** What we owed after the last line shown. */
  closing: number
  /** What we owe today across every sheet: where a statement of every date ends. */
  owedToday: number
  /** The part of `owedToday` still open on sheets, the figure People → Subs calls Balance due. */
  openOnSheets: number
  /** Paid past a sheet's total, summed. `owedToday` is `openOnSheets` less this and less `credit`. */
  overPaid: number
  /** The credit they hold today. */
  credit: number
  /** True when the period is open at its end, so `closing` is today's figure. */
  endsToday: boolean
}

/**
 * One person's sheets and money, oldest first, with what we owed after each line. A sheet is dated no later than
 * its first payment, so a deposit never reads as money paid for nothing. A line with no day closes the list and
 * shows only when the period is open at both ends.
 */
export function buildSubStatement(sheets: readonly LedgerSheet[], key: string, range: { from?: string | null; to?: string | null } = {}): SubStatement {
  const mine = sheets.filter((s) => s.paidToKey === key)
  const from = (range.from ?? '').trim() || null
  const to = (range.to ?? '').trim() || null
  const all: Array<Omit<StatementEntry, 'owed'>> = []
  let openOnSheets = 0
  let overPaid = 0
  let credit = 0
  for (const s of mine) {
    const lines = buildLedgerLines([s])
    const firstPaid = lines.map((l) => l.ymd).filter(Boolean).sort()[0] ?? ''
    const dated = (s.day ?? '').slice(0, 10)
    const day = dated && firstPaid ? (dated < firstPaid ? dated : firstPaid) : dated || firstPaid
    all.push({ kind: 'sheet', id: `sheet:${s.id}`, ymd: day, recorded: false, at: '', sheetId: s.id, job: s.job, address: s.address, memo: '', method: '', methodRef: '', amount: s.agreed })
    for (const l of lines) {
      all.push({ kind: l.fromCredit ? 'credit-used' : l.kind, id: l.id, ymd: l.ymd, recorded: l.recorded, at: l.at, sheetId: l.sheetId, job: l.job, address: l.address, memo: l.memo, method: l.method, methodRef: l.methodRef, amount: Math.abs(l.amount) })
      // The credit kept with a payment is its own line, right under it.
      if (l.creditKept > 0) all.push({ kind: 'credit-kept', id: `kept:${l.id}`, ymd: l.ymd, recorded: l.recorded, at: `${l.at}~`, sheetId: l.sheetId, job: l.job, address: l.address, memo: '', method: l.method, methodRef: l.methodRef, amount: l.creditKept })
    }
    const owed = sheetOwed(s)
    if (owed > 0) openOnSheets = cents(openOnSheets + owed)
    else overPaid = cents(overPaid - owed)
    credit = cents(credit + sheetCredit(s))
  }
  // Oldest first. On one day a sheet comes before the money paid on it. A line with no day sorts last.
  all.sort((a, b) => (a.ymd || '9999').localeCompare(b.ymd || '9999') || (a.kind === 'sheet' ? 0 : 1) - (b.kind === 'sheet' ? 0 : 1) || a.at.localeCompare(b.at))
  const st: SubStatement = {
    key,
    name: mine[0]?.paidTo ?? '',
    crew: mine[0]?.crew ?? false,
    from,
    to,
    opening: 0,
    entries: [],
    agreed: 0,
    paid: 0,
    payments: 0,
    backcharged: 0,
    closing: 0,
    owedToday: cents(openOnSheets - overPaid - credit),
    openOnSheets,
    overPaid,
    credit,
    endsToday: !to,
  }
  let owed = 0
  for (const e of all) {
    const delta = e.kind === 'sheet' ? e.amount : e.kind === 'credit-used' ? 0 : -e.amount
    const before = from && (!e.ymd ? false : e.ymd < from)
    const after = to && (!e.ymd || e.ymd > to)
    const undatedOut = !e.ymd && (from || to)
    if (before) {
      owed = cents(owed + delta)
      st.opening = owed
      continue
    }
    if (after || undatedOut) continue
    owed = cents(owed + delta)
    st.entries.push({ ...e, owed })
    if (e.kind === 'sheet') st.agreed = cents(st.agreed + e.amount)
    else if (e.kind === 'payment') {
      st.paid = cents(st.paid + e.amount)
      st.payments += 1
    } else if (e.kind === 'credit-kept') st.paid = cents(st.paid + e.amount)
    else if (e.kind === 'backcharge') st.backcharged = cents(st.backcharged + e.amount)
  }
  st.closing = owed
  return st
}

/**
 * The foot's check against People → Subs. The roster's Balance due counts what is still open on sheets and
 * leaves out anything paid past a sheet's total, so that is the figure it is held against.
 */
export function statementCheckWords(st: SubStatement, rosterBalanceDue: number | null | undefined): { agrees: boolean | null; words: string } {
  const held = st.credit > 0 ? ` They hold a credit of ${money(st.credit)}.` : st.credit < 0 ? ` Their credit is short by ${money(st.credit)}.` : ''
  const over = (st.overPaid > 0 ? ` ${money(st.openOnSheets)} is still open on sheets and ${money(st.overPaid)} was paid past a sheet's total.` : '') + held
  if (rosterBalanceDue == null || !Number.isFinite(rosterBalanceDue)) return { agrees: null, words: `We owe ${st.name || 'them'} ${weOweWords(st.owedToday)} today.${over}` }
  const agrees = Math.abs(cents(rosterBalanceDue) - st.openOnSheets) < 0.005
  return agrees
    ? { agrees: true, words: `Agrees with People → Subs, where Balance due reads ${money(rosterBalanceDue)}.${over}` }
    : { agrees: false, words: `People → Subs reads ${money(rosterBalanceDue)} for Balance due and these sheets come to ${money(st.openOnSheets)}. A sheet shared with another sub counts for neither there.${over}` }
}

/** What a statement line is called, on the screen, the print and the file. */
export const STATEMENT_WHAT: Record<StatementEntry['kind'], string> = { sheet: 'Sheet agreed', payment: 'Payment', backcharge: 'Back-charge', 'credit-kept': 'Credit kept', 'credit-used': 'Credit used' }

export const SUB_STATEMENT_CSV_HEAD: ReadonlyArray<string> = ['Date', 'Type', 'Job', 'How paid', 'Reference', 'Memo', 'Agreed', 'Paid', 'We owe after']

/** One person's statement as a spreadsheet. Agreed and Paid are separate columns so each adds by itself. */
export function subStatementCsv(st: SubStatement): string {
  const rows: string[] = [SUB_STATEMENT_CSV_HEAD.map(csvCell).join(',')]
  if (st.from) rows.push([csvCell(st.from), csvCell('Brought forward'), '', '', '', '', '', '', csvNumber(st.opening)].join(','))
  for (const e of st.entries) {
    rows.push(
      [
        csvCell(e.ymd),
        csvCell(STATEMENT_WHAT[e.kind]),
        csvCell(e.job),
        csvCell(e.method),
        csvCell(e.methodRef),
        csvCell(e.memo),
        e.kind === 'sheet' ? csvNumber(e.amount) : '',
        e.kind === 'sheet' || e.kind === 'credit-used' ? '' : csvNumber(e.amount),
        csvNumber(e.owed),
      ].join(','),
    )
  }
  return rows.join('\r\n') + '\r\n'
}

/** `sub-statement-calloway-tile-2026-11-13.csv`. */
export function subStatementCsvFileName(name: string, todayYmd: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return `sub-statement-${slug || 'sub'}-${todayYmd}.csv`
}

/** One person's statement as a page to print. The office's own report: nothing here is sent to the sub. */
export function subStatementHtml(st: SubStatement, opts: { periodWords: string; checkWords: string; printedWords: string }): string {
  const cell = (n: number): string => `${n < 0 ? '−' : ''}${esc(money(n))}`
  const row = (e: StatementEntry): string => {
    const what =
      e.kind === 'payment'
        ? [`<b>Payment</b>`, esc(ledgerHowPaidWords(e)), esc(e.memo)].filter(Boolean).join(' · ')
        : e.kind === 'credit-used'
          ? [`<b>Credit used</b>`, esc(money(e.amount)), esc(e.memo)].filter(Boolean).join(' · ')
          : `<b>${STATEMENT_WHAT[e.kind]}</b>${e.memo ? ` · ${esc(e.memo)}` : ''}`
    return `<tr><td class="when">${esc(ledgerDayWords(e.ymd, true))}${e.recorded ? '<br><span>recorded</span>' : ''}</td><td>${what}</td><td>${esc(e.job)}${e.address && !e.job.includes(e.address) ? `<br><span>${esc(e.address)}</span>` : ''}</td><td class="amt">${e.kind === 'sheet' ? cell(e.amount) : ''}</td><td class="amt">${e.kind === 'sheet' || e.kind === 'credit-used' ? '' : cell(e.amount)}</td><td class="amt">${cell(e.owed)}</td></tr>`
  }
  const forward = st.from ? `<tr class="fwd"><td class="when">${esc(ledgerDayWords(st.from, true))}</td><td colspan="4">Brought forward</td><td class="amt">${cell(st.opening)}</td></tr>` : ''
  return `<!doctype html><html><head><meta charset="utf-8"><title>Statement · ${esc(st.name)}</title><style>
body{font:12px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;margin:28px}
h1{font-size:18px;margin:0 0 2px}p{margin:3px 0;color:#444}
table{border-collapse:collapse;width:100%;margin-top:10px}th{text-align:left;font-size:11px;border-bottom:2px solid #111;padding:4px 8px 4px 0}th.amt{text-align:right;padding-right:0}
td{border-top:1px solid #ccc;padding:5px 8px 5px 0;vertical-align:top}
td.when{white-space:nowrap;width:1%;padding-right:14px;font-weight:600}td.amt{text-align:right;white-space:nowrap;padding-right:0}
td span{color:#555;font-weight:400}tr.fwd td{color:#555}tr.foot td{border-top:2px solid #111;font-weight:700}
tr{break-inside:avoid}
</style></head><body>
<h1>${esc(st.name)}</h1>
<p>Statement of sub sheets and payments. ${esc(opts.periodWords)} Oldest first.</p>
${
  st.entries.length || st.from
    ? `<table><thead><tr><th>Date</th><th>What</th><th>Job</th><th class="amt">Agreed</th><th class="amt">Paid</th><th class="amt">We owe</th></tr></thead><tbody>${forward}${st.entries.map(row).join('')}<tr class="foot"><td colspan="3">${st.endsToday ? 'We owe today' : 'We owed at the end'}</td><td class="amt">${cell(st.agreed)}</td><td class="amt">${cell(cents(st.paid + st.backcharged))}</td><td class="amt">${cell(st.closing)}</td></tr></tbody></table>`
    : '<p>Nothing was agreed or paid in this period.</p>'
}
<p style="margin-top:14px">${esc(opts.checkWords)}</p>
<p>A date marked recorded is the day the payment was entered, where no Date sent was given. Printed ${esc(opts.printedWords)}.</p>
</body></html>`
}
