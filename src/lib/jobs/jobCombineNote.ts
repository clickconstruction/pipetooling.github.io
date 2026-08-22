/**
 * Combine-flow reconciliation kernel (v2.2068). When the Combine/Separate flow
 * or the Delete-job modal runs migrate_job_ledger_costs_and_delete, the source
 * job's notes/reports/status events land on the target and the source is
 * deleted — historically with no visible record, so a tech who had marked the
 * (duplicate) source 100% + Ready to bill saw their work silently "reverted"
 * (Abraham, 2026-08-21; job 877 "Johnny Ingram").
 *
 * Two contracts live here:
 *
 * 1. The combine thread note the RPC now posts on the target:
 *    `Combined "<name>" (Job #<number>) into this job — source was <Status> at <pct>%`
 *    Composed server-side in 20260822010000_combine_job_reconciliation.sql;
 *    composeCombineNoteBody mirrors that SQL byte-for-byte (tests pin it) and
 *    parseCombineNoteBody is the reader. Change the format in both places.
 *
 * 2. combineStatusPreview: the source-vs-target status/pct comparison both
 *    confirm modals show, so the operator explicitly sees when the source is
 *    further along than the surviving target before confirming.
 */

import { labelJobsLedgerStatus, normalizeJobsLedgerStatus } from '../jobsLedgerStatusPipeline'

export const JOB_COMBINE_NOTE_PREFIX = 'Combined "'

export type JobStatusPct = {
  status: string | null
  pctComplete: number | null
}

/** `100` → "100", `87.5` → "87.5" — mirrors the SQL `rtrim(to_char(.., 'FM999999990.##'), '.')`. */
function formatPct(pct: number): string {
  return String(Math.round(pct * 100) / 100)
}

/** "Ready to bill at 100%", "Working", or "—" when the status is unknown. */
export function describeStatusPct(row: JobStatusPct): string {
  const key = normalizeJobsLedgerStatus(row.status)
  const label = key ? labelJobsLedgerStatus(key) : (row.status ?? '').trim()
  if (!label) return '—'
  return row.pctComplete == null ? label : `${label} at ${formatPct(row.pctComplete)}%`
}

export function composeCombineNoteBody(source: {
  jobName: string | null
  number: string | null
  status: string | null
  pctComplete: number | null
}): string {
  const number = (source.number ?? '').trim() || '—'
  let body = `Combined "${source.jobName ?? ''}" (Job #${number}) into this job`
  const key = normalizeJobsLedgerStatus(source.status)
  const label = key ? labelJobsLedgerStatus(key) : (source.status ?? '').trim()
  if (label) {
    body += ` — source was ${label}`
    if (source.pctComplete != null) body += ` at ${formatPct(source.pctComplete)}%`
  }
  return body
}

export type CombineNoteParts = {
  sourceJobName: string
  sourceNumber: string
  /** "Ready to bill at 100%" etc., or null when the note carried no status. */
  sourceWas: string | null
}

/** The parts out of a combine note body, or null when the body is not one. */
export function parseCombineNoteBody(body: string): CombineNoteParts | null {
  const m = /^Combined "(.*)" \(Job #(.+?)\) into this job(?: — source was (.+))?$/.exec(body)
  if (!m) return null
  return { sourceJobName: m[1] ?? '', sourceNumber: m[2] ?? '', sourceWas: m[3] ?? null }
}

export type CombineStatusPreview = {
  /** Always shown: what the surviving job keeps. */
  keeps: string
  /** Amber warning when combining discards source progress marks, else null. */
  warning: string | null
}

/**
 * What the confirm modals show above the destructive button. The surviving job
 * always keeps the TARGET's status/% — the warning fires whenever that
 * discards source marks the survivor won't show: a different pipeline stage
 * (either direction — RTB@100% into a Billed target was the job-877 case), or
 * the same stage at a higher %. Those are exactly the combines where a crew's
 * completion signals vanish without a trace.
 */
export function combineStatusPreview(source: JobStatusPct, target: JobStatusPct): CombineStatusPreview {
  const keeps = `The combined job keeps the target's status and % done — ${describeStatusPct(target)}. The source's status and % done do not carry over.`

  const srcKey = normalizeJobsLedgerStatus(source.status)
  const tgtKey = normalizeJobsLedgerStatus(target.status)
  const sourceMarksLost =
    srcKey != null &&
    tgtKey != null &&
    (srcKey !== tgtKey || (source.pctComplete ?? 0) > (target.pctComplete ?? 0))

  const warning = sourceMarksLost
    ? `The source's progress (${describeStatusPct(source)}) differs from the target's (${describeStatusPct(target)}). The combined job keeps the target's — the source's marks survive only as the "Combined" note in Job activity.`
    : null

  return { keeps, warning }
}
