/**
 * Deleting a turned-off portal link (punch list #443, row 11): the call. The rule is `portalLinkDelete.ts`.
 *
 * `delete_test_portal_link` runs as the signed-in person and holds every rule itself: a developer, a link that is off,
 * a customer whose name starts with ZZ, no GC proposal naming the link. Its refusal is passed on in its own words.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { portalLinkDeleteProblem, type PortalLinkDeleteCandidate } from './portalLinkDelete'

/** Delete one turned-off link. The rule runs first, then the one call, sent once. */
export async function deleteTestPortalLink(entry: PortalLinkDeleteCandidate, customerName: string): Promise<void> {
  const problem = portalLinkDeleteProblem(entry, customerName)
  if (problem) throw new Error(problem)
  const answer = await withSupabaseRetry(
    () => supabase.rpc('delete_test_portal_link' as never, { p_link_id: entry.linkId } as never),
    'delete the link',
    { maxRetries: 0 },
  )
  const a = (answer ?? null) as Record<string, unknown> | null
  if (a && typeof a.error === 'string') throw new Error(a.error)
}
