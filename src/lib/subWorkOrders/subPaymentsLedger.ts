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
 */
import type { LaborJobPayment, LaborJobPaymentEvent } from '../../types/laborJob'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { escapeCsvField } from '../domTableToCsv'

const YMD = /^\d{4}-\d{2}-\d{2}/

/**
 * One payment's day: its Date sent, else the day the row was recorded in the app's timezone (flagged), else null.
 * The Pay row's dates (`sheetPaymentDates.ts`, v2.7172) read a payment the same way; PR 3 folds the two into this one.
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
  /** As stored: above zero for a payment, below for a back-charge. */
  amount: number
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
        amount,
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

export type LedgerFilter = { from?: string | null; to?: string | null; paidToKey?: string | null; search?: string | null }

function haystack(r: LedgerRow): string {
  if (r.kind === 'trace') return r.text.toLowerCase()
  const plain = Math.abs(r.amount).toFixed(2)
  return [r.paidTo, r.job, r.address, r.memo, plain, money(r.amount), r.kind === 'backcharge' ? 'back-charge backcharge' : 'payment', r.crew ? 'crew' : ''].join(' ').toLowerCase()
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
}

export function ledgerTotals(rows: readonly LedgerRow[]): LedgerTotals {
  const t: LedgerTotals = { payments: 0, paidTotal: 0, backcharges: 0, backchargeTotal: 0, people: 0, undated: 0 }
  const people = new Set<string>()
  for (const r of rows) {
    if (r.kind === 'payment') {
      t.payments += 1
      t.paidTotal = cents(t.paidTotal + r.amount)
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

/** Who the lines went to, by name, for the Paid to picker. */
export function ledgerPaidToOptions(lines: readonly LedgerLine[]): Array<{ key: string; label: string; crew: boolean }> {
  const by = new Map<string, { key: string; label: string; crew: boolean }>()
  for (const l of lines) if (l.paidToKey && !by.has(l.paidToKey)) by.set(l.paidToKey, { key: l.paidToKey, label: l.paidTo, crew: l.crew })
  return [...by.values()].sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }))
}

/** `paid in full` · `$1,500.00` · `over by $20.00`: what a sheet owed after a line. */
export function leftOnSheetWords(left: number): string {
  if (left === 0) return 'paid in full'
  return left < 0 ? `over by ${money(left)}` : money(left)
}

/** A cell a spreadsheet will not run: text that opens like a formula is led with an apostrophe. */
const csvCell = (v: string): string => escapeCsvField(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v)
/** A number cell: left as it is so a column of them adds, and a back-charge keeps its minus sign. */
const csvNumber = (n: number): string => n.toFixed(2)

export const SUB_PAYMENTS_CSV_HEAD: ReadonlyArray<string> = ['Date', 'Date is', 'Paid to', 'Crew pay', 'Job', 'Address', 'Type', 'Memo', 'Amount', 'Left on the sheet']

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
        csvCell(l.kind === 'backcharge' ? 'Back-charge' : 'Payment'),
        csvCell(l.memo),
        csvNumber(l.amount),
        csvNumber(l.leftOnSheet),
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
    const what = r.kind === 'backcharge' ? `<b>Back-charge</b>${r.memo ? ` · ${esc(r.memo)}` : ''}` : esc(r.memo)
    return `<tr><td class="when">${esc(ledgerDayWords(r.ymd, true))}${r.recorded ? '<br><span>recorded</span>' : ''}</td><td><b>${esc(r.paidTo)}</b>${r.crew ? ' <span>crew</span>' : ''}</td><td>${esc(r.job)}${r.address ? `<br><span>${esc(r.address)}</span>` : ''}</td><td>${what}</td><td class="amt">${r.amount < 0 ? '−' : ''}${esc(money(r.amount))}</td></tr>`
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
