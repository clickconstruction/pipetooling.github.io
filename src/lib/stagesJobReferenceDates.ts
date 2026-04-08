/** Stages `j:` (field) / `b:` (billing reference: manual last bill date + invoice/payment activity) — pure date helpers for Jobs.tsx. */

export type StagesBillingJobSlice = {
  last_bill_date?: string | null
  invoices: Array<{
    sent_to_customer_at: string | null
    billed_at: string | null
  }>
  payments: Array<{ paid_on: string | null }>
}

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function trimYmd(s: string | null | undefined): string | null {
  const t = s?.trim()
  if (!t) return null
  if (YMD_RE.test(t)) return t
  if (t.length >= 10 && YMD_RE.test(t.slice(0, 10))) return t.slice(0, 10)
  return null
}

/**
 * Normalize DB timestamps or YYYY-MM-DD to local calendar YMD (matches {@link formatEstimatedCompletionDisplay} style parsing).
 */
export function timestampOrDateToYmd(value: string | null | undefined): string | null {
  const ymd = trimYmd(value ?? null)
  if (ymd) return ymd
  const raw = value?.trim()
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Max of YYYY-MM-DD strings (calendar order). */
export function maxYmd(dates: Array<string | null | undefined>): string | null {
  const xs = dates.filter((d): d is string => typeof d === 'string' && YMD_RE.test(d))
  if (xs.length === 0) return null
  return xs.reduce((a, b) => (a >= b ? a : b))
}

export function deriveStagesFieldReferenceYmd(args: {
  lastWorkDate: string | null | undefined
  lastScheduleWorkDate: string | null | undefined
}): string | null {
  const w = trimYmd(args.lastWorkDate ?? null)
  const s = trimYmd(args.lastScheduleWorkDate ?? null)
  return maxYmd([w, s])
}

export type BillingActivityDetail = { ymd: string; tooltip: string }

type BillingCand = { ymd: string; label: string }

function collectBillingCandidates(
  job: StagesBillingJobSlice,
  includeManualPlan: boolean,
): BillingCand[] {
  const cands: BillingCand[] = []
  if (includeManualPlan) {
    const planYmd = trimYmd(job.last_bill_date ?? null)
    if (planYmd) cands.push({ ymd: planYmd, label: 'Last manual bill date' })
  }
  for (const inv of job.invoices ?? []) {
    const y1 = timestampOrDateToYmd(inv.sent_to_customer_at)
    if (y1) cands.push({ ymd: y1, label: 'Invoice sent' })
    const y2 = timestampOrDateToYmd(inv.billed_at)
    if (y2) cands.push({ ymd: y2, label: 'Invoice billed' })
  }
  for (const p of job.payments ?? []) {
    const y = timestampOrDateToYmd(p.paid_on)
    if (y) cands.push({ ymd: y, label: 'Payment recorded' })
  }
  return cands
}

function bestDetailFromCandidates(cands: BillingCand[]): BillingActivityDetail | null {
  if (cands.length === 0) return null
  let best = cands[0]!
  for (let i = 1; i < cands.length; i++) {
    const c = cands[i]!
    if (c.ymd > best.ymd) best = c
  }
  const tied = cands.filter((c) => c.ymd === best.ymd)
  const labels = [...new Set(tied.map((t) => t.label))]
  return {
    ymd: best.ymd,
    tooltip: `Latest: ${labels.join(' · ')} (${best.ymd})`,
  }
}

/** Invoice / payment activity only — excludes job-level manual `last_bill_date` (Job Detail middle row; Stages `b:` uses {@link deriveStagesBillingActivityDetail}). */
export function deriveRecordedBillingActivityDetail(
  job: Pick<StagesBillingJobSlice, 'invoices' | 'payments'>,
): BillingActivityDetail | null {
  return bestDetailFromCandidates(
    collectBillingCandidates(
      { last_bill_date: null, invoices: job.invoices, payments: job.payments },
      false,
    ),
  )
}

export function deriveStagesBillingActivityDetail(job: StagesBillingJobSlice): BillingActivityDetail | null {
  return bestDetailFromCandidates(collectBillingCandidates(job, true))
}

export function deriveStagesBillingActivityYmd(job: StagesBillingJobSlice): string | null {
  return deriveStagesBillingActivityDetail(job)?.ymd ?? null
}

export function deriveStagesFieldTooltip(args: {
  lastWorkDate: string | null | undefined
  lastScheduleWorkDate: string | null | undefined
  resolvedYmd: string | null
}): string | null {
  const { resolvedYmd } = args
  if (!resolvedYmd) return null
  const w = trimYmd(args.lastWorkDate ?? null)
  const s = trimYmd(args.lastScheduleWorkDate ?? null)
  if (w && s && w !== s) {
    return `Sessions: ${w}; schedule: ${s}. Line shows the later date (${resolvedYmd}).`
  }
  if (w && !s) return `From approved clock sessions (${w}).`
  if (!w && s) return `From job schedule (${s}). No approved session work date yet.`
  if (w && s && w === s) return `Sessions and schedule agree (${w}).`
  return null
}

/** Merge max schedule work_date per job_id from block rows. */
export function mergeMaxScheduleWorkDateByJobId(
  rows: Array<{ job_id: string; work_date: string }>,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const r of rows) {
    const wd = trimYmd(r.work_date)
    if (!wd) continue
    const prev = map.get(r.job_id)
    if (prev == null || wd > prev) map.set(r.job_id, wd)
  }
  return map
}
