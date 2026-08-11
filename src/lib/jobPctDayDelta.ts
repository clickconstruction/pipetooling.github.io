/**
 * My Schedule % progress (v2.1567): a job's current pct_complete plus how far
 * it moved TODAY (company calendar). The baseline is reconstructed from the
 * job's thread notes — every Stages % commit writes a note whose body starts
 * "N% complete" (stagesPctNote.ts), so the latest such note BEFORE today is
 * the start-of-day value. Known gap, accepted at design time: a pct_complete
 * write that skipped the note flow is invisible here, so those rare jobs show
 * a slightly-off delta.
 */
import { APP_CALENDAR_TZ } from '../utils/dateUtils'

/** "45% complete — note" / "100% complete" → 45 / 100; anything else null. */
export function parsePctCompleteNoteBody(body: string): number | null {
  const m = /^(\d{1,3})% complete(?:\s*—|$)/.exec(body.trim())
  if (!m) return null
  const v = Number(m[1])
  return Number.isFinite(v) && v >= 0 && v <= 100 ? v : null
}

/** Company-calendar YYYY-MM-DD of an ISO instant; null when unparseable. */
export function companyYmdOf(iso: string): string | null {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(t))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const y = get('year')
  const m = get('month')
  const d = get('day')
  return y && m && d ? `${y}-${m}-${d}` : null
}

export type JobPctToday = {
  /** Current jobs_ledger.pct_complete (0–100). */
  pct: number
  /**
   * pct − start-of-day value. Null when no note history exists at all (the
   * baseline is unknowable); 0 when history exists but nothing moved today.
   */
  delta: number | null
}

export type PctNoteRow = { job_id: string; body: string; created_at: string }

export type JobPctSourceRow = {
  pct: number | null
  /** jobs_ledger.status — only 'paid' matters here (Paid in Full). */
  status: string | null
}

/**
 * Per-job current % + today's movement. A job with a null pct still renders:
 * 100 when the job is Paid in Full (status 'paid'), else 0 — with no delta,
 * since the value is synthesized rather than recorded. A job whose FIRST-ever
 * % note landed today baselines at 0 (it had no recorded progress before
 * today).
 */
export function computeJobPctToday(
  jobsById: ReadonlyMap<string, JobPctSourceRow>,
  notes: PctNoteRow[],
  todayYmd: string,
): Map<string, JobPctToday> {
  type Acc = { latestBeforeMs: number; latestBeforeValue: number; hasBefore: boolean; hasToday: boolean }
  const accByJob = new Map<string, Acc>()
  for (const note of notes) {
    const value = parsePctCompleteNoteBody(note.body)
    if (value == null) continue
    const ymd = companyYmdOf(note.created_at)
    if (ymd == null || ymd > todayYmd) continue
    const acc = accByJob.get(note.job_id) ?? {
      latestBeforeMs: Number.NEGATIVE_INFINITY,
      latestBeforeValue: 0,
      hasBefore: false,
      hasToday: false,
    }
    if (ymd === todayYmd) {
      acc.hasToday = true
    } else {
      const ms = Date.parse(note.created_at)
      if (ms >= acc.latestBeforeMs) {
        acc.latestBeforeMs = ms
        acc.latestBeforeValue = value
        acc.hasBefore = true
      }
    }
    accByJob.set(note.job_id, acc)
  }

  const out = new Map<string, JobPctToday>()
  for (const [jobId, { pct, status }] of jobsById) {
    if (pct == null || !Number.isFinite(pct)) {
      out.set(jobId, { pct: status === 'paid' ? 100 : 0, delta: null })
      continue
    }
    const acc = accByJob.get(jobId)
    const baseline = acc?.hasBefore ? acc.latestBeforeValue : acc?.hasToday ? 0 : null
    out.set(jobId, { pct, delta: baseline == null ? null : pct - baseline })
  }
  return out
}
