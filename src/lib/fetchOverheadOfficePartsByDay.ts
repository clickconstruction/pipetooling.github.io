import { supabase } from './supabase'
import { readOtherJobsPartsByDay, readOverheadOfficePartsByDay, type OverheadOfficePartsByDayResult } from './overheadOfficePartsReads'

// The reads live in `overheadOfficePartsReads.ts` with the client passed in (v2.5880); this file binds the app's
// client for the Overhead tab, the pool snapshot, the job day ledger and the project day costs.
export type { OverheadOfficePartsByDayResult, OverheadPartsDetailLine, OverheadPartsSource } from './overheadOfficePartsReads'

/**
 * Office job materials by calendar day (Chicago wall date for Mercury/Tally timestamps),
 * same sources as job materials snapshot: Mercury allocations, supply invoice allocations, tally parts.
 * Rejects when any source fetch fails — callers surface the error instead of silently rendering a $0 Materials column.
 */
export function fetchOverheadOfficePartsByDay(args: { officeJobLedgerId: string; startYmd: string; endYmd: string }): Promise<OverheadOfficePartsByDayResult> {
  return readOverheadOfficePartsByDay(supabase, args)
}

/**
 * Materials on all jobs except the overhead office job (or all jobs when `officeJobLedgerId` is null).
 * Same line rules, date keys, and error propagation as `fetchOverheadOfficePartsByDay`.
 */
export function fetchOtherJobsPartsByDay(args: { officeJobLedgerId: string | null; startYmd: string; endYmd: string }): Promise<OverheadOfficePartsByDayResult> {
  return readOtherJobsPartsByDay(supabase, args)
}
