/**
 * A decision entered by the office on a reviewer's behalf (Submittals stage 5b): the
 * architect marked up the PDF or answered by email, and the estimator types the call onto
 * the row. The record names both — the reviewer it came from and the person who typed it —
 * and the room's thread gets a quiet system line that never carries a staff name.
 */
import type { ReviewDecision } from './submittalRevision'

export type EnteredPerson = { id: string; name: string; email: string | null }

export type EnteredDecisionInput = {
  decision: ReviewDecision
  note: string | null
  person: EnteredPerson
  byUserId: string | null
  byName: string | null
  now: string
  source?: 'entered' | 'robot'
}

export type EnteredDecisionPatch = {
  review_decision: ReviewDecision
  review_note: string | null
  reviewed_by_person_id: string
  reviewed_by_name: string
  reviewed_by_email: string | null
  reviewed_at: string
  decision_source: 'entered' | 'robot'
  decision_entered_by: string | null
  decision_entered_by_name: string | null
}

/** The `bid_submittal_items` patch for one row. */
export function enteredDecisionPatch(i: EnteredDecisionInput): EnteredDecisionPatch {
  return {
    review_decision: i.decision,
    review_note: i.note?.trim() || null,
    reviewed_by_person_id: i.person.id,
    reviewed_by_name: i.person.name.trim(),
    reviewed_by_email: i.person.email?.trim().toLowerCase() || null,
    reviewed_at: i.now,
    decision_source: i.source ?? 'entered',
    decision_entered_by: i.byUserId,
    decision_entered_by_name: i.byName?.trim() || null,
  }
}

/** The patch that takes an entered decision back off a row. */
export const CLEAR_DECISION_PATCH = {
  review_decision: null,
  review_note: null,
  reviewed_by_person_id: null,
  reviewed_by_name: null,
  reviewed_by_email: null,
  reviewed_at: null,
  decision_source: 'room',
  decision_entered_by: null,
  decision_entered_by_name: null,
} as const

/**
 * The room thread's system line: "from Dana Whitfield's PDF, entered by the office · 1 row · 1 revise".
 * The office reads as the office on the room — the staff name stays on the tab.
 */
export function enteredEntryBody(personName: string, counts: { approved: number; revise: number; rejected: number }, source: 'entered' | 'robot' = 'entered'): string {
  const n = counts.approved + counts.revise + counts.rejected
  const parts = [counts.approved ? `${counts.approved} approve` : '', counts.revise ? `${counts.revise} revise` : '', counts.rejected ? `${counts.rejected} reject` : ''].filter(Boolean)
  const how = source === 'robot' ? 'read by the robot, confirmed by the office' : 'entered by the office'
  return `from ${personName.trim()}'s file, ${how} · ${n} row${n === 1 ? '' : 's'}${parts.length ? ` · ${parts.join(' · ')}` : ''}`
}

/** "entered by Wendi" — the tab's suffix on a row's call; "" for a room decision. */
export function enteredSuffix(item: { decision_source?: string | null; decision_entered_by_name?: string | null }): string {
  if (item.decision_source === 'entered') return `entered by ${item.decision_entered_by_name?.trim() || 'the office'}`
  if (item.decision_source === 'robot') return `read by the robot · confirmed by ${item.decision_entered_by_name?.trim() || 'the office'}`
  return ''
}
