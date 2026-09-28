import { checkWasOnWords, formatYmdLong, formatYmdShort, type GcChecksReport } from '../jobs/gcChecksApplied'
import { formatCurrency } from '../jobs/jobFormatting'
import { GC_STATEMENT_COMPANY_NAME } from './gcStatementEmail'

/**
 * "Where the checks went" — the sheet (v2.4050, PR 4 of the train): every
 * payment a GC sent in the period, where each sits now (one line per job and
 * bill), what moved, what came in and is not yet on a bill, and where each
 * job stands. Pure HTML builder in the GC statement print's mold (light,
 * inline styles; the window.open/print glue stays at the call site), plus the
 * same rows as a CSV for the bookkeeper who reconciles in a spreadsheet.
 */

const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
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

  const checkRows = report.checks
    .map((c) => {
      const stamp = [
        c.sentYmd && c.sentYmd !== c.receivedYmd ? `mailed ${formatYmdShort(c.sentYmd)}` : '',
        c.depositedYmd ? `deposited ${formatYmdShort(c.depositedYmd)}` : '',
      ]
        .filter(Boolean)
        .join(' · ')
      const label = c.noNumber ? `<span style="color:#b45309;font-weight:600">${escapeHtml(c.label)}</span>` : escapeHtml(c.label)
      const lines = c.lines
        .map((l) => {
          const tag = l.invoiceId ? (l.jobPaidInFull ? ' <span style="color:#15803d;font-weight:600">job paid in full</span>' : l.billPaidInFull ? ' <span style="color:#15803d;font-weight:600">paid in full</span>' : '') : ''
          return `<div style="display:flex;justify-content:space-between;gap:12px"><span>${escapeHtml(l.jobLabel)} · ${escapeHtml(l.invoiceLabel)}${tag}</span><span style="white-space:nowrap">${money(l.amount)}</span></div>`
        })
        .join('')
      const unapplied = c.unapplied > 0.005 ? `<div style="display:flex;justify-content:space-between;gap:12px"><span style="color:#b45309;font-weight:600">not yet applied — tell us the invoice</span><span style="white-space:nowrap">${money(c.unapplied)}</span></div>` : ''
      const wasOn = c.wasOn.map((m) => escapeHtml(checkWasOnWords(m))).join('<br />')
      return `<tr>
        <td>${label}${stamp ? `<br /><span style="color:#4b5563">${escapeHtml(stamp)}</span>` : ''}</td>
        <td style="text-align:center;white-space:nowrap">${c.receivedYmd ? escapeHtml(formatYmdLong(c.receivedYmd)) : '—'}</td>
        <td style="text-align:right;white-space:nowrap">${money(c.amount)}</td>
        <td><div style="display:grid;gap:3px">${lines}${unapplied}</div></td>
        <td style="font-size:0.75rem;color:#4b5563">${wasOn}</td>
      </tr>`
    })
    .join('')

  const applied = report.summary.received - report.summary.unapplied
  const checksTotal = `<tr style="background:#f9fafb;font-weight:600">
        <td colspan="2" style="text-align:right">Received${report.sinceYmd ? ` since ${escapeHtml(formatYmdShort(report.sinceYmd))}` : ''}:</td>
        <td style="text-align:right;white-space:nowrap">${money(report.summary.received)}</td>
        <td colspan="2">${report.summary.unapplied > 0.005 ? `${money(applied)} applied · ${money(report.summary.unapplied)} not yet applied` : ''}</td>
      </tr>`

  const jobRows = report.jobs
    .map(
      (j) => `<tr>
        <td>${escapeHtml(j.jobLabel)}<br /><span style="color:#4b5563">${plural(j.billCount, 'invoice', 'invoices')}</span></td>
        <td style="text-align:right;white-space:nowrap">${money(j.billed)}</td>
        <td>${escapeHtml(j.paidBy.join(' · ') || '—')}</td>
        <td style="white-space:nowrap">${j.lastApplied ? `${escapeHtml(j.lastApplied.label)}${j.lastApplied.receivedYmd ? ` · ${escapeHtml(formatYmdShort(j.lastApplied.receivedYmd))}` : ''}` : '—'}</td>
        <td style="text-align:right;white-space:nowrap">${j.retainageHeld > 0.005 ? money(j.retainageHeld) : '—'}</td>
        <td style="text-align:right;white-space:nowrap">${j.paid ? '<span style="color:#15803d;font-weight:600">paid</span>' : `<span style="color:#b91c1c;font-weight:600">${money(j.stillOpen)}</span>`}</td>
      </tr>`,
    )
    .join('')

  const openCount = report.jobs.filter((j) => !j.paid && j.stillOpen > 0.005).length
  const jobsTotal = `<tr style="background:#f9fafb;font-weight:600">
        <td colspan="4" style="text-align:right">Open on ${plural(openCount, 'job', 'jobs')} (matches your statement) · retainage held:</td>
        <td style="text-align:right;white-space:nowrap">${report.summary.retainageHeld > 0.005 ? money(report.summary.retainageHeld) : '—'}</td>
        <td style="text-align:right;white-space:nowrap">${money(report.summary.stillOpen)}</td>
      </tr>`

  const earlier = report.earlierCount > 0 ? `<p style="margin:0.5rem 0 0;font-size:0.8125rem;color:#4b5563">${plural(report.earlierCount, 'earlier payment is', 'earlier payments are')} not on this sheet; the job table counts every payment.</p>` : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; color: #1f2937; }
  h1 { font-size: 1.25rem; margin-bottom: 0.15rem; }
  h2 { font-size: 1rem; margin: 1.1rem 0 0.2rem; }
  p.sub { margin: 0 0 0.8rem; font-size: 0.875rem; color: #4b5563; }
  p.note { margin: 0 0 0.35rem; font-size: 0.8125rem; color: #4b5563; }
  .sum { display: flex; flex-wrap: wrap; gap: 6px 22px; font-size: 0.875rem; margin: 0 0 0.5rem; padding: 0.55rem 0.7rem; background: #fafaf7; border: 1px solid #ccc; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.35rem; font-size: 0.8125rem; }
  th, td { border: 1px solid #ccc; padding: 0.4rem 0.5rem; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; }
  section { page-break-inside: avoid; }
  .foot { margin-top: 1rem; padding-top: 0.5rem; border-top: 1px solid #ccc; font-size: 0.8125rem; color: #4b5563; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${title}</h1>
  <p class="sub">${escapeHtml(gcChecksReportSubtitle(report, opts.asOfYmd))}</p>
  <div class="sum">${summary}</div>
  <section>
    <h2>Each payment, and where it sits now</h2>
    <p class="note">Newest first. A check that covered more than one job has a line per job. "Was on" records a move after the check was first recorded.</p>
    <table>
      <thead><tr><th>Payment</th><th style="text-align:center">Received</th><th style="text-align:right">Amount</th><th>Applied now to</th><th>Was on</th></tr></thead>
      <tbody>${checkRows}${checksTotal}</tbody>
    </table>${earlier}
  </section>
  <section>
    <h2>Where each job stands</h2>
    <p class="note">The same payments read by job. "Last applied" is the newest payment sitting on the job today.</p>
    <table>
      <thead><tr><th>Job</th><th style="text-align:right">Billed</th><th>Paid by</th><th>Last applied</th><th style="text-align:right">Retainage held</th><th style="text-align:right">Still open</th></tr></thead>
      <tbody>${jobRows}${jobsTotal}</tbody>
    </table>
  </section>
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
