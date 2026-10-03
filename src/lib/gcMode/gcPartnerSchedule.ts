/**
 * GC mode — design spike. A trade partner's schedule record across our jobs, for Trade partners
 * (the owner, 2026-10-02: milestone hit rate and look-ahead reliability per company, beside
 * "answers when asked"). It reads the Building lane's measures per project and adds them up by
 * company; it lives in its own file so the bench (gcBench.ts) does not import the schedule.
 */
import type { GcState, Partner } from './gcTypes'
import { MILESTONE_GRACE_DAYS, RELIABILITY_WEEKS, lookAheadReliability, milestoneHitRate, milestoneRows } from './gcBuildingSchedule'

export interface PartnerScheduleRecord {
  /** Milestones of theirs already decided: met within the grace days, out of all decided. */
  milestones: { hit: number; of: number }
  /** Verified look-ahead activities done the week they were planned, over the last weeks. */
  lookAhead: { done: number; of: number }
}

/** Null when no job of ours has a milestone or a verified look-ahead mark of theirs yet. */
export function partnerScheduleRecord(state: GcState, partner: Partner): PartnerScheduleRecord | null {
  const record: PartnerScheduleRecord = { milestones: { hit: 0, of: 0 }, lookAhead: { done: 0, of: 0 } }
  for (const project of state.projects) {
    if (!project.schedule) continue
    // The Building lane names a company by its awarded partner's company name.
    const rate = milestoneHitRate(milestoneRows(state, project).filter((r) => r.company === partner.company))
    record.milestones.hit += rate.hit
    record.milestones.of += rate.of
    const marks = lookAheadReliability(state, project).byCompany.find((c) => c.company === partner.company)
    if (marks) {
      record.lookAhead.done += marks.done
      record.lookAhead.of += marks.of
    }
  }
  return record.milestones.of === 0 && record.lookAhead.of === 0 ? null : record
}

/** The record in words for the bench: "3 of 4 milestones on time · look-ahead 73%". */
export function partnerScheduleWords(record: PartnerScheduleRecord): string {
  const parts: string[] = []
  if (record.milestones.of > 0) parts.push(`${record.milestones.hit} of ${record.milestones.of} ${record.milestones.of === 1 ? 'milestone' : 'milestones'} on time`)
  if (record.lookAhead.of > 0) parts.push(`look-ahead ${Math.round((record.lookAhead.done / record.lookAhead.of) * 100)}%`)
  return parts.join(' · ')
}

/** What the two numbers count, said once, for the hover. */
export const PARTNER_SCHEDULE_WHY = `On time: met within ${MILESTONE_GRACE_DAYS} days of its planned day. Look-ahead: the share of the activities they planned for a week that our superintendent saw done that week, over the last ${RELIABILITY_WEEKS} weeks.`
