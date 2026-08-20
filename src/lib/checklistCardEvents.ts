/**
 * Pure helpers for the checklist card's history spine (Phase 2 of the
 * checklist-card redesign, v2.1842 migration).
 *
 * Events arrive oldest-first from `checklist_instance_events`. Transition rows
 * (`completed` / `reopened` / `accepted`) are trigger-written; `comment` rows
 * are person-written. The card shows a one-line status strip derived here, and
 * a reopened card surfaces the reopener's reason — the first comment posted at
 * or after the latest `reopened` event, by convention written in the same
 * action ("Reopen with comment").
 */

export type ChecklistCardEvent = {
  id: string
  instance_id: string
  event_type: string
  actor_user_id: string | null
  body: string
  created_at: string
}

export type ChecklistCardInstanceState = {
  completed_at: string | null
  reviewed_at: string | null
}

export type ChecklistCardStatus =
  | { kind: 'open' }
  | { kind: 'reopened'; byUserId: string | null; at: string; reason: string | null; reasonByUserId: string | null }
  | { kind: 'waiting_review'; at: string }
  | { kind: 'signed_off'; at: string; byUserId: string | null }

export function groupEventsByInstance(
  events: ChecklistCardEvent[],
): Map<string, ChecklistCardEvent[]> {
  const map = new Map<string, ChecklistCardEvent[]>()
  for (const e of events) {
    const list = map.get(e.instance_id)
    if (list) list.push(e)
    else map.set(e.instance_id, [e])
  }
  return map
}

export function commentCount(events: ChecklistCardEvent[]): number {
  let n = 0
  for (const e of events) if (e.event_type === 'comment') n++
  return n
}

/** Latest event of a type, relying on oldest-first input order. */
function lastOfType(events: ChecklistCardEvent[], type: string): ChecklistCardEvent | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    if (e && e.event_type === type) return e
  }
  return null
}

/**
 * Card status from the instance row + its events. The instance row is the
 * authority on the current state (events could lag if an insert was dropped by
 * the trigger's never-break guard); events supply the who/why texture.
 */
export function cardStatus(
  inst: ChecklistCardInstanceState,
  events: ChecklistCardEvent[],
): ChecklistCardStatus {
  if (inst.completed_at) {
    if (inst.reviewed_at) {
      const accepted = lastOfType(events, 'accepted')
      return { kind: 'signed_off', at: inst.reviewed_at, byUserId: accepted?.actor_user_id ?? null }
    }
    return { kind: 'waiting_review', at: inst.completed_at }
  }
  const reopened = lastOfType(events, 'reopened')
  if (!reopened) return { kind: 'open' }
  // Reason = first comment at/after the reopen (posted together by the
  // "Reopen with comment" action, so >= covers equal timestamps).
  let reason: ChecklistCardEvent | null = null
  for (const e of events) {
    if (e.event_type === 'comment' && e.created_at >= reopened.created_at) {
      reason = e
      break
    }
  }
  return {
    kind: 'reopened',
    byUserId: reopened.actor_user_id,
    at: reopened.created_at,
    reason: reason ? reason.body : null,
    reasonByUserId: reason ? reason.actor_user_id : null,
  }
}

/** Compact h:mm time for strips; falls back to the raw string when unparseable. */
export function stripTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** Day-aware stamp: time alone for today, weekday + time within a week, date otherwise. */
export function stripStamp(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return stripTime(iso)
  const days = (now.getTime() - d.getTime()) / 86_400_000
  if (days < 7) {
    return `${d.toLocaleDateString([], { weekday: 'short' })} ${stripTime(iso)}`
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/**
 * True when the card's most recent completion transition is a reopen — i.e. a
 * human explicitly said "this still needs doing" and nobody has re-completed
 * it since. Powers the Outstanding qualifier for reopened recurring tasks
 * (v2.1869): a deliberate reopen outranks the recurrings-don't-carry-over rule.
 */
export function lastTransitionIsReopen(events: ChecklistCardEvent[]): boolean {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    if (!e) continue
    if (e.event_type === 'reopened') return true
    if (e.event_type === 'completed') return false
  }
  return false
}
