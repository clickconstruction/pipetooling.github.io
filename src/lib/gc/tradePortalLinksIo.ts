/**
 * GC mode, a company's portal link in its window, *Their portal* (P1b-ii-b): its reads and writes. The links come from
 * `gc_trade_portal_links` and the visits from `public_page_views`, both readable by a dev only, as the block is.
 * Making, remaking and turning off a link go through P1a's two dev-only functions, which answer `{ error }` in
 * plain words when they refuse.
 */
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { tradeLinkVisits, type TradeLinkRow, type TradeLinkVisits } from './tradePortalLinks'

export async function loadTradePortalLinks(companyIds: string[]): Promise<{ links: TradeLinkRow[]; visits: Record<string, TradeLinkVisits> }> {
  if (companyIds.length === 0) return { links: [], visits: {} }
  const links = await supabase.from('gc_trade_portal_links').select('company_id, token, created_at, revoked_at').in('company_id', companyIds)
  checkSupabaseError(links, 'read the portal links')
  const views = await supabase.from('public_page_views').select('entity_id, occurred_at').eq('surface', 'gc_trade_portal').eq('viewer', 'outside').in('entity_id', companyIds)
  checkSupabaseError(views, 'read the portal visits')
  const rows = links.data ?? []
  return { links: rows, visits: tradeLinkVisits(views.data ?? [], rows) }
}

function refused(data: unknown, fallback: string): string | null {
  if (data && typeof data === 'object' && 'error' in data) {
    const error = (data as { error?: unknown }).error
    return typeof error === 'string' && error.trim() ? error : fallback
  }
  return null
}

/** The company's link that is on, or a new one. `remake` turns the old one off first. Returns the token. */
export async function makeTradePortalLink(companyId: string, remake: boolean): Promise<string> {
  const result = await supabase.rpc('mint_gc_trade_portal_link', { p_company_id: companyId, p_rotate: remake })
  checkSupabaseError(result, 'make the link')
  const problem = refused(result.data, 'The link was not made.')
  if (problem) throw new Error(problem)
  const token = (result.data as { token?: unknown } | null)?.token
  if (typeof token !== 'string' || token === '') throw new Error('The link was not made.')
  return token
}

/** Turn the company's link off, with no new one. */
export async function turnOffTradePortalLink(companyId: string): Promise<void> {
  const result = await supabase.rpc('revoke_gc_trade_portal_link', { p_company_id: companyId })
  checkSupabaseError(result, 'turn the link off')
  const problem = refused(result.data, 'The link was not turned off.')
  if (problem) throw new Error(problem)
}
