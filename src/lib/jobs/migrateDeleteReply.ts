/**
 * The words after migrate_job_ledger_costs_and_delete answers ok — one place for
 * the Edit Job "Reassign to another job…" door and Pipeline → Combine, which read
 * the same payload. `estimate_unlinked` (v2.4139) is set when the source job was
 * made from an estimate and the target already had one of its own: the estimate
 * keeps its record on the Estimates page and drops its job link (one estimate per
 * job, `estimates_job_ledger_id_unique`), instead of the whole move failing.
 */
export type MigrateDeleteOkPayload = {
  ok?: boolean
  note_body?: unknown
  estimate_unlinked?: unknown
}

export const MIGRATE_DELETE_ESTIMATE_UNLINKED_LINE =
  "This job's estimate stays on the Estimates page on its own — the target job already has an estimate of its own."

export function migrateDeleteEstimateUnlinked(payload: MigrateDeleteOkPayload | null | undefined): boolean {
  return payload?.estimate_unlinked === true
}

function withEstimateLine(base: string, payload: MigrateDeleteOkPayload | null | undefined): string {
  return migrateDeleteEstimateUnlinked(payload) ? `${base} ${MIGRATE_DELETE_ESTIMATE_UNLINKED_LINE}` : base
}

/** The Edit Job door's success toast ("this job" — the form being closed). */
export function migrateDeleteSuccessToast(payload: MigrateDeleteOkPayload | null | undefined): string {
  const base =
    typeof payload?.note_body === 'string'
      ? 'Costs and job total moved to the target job; this job was removed. A "Combined" note was posted to the target\'s activity.'
      : 'Costs and job total moved to the target job; this job was removed. Open the target job to verify Specific Work and Job Total.'
  return withEstimateLine(base, payload)
}

/** Pipeline → Combine's success toast ("the source job" — picked from a list). */
export function combineJobsSuccessToast(payload: MigrateDeleteOkPayload | null | undefined): string {
  const base =
    typeof payload?.note_body === 'string'
      ? 'Costs and job total moved to the target job; the source job was removed. A "Combined" note was posted to the job\'s activity.'
      : 'Costs and job total moved to the target job; the source job was removed. Open the target job to verify Specific Work and Job Total.'
  return withEstimateLine(base, payload)
}
