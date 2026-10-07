import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

/** One job the office gave up on, as the Settings list reads it (punch list #94, v2.4795). */
export type UncollectibleReportRow = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  customer_name: string | null
  revenue: number | null
  payments_made: number | null
  uncollectible_at: string | null
  uncollectible_reason: string | null
}

export type UncollectibleReportLine = { id: string; number: string; job: string; customer: string; ymd: string; open: number; reason: string }
export type UncollectibleReportYear = { year: string; count: number; total: number; lines: UncollectibleReportLine[] }
export type UncollectibleReport = { years: UncollectibleReportYear[]; count: number; total: number }

/** Group the given-up bills by the year the office gave up, newest year first, each year's lines newest first. */
export function buildUncollectibleReport(rows: ReadonlyArray<UncollectibleReportRow>): UncollectibleReport {
  const byYear = new Map<string, UncollectibleReportLine[]>()
  for (const r of rows) {
    const ymd = calendarYmdInAppTzFromIso(r.uncollectible_at ?? '') || ''
    const year = ymd ? ymd.slice(0, 4) : 'undated'
    const line: UncollectibleReportLine = {
      id: r.id,
      number: (r.hcp_number ?? '').trim() || (r.click_number ?? '').trim() || '—',
      job: (r.job_name ?? '').trim() || 'Job',
      customer: (r.customer_name ?? '').trim() || '—',
      ymd,
      open: Math.max(0, Number(r.revenue ?? 0) - Number(r.payments_made ?? 0)),
      reason: (r.uncollectible_reason ?? '').trim(),
    }
    const list = byYear.get(year)
    if (list) list.push(line)
    else byYear.set(year, [line])
  }
  const years = [...byYear.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([year, lines]) => {
      const sorted = [...lines].sort((a, b) => (a.ymd < b.ymd ? 1 : a.ymd > b.ymd ? -1 : 0))
      return { year, count: sorted.length, total: sorted.reduce((s, l) => s + l.open, 0), lines: sorted }
    })
  return { years, count: rows.length, total: years.reduce((s, y) => s + y.total, 0) }
}

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** The CSV the accountant takes: one line per bill, the year first, dollars with cents. */
export function uncollectibleReportCsv(report: UncollectibleReport): string {
  const head = ['year', 'given_up_on', 'job_number', 'job', 'customer', 'open_dollars', 'reason']
  const lines = report.years.flatMap((y) => y.lines.map((l) => [y.year, l.ymd, l.number, l.job, l.customer, l.open.toFixed(2), l.reason].map(csvCell).join(',')))
  return [head.join(','), ...lines].join('\n') + '\n'
}
