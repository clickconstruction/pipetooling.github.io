/**
 * GC mode, the real build, the schedule's PR 16b-ii: a change order's non-money half, read through the view
 * `gc_change_orders_office` (migration 20261010081000), which gates itself on the office team and returns none to anyone
 * else. Never `gc_change_orders`, the money team's.
 */
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { CHANGE_ORDER_OFFICE_COLUMNS, type ChangeOrderOfficeRow } from './changeOrderOfficeRows'

/** The jobs' change orders, their money left out by the view itself. */
export async function loadGcChangeOrdersOffice(projectIds: string[]): Promise<ChangeOrderOfficeRow[]> {
  if (projectIds.length === 0) return []
  const result = await supabase
    .from('gc_change_orders_office')
    .select(CHANGE_ORDER_OFFICE_COLUMNS)
    .in('project_id', projectIds)
    .order('number')
  checkSupabaseError(result, 'load the change orders')
  return result.data ?? []
}
