import type { JobStatusEventRow } from './fetchJobStatusEventsForJobLedger'
import type { JobThreadEventActivityItem } from './jobActivityEvent'

const STATUS_LABELS: Record<string, string> = {
  waiting: 'Waiting',
  working: 'Working',
  ready_to_bill: 'Ready to Bill',
  billed: 'Billed',
  paid: 'Paid',
}

/** Human label for a jobs_ledger.status value (title-cases unknown values). */
export function humanizeJobStatus(s: string | null | undefined): string {
  const v = (s ?? '').trim()
  if (!v) return '—'
  return STATUS_LABELS[v] ?? v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Status-transition audit rows → generic timeline `event` items. */
export function statusEventsToActivityItems(rows: JobStatusEventRow[]): JobThreadEventActivityItem[] {
  return rows
    .filter((r) => (r.changed_at ?? '').trim().length > 0)
    .map((r) => ({
      kind: 'event' as const,
      event: {
        dedupeKey: `ev:status:${r.id}`,
        type: 'status_change' as const,
        occurredAt: r.changed_at as string,
        actorName: r.users?.name?.trim() || null,
        summary: `${humanizeJobStatus(r.from_status)} → ${humanizeJobStatus(r.to_status)}`,
        financial: false,
        detail: { from: r.from_status, to: r.to_status, source_id: r.id },
      },
    }))
}
