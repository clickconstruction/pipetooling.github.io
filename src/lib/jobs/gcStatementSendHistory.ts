/**
 * One GC's send history across all three statement lanes (journey-map Tier-2
 * #45 / J20-F10): the personal round's marks (`gc_statement_round_marks`), and
 * the app-sent emails (`gc_statement_emails`) — Draft Message or a scheduled
 * send — with the lane read off `email_send_log.email_type` and the delivery
 * status off `last_event`, joined by `resend_email_id`. One list, newest first,
 * so "what exactly went out, to whom, by which lane?" has one answer. Pure —
 * IO lives in `gcStatementSendHistoryIo.ts`.
 */

import { emailLogStatusChip, type EmailLogStatusChip } from '../emailSendLog'
import { GC_STATEMENT_EMAIL_TYPES } from '../gcStatementSendDedupe'
import { sendChannelLabel, type RoundMarkRow } from './gcStatementRounds'

/** A `gc_statement_emails` row for one GC (the columns the list reads). */
export type GcStatementAppSendRow = {
  id: string
  gc_name: string
  group_by: string
  sent_to: string
  subject: string
  total: number
  job_count: number
  sent_by_name: string
  resend_email_id: string | null
  sent_at: string
  cc_emails: string[] | null
}

/** The `email_send_log` columns the list joins in (readable to the office for statement types since 20260905190000). */
export type GcStatementSendLogRow = {
  resend_email_id: string | null
  email_type: string | null
  last_event: string | null
}

/**
 * personal      — a round mark ("Sent it ✓" / Share → Mark sent…); the channel is how.
 * draft_message — send-gc-statement-email (email_type gc_statement_manual).
 * scheduled     — gc-statement-email-dispatch (email_type gc_statement_scheduled).
 * app           — an app-sent email whose log row predates lane stamping (or never logged).
 */
export type StatementLane = 'personal' | 'draft_message' | 'scheduled' | 'app'

export function laneForEmailType(emailType: string | null | undefined): StatementLane {
  if (emailType === GC_STATEMENT_EMAIL_TYPES.manual) return 'draft_message'
  if (emailType === GC_STATEMENT_EMAIL_TYPES.scheduled) return 'scheduled'
  return 'app'
}

export function statementLaneLabel(lane: StatementLane, channel?: string | null): string {
  switch (lane) {
    case 'personal':
      return `Personal · ${sendChannelLabel(channel).toLowerCase()}`
    case 'draft_message':
      return 'Draft Message'
    case 'scheduled':
      return 'Scheduled send'
    default:
      return 'App email'
  }
}

export type GcStatementHistoryEntry = {
  key: string
  /** ISO instant — a mark's acted_at or an email's sent_at. */
  at: string
  /** 'statement' went out (any lane); 'spoke' = a contacted mark, never a statement. */
  kind: 'statement' | 'spoke'
  lane: StatementLane
  laneLabel: string
  who: string
  /** App sends only: the To address (+N when CCs rode along). */
  recipient: string | null
  /** App sends only: the statement total. */
  total: number | null
  /** App sends only: Resend delivery state as a chip; null when the log row is missing. */
  status: EmailLogStatusChip | null
  temperature: string | null
  expectedPayBy: string | null
  note: string | null
}

/** "ap@knight.com" · "ap@knight.com +2" */
export function formatStatementRecipient(sentTo: string, cc: string[] | null | undefined): string {
  const n = (cc ?? []).filter((e) => typeof e === 'string' && e.trim()).length
  return n > 0 ? `${sentTo} +${n}` : sentTo
}

export function buildGcStatementSendHistory(
  input: { marks: ReadonlyArray<RoundMarkRow>; emails: ReadonlyArray<GcStatementAppSendRow>; log: ReadonlyArray<GcStatementSendLogRow> },
  limit = 60,
): GcStatementHistoryEntry[] {
  const logById = new Map<string, GcStatementSendLogRow>()
  for (const l of input.log) if (l.resend_email_id) logById.set(l.resend_email_id, l)

  const out: GcStatementHistoryEntry[] = []
  for (const m of input.marks) {
    if (m.action !== 'sent' && m.action !== 'contacted') continue
    out.push({
      key: `mark:${m.week_start}:${m.acted_at}`,
      at: m.acted_at,
      kind: m.action === 'contacted' ? 'spoke' : 'statement',
      lane: 'personal',
      laneLabel: statementLaneLabel('personal', m.channel),
      who: m.acted_by_name || '—',
      recipient: null,
      total: null,
      status: null,
      temperature: m.temperature ?? null,
      expectedPayBy: m.expected_pay_by ?? null,
      note: m.note?.trim() || null,
    })
  }
  for (const e of input.emails) {
    const log = e.resend_email_id ? logById.get(e.resend_email_id) : undefined
    const lane = laneForEmailType(log?.email_type)
    out.push({
      key: `email:${e.id}`,
      at: e.sent_at,
      kind: 'statement',
      lane,
      laneLabel: statementLaneLabel(lane),
      who: e.sent_by_name || '—',
      recipient: formatStatementRecipient(e.sent_to, e.cc_emails),
      total: Number.isFinite(e.total) ? e.total : null,
      status: log ? emailLogStatusChip(log.last_event) : null,
      temperature: null,
      expectedPayBy: null,
      note: null,
    })
  }
  out.sort((a, b) => {
    const d = new Date(b.at).getTime() - new Date(a.at).getTime()
    return Number.isNaN(d) ? 0 : d
  })
  return out.slice(0, Math.max(0, limit))
}

/** Lanes present in a history, in display order — for the modal's one-line summary ("3 by Draft Message · 2 scheduled · 4 personal"). */
export function summarizeStatementLanes(entries: ReadonlyArray<GcStatementHistoryEntry>): string {
  const counts: Record<StatementLane, number> = { personal: 0, draft_message: 0, scheduled: 0, app: 0 }
  for (const e of entries) if (e.kind === 'statement') counts[e.lane] += 1
  const parts: string[] = []
  if (counts.personal) parts.push(`${counts.personal} personal`)
  if (counts.draft_message) parts.push(`${counts.draft_message} by Draft Message`)
  if (counts.scheduled) parts.push(`${counts.scheduled} scheduled`)
  if (counts.app) parts.push(`${counts.app} app email${counts.app === 1 ? '' : 's'}`)
  return parts.join(' · ')
}
