/**
 * Messages, cut 8: the office's read-back of customers' pages, in one batch. `customer_portal_views`
 * (20261012130000) gives each page's last outside open; `customer_portal_papers` (20261012210000) gives every paper
 * sent, as its non-money half with its first outside open. `customerPaperViews` (`papers.ts`) puts them together.
 *
 * Readers: the thread header's portal pill (`portalWords(lastOpenedAt, pillPapers(papers))`), Follow up's portal rows
 * (`papersWaitingOnThem`), the step card's So far and By company's Portal column. Both reads answer the office team
 * only; anyone else gets empty lists, and the read-back says "never opened".
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { customerPaperViews, type CustomerPageViewRow, type CustomerPaperRow, type CustomerReadBack } from './papers'

// Untyped until the types regenerate after 20261012130000's and 20261012210000's push.
const db = supabase as unknown as SupabaseClient

/** Each customer's read-back, keyed by customer id; every id asked for has an entry. */
export async function loadCustomerPortalReadBack(customerIds: readonly string[]): Promise<Map<string, CustomerReadBack>> {
  const ids = [...new Set(customerIds)]
  if (ids.length === 0) return new Map()
  const [pages, papers] = await Promise.all([
    withSupabaseRetry<CustomerPageViewRow[]>(() => db.rpc('customer_portal_views', { p_customer_ids: ids }), 'read when customers opened their page'),
    withSupabaseRetry<CustomerPaperRow[]>(() => db.rpc('customer_portal_papers', { p_customer_ids: ids }), 'read the papers sent to customers'),
  ])
  return customerPaperViews(ids, papers ?? [], pages ?? [])
}
