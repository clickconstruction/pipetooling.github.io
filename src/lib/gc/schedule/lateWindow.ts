/**
 * GC mode, the real build, the schedule's PR 14c: the office's answers to the trades on the Schedule window (the plan is
 * to-dos/gc-mode/mockups/schedule-pr14.md on branch spike/gc-mode). The window's own rules, apart from the kernels the
 * prototype lifted word for word (`lateNotices.ts`, `schedule.ts`): a late notice someone answered first, our
 * superintendent's check of a trade's mark, and our crew's own mark.
 */
import { lateNoticeState } from './lateNotices'
import type { ScheduleRow } from './schedule'
import type { LookAheadMark, LookAheadReason } from './types'
import type { GcProject } from '../types'

/** `gc_schedule_save_move`'s refusal of a notice a standing move took already. */
const TAKEN_ALREADY = 'That late notice was taken already.'

/** The database refused a move because another move took its late notice first. */
export function noticeTakenRefusal(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : ''
  return message.includes(TAKEN_ALREADY)
}

/** What Why it moved says when the notice it takes was answered first: the card read again and the row went. */
export const NOTICE_ANSWERED_FIRST = 'Someone answered this notice first. It is off the card now, and the chart shows the days it has.'

/**
 * The notice a move takes is no longer open on the schedule as read: taken, replaced by a newer one, overtaken by a
 * move, or pushed back. A notice the schedule does not have counts as gone.
 */
export function lateNoticeGone(project: GcProject, noticeId: string): boolean {
  const notice = project.schedule?.lateNotices?.find((n) => n.id === noticeId)
  return !notice || lateNoticeState(project, notice) !== 'open'
}

/**
 * Our superintendent's check of a trade's mark (owner, 2026-10-02: only a checked mark counts), as the prototype's
 * reducer made it: checked today, and a correction when it differs from the trade's. A "done" corrected to not done
 * carries why.
 */
export function verifiedMark(mark: LookAheadMark, done: boolean, reason: LookAheadReason | null, today: string): LookAheadMark {
  const corrected = done !== mark.done
  return {
    ...mark,
    verifiedOn: today,
    ...(corrected ? { verifiedDone: done } : {}),
    ...(corrected && !done && reason ? { verifiedReason: reason } : {}),
  }
}

/** Our own crew's mark for a week: ours, so it counts as checked the day it is made. Why only when not done. */
export function crewMark(row: ScheduleRow, weekOf: string, done: boolean, reason: LookAheadReason | null, today: string): LookAheadMark {
  return {
    weekOf,
    lineId: row.activity.lineId,
    packageId: row.pkg.id,
    done,
    ...(!done && reason ? { reason } : {}),
    markedOn: today,
    verifiedOn: today,
  }
}
