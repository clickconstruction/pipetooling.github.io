/**
 * Leave (People spine PR 2, v2.3700): the headless writes the Person desk's End employment flow
 * runs, one function each, so the flow is a list of calls and nothing is left for a second screen.
 * Every write is the one the sections already make — nothing here has a new permission; the
 * gates are the sections' gates (`personDeskGates.ts`) and the edge function's own.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { FunctionsHttpError } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { resolveCompanyOwnerUserId } from '../companyOwner'
import { archiveRequestBody, type ArchiveReassignMode } from '../archiveUserDialog'
import { removeSalaryScheduleForUser } from '../salaryScheduleSync'

type Client = SupabaseClient<Database>

/** Close whatever is still on the clock for this account — the session then waits for approval. */
export async function closeOpenClockSessions(supabase: Client, userId: string): Promise<void> {
  const { error } = await supabase.from('clock_sessions').update({ clocked_out_at: new Date().toISOString() }).eq('user_id', userId).is('clocked_out_at', null)
  if (error) throw new Error(error.message)
}

/**
 * A salaried person who leaves stops being salaried: the workday template and its day overrides
 * go (which also drops today's and yesterday's unapproved auto sessions), and the pay row flips
 * to hourly so no list credits the flat 8 h a day after the end date. Run AFTER the final pay
 * report — that report needs the salaried credit for the days it covers.
 */
export async function clearSalaryForPerson(supabase: Client, args: { userId: string | null; payName: string }): Promise<void> {
  if (args.userId) {
    const r = await removeSalaryScheduleForUser(args.userId)
    if (r.error) throw new Error(r.error)
  }
  const { error } = await supabase
    .from('people_pay_config')
    .update({ is_salary: false, record_hours_but_salary: false })
    .eq('person_name', args.payName)
  if (error) throw new Error(error.message)
}

/** Customers still on this account's name (they move to the company owner on archive when asked). */
export async function countCustomersOwned(supabase: Client, userId: string): Promise<number | null> {
  const { count, error } = await supabase.from('customers').select('id', { count: 'exact', head: true }).eq('master_user_id', userId)
  if (error) return null
  return count ?? 0
}

async function fnErrorMessage(e: unknown): Promise<string> {
  if (e instanceof FunctionsHttpError && e.context) {
    try {
      const b = (await e.context.json()) as { error?: string } | null
      if (b?.error) return b.error
    } catch {
      /* fall through */
    }
  }
  return e instanceof Error ? e.message : 'That did not save'
}

/**
 * Archive the login account through `archive-user` (archived stamp, sign-in banned, CountTooling
 * seat deactivated) — with the customers moved to the company owner when `mode` says so and
 * there are any. Same body the Active Accounts dialog sends (`archiveRequestBody`).
 */
export async function archiveAccount(
  supabase: Client,
  args: { email: string; name: string | null; customerCount: number | null; mode: ArchiveReassignMode; authUserId: string },
): Promise<void> {
  const reassignTo = args.mode === 'reassign' && (args.customerCount ?? 0) > 0 ? await resolveCompanyOwnerUserId(supabase, args.authUserId) : ''
  const body = archiveRequestBody({ email: args.email, name: args.name }, args.customerCount, args.mode, reassignTo)
  try {
    const { data, error } = await supabase.functions.invoke('archive-user', { body })
    if (error) throw error
    const err = (data as { error?: string } | null)?.error
    if (err) throw new Error(err)
  } catch (e) {
    throw new Error(await fnErrorMessage(e))
  }
}

/** The roster row's archived stamp — the other half of the person leaves every roster too. Restorable from People → Users → Archived. */
export async function archiveRosterRow(supabase: Client, personId: string): Promise<void> {
  const { error } = await supabase.from('people').update({ archived_at: new Date().toISOString() }).eq('id', personId)
  if (error) throw new Error(error.message)
}

/** The end date, on the roster row where employment dates live. */
export async function setEmploymentEndDate(supabase: Client, personId: string, endDateYmd: string): Promise<void> {
  const { error } = await supabase.from('people').update({ end_date: endDateYmd }).eq('id', personId)
  if (error) throw new Error(error.message)
}
