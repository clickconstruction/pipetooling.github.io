/**
 * The reads behind the Sites lens (v2.8657): the people here with the id each row holds for CountTooling, and each
 * site's accounts over its dev-only bridge, each on its own. Since v2.8667 also the person desk's writes over the
 * same two bridges: a seat made, retired or brought back, and its role set.
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

/** One write over a site's bridge (v2.8667). It answers with what the site sent back, and throws the site's own reason. */
export async function sendSiteVerb(client: Client, site: SiteKey, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const bridge = SITES.find((s) => s.key === site)?.bridge ?? 'ct-bridge'
  try {
    const { data, error } = await client.functions.invoke(bridge, { body })
    if (error) throw error
    const sent = data !== null && typeof data === 'object' ? (data as Record<string, unknown>) : {}
    if (typeof sent.error === 'string' && sent.error.trim() !== '') throw new Error(sent.error)
    return sent
  } catch (e) {
    const said = await readEdgeFunctionErrorBody(e)
    throw new Error(said ?? formatErrorMessage(e, 'The site did not answer.'))
  }
}

/**
 * Make (or find) their TakeoffTooling seat. PipeTooling keeps no id for it: the seat is found again by address,
 * which is why the row says *by address*.
 */
export async function makeTakeoffToolingSeat(client: Client, args: { email: string; name: string | null }): Promise<string> {
  const sent = await sendSiteVerb(client, 'takeoff', { verb: 'create', email: args.email, name: args.name ?? undefined })
  const id = typeof sent.tt_user_id === 'string' ? sent.tt_user_id : ''
  if (!id) throw new Error('TakeoffTooling sent no seat back.')
  return id
}
