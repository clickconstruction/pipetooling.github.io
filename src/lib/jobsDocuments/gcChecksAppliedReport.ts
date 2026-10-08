import { checkWasOnWords, formatYmdLong, formatYmdShort, type GcCheck, type GcCheckJob, type GcChecksReport } from '../jobs/gcChecksApplied'
import { formatCurrency } from '../jobs/jobFormatting'
import { GC_STATEMENT_COMPANY_NAME } from './gcStatementEmail'

/**
 * "Where the checks went" — the sheet (v2.4050, PR 4 of the train; laid out
 * for paper in v2.4091; a PDF since v2.4913): every payment a GC sent in the
 * period, where each sits now (one line per job and bill), what moved, what
 * came in and is not yet on a bill, and where each job stands.
 * `gcChecksSheetModel` is the pure half — every cell, tested;
 * `gcChecksAppliedPdf.ts` draws it. The same rows go out as a CSV for the
 * bookkeeper who reconciles in a spreadsheet.
 *
 * Paper rules (from the first print, RMC 2026-09-28): rows never split
 * across a page but sections may, so page 1 is not a heading over white
 * space; a column with nothing in it is not drawn; the job column gets a
 * third of the width; a check's lines group under the job named once; the
 * job table is Open then Paid in full, each with its subtotal.
 */

const money = (n: number): string => `$${formatCurrency(n)}`
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function gcChecksReportTitle(gcName: string): string {
  return `${gcName} — where your checks were applied`
}

/** "Since Jun 1, 2026 · as of Sep 28, 2026 · Click Plumbing and Electrical" */
export function gcChecksReportSubtitle(report: Pick<GcChecksReport, 'sinceYmd'>, asOfYmd: string): string {
  const parts = [report.sinceYmd ? `Since ${formatYmdLong(report.sinceYmd)}` : 'Every payment on record', `as of ${formatYmdLong(asOfYmd)}`, GC_STATEMENT_COMPANY_NAME]
  return parts.join(' · ')
}

/** The payment column, quiet: "#48211" · "ACH" · "check, no number" — the office's orange chip stays on screen. */
export function sheetPaymentLabel(c: Pick<GcCheck, 'label' | 'noNumber'>): string {
  return c.noNumber ? 'check, no number' : c.label
}

/**
 * "Paid by" as dates, not repeated labels: "#48102 Sep 10 · #48211 Sep 24",
 * "check May 19 · check Jun 4"; four or more read "4 payments, Oct 10 – Mar 10".
 */
export function paidByWords(paidBy: GcCheckJob['paidBy']): string {
  if (paidBy.length === 0) return '—'
  const one = (p: GcCheckJob['paidBy'][number]) => {
    const label = p.noNumber ? 'check' : p.label
    return p.receivedYmd ? `${label} ${formatYmdShort(p.receivedYmd)}` : label
  }
  if (paidBy.length <= 3) return paidBy.map(one).join(' · ')
  const dated = paidBy.filter((p) => p.receivedYmd)
  const first = dated[0]?.receivedYmd
  const last = dated[dated.length - 1]?.receivedYmd
  const span = first && last ? `, ${formatYmdShort(first)} – ${formatYmdShort(last)}` : ''
  return `${paidBy.length} payments${span}`
}

/** "#48211 · Sep 24" / "check · May 19" / "Payment · Mar 29". */
function lastAppliedWords(j: GcCheckJob): string {
  if (!j.lastApplied) return '—'
  const last = j.paidBy[j.paidBy.length - 1]
  const label = last?.noNumber ? 'check' : j.lastApplied.label
  return j.lastApplied.receivedYmd ? `${label} · ${formatYmdShort(j.lastApplied.receivedYmd)}` : label
}

export type SheetTone = 'ink' | 'bold' | 'muted' | 'green' | 'red' | 'amber'
export type SheetRun = { text: string; tone?: SheetTone }
/** One line of a cell: its words, an amount at the cell's right edge, set in under its job, small. */
export type SheetLine = { runs: SheetRun[]; amount?: string; indent?: boolean; small?: boolean; gapBefore?: boolean }
export type SheetCell = { lines: SheetLine[]; align?: 'right'; span?: number }
export type SheetTable = {
  /** Each column's share of the width; they sum to 1. */
  widths: number[]
  head: SheetCell[]
  rows: SheetCell[][]
  /** The subtotal row, shaded. */
  total: SheetCell[]
}
export type GcChecksSheetModel = {
  title: string
  subtitle: string
  /** The summary box: one phrase each, its figures bold. */
  summary: SheetRun[][]
  checks: { heading: string; note: string; table: SheetTable; earlier: string | null }
  jobs: { heading: string; note: string; open: SheetTable | null; paid: SheetTable | null }
  foot: string
}

const cell = (text: string, tone?: SheetTone, align?: 'right'): SheetCell => ({ lines: [{ runs: [{ text, tone }] }], ...(align ? { align } : {}) })
const head = (text: string, align?: 'right'): SheetCell => cell(text, 'bold', align)
const totalCell = (text: string, o: { align?: 'right'; span?: number } = {}): SheetCell => ({ lines: text ? [{ runs: [{ text, tone: 'bold' }] }] : [], ...o })

/** A check's lines grouped under each job, the job named once. */
function appliedLines(c: GcCheck): SheetLine[] {
  const byJob = new Map<string, GcCheck['lines']>()
  for (const l of c.lines) byJob.set(l.jobLabel, [...(byJob.get(l.jobLabel) ?? []), l])
  const out: SheetLine[] = []
  for (const [jobLabel, lines] of byJob) {
    const jobPaid = lines.some((l) => l.jobPaidInFull)
    out.push({ runs: [{ text: jobLabel, tone: 'bold' }, ...(jobPaid ? [{ text: ' job paid in full', tone: 'green' as const }] : [])], ...(out.length > 0 ? { gapBefore: true } : {}) })
    for (const l of lines) {
      const tag = l.invoiceId && !jobPaid && l.billPaidInFull
      out.push({ runs: [{ text: l.invoiceLabel }, ...(tag ? [{ text: ' paid in full', tone: 'green' as const }] : [])], amount: money(l.amount), indent: true })
    }
  }
  if (c.unapplied > 0.005) out.push({ runs: [{ text: 'not yet applied — tell us the invoice', tone: 'amber' }], amount: money(c.unapplied), ...(out.length > 0 ? { gapBefore: true } : {}) })
  return out
}

export function gcChecksSheetModel(gcName: string, report: GcChecksReport, opts: { asOfYmd: string }): GcChecksSheetModel {
  const s = report.summary
  const summary: SheetRun[][] = [
    [{ text: plural(s.payments, 'payment', 'payments'), tone: 'bold' }, { text: ' received · ' }, { text: money(s.received), tone: 'bold' }],
    [{ text: 'applied to ' }, { text: plural(s.appliedLines, 'invoice', 'invoices'), tone: 'bold' }, { text: ' on ' }, { text: plural(s.jobsPaid, 'job', 'jobs'), tone: 'bold' }],
    ...(s.unapplied > 0.005 ? [[{ text: money(s.unapplied), tone: 'bold' as const }, { text: ' received, not yet applied' }]] : []),
    [{ text: money(s.stillOpen), tone: 'bold' }, { text: ' still open' }, ...(s.retainageHeld > 0.005 ? [{ text: ' · of which ' }, { text: money(s.retainageHeld), tone: 'bold' as const }, { text: ' is retainage you hold' }] : [])],
  ]

  const showWasOn = report.checks.some((c) => c.wasOn.length > 0)
  const showRetainage = report.jobs.some((j) => j.retainageHeld > 0.005)

  const checkRows = report.checks.map((c): SheetCell[] => {
    const stamp = [c.sentYmd && c.sentYmd !== c.receivedYmd ? `mailed ${formatYmdShort(c.sentYmd)}` : '', c.depositedYmd ? `deposited ${formatYmdShort(c.depositedYmd)}` : ''].filter(Boolean).join(' · ')
    const payment: SheetCell = { lines: [{ runs: [c.noNumber ? { text: sheetPaymentLabel(c), tone: 'muted' } : { text: c.label, tone: 'bold' }] }, ...(stamp ? [{ runs: [{ text: stamp, tone: 'muted' as const }], small: true }] : [])] }
    const row = [payment, cell(c.receivedYmd ? formatYmdLong(c.receivedYmd) : '—'), cell(money(c.amount), undefined, 'right'), { lines: appliedLines(c) }]
    if (showWasOn) row.push({ lines: c.wasOn.map((m) => ({ runs: [{ text: checkWasOnWords(m), tone: 'muted' as const }], small: true })) })
    return row
  })
  const applied = s.received - s.unapplied
  const checks: SheetTable = {
    widths: showWasOn ? [0.13, 0.14, 0.13, 0.44, 0.16] : [0.15, 0.14, 0.13, 0.58],
    head: [head('Payment'), head('Received'), head('Amount', 'right'), head('Applied now to'), ...(showWasOn ? [head('Was on')] : [])],
    rows: checkRows,
    total: [
      totalCell(`Received${report.sinceYmd ? ` since ${formatYmdShort(report.sinceYmd)}` : ''}:`, { align: 'right', span: 2 }),
      totalCell(money(s.received), { align: 'right' }),
      totalCell(s.unapplied > 0.005 ? `${money(applied)} applied · ${money(s.unapplied)} not yet applied` : '', showWasOn ? { span: 2 } : {}),
    ],
  }

  const jobWidths = showRetainage ? [0.27, 0.12, 0.21, 0.16, 0.11, 0.13] : [0.34, 0.13, 0.21, 0.17, 0.15]
  const jobHead = [head('Job'), head('Billed', 'right'), head('Paid by'), head('Last applied'), ...(showRetainage ? [head('Retainage held', 'right')] : []), head('Still open', 'right')]
  const jobRow = (j: GcCheckJob): SheetCell[] => [
    { lines: [{ runs: [{ text: j.jobLabel }, { text: ` · ${plural(j.billCount, 'invoice', 'invoices')}`, tone: 'muted' }] }] },
    cell(money(j.billed), undefined, 'right'),
    cell(paidByWords(j.paidBy)),
    cell(lastAppliedWords(j)),
    ...(showRetainage ? [cell(j.retainageHeld > 0.005 ? money(j.retainageHeld) : '—', undefined, 'right')] : []),
    j.paid ? cell('paid', 'green', 'right') : cell(money(j.stillOpen), 'red', 'right'),
  ]
  const open = report.jobs.filter((j) => !j.paid)
  const paid = report.jobs.filter((j) => j.paid)
  const openTable: SheetTable | null =
    open.length > 0
      ? {
          widths: jobWidths,
          head: jobHead,
          rows: open.map(jobRow),
          total: [
            totalCell(`Open on ${plural(open.length, 'job', 'jobs')} (matches your statement)${showRetainage ? ' · retainage held' : ''}:`, { align: 'right', span: 4 }),
            ...(showRetainage ? [totalCell(money(s.retainageHeld), { align: 'right' })] : []),
            totalCell(money(s.stillOpen), { align: 'right' }),
          ],
        }
      : null
  const paidTable: SheetTable | null =
    paid.length > 0
      ? {
          widths: jobWidths,
          head: jobHead,
          rows: paid.map(jobRow),
          total: [totalCell(`${plural(paid.length, 'job', 'jobs')} paid in full · billed:`, { align: 'right', span: showRetainage ? 5 : 4 }), totalCell(money(paid.reduce((t, j) => t + j.billed, 0)), { align: 'right' })],
        }
      : null

  return {
    title: gcChecksReportTitle(gcName),
    subtitle: gcChecksReportSubtitle(report, opts.asOfYmd),
    summary,
    checks: {
      heading: 'Each payment, and where it sits now',
      note: `Newest first. A check that covered more than one job lists each job.${showWasOn ? ' "Was on" records a move after the check was first recorded.' : ''}`,
      table: checks,
      earlier: report.earlierCount > 0 ? `${plural(report.earlierCount, 'earlier payment is', 'earlier payments are')} not on this sheet; the job table counts every payment.` : null,
    },
    jobs: { heading: 'Where each job stands', note: 'The same payments read by job. "Last applied" is the newest payment sitting on the job today.', open: openTable, paid: paidTable },
    foot: 'Questions about a check? Reply to your statement email or call the office. Your live statement, with Pay online, is on your portal link.',
  }
}

const csvCell = (v: string | number | null | undefined): string => {
  const s = v == null ? '' : typeof v === 'number' ? v.toFixed(2) : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const GC_CHECKS_CSV_HEADER = [
  'Payment',
  'Type',
  'Number',
  'Received',
  'Sent',
  'Deposited',
  'Payment amount',
  'Job',
  'Invoice',
  'Applied amount',
  'Bill paid in full',
  'Was on',
  'Not yet applied on this deposit',
] as const

/** One row per applied line — the same facts as the sheet, for the bookkeeper's spreadsheet. */
export function buildGcChecksAppliedCsv(report: GcChecksReport): string {
  const rows: string[] = [GC_CHECKS_CSV_HEADER.join(',')]
  for (const c of report.checks) {
    for (const l of c.lines) {
      rows.push(
        [
          c.label,
          c.kind,
          c.number,
          c.receivedYmd ?? '',
          c.sentYmd ?? '',
          c.depositedYmd ?? '',
          c.amount,
          l.jobLabel,
          l.invoiceLabel,
          l.amount,
          l.billPaidInFull ? 'yes' : 'no',
          c.wasOn.map(checkWasOnWords).join('; '),
          c.unapplied > 0.005 ? c.unapplied : '',
        ]
          .map(csvCell)
          .join(','),
      )
    }
  }
  return rows.join('\r\n') + '\r\n'
}

/** A file name a browser accepts: letters, digits and dashes from the GC's name, then the day. */
function gcChecksFileName(gcName: string, asOfYmd: string, ext: 'csv' | 'pdf'): string {
  const part = gcName.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'gc'
  return `checks-applied_${part}_${asOfYmd}.${ext}`
}
export const gcChecksCsvFileName = (gcName: string, asOfYmd: string): string => gcChecksFileName(gcName, asOfYmd, 'csv')
export const gcChecksPdfFileName = (gcName: string, asOfYmd: string): string => gcChecksFileName(gcName, asOfYmd, 'pdf')
