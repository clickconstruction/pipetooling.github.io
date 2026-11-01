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
  /** The photos on the report (punch list #229, PR 2): dispatch reads *· 1 photo on the report* and opens it. */
  photos?: number
}): string {
  const base = `Turnaway: ${args.jobLabel} — ${turnawayReasonLabel(args.reason)}`
  const trimmedNote = args.note.trim()
  const withNote = trimmedNote ? `${base}. ${trimmedNote}` : base
  const n = args.photos ?? 0
  const full = n > 0 ? `${withNote} · ${n === 1 ? '1 photo' : `${n} photos`} on the report` : withNote
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

/**
 * The File Turnaway press's words (punch list #229, PR 2): what it files, with the photos riding; a shot still on
 * its way reads *Sending 1 photo…* and the press waits, as the field report's Save does.
 */
export function turnawayFileWords(input: { photos: number; inFlight: number; saving: boolean }): string {
  if (input.saving) return 'Filing…'
  if (input.inFlight > 0) return input.inFlight === 1 ? 'Sending 1 photo…' : `Sending ${input.inFlight} photos…`
  if (input.photos > 0) return `File Turnaway · ${input.photos === 1 ? '1 photo' : `${input.photos} photos`}`
  return 'File Turnaway'
}
