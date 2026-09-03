/**
 * Wednesday GC certification kernel (v2.1980): pure logic for the weekly
 * certify-and-send ritual. A certification is one office person attesting a
 * GC's Billed Awaiting Payment group is accurate for the current week (weeks
 * are Monday-keyed in the company calendar zone; the ritual is due Wednesday).
 * Rows live in `gc_review_certifications` (append-only — latest per week+GC
 * wins); this kernel derives everything the UI shows: each group's state
 * (uncertified / certified / changed-since-certified with a dollar delta, by
 * diffing the live rollup against the certified snapshot), the modal's weekly
 * progress, and the Dashboard nudge state.
 */
import { chicagoYmdOf } from '../gcStatementStandingCopies'
import { mondayOfWeekYmd } from './stagesWeeklyMovement'
import type { GcReviewGroup } from '../gcReviewRollup'

export type GcCertSnapshotRow = { key: string; jobId: string; remaining: number }
export type GcCertSnapshot = { rows: GcCertSnapshotRow[]; total: number; jobCount: number }

export type GcReviewCertRow = {
  gc_customer_id: string
  week_start: string
  certified_by_name: string
  certified_at: string
  job_count: number
  total: number
  snapshot: unknown
  note: string
}

export type GcCertStatus =
  | { state: 'uncertified' }
  | { state: 'certified'; cert: GcReviewCertRow }
  | { state: 'changed'; cert: GcReviewCertRow; delta: number }

/** Monday of the current company-calendar week, YYYY-MM-DD — the cert week key. */
export function gcReviewWeekStartYmd(now = new Date()): string {
  return mondayOfWeekYmd(chicagoYmdOf(now))
}

/** Company-calendar weekday, 0=Sunday … 6=Saturday. */
export function gcReviewWeekdayIndex(now = new Date()): number {
  const ymd = chicagoYmdOf(now)
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()
}

const cents = (n: number) => Math.round(n * 100)

/** What a certification attests: the group's rows keyed stably, plus totals. */
export function buildGcCertSnapshot(group: Pick<GcReviewGroup, 'rows' | 'subtotal' | 'jobCount'>): GcCertSnapshot {
  return {
    rows: group.rows.map((r) => ({ key: r.key, jobId: r.jobId, remaining: r.remaining })),
    total: group.subtotal,
    jobCount: group.jobCount,
  }
}

/** Latest certification per GC (rows may arrive in any order). */
export function latestCertByGc(rows: readonly GcReviewCertRow[]): Map<string, GcReviewCertRow> {
  const out = new Map<string, GcReviewCertRow>()
  for (const r of rows) {
    const prev = out.get(r.gc_customer_id)
    if (!prev || r.certified_at > prev.certified_at) out.set(r.gc_customer_id, r)
  }
  return out
}

function parseSnapshot(v: unknown): GcCertSnapshot | null {
  if (!v || typeof v !== 'object') return null
  const s = v as GcCertSnapshot
  if (!Array.isArray(s.rows) || typeof s.total !== 'number') return null
  return s
}

/**
 * A group is "changed since certified" when its row set or any row's remaining
 * moved after the attestation — new bill, payment, reassignment. The delta is
 * live subtotal minus certified total (what the certifier signed off on).
 */
export function gcGroupCertStatus(
  group: Pick<GcReviewGroup, 'rows' | 'subtotal'>,
  cert: GcReviewCertRow | undefined,
): GcCertStatus {
  if (!cert) return { state: 'uncertified' }
  const snap = parseSnapshot(cert.snapshot)
  if (!snap) {
    // Unreadable snapshot: trust the totals alone.
    return cents(group.subtotal) === cents(cert.total)
      ? { state: 'certified', cert }
      : { state: 'changed', cert, delta: group.subtotal - cert.total }
  }
  const certified = new Map(snap.rows.map((r) => [r.key, cents(r.remaining)]))
  let changed = certified.size !== group.rows.length
  if (!changed) {
    for (const r of group.rows) {
      if (certified.get(r.key) !== cents(r.remaining)) {
        changed = true
        break
      }
    }
  }
  if (!changed) return { state: 'certified', cert }
  return { state: 'changed', cert, delta: group.subtotal - snap.total }
}

/** True when this GC's last statement send falls inside the cert week (company calendar). */
export function gcReviewSentThisWeek(lastSentIso: string | undefined, weekStartYmd: string): boolean {
  if (!lastSentIso) return false
  const sent = new Date(lastSentIso)
  if (Number.isNaN(sent.getTime())) return false
  return chicagoYmdOf(sent) >= weekStartYmd
}

export type GcReviewWeekProgress = { gcs: number; certified: number; sent: number }

/** Progress over the REAL GC groups (the No-GC bucket is exempt from the ritual). */
export function gcReviewWeekProgress(
  groups: readonly Pick<GcReviewGroup, 'gcId' | 'isNoGc' | 'rows' | 'subtotal'>[],
  certsByGc: ReadonlyMap<string, GcReviewCertRow>,
  lastSentByGcId: Record<string, string>,
  weekStartYmd: string,
): GcReviewWeekProgress {
  let gcs = 0
  let certified = 0
  let sent = 0
  for (const g of groups) {
    if (g.isNoGc || !g.gcId) continue
    // A group with nothing outstanding (a billed job that's fully paid but not
    // yet marked paid) has nothing to certify or send — it stays out of the
    // ritual's count, matching the server's gcs_outstanding (v2.2705).
    if (cents(g.subtotal) <= 0) continue
    gcs += 1
    if (gcGroupCertStatus(g, certsByGc.get(g.gcId)).state === 'certified') certified += 1
    if (gcReviewSentThisWeek(lastSentByGcId[g.gcId], weekStartYmd)) sent += 1
  }
  return { gcs, certified, sent }
}

/**
 * GCs the ritual still needs something for — not yet certified AND sent. The
 * Needs-you badge used `outstanding − certified`, which read "0" the moment
 * everything was certified even with zero statements sent (v2.2705). The v2
 * RPC reports `gcs_done` (certified ∩ sent); older payloads fall back to
 * `min(certified, sent)`, the best lower bound on the intersection.
 */
export function gcReviewGcsToDo(status: { gcs_outstanding: number; gcs_certified: number; gcs_sent: number; gcs_done?: number }): number {
  const done = status.gcs_done ?? Math.min(status.gcs_certified, status.gcs_sent)
  return Math.max(0, status.gcs_outstanding - done)
}

export type GcReviewNudgeState = 'hidden' | 'due' | 'done'

/**
 * Dashboard nudge: amber from Wednesday until every outstanding GC is
 * certified AND sent this week; green for the rest of Wednesday once done;
 * hidden Monday/Tuesday and after a completed week.
 */
export function gcReviewNudgeState(
  status: { gcs_outstanding: number; gcs_certified: number; gcs_sent: number },
  now = new Date(),
): GcReviewNudgeState {
  if (status.gcs_outstanding <= 0) return 'hidden'
  const dow = gcReviewWeekdayIndex(now)
  const wednesdayOrLater = dow >= 3 && dow <= 6
  if (!wednesdayOrLater) return 'hidden'
  const done = status.gcs_certified >= status.gcs_outstanding && status.gcs_sent >= status.gcs_outstanding
  if (!done) return 'due'
  return dow === 3 ? 'done' : 'hidden'
}
