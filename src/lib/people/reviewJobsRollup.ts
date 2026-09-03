// Rolls the Review panel's per-day Jobs Worked rows (sub-labor sheets + crew
// days) up to one line per job, with the day rows underneath. Pure: the tab
// maps its two row shapes into `ReviewRollupRowInput` and keeps a rowKey →
// row map for rendering the days with the existing row renderers.

export type ReviewRollupRowInput = {
  /** Stable key the tab uses to find the original row (`labor-<id>` / `crew-<job>-<date>`). */
  rowKey: string
  /** Job identity — ledger id when known, else the raw sheet number. */
  jobKey: string
  /** YYYY-MM-DD or null (undated sheet). */
  date: string | null
  numberLabel: string
  jobName: string
  jobAddress: string
  hours: number
  laborCost: number
  allocatedTotalBill: number
  allocatedRevenueBeforeOverhead: number
  totalLaborOnJob: number
  valueCreated: number
  revenueBeforeOverhead: number
  totalBill: number
  pctComplete: number | null
}

export type ReviewJobGroup = {
  jobKey: string
  numberLabel: string
  jobName: string
  jobAddress: string
  /** Day rows in date order (undated last). */
  rowKeys: string[]
  dayRows: number
  zeroHourRows: number
  hours: number
  laborCost: number
  /** This person's labor ÷ the job's lifetime labor, 0–1; null when the job has no labor on record. */
  share: number | null
  allocatedTotalBill: number
  allocatedRevenueBeforeOverhead: number
  totalLaborOnJob: number
  valueCreated: number
  revenueBeforeOverhead: number
  revPerHour: number | null
  profitPerHour: number | null
  flags: { noBill: boolean; assumedPct: boolean }
}

export type ReviewJobsRollup = {
  jobs: ReviewJobGroup[]
  dayRows: number
  zeroHourRows: number
}

function dateSort(a: ReviewRollupRowInput, b: ReviewRollupRowInput): number {
  if (a.date == null && b.date == null) return a.rowKey.localeCompare(b.rowKey)
  if (a.date == null) return 1
  if (b.date == null) return -1
  return a.date.localeCompare(b.date) || a.rowKey.localeCompare(b.rowKey)
}

export function buildReviewJobsRollup(rows: readonly ReviewRollupRowInput[]): ReviewJobsRollup {
  const byJob = new Map<string, ReviewRollupRowInput[]>()
  for (const r of rows) {
    const list = byJob.get(r.jobKey) ?? []
    list.push(r)
    byJob.set(r.jobKey, list)
  }
  let zeroHourRowsTotal = 0
  const jobs: ReviewJobGroup[] = []
  for (const [jobKey, list] of byJob) {
    list.sort(dateSort)
    // Whole-job figures are identical on every row of the job; take the first.
    const head = list[0]!
    let hours = 0
    let laborCost = 0
    let allocatedTotalBill = 0
    let allocatedRevenueBeforeOverhead = 0
    let zeroHourRows = 0
    for (const r of list) {
      hours += r.hours
      laborCost += r.laborCost
      allocatedTotalBill += r.allocatedTotalBill
      allocatedRevenueBeforeOverhead += r.allocatedRevenueBeforeOverhead
      if (r.hours <= 0) zeroHourRows += 1
    }
    zeroHourRowsTotal += zeroHourRows
    jobs.push({
      jobKey,
      numberLabel: head.numberLabel,
      jobName: head.jobName,
      jobAddress: head.jobAddress,
      rowKeys: list.map((r) => r.rowKey),
      dayRows: list.length,
      zeroHourRows,
      hours,
      laborCost,
      share: head.totalLaborOnJob > 0 ? laborCost / head.totalLaborOnJob : null,
      allocatedTotalBill,
      allocatedRevenueBeforeOverhead,
      totalLaborOnJob: head.totalLaborOnJob,
      valueCreated: head.valueCreated,
      revenueBeforeOverhead: head.revenueBeforeOverhead,
      revPerHour: hours > 0 ? allocatedTotalBill / hours : null,
      profitPerHour: hours > 0 ? allocatedRevenueBeforeOverhead / hours : null,
      flags: { noBill: head.totalBill <= 0, assumedPct: head.pctComplete == null && head.totalBill > 0 },
    })
  }
  jobs.sort(
    (a, b) =>
      b.allocatedRevenueBeforeOverhead - a.allocatedRevenueBeforeOverhead ||
      b.allocatedTotalBill - a.allocatedTotalBill ||
      a.numberLabel.localeCompare(b.numberLabel),
  )
  return { jobs, dayRows: rows.length, zeroHourRows: zeroHourRowsTotal }
}
