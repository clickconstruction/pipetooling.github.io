/**
 * Hiring → the helper try-out (v2.3627, to-dos/helper-tryout-loop PR 1). Try-out is a stage
 * between Interview and Hire: *Try out* on a helper column's card makes the helper's login
 * (create-user's trial branch) so they can be scheduled and clock, and the card waits in
 * Try-out until the office presses Hire or Pass. Pure rules only — the tab does the I/O.
 */
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { suggestRosterKind } from './hireRosterKinds'

export type TrialCandidate = {
  status: string
  email: string | null
  trial_user_id?: string | null
  trial_started_at?: string | null
}

/** Try out is the verb for a helper column ("Helper", "Apprentice", "Laborer"); an office column keeps Advance only. */
export function isHelperColumn(roleName: string | null | undefined): boolean {
  return suggestRosterKind(roleName) === 'helper'
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Why Try out cannot run on this card, or null when it can. The function refuses the same cases server-side. */
export function tryOutBlocker(candidate: TrialCandidate): string | null {
  if (candidate.status === 'trial' || candidate.trial_user_id) return 'Already on a try-out.'
  if (candidate.status !== 'active' && candidate.status !== 'calling') return 'Only a card on Screen or Interview can start a try-out.'
  const email = (candidate.email ?? '').trim()
  if (!email) return 'Add an email first — the helper signs in with it to clock in.'
  if (!EMAIL_SHAPE.test(email)) return 'That email does not look right — fix it on the card first.'
  return null
}

/** "on trial since Sep 12" — the company reads dates in its own zone; a missing stamp says so plainly. */
export function trialSinceLabel(startedAt: string | null | undefined, timeZone: string = APP_CALENDAR_TZ): string {
  if (!startedAt) return 'on trial'
  const d = new Date(startedAt)
  if (Number.isNaN(d.getTime())) return 'on trial'
  return `on trial since ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone })}`
}
