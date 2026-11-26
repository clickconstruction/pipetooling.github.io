/**
 * Deleting a turned-off portal link (punch list #443, row 11): the take-back of **Turn off** in a customer's portal
 * window.
 *
 * Turning a link off sets `revoked_at` and keeps the row for the window's History, so every walk that turned a ZZ Test
 * customer's portal off left a row for good. The table lets nobody delete; `delete_test_portal_link` (migration
 * 20261126023047) is the one door, for a developer, on a test customer's turned-off link that no GC proposal names.
 * This is the rule for the press that calls it. Pure: the call is `portalLinkDeleteIo.ts`, the press sits on a link's
 * History line in `components/customers/CustomerPortalGlobeButton.tsx`.
 *
 * - The press is drawn for a dev and for nobody else. View as a sample account is that account, so it draws nothing.
 * - Only a link that is off goes: turned off, or rotated away. A live link is never offered.
 * - Only a test customer's link goes: the customer's name starts with ZZ (`isZzTestName`), the one mark a customer carries.
 * - The function refuses a link a GC's proposal names, since the proposal would forget it without a word. The window
 *   reads which of its links a proposal names and draws the press dead on those with the function's own sentence
 *   (punch list #443, finding 254). A refusal that comes back anyway is said as that sentence, never as a failure.
 */
import { isZzTestName } from '../../../supabase/functions/_shared/zzTestJob'
import type { PortalTimelineEntry } from './portalLinkState'

/** Who is offered the delete: a dev. Every other role sees nothing new. */
export function portalLinkDeleteDrawn(role: string | null | undefined): boolean {
  return role === 'dev'
}

/** A History line the press can sit on: a link's, with the row's id, and off. */
export type PortalLinkDeleteCandidate = Extract<PortalTimelineEntry, { kind: 'link' }>

/**
 * The sentence for a link a GC's proposal names, in the function's own words (`delete_test_portal_link`), so the
 * window and the database say one thing: *1 GC proposal names this link. It stays.*
 */
export function portalLinkNamedWords(count: number): string {
  return count === 1 ? '1 GC proposal names this link. It stays.' : `${count} GC proposals name this link. It stays.`
}

/** How many GC proposals name each link, from the proposals read for the window's links. */
export function portalLinkNamedCounts(rows: ReadonlyArray<{ portal_link_id: string | null }> | null | undefined): Map<string, number> {
  const counts = new Map<string, number>()
  for (const r of rows ?? []) if (r.portal_link_id) counts.set(r.portal_link_id, (counts.get(r.portal_link_id) ?? 0) + 1)
  return counts
}

/**
 * Why this link can never be deleted from here; '' when it may be, subject to the function's own checks. `named` is
 * how many GC proposals name the link, when the window could read them: a link one names stays, so its press is dead
 * with that reason and opens no confirm (punch list #443). Unread, it is 0 and the function still refuses.
 */
export function portalLinkDeleteProblem(entry: PortalTimelineEntry, customerName: string | null | undefined, named = 0): string {
  if (entry.kind !== 'link') return 'Only a link can be deleted.'
  if (!entry.linkId) return 'This link has no id to delete by. Read the window again.'
  if (entry.outcome === 'active' || entry.revokedAt === null) return 'Turn this link off first. A live link is never deleted.'
  if (!isZzTestName(customerName)) return 'Only a test customer’s link can be deleted. The customer’s name must start with ZZ.'
  if (named > 0) return portalLinkNamedWords(named)
  return ''
}

/** The confirm window's words. The button names the act. */
export function portalLinkDeleteConfirm(entry: PortalLinkDeleteCandidate, customerName: string): { title: string; message: string; confirmLabel: string } {
  const what = entry.audience === 'all' ? 'link' : entry.audience === 'gc' ? 'separate view (GC bills only)' : 'separate view (their own jobs)'
  return {
    title: `Delete this turned-off ${what} of ${customerName}?`,
    message: 'It leaves the History for everyone, and it cannot be brought back. A link a GC proposal names stays.',
    confirmLabel: 'Delete the link',
  }
}

/** What the toast says once it is gone. */
export const PORTAL_LINK_DELETED_WORDS = 'The turned-off link was deleted.'

/** The press's word on the History line. */
export const PORTAL_LINK_DELETE_PRESS = 'Delete…'
