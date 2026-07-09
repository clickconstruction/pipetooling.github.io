/**
 * Turnaway shared contract: a tech dispatched to a job finds the client absent
 * or the site not ready. PR 1 files a field report (managed 'Turnaway'
 * template) + a dispatch request; PR 2 keys the office "Create trip charge"
 * affordance off TURNAWAY_PENDING_ACTION and recovers the reason from the
 * reference_summary via parseTurnawayReason.
 */

/** Seeded by migration 20260709120000_turnaway_report_template.sql; rename-protected in DB. */
export const TURNAWAY_TEMPLATE_NAME = 'Turnaway'

/** dispatch_requests.pending_action token; de-dupes one open turnaway per job. */
export const TURNAWAY_PENDING_ACTION = 'trip_charge_turnaway'

/** dispatch_requests.title max length (DB check constraint). */
const TITLE_MAX = 2000

export const TURNAWAY_REASONS = ['client_not_home', 'site_not_ready', 'other'] as const
export type TurnawayReason = (typeof TURNAWAY_REASONS)[number]

export function turnawayReasonLabel(reason: TurnawayReason): string {
  switch (reason) {
    case 'client_not_home':
      return 'Client not home'
    case 'site_not_ready':
      return 'Site not ready'
    case 'other':
      return 'Other'
  }
}

/**
 * reports.field_values for a Turnaway. Keys MUST match the seeded
 * report_template_fields labels ('Reason', 'Note') so office report views line
 * up with the template; the value is the human label because those views
 * render field_values entries raw.
 */
export function buildTurnawayFieldValues(reason: TurnawayReason, note: string): Record<string, string> {
  return { Reason: turnawayReasonLabel(reason), Note: note.trim() }
}

/** Inbox message for the dispatch request (the title IS the message). */
export function buildTurnawayDispatchTitle(args: {
  jobLabel: string
  reason: TurnawayReason
  note: string
}): string {
  const base = `Turnaway: ${args.jobLabel} — ${turnawayReasonLabel(args.reason)}`
  const trimmedNote = args.note.trim()
  const full = trimmedNote ? `${base}. ${trimmedNote}` : base
  return full.length > TITLE_MAX ? `${full.slice(0, TITLE_MAX - 1)}…` : full
}

/**
 * dispatch_requests.reference_summary with a stable parseable prefix —
 * `Turnaway (<reason label>): <job details>` — the PR1↔PR2 contract for
 * carrying the reason to the office trip-charge modal.
 */
export function buildTurnawayReferenceSummary(
  reason: TurnawayReason,
  parts: { hcpNumber: string; jobName: string; jobAddress: string },
): string {
  const detail = [parts.hcpNumber, parts.jobName, parts.jobAddress]
    .map((s) => s.trim())
    .filter((s) => s && s !== '—')
    .join(' · ')
  const prefix = `Turnaway (${turnawayReasonLabel(reason)})`
  return detail ? `${prefix}: ${detail}` : prefix
}

/** Inverse of buildTurnawayReferenceSummary's prefix; null when unparseable. */
export function parseTurnawayReason(referenceSummary: string | null | undefined): TurnawayReason | null {
  const m = /^turnaway \(([^)]+)\)/i.exec((referenceSummary ?? '').trim())
  if (!m) return null
  const label = m[1]!.trim().toLowerCase()
  for (const r of TURNAWAY_REASONS) {
    if (turnawayReasonLabel(r).toLowerCase() === label) return r
  }
  return null
}

export function isTurnawayTemplateName(name: string): boolean {
  return name.trim().toLowerCase() === TURNAWAY_TEMPLATE_NAME.toLowerCase()
}

export function findTurnawayTemplateId(
  templates: readonly { id: string; name: string }[],
): string | undefined {
  return templates.find((t) => isTurnawayTemplateName(t.name))?.id
}
