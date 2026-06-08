import { JOB_ACTIVITY_EVENT_RENDER, type JobActivityEventType, type JobThreadEventActivityItem } from './jobActivityEvent'

/** Row shape returned by the `list_job_activity_events` RPC. */
export type JobActivityEventRpcRow = {
  id: string
  event_type: string
  occurred_at: string | null
  actor_user_id: string | null
  actor_name: string | null
  summary: string | null
  detail: Record<string, unknown> | null
  financial: boolean | null
}

/**
 * Map `list_job_activity_events` rows → generic `event` timeline items.
 * Rows with an unknown event_type (forward-compat) or no occurred_at are dropped
 * so the render registry lookup is always safe.
 */
export function jobActivityEventsFromRpc(rows: JobActivityEventRpcRow[]): JobThreadEventActivityItem[] {
  return rows
    .filter((r) => (r.occurred_at ?? '').trim().length > 0 && r.event_type in JOB_ACTIVITY_EVENT_RENDER)
    .map((r) => ({
      kind: 'event' as const,
      event: {
        dedupeKey: `ev:${r.id}`,
        type: r.event_type as JobActivityEventType,
        occurredAt: r.occurred_at as string,
        actorName: r.actor_name?.trim() || null,
        summary: r.summary ?? '',
        detail: r.detail ?? undefined,
        financial: !!r.financial,
      },
    }))
}
