import { labelJobsLedgerStatus, normalizeJobsLedgerStatus } from './jobsLedgerStatusPipeline'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'

/** One line for Send Job Back modal: last transition into `toStatus` (from job_status_events). */
export function formatMoveIntoStageByOnLine(
  toStatus: string,
  actorName: string | null | undefined,
  changedAtIso: string | null | undefined,
): string | null {
  if (!changedAtIso) return null
  const normalized = normalizeJobsLedgerStatus(toStatus)
  if (!normalized) return null
  const stageLabel = labelJobsLedgerStatus(normalized)
  const name = (typeof actorName === 'string' ? actorName : '').trim() || 'Unknown'
  const d = new Date(changedAtIso)
  if (Number.isNaN(d.getTime())) return null
  const on = d.toLocaleString('en-US', {
    timeZone: APP_CALENDAR_TZ,
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  return `Move into ${stageLabel} by: ${name} on ${on}`
}
