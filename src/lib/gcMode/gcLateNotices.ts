/**
 * GC mode design spike: a trade tells us it will be late, the Gantt's Phase 3 (G-117; mock-up
 * `to-dos/gc-mode/mockups/G-117.md`). From its own chart in its portal, a company sends the day it
 * will finish (or start, for work not started) and why, while the day is still ahead. The office
 * reads it as a move to take or push back on: taking it saves an ordinary move that carries the
 * trade's reason and words; pushing back sends the office's words to the portal, and the company
 * answers that it will make the day or sends another.
 *
 * Where a notice stands is read each time from the schedule, never copied: a standing move that
 * carries it, a newer notice, the bar's dates, the office's answer.
 *
 * Its own file, out of the barrel: the reducer, the portal, Follow up and the walk read it.
 */
import type { LookAheadReason } from './gcTypes'
import { MOVE_NOTE_MIN } from './gcScheduleMoves'
import type { PortalKey } from './gcPortalI18n'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import type { LateDoor } from '../gc/schedule/lateNotices'
import { LATE_REASONS } from '../gc/schedule/lateNotices'
export type { LateDoor, LateNoticeRow, LateNoticeState, LateWaiting, OpenLateNotice } from '../gc/schedule/lateNotices'
export { LATE_REASONS, companyLateNotice, lateAheadWords, lateDayAsked, lateDayChanged, lateDoor, lateKeepLogWords, lateMoveNote, lateNoticeLogWords, lateNoticeMove, lateNoticeMoveWords, lateNoticeReasons, lateNoticeRows, lateNoticeState, lateNoticeTails, lateNoticesToAnswer, latePushBackLogWords, lateSaysWords, lateTarget, lateWaiting, lateWalkFact, nextLateNoticeId, openLateNotices, portalLateNotice } from '../gc/schedule/lateNotices'

/** What stops a notice from going, in the portal's words: the key, and the day it names. Null: it can go. */
export function lateNoticeProblem(door: LateDoor, today: string, day: string, reason: LookAheadReason | null, note: string): { key: PortalKey; day?: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { key: 'latePickDay' }
  if (day <= door.day) return { key: 'lateLaterDay', day: door.day }
  if (day < today) return { key: 'lateFromToday' }
  if (!reason || !LATE_REASONS.includes(reason)) return { key: 'latePickWhy' }
  if (note.trim().length < MOVE_NOTE_MIN) return { key: 'lateNote' }
  return null
}
