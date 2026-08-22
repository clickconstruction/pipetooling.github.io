/**
 * Send-back reason notes (v2.2065). When the office sends a Ready-to-bill job
 * back to Working, the crew's 100% "vanishes" from their My Schedule card with
 * no explanation — the field's read is "the app ignored my report" (Abraham,
 * 2026-08-21). The reason captured at send-back time becomes a jobs_ledger
 * thread note in a fixed, parseable body format (same pattern as the
 * "N% complete — <note>" notes in stagesPctNote.ts), so Job activity records
 * it and the My Schedule card can show the crew who sent the job back and why.
 *
 * Body format: `Sent back to Working — <reason>`. The prefix is the contract:
 * parseSendBackNoteBody and the My Schedule fetch (`like` filter) both key on
 * it — change it only with a migration plan for existing notes.
 */

export const JOB_SEND_BACK_NOTE_PREFIX = 'Sent back to Working — '

/** Max note body length, mirroring set_job_pct_from_field's cap. */
const MAX_BODY = 2000

/** Null when the reason is enough to save; otherwise the inline error to show. */
export function sendBackReasonError(reason: string): string | null {
  const r = reason.trim()
  if (r.length === 0) return 'Say why this is going back — the crew sees this.'
  if (r.length < 5) return 'A few words, so the crew knows what to do differently.'
  return null
}

export function composeSendBackNoteBody(reason: string): string {
  return (JOB_SEND_BACK_NOTE_PREFIX + reason.trim()).slice(0, MAX_BODY)
}

/** The reason out of a send-back note body, or null when the body is not one. */
export function parseSendBackNoteBody(body: string): string | null {
  if (!body.startsWith(JOB_SEND_BACK_NOTE_PREFIX)) return null
  const reason = body.slice(JOB_SEND_BACK_NOTE_PREFIX.length).trim()
  return reason.length > 0 ? reason : null
}

const SHOW_SEND_BACK_MAX_AGE_DAYS = 14

export type SendBackCardLine = {
  /** Trimmed reason text. */
  reason: string
  /** Display name of who sent it back ('' when unknown). */
  byName: string
}

/**
 * Whether a schedule card should carry the "Sent back" line: only while the
 * job is still Working (the line's job is done once the job moves again) and
 * the send-back is recent enough to still be the reason the job is back on
 * the crew's plate. Pure — callers pass the newest send-back note.
 */
export function sendBackLineForCard(input: {
  jobStatus: string | null
  noteBody: string
  noteCreatedAtIso: string
  byName: string | null
  nowIso: string
}): SendBackCardLine | null {
  if (input.jobStatus !== 'working') return null
  const reason = parseSendBackNoteBody(input.noteBody)
  if (reason == null) return null
  const created = Date.parse(input.noteCreatedAtIso)
  const now = Date.parse(input.nowIso)
  if (Number.isNaN(created) || Number.isNaN(now)) return null
  const ageDays = (now - created) / 86_400_000
  if (ageDays < 0 || ageDays > SHOW_SEND_BACK_MAX_AGE_DAYS) return null
  return { reason, byName: (input.byName ?? '').trim() }
}
