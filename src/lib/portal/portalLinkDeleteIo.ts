/**
 * Deleting a turned-off portal link (punch list #443, row 11): the call. The rule is `portalLinkDelete.ts`.
 *
 * `delete_test_portal_link` runs as the signed-in person and holds every rule itself: a developer, a link that is off,
 * a customer whose name starts with ZZ, no GC proposal naming the link. Its refusal is passed on in its own words,
 * as a `PortalLinkDeleteRefused`.
 */
import { supabase } from '../supabase'
import { DatabaseError, withSupabaseRetry } from '../../utils/errorHandling'
import { portalLinkDeleteProblem, portalLinkNamedCounts, type PortalLinkDeleteCandidate } from './portalLinkDelete'

/**
 * A delete the rule turned down on purpose: the client's own rule, or the function's (`P0001`, raised in plain words).
 * Its message is the reason and nothing else, so the screen says it as it stands and not as *Failed to delete…*
 * (punch list #443, finding 254). Anything else that goes wrong is an ordinary error.
 */
export class PortalLinkDeleteRefused extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'PortalLinkDeleteRefused'
  }
}

/** Delete one turned-off link. The rule runs first, then the one call, sent once. */
export async function deleteTestPortalLink(entry: PortalLinkDeleteCandidate, customerName: string): Promise<void> {
  const problem = portalLinkDeleteProblem(entry, customerName)
  if (problem) throw new PortalLinkDeleteRefused(problem)
  let answer: unknown
  try {
    answer = await withSupabaseRetry(
      () => supabase.rpc('delete_test_portal_link' as never, { p_link_id: entry.linkId } as never),
      'delete the link',
      { maxRetries: 0 },
    )
  } catch (e) {
    if (e instanceof DatabaseError && e.code === 'P0001' && e.serverMessage) throw new PortalLinkDeleteRefused(e.serverMessage)
    throw e
  }
  const a = (answer ?? null) as Record<string, unknown> | null
  if (a && typeof a.error === 'string') throw new PortalLinkDeleteRefused(a.error)
}

/**
 * How many GC proposals name each of these links, so the window can draw **Delete…** dead on a link that stays. One
 * read, office staff may make it. Null when it cannot be read: the press then stays live and the function refuses.
 */
export async function readPortalLinkNamedCounts(linkIds: readonly string[]): Promise<Map<string, number> | null> {
  if (linkIds.length === 0) return new Map()
  try {
    const rows = await withSupabaseRetry(
      async () => supabase.from('job_paper_proposals').select('portal_link_id').in('portal_link_id', [...linkIds]),
      'read the GC proposals that name these links',
    )
    return portalLinkNamedCounts((rows ?? []) as Array<{ portal_link_id: string | null }>)
  } catch {
    return null
  }
}
