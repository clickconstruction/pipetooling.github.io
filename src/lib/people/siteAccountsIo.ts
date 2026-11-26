/**
 * The reads behind the Sites lens (v2.8657). Three reads, each on its own: the people here with the id each row
 * holds for CountTooling, and each site's accounts over its dev-only bridge. Nothing here writes.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { readEdgeFunctionErrorBody } from '../readEdgeFunctionErrorBody'
import { SITES, parseSiteRoster, type SiteKey, type SiteRead } from './siteAccounts'

type Client = SupabaseClient<Database>

/** One person here as the lens matches them: their address, and the CountTooling id their row holds. */
export type SitePersonRow = { id: string; email: string | null; counttooling_user_id: string | null }

/** Every `users` row a dev may read, archived ones too, so a seat kept by someone who left is not "nobody". */
export async function fetchSitePeople(client: Client): Promise<SitePersonRow[]> {
  const rows = await withSupabaseRetry(() => client.from('users').select('id, email, counttooling_user_id'), 'read the people for the Sites lens')
  return (rows ?? []) as SitePersonRow[]
}

/** One site's accounts over its bridge. It answers with the read, and never throws: a site that fails says why. */
export async function fetchSiteRoster(client: Client, site: SiteKey): Promise<SiteRead> {
  const bridge = SITES.find((s) => s.key === site)?.bridge ?? 'ct-bridge'
  try {
    const { data, error } = await client.functions.invoke(bridge, { body: { verb: 'roster' } })
    if (error) throw error
    return { state: 'ready', accounts: parseSiteRoster(site, data) }
  } catch (e) {
    const said = await readEdgeFunctionErrorBody(e)
    return { state: 'failed', reason: said ?? formatErrorMessage(e, 'The site did not answer.') }
  }
}
