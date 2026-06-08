import type { JobTeamMemberRow } from './fetchJobTeamMembersForJobLedger'
import type { JobThreadEventActivityItem } from './jobActivityEvent'

/**
 * Crew/team-member rows → `crew_added` `event` items.
 * (Removal is not representable in Phase 1 — a removed member is a deleted row;
 * Phase 2's append-only ledger captures `crew_removed`.)
 */
export function teamMembersToActivityItems(rows: JobTeamMemberRow[]): JobThreadEventActivityItem[] {
  return rows
    .filter((r) => (r.created_at ?? '').trim().length > 0)
    .map((r) => {
      const name = r.users?.name?.trim() || 'Someone'
      return {
        kind: 'event' as const,
        event: {
          dedupeKey: `ev:crew:${r.id}`,
          type: 'crew_added' as const,
          occurredAt: r.created_at as string,
          actorName: null,
          summary: `${name} added to crew`,
          financial: false,
          detail: { user_id: r.user_id, source_id: r.id },
        },
      }
    })
}
