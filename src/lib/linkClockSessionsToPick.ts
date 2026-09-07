import { supabase } from './supabase'
import { crewLinkPatch } from './crewAssignSessionLinkPlan'

export type ClockSessionPick = { type: 'job' | 'bid'; id: string }

export type LinkClockSessionsResult = {
  /** Rows the UPDATE actually touched — RLS silently drops the rest, so compare against `ids.length`. */
  updated: number
  error: string | null
}

/**
 * The one write behind "put the job on the clock session" (v2.2962 / v2.2966):
 * `UPDATE clock_sessions SET job_ledger_id / bid_id WHERE id IN (ids)`. For an
 * approved session the `clock_sessions_sync_crew_assignments_tr` trigger then
 * rewrites the person-day split from durations; a pending session waits for
 * approval, which runs the same sync. Callers never write the crew tables.
 */
export async function linkClockSessionsToPick(ids: readonly string[], pick: ClockSessionPick): Promise<LinkClockSessionsResult> {
  if (ids.length === 0) return { updated: 0, error: null }
  const { data, error } = await supabase.from('clock_sessions').update(crewLinkPatch(pick)).in('id', [...ids]).select('id')
  if (error) return { updated: 0, error: error.message }
  return { updated: (data ?? []).length, error: null }
}

/** Toast copy when RLS let fewer rows through than asked (a team lead off-roster, an assistant without pay access; controllers pass via `has_payroll_access()`). */
export function partialLinkMessage(personName: string, updated: number, asked: number): string {
  if (updated === 0) return `No sessions were updated — your account can't edit ${personName}'s clock sessions. Ask a pay-approved leader to link them.`
  return `Linked ${updated} of ${asked} sessions — the rest are outside your clock-edit access.`
}
