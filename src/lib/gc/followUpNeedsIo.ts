/**
 * GC mode, the Dashboard's Follow up line: the slice of the board's rows that Follow up's count
 * reads (`followUpNeeds.ts`), in seven small reads under door 1's and door 2's policies. The hook
 * imports this file on demand, so the Dashboard's own chunk does not carry the GC kernels.
 */
import { supabase } from '../supabase'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import type { BoardRows } from './boardRows'
import { followUpStateFromSlice, gcFollowUpNeeds, type GcFollowUpNeeds } from './followUpNeeds'

function taken<T>(result: { data: T | null; error: SupabaseResultError | null; status?: number }, operation: string): T {
  checkSupabaseError(result, operation)
  return result.data
}

const none = Promise.resolve({ data: [], error: null })

/** The line for today, or null when nobody waits on a call. */
export async function loadGcFollowUpNeeds(today: string): Promise<GcFollowUpNeeds | null> {
  const [gc, companies] = await Promise.all([
    supabase
      .from('gc_projects')
      .select('project_id, stage, bid_due, sq_ft, size_note, customer_role, property_owner_customer_id, architect_customer_id, project_manager_user_id, drive_folder_url, lost_on'),
    supabase
      .from('gc_companies')
      .select('id, name, trades, contact_name, phone, email, address, max_miles, license, lang, vetting_status, vetting_limit, vetting_decided_on, vetting_decided_by, vetting_note, contact_gets'),
  ])
  const gcRows = taken(gc, 'load the GC projects')
  if (gcRows.length === 0) return null
  const ids = gcRows.map((g) => g.project_id)
  const [projects, packages] = await Promise.all([
    supabase.from('projects').select('id, name, address, customer_id, plans_link').in('id', ids),
    supabase.from('gc_trade_packages').select('id, project_id, trade, position, budget, ours, own_bid_id, carried_invite_id, carry_budget').in('project_id', ids),
  ])
  const packageRows = taken(packages, 'load the trades')
  const packageIds = packageRows.map((p) => p.id)
  const invites = taken(await (packageIds.length ? supabase.from('gc_invites').select('*').in('package_id', packageIds) : none), 'load the asks') as BoardRows['invites']
  const inviteIds = invites.map((i) => i.id)
  const [quotes, contacts] = await Promise.all([
    inviteIds.length ? supabase.from('gc_quotes').select('*').in('invite_id', inviteIds) : none,
    inviteIds.length ? supabase.from('gc_company_contacts').select('*').in('invite_id', inviteIds) : none,
  ])
  return gcFollowUpNeeds(
    followUpStateFromSlice({
      today,
      gc: gcRows,
      projects: taken(projects, 'load the GC projects'),
      packages: packageRows,
      companies: taken(companies, 'load the trade partners'),
      invites,
      quotes: taken(quotes, 'load the quotes') as BoardRows['quotes'],
      contacts: taken(contacts, 'load the call log'),
    }),
  )
}
