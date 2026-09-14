/**
 * Where the crew is, per job (Where the Job Is, PR 3 — owner-approved 2026-09-14).
 *
 * Parses the `list_job_crew_position` RPC into what the Pipeline row needs:
 * the last day anyone clocked in and who, whether that is today, the newest
 * sub sheet's stage and crew, the newest report percent and when, and when
 * the office last typed a percent — so the cell can say "Behar's crew on
 * site Fri" and know whether a typed 40% is older than the last clock-in.
 * Pure; dates are company-calendar `YYYY-MM-DD` strings and ISO instants.
 */

export type JobCrewPositionRpcRow = {
  job_ledger_id: string
  last_work_date: string | null
  last_day_people: string[] | null
  sessions_60d: number | null
  people_60d: number | null
  sheet_stage: string | null
  sheet_names: string | null
  sheet_date: string | null
  sheet_progress_pct: number | null
  sheet_stage_changed_at: string | null
  report_pct: number | null
  report_at: string | null
  pct_manual_at: string | null
}

export type SubSheetStage = 'working' | 'walkthrough' | 'customer_pay'

export type JobCrewPosition = {
  jobId: string
  /** Company day of the last clock-in within 60 days; null = nobody clocked in. */
  lastWorkYmd: string | null
  /** Who was clocked in on that day (users.name, sorted). */
  lastDayPeople: string[]
  onSiteToday: boolean
  sessions60d: number
  people60d: number
  /** The newest sub sheet on the job, or null. */
  sheet: { stage: SubSheetStage; names: string[]; ymd: string | null; progressPct: number | null; stageChangedAt: string | null } | null
  /** The newest field report that answered "How complete is the job?". */
  report: { pct: number; at: string } | null
  /** When the office last typed a percent on the job (job_pct_events, manual); null = never since the ledger began. */
  pctManualAt: string | null
}

const isSheetStage = (s: unknown): s is SubSheetStage => s === 'working' || s === 'walkthrough' || s === 'customer_pay'

/** `'Behar | Malachi | Abraham'` → `['Behar', 'Malachi', 'Abraham']`. */
export function splitSheetNames(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** "Behar Kraja" → "Behar"; keeps a lone word; empty → "". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

export function crewPositionFromRpcRow(r: JobCrewPositionRpcRow, todayYmd: string): JobCrewPosition {
  const lastWorkYmd = r.last_work_date ? r.last_work_date.slice(0, 10) : null
  const reportPct = r.report_pct != null && Number.isFinite(Number(r.report_pct)) ? Math.max(0, Math.min(100, Math.round(Number(r.report_pct)))) : null
  return {
    jobId: r.job_ledger_id,
    lastWorkYmd,
    lastDayPeople: (r.last_day_people ?? []).map((s) => s.trim()).filter((s) => s.length > 0),
    onSiteToday: lastWorkYmd != null && lastWorkYmd === todayYmd,
    sessions60d: Math.max(0, Number(r.sessions_60d ?? 0) || 0),
    people60d: Math.max(0, Number(r.people_60d ?? 0) || 0),
    sheet: isSheetStage(r.sheet_stage)
      ? {
          stage: r.sheet_stage,
          names: splitSheetNames(r.sheet_names),
          ymd: r.sheet_date ? r.sheet_date.slice(0, 10) : null,
          progressPct: r.sheet_progress_pct != null ? Math.max(0, Math.min(100, Math.round(Number(r.sheet_progress_pct)))) : null,
          stageChangedAt: r.sheet_stage_changed_at ?? null,
        }
      : null,
    report: reportPct != null && r.report_at ? { pct: reportPct, at: r.report_at } : null,
    pctManualAt: r.pct_manual_at ?? null,
  }
}

export function crewPositionsFromRpc(rows: ReadonlyArray<JobCrewPositionRpcRow> | null | undefined, todayYmd: string): Map<string, JobCrewPosition> {
  const out = new Map<string, JobCrewPosition>()
  for (const r of rows ?? []) {
    if (!r?.job_ledger_id) continue
    out.set(r.job_ledger_id, crewPositionFromRpcRow(r, todayYmd))
  }
  return out
}

/**
 * The crew a row can name: the people clocked in on the last day, else the
 * sub sheet's first name as "<Name>'s crew" (a multi-name sheet) or the lone
 * name. Empty when nobody is on record.
 */
export function crewShortName(p: JobCrewPosition | null | undefined): string {
  if (!p) return ''
  if (p.lastDayPeople.length === 1) return firstName(p.lastDayPeople[0]!)
  if (p.lastDayPeople.length === 2) return p.lastDayPeople.map(firstName).join(' & ')
  if (p.lastDayPeople.length > 2) return `${firstName(p.lastDayPeople[0]!)} +${p.lastDayPeople.length - 1}`
  if (p.sheet && p.sheet.names.length > 0) {
    // A lone sheet name is often a company ("Texas Rooter") — keep it whole.
    if (p.sheet.names.length === 1) return p.sheet.names[0]!
    return `${firstName(p.sheet.names[0]!)}'s crew`
  }
  return ''
}

/**
 * The percent the row shows, with its provenance. **The job's own
 * `pct_complete` is the number** — it is what the % done box shows and what
 * reports propagate into (v2.3192) — dated by the newest hand-set
 * (`pct_manual_at`), or by the report that carries the same number when no
 * hand-set is on record. A report stands on its own only when the job has no
 * percent at all. (v2.3372's "newest wins" governs Job Summary, where reports
 * feed the %; on the Pipeline row the box and the words must agree.)
 */
export function newestPercent(p: JobCrewPosition | null | undefined, typedPct: number | null | undefined): { pct: number; source: 'typed' | 'report'; at: string | null } | null {
  const typed = typedPct != null && Number.isFinite(Number(typedPct)) ? Math.round(Number(typedPct)) : null
  const report = p?.report ?? null
  const manualAt = p?.pctManualAt ?? null
  if (typed != null) {
    if (manualAt) return { pct: typed, source: 'typed', at: manualAt }
    if (report && report.pct === typed) return { pct: typed, source: 'report', at: report.at }
    return { pct: typed, source: 'typed', at: null }
  }
  if (report) return { pct: report.pct, source: 'report', at: report.at }
  return null
}

/** True when the percent on record was set before the last clock-in — the crew has been on site since the number was typed or reported. */
export function percentIsStale(p: JobCrewPosition | null | undefined, typedPct: number | null | undefined): boolean {
  const n = newestPercent(p, typedPct)
  if (!n || !p?.lastWorkYmd) return false
  if (!n.at) return true // a percent with no date on record and a crew on site since: treat as stale
  return n.at.slice(0, 10) < p.lastWorkYmd
}
