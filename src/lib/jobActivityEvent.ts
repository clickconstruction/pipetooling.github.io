/**
 * Generic "system event" item for the Job activity / notes ledger.
 *
 * Rather than adding a new `JobThreadActivityItem` kind per action type, every
 * lifecycle/system action (status change, payment, billing milestone, crew
 * change, field edit, combine/separate, …) is represented by ONE `event` kind
 * carrying a `type` discriminator. The render registry below maps each type to
 * its display chrome, so the panel needs only a single render branch.
 */

export type JobActivityEventType =
  | 'status_change'
  | 'payment_added'
  | 'payment_removed'
  | 'invoice_created'
  | 'invoice_billed'
  | 'invoice_sent'
  | 'invoice_write_down'
  | 'invoice_stripe_email_sent'
  | 'crew_added'
  | 'crew_removed'
  | 'material_added'
  | 'fixture_added'
  | 'field_edited'
  | 'job_combined'
  | 'job_separated'
  | 'collections_change'
  | 'completeness_marked'

export type JobActivityEvent = {
  /** Stable React key + dedupe key: `ev:status:<id>` (Phase 1) / `ev:<rowid>` (Phase 2). */
  dedupeKey: string
  type: JobActivityEventType
  /** ISO timestamp for timeline sort. */
  occurredAt: string
  /** Resolved display name of the actor; null = system/automated. */
  actorName: string | null
  /** Pre-humanized headline, e.g. "Working → Ready to Bill" or "Payment $1,200.00 (check)". */
  summary: string
  /** Optional structured extras for the render branch / future use. */
  detail?: Record<string, unknown>
  /** Drives role-gating awareness and the client filter bucket. */
  financial: boolean
}

export type JobThreadEventActivityItem = { kind: 'event'; event: JobActivityEvent }

/** Filter/grouping bucket for the panel's segmented filter control. */
export type JobActivityBucket = 'status' | 'billing' | 'crew' | 'other'

export type EventRenderMeta = {
  /** Short uppercase tag shown on the row (e.g. "STATUS", "PAYMENT"). */
  tag: string
  /** Tag text color. */
  tagColor: string
  /** Row left-border accent color. */
  borderColor: string
  bucket: JobActivityBucket
}

const BILLING_BLUE = { tagColor: '#1d4ed8', borderColor: '#93c5fd' } as const
const MONEY_GREEN = { tagColor: '#047857', borderColor: '#6ee7b7' } as const
const DANGER_RED = { tagColor: '#b91c1c', borderColor: '#fca5a5' } as const
const STATUS_AMBER = { tagColor: '#b45309', borderColor: '#fcd34d' } as const
const CREW_INDIGO = { tagColor: '#4f46e5', borderColor: '#a5b4fc' } as const
const WORK_TEAL = { tagColor: '#0f766e', borderColor: '#5eead4' } as const
const EDIT_GRAY = { tagColor: '#6b7280', borderColor: 'var(--border-strong)' } as const
const COMBINE_PURPLE = { tagColor: '#7c3aed', borderColor: '#c4b5fd' } as const

export const JOB_ACTIVITY_EVENT_RENDER: Record<JobActivityEventType, EventRenderMeta> = {
  status_change: { tag: 'Status', ...STATUS_AMBER, bucket: 'status' },
  payment_added: { tag: 'Payment', ...MONEY_GREEN, bucket: 'billing' },
  payment_removed: { tag: 'Payment', ...DANGER_RED, bucket: 'billing' },
  invoice_created: { tag: 'Invoice', ...BILLING_BLUE, bucket: 'billing' },
  invoice_billed: { tag: 'Billed', ...BILLING_BLUE, bucket: 'billing' },
  invoice_sent: { tag: 'Sent', ...BILLING_BLUE, bucket: 'billing' },
  invoice_write_down: { tag: 'Write-down', ...STATUS_AMBER, bucket: 'billing' },
  invoice_stripe_email_sent: { tag: 'Emailed', ...BILLING_BLUE, bucket: 'billing' },
  crew_added: { tag: 'Crew', ...CREW_INDIGO, bucket: 'crew' },
  crew_removed: { tag: 'Crew', ...DANGER_RED, bucket: 'crew' },
  material_added: { tag: 'Material', ...WORK_TEAL, bucket: 'other' },
  fixture_added: { tag: 'Work', ...WORK_TEAL, bucket: 'other' },
  field_edited: { tag: 'Edit', ...EDIT_GRAY, bucket: 'other' },
  job_combined: { tag: 'Combined', ...COMBINE_PURPLE, bucket: 'other' },
  job_separated: { tag: 'Separated', ...COMBINE_PURPLE, bucket: 'other' },
  collections_change: { tag: 'Collections', ...DANGER_RED, bucket: 'billing' },
  completeness_marked: { tag: 'Progress', ...WORK_TEAL, bucket: 'status' },
}

export function eventRenderMeta(type: JobActivityEventType): EventRenderMeta {
  return JOB_ACTIVITY_EVENT_RENDER[type]
}

export function bucketForEvent(type: JobActivityEventType): JobActivityBucket {
  return JOB_ACTIVITY_EVENT_RENDER[type].bucket
}
