import { checkWasOnWords, formatYmdLong, formatYmdShort, type GcCheck, type GcCheckJob, type GcChecksReport } from '../jobs/gcChecksApplied'
import { formatCurrency } from '../jobs/jobFormatting'
import { GC_STATEMENT_COMPANY_NAME } from './gcStatementEmail'

/**
 * "Where the checks went" — the sheet (v2.4050, PR 4 of the train; laid out
 * for paper in v2.4091): every payment a GC sent in the period, where each
 * sits now (one line per job and bill), what moved, what came in and is not
 * yet on a bill, and where each job stands. Pure HTML builder in the GC
 * statement print's mold (light, inline styles; the window.open/print glue
 * stays at the call site), plus the same rows as a CSV for the bookkeeper
 * who reconciles in a spreadsheet.
 *
 * Paper rules (from the first print, RMC 2026-09-28): rows never split
 * across a page but sections may, so page 1 is not a heading over white
 * space; a column with nothing in it is not drawn; the job column gets a
 * third of the width; a check's lines group under the job named once; the
 * job table is Open then Paid in full, each with its subtotal.
 */

const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const money = (n: number): string => `$${formatCurrency(n)}`
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const GREEN = 'color:#15803d;font-weight:600'
const RED = 'color:#b91c1c;font-weight:600'
const MUTED = 'color:#4b5563'

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

/** A check's lines grouped under each job, the job named once. */
function appliedLinesHtml(c: GcCheck): string {
  const byJob = new Map<string, GcCheck['lines']>()
  for (const l of c.lines) byJob.set(l.jobLabel, [...(byJob.get(l.jobLabel) ?? []), l])
  const groups = [...byJob.entries()].map(([jobLabel, lines]) => {
    const jobPaid = lines.some((l) => l.jobPaidInFull)
    const rows = lines
      .map((l) => {
        const tag = l.invoiceId && !jobPaid && l.billPaidInFull ? ` <span style="${GREEN}">paid in full</span>` : ''
        return `<div style="display:flex;justify-content:space-between;gap:12px;padding-left:0.9rem"><span>${escapeHtml(l.invoiceLabel)}${tag}</span><span style="white-space:nowrap">${money(l.amount)}</span></div>`
      })
      .join('')
    const head = `<div style="font-weight:600">${escapeHtml(jobLabel)}${jobPaid ? ` <span style="${GREEN}">job paid in full</span>` : ''}</div>`
    return `<div>${head}${rows}</div>`
  })
  const unapplied = c.unapplied > 0.005 ? `<div style="display:flex;justify-content:space-between;gap:12px"><span style="color:#b45309;font-weight:600">not yet applied — tell us the invoice</span><span style="white-space:nowrap">${money(c.unapplied)}</span></div>` : ''
  return `<div style="display:grid;gap:5px">${groups.join('')}${unapplied}</div>`
}

export function buildGcChecksAppliedReportHtml(gcName: string, report: GcChecksReport, opts: { asOfYmd: string }): string {
  const title = escapeHtml(gcChecksReportTitle(gcName))
  const s = report.summary
  const summary = [
    `<b>${plural(s.payments, 'payment', 'payments')}</b> received · <b>${money(s.received)}</b>`,
    `applied to <b>${plural(s.appliedLines, 'invoice', 'invoices')}</b> on <b>${plural(s.jobsPaid, 'job', 'jobs')}</b>`,
    ...(s.unapplied > 0.005 ? [`<b>${money(s.unapplied)}</b> received, not yet applied`] : []),
    `<b>${money(s.stillOpen)}</b> still open${s.retainageHeld > 0.005 ? ` · of which <b>${money(s.retainageHeld)}</b> is retainage you hold` : ''}`,
  ]
    .map((x) => `<span>${x}</span>`)
    .join('')

  const showWasOn = report.checks.some((c) => c.wasOn.length > 0)
  const showRetainage = report.jobs.some((j) => j.retainageHeld > 0.005)

  const checkRows = report.checks
    .map((c) => {
      const stamp = [
        c.sentYmd && c.sentYmd !== c.receivedYmd ? `mailed ${formatYmdShort(c.sentYmd)}` : '',
        c.depositedYmd ? `deposited ${formatYmdShort(c.depositedYmd)}` : '',
      ]
        .filter(Boolean)
        .join(' · ')
      const label = c.noNumber ? `<span style="${MUTED}">${escapeHtml(sheetPaymentLabel(c))}</span>` : `<b>${escapeHtml(c.label)}</b>`
      const wasOn = showWasOn ? `<td style="font-size:0.75rem;${MUTED}">${c.wasOn.map((m) => escapeHtml(checkWasOnWords(m))).join('<br />')}</td>` : ''
      return `<tr>
        <td>${label}${stamp ? `<br /><span style="font-size:0.75rem;${MUTED}">${escapeHtml(stamp)}</span>` : ''}</td>
        <td style="white-space:nowrap">${c.receivedYmd ? escapeHtml(formatYmdLong(c.receivedYmd)) : '—'}</td>
        <td style="text-align:right;white-space:nowrap">${money(c.amount)}</td>
        <td>${appliedLinesHtml(c)}</td>${wasOn}
      </tr>`
    })
    .join('')

  const applied = report.summary.received - report.summary.unapplied
  const checksTotal = `<tr class="total">
        <td colspan="2" style="text-align:right">Received${report.sinceYmd ? ` since ${escapeHtml(formatYmdShort(report.sinceYmd))}` : ''}:</td>
        <td style="text-align:right;white-space:nowrap">${money(report.summary.received)}</td>
        <td${showWasOn ? ' colspan="2"' : ''}>${report.summary.unapplied > 0.005 ? `${money(applied)} applied · ${money(report.summary.unapplied)} not yet applied` : ''}</td>
      </tr>`
  const checksCols = `<colgroup><col style="width:${showWasOn ? '13%' : '15%'}" /><col style="width:14%" /><col style="width:13%" /><col />${showWasOn ? '<col style="width:16%" />' : ''}</colgroup>`
  const checksHead = `<thead><tr><th>Payment</th><th>Received</th><th style="text-align:right">Amount</th><th>Applied now to</th>${showWasOn ? '<th>Was on</th>' : ''}</tr></thead>`

  const open = report.jobs.filter((j) => !j.paid)
  const paid = report.jobs.filter((j) => j.paid)
  const jobCols = `<colgroup><col style="width:${showRetainage ? '26%' : '33%'}" /><col style="width:12%" /><col style="width:20%" /><col style="width:16%" />${showRetainage ? '<col style="width:10%" />' : ''}<col style="width:12%" /></colgroup>`
  const jobHead = `<thead><tr><th>Job</th><th style="text-align:right">Billed</th><th>Paid by</th><th>Last applied</th>${showRetainage ? '<th style="text-align:right">Retainage held</th>' : ''}<th style="text-align:right">Still open</th></tr></thead>`
  const jobRow = (j: GcCheckJob) => `<tr>
        <td>${escapeHtml(j.jobLabel)} <span style="font-size:0.75rem;${MUTED};white-space:nowrap">· ${plural(j.billCount, 'invoice', 'invoices')}</span></td>
        <td style="text-align:right;white-space:nowrap">${money(j.billed)}</td>
        <td>${escapeHtml(paidByWords(j.paidBy))}</td>
        <td style="white-space:nowrap">${escapeHtml(lastAppliedWords(j))}</td>${showRetainage ? `<td style="text-align:right;white-space:nowrap">${j.retainageHeld > 0.005 ? money(j.retainageHeld) : '—'}</td>` : ''}
        <td style="text-align:right;white-space:nowrap">${j.paid ? `<span style="${GREEN}">paid</span>` : `<span style="${RED}">${money(j.stillOpen)}</span>`}</td>
      </tr>`
  const colsBeforeMoney = showRetainage ? 4 : 4
  const openTotal = `<tr class="total">
        <td colspan="${colsBeforeMoney}" style="text-align:right">Open on ${plural(open.length, 'job', 'jobs')} (matches your statement)${showRetainage ? ' · retainage held' : ''}:</td>${showRetainage ? `<td style="text-align:right;white-space:nowrap">${money(report.summary.retainageHeld)}</td>` : ''}
        <td style="text-align:right;white-space:nowrap">${money(report.summary.stillOpen)}</td>
      </tr>`
  const paidTotal = `<tr class="total">
        <td colspan="${colsBeforeMoney + (showRetainage ? 1 : 0)}" style="text-align:right">${plural(paid.length, 'job', 'jobs')} paid in full · billed:</td>
        <td style="text-align:right;white-space:nowrap">${money(paid.reduce((t, j) => t + j.billed, 0))}</td>
      </tr>`

  const earlier = report.earlierCount > 0 ? `<p class="note">${plural(report.earlierCount, 'earlier payment is', 'earlier payments are')} not on this sheet; the job table counts every payment.</p>` : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 0.75in; color: #1f2937; }
  h1 { font-size: 1.25rem; margin: 0 0 0.15rem; }
  h2 { font-size: 1rem; margin: 1.1rem 0 0.2rem; }
  h3 { font-size: 0.875rem; margin: 0.8rem 0 0.1rem; color: #4b5563; }
  p.sub { margin: 0 0 0.8rem; font-size: 0.875rem; color: #4b5563; }
  p.note { margin: 0.2rem 0 0.35rem; font-size: 0.8125rem; color: #4b5563; }
  .sum { display: flex; flex-wrap: wrap; gap: 6px 22px; font-size: 0.875rem; margin: 0 0 0.5rem; padding: 0.55rem 0.7rem; background: #fafaf7; border: 1px solid #ccc; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.35rem; font-size: 0.8125rem; table-layout: fixed; }
  th, td { border: 1px solid #ccc; padding: 0.35rem 0.45rem; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
  th { background: #f5f5f5; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  tr.total td { background: #f9fafb; font-weight: 600; }
  h2, h3 { page-break-after: avoid; break-after: avoid; }
  .foot { margin-top: 1rem; padding-top: 0.5rem; border-top: 1px solid #ccc; font-size: 0.8125rem; color: #4b5563; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${title}</h1>
  <p class="sub">${escapeHtml(gcChecksReportSubtitle(report, opts.asOfYmd))}</p>
  <div class="sum">${summary}</div>
  <h2>Each payment, and where it sits now</h2>
  <p class="note">Newest first. A check that covered more than one job lists each job.${showWasOn ? ' "Was on" records a move after the check was first recorded.' : ''}</p>
  <table>${checksCols}${checksHead}<tbody>${checkRows}${checksTotal}</tbody></table>${earlier}
  <h2>Where each job stands</h2>
  <p class="note">The same payments read by job. "Last applied" is the newest payment sitting on the job today.</p>
  ${open.length > 0 ? `<h3>Open</h3><table>${jobCols}${jobHead}<tbody>${open.map(jobRow).join('')}${openTotal}</tbody></table>` : ''}
  ${paid.length > 0 ? `<h3>Paid in full</h3><table>${jobCols}${jobHead}<tbody>${paid.map(jobRow).join('')}${paidTotal}</tbody></table>` : ''}
  <p class="foot">Questions about a check? Reply to your statement email or call the office. Your live statement, with Pay online, is on your portal link.</p>
</body></html>`
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
export function gcChecksCsvFileName(gcName: string, asOfYmd: string): string {
  const part = gcName.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'gc'
  return `checks-applied_${part}_${asOfYmd}.csv`
}
