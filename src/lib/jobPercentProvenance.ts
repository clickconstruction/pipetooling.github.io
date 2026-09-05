/**
 * "% done" provenance (v2.2852, journey-map Tier-1 #5b): every place that shows a job's
 * percent says where the number came from. Three writers exist — the crew's field report,
 * the office's Edit-Job / Stages %, and the paid-invoices override — and until now the
 * row, the Job Detail header and the report modal each showed a bare number.
 * Pure — no React/supabase.
 */
import type { JobSummaryPercentSource } from './jobSummaryPercentComplete'
import { reportCompletionPercent } from './jobChargesTimeline'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'

export type JobPercentProvenance = {
  source: JobSummaryPercentSource
  /** ISO timestamp of the crew report that produced the % (crew-report only). */
  reportedOn?: string | null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Aug 27" from an ISO timestamp, on the company calendar (America/Chicago). Null when unparseable. */
export function formatProvenanceDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  let ymd: string
  try {
    ymd = calendarYmdInAppTzFromIso(iso)
  } catch {
    return null
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  const month = MONTHS[Number(m[2]) - 1]
  if (!month) return null
  return `${month} ${Number(m[3])}`
}

/**
 * The badge text: "crew report Aug 27" (date when known) · "set by office" · "fully collected".
 * Null when nobody said a % (`none`) — no badge next to "—".
 */
export function percentProvenanceLabel(
  source: JobSummaryPercentSource,
  meta?: { reportedOn?: string | null },
): string | null {
  switch (source) {
    case 'crew-report': {
      const day = formatProvenanceDate(meta?.reportedOn)
      return day ? `crew report ${day}` : 'crew report'
    }
    case 'office':
      return 'set by office'
    case 'paid-invoices':
      return 'fully collected'
    case 'none':
      return null
  }
}

/** Hover text behind the badge — the one-sentence rule for each source. */
export function percentProvenanceTitle(source: JobSummaryPercentSource): string | null {
  switch (source) {
    case 'crew-report':
      return 'From the latest field report that carried a completion % — what the crew last said'
    case 'office':
      return "The job's own % complete, set from Edit Job, the Pipeline board or Job Detail"
    case 'paid-invoices':
      return 'Every invoice is paid and the total covers the contract — reads as 100% regardless of what was reported'
    case 'none':
      return null
  }
}

export type ReportWithPercent = {
  created_at: string
  field_values: Record<string, unknown> | null | undefined
}

/**
 * The newest report that carries a completion % — its % and when it was filed.
 * Reports without a % (walks, notes) are skipped; order of input does not matter.
 */
export function latestReportPercent(
  reports: readonly ReportWithPercent[] | null | undefined,
): { pct: number; createdAt: string } | null {
  if (!reports) return null
  let best: { pct: number; createdAt: string } | null = null
  for (const r of reports) {
    const pct = reportCompletionPercent(r.field_values)
    if (pct == null) continue
    if (!best || r.created_at > best.createdAt) best = { pct, createdAt: r.created_at }
  }
  return best
}

/**
 * Provenance of a job's RECORDED % (`jobs_ledger.pct_complete`) — the number the Job Detail
 * header, the Pipeline "% done" box and the schedule cards show. Field reports mirror their
 * % into that column (v2.1833), so when the newest report with a % says the same number the
 * recorded value came from the crew; any other value was set by the office after (or apart
 * from) the reports. Null pct → `none`.
 */
export function recordedPercentProvenance(
  pctComplete: number | null | undefined,
  reports: readonly ReportWithPercent[] | null | undefined,
): JobPercentProvenance {
  if (pctComplete == null || !Number.isFinite(pctComplete)) return { source: 'none' }
  const latest = latestReportPercent(reports)
  if (latest && latest.pct === Math.round(pctComplete)) {
    return { source: 'crew-report', reportedOn: latest.createdAt }
  }
  return { source: 'office' }
}

// ── Report modal ("Currently 30% — move to update") ──────────────────────────

type PercentFieldLike = { label: string; input_type?: string | null }

/**
 * The report modal's percent slider opens on the job's current % instead of 0 (J2-F1). This
 * fills every untouched `percent_0_100` field with the seed so the slider, the copied text
 * and the saved report all say the same number; a touched field keeps what the tech set.
 * With no seed (bids, projects, jobs with no % yet) the values pass through unchanged and
 * the field falls back to 0 as before.
 */
export function seedUntouchedPercentFields(
  fields: readonly PercentFieldLike[],
  fieldValues: Record<string, string>,
  seedPct: number | null | undefined,
): Record<string, string> {
  if (seedPct == null || !Number.isFinite(seedPct)) return fieldValues
  const seed = String(Math.max(0, Math.min(100, Math.round(seedPct))))
  let out: Record<string, string> | null = null
  for (const f of fields) {
    if ((f.input_type ?? 'long_text') !== 'percent_0_100') continue
    if (fieldValues[f.label] != null) continue
    if (!out) out = { ...fieldValues }
    out[f.label] = seed
  }
  return out ?? fieldValues
}

/**
 * The line under the slider's label. Untouched (or moved back to the seed): tells the tech
 * the number is the job's current % and how to change it. Moved: remembers where it was.
 * Null when there is no seed to speak of.
 */
export function reportPercentSeedHint(
  seedPct: number | null | undefined,
  currentValue: string | undefined,
  provenance?: JobPercentProvenance | null,
): string | null {
  if (seedPct == null || !Number.isFinite(seedPct)) return null
  const seed = Math.round(seedPct)
  const who = provenance ? percentProvenanceLabel(provenance.source, { reportedOn: provenance.reportedOn }) : null
  const suffix = who ? ` · ${who}` : ''
  const n = currentValue == null ? seed : Number.parseInt(currentValue, 10)
  if (Number.isNaN(n) || n === seed) return `Currently ${seed}% — move to update${suffix}`
  return `Was ${seed}%${suffix}`
}
