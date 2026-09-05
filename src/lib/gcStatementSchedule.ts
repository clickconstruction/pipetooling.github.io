import type { Database } from '../types/database'
import { salaryZonedWallClockToUtcMs } from './salaryZonedWallClock'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'

/**
 * Scheduling kernel for the gc_statement Report Subscriptions stream
 * (v2.1427, Phase 3 — docs/REPORT_SUBSCRIPTIONS.md). Pure: builds and
 * validates the gc_statement_email_requests insert row from the GC Review
 * dialogs' state; IO lives in gcStatementEmailRequests.ts.
 */

export type GcStatementRequestInsert = Database['public']['Tables']['gc_statement_email_requests']['Insert']

export type GcStatementScheduleInput = {
  requestedBy: string
  toEmail: string
  /** Grouping dimension the modal is showing (drives the rebuilt statement). */
  byDevelopment: boolean
  /** GC customer id / development id for a single statement; null = whole report. */
  entityId: string | null
  /** Display snapshot for pending lists ('All GCs' / 'All developments' when entityId is null). */
  entityName: string
  includeCollections: boolean
  /** Civil date + wall clock in the company calendar zone (Central). */
  sendDateYmd: string
  sendTimeHm: string
  /** CC recipients (v2.2160) — already normalized by parseCcEmails; empty/omitted → none. */
  ccEmails?: string[]
  repeatWeekly: boolean
}

export type GcStatementScheduleResult =
  | { ok: true; row: GcStatementRequestInsert; sendAtIso: string }
  | { ok: false; error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function buildGcStatementRequestInsert(
  input: GcStatementScheduleInput,
  now: Date = new Date(),
): GcStatementScheduleResult {
  const toEmail = input.toEmail.trim()
  if (!EMAIL_RE.test(toEmail)) return { ok: false, error: 'Enter a valid email address.' }

  const hm = /^(\d{1,2}):(\d{2})$/.exec(input.sendTimeHm.trim())
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.sendDateYmd) || !hm) {
    return { ok: false, error: 'Pick a date and time.' }
  }
  const ms = salaryZonedWallClockToUtcMs(input.sendDateYmd, Number(hm[1]), Number(hm[2]), 0, APP_CALENDAR_TZ)
  if (ms == null) return { ok: false, error: 'Pick a date and time.' }
  if (ms <= now.getTime()) return { ok: false, error: 'Pick a time in the future (Central).' }

  const sendAtIso = new Date(ms).toISOString()
  return {
    ok: true,
    sendAtIso,
    row: {
      requested_by: input.requestedBy,
      sent_to: toEmail,
      group_by: input.byDevelopment ? 'development' : 'gc',
      gc_customer_id: !input.byDevelopment && input.entityId ? input.entityId : null,
      development_id: input.byDevelopment && input.entityId ? input.entityId : null,
      entity_name: input.entityName,
      include_collections: input.includeCollections,
      send_at: sendAtIso,
      repeat_weekly: input.repeatWeekly,
      cc_emails: input.ccEmails && input.ccEmails.length > 0 ? input.ccEmails : null,
    },
  }
}

export type PendingGcStatementSend = {
  id: string
  /** Who scheduled it (journey-map #45: the office sees every request; only the requester or a dev may Cancel). */
  requested_by: string
  sent_to: string
  group_by: string
  gc_customer_id: string | null
  development_id: string | null
  entity_name: string
  include_collections: boolean
  send_at: string
  repeat_weekly: boolean
}

/** "Knight Contracting → ap@knight.com" / "All GCs → book@keeper.com" for pending lists. */
export function describePendingGcStatementSend(row: Pick<PendingGcStatementSend, 'entity_name' | 'sent_to'>): string {
  const name = row.entity_name.trim() || 'Statement'
  return `${name} → ${row.sent_to}`
}
