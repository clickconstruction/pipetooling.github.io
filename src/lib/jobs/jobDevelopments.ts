/**
 * Developments on jobs (v2.1199) — pure helpers for the Edit Job Development
 * picker. A development is a named group of jobs (public.developments); jobs
 * link via jobs_ledger.development_id. Same cross-master protection idiom as
 * resolveGcCustomerIdForJobPayload (jobLedgerCustomer.ts).
 */

/** The developments columns the Edit Job form loads. */
export type JobFormDevelopmentRow = {
  id: string
  name: string | null
  master_user_id: string
  archived_at: string | null
}

/**
 * Cross-master protection for the job's development link. A development is
 * only ever an explicit pick — no name to re-resolve by — so a pick owned by a
 * DIFFERENT master drops to null (the DB backstop trigger would reject it
 * anyway). A pick not present in the supplied list is trusted, mirroring
 * resolveGcCustomerIdForJobPayload.
 */
export function resolveDevelopmentIdForJobPayload(
  explicitId: string | null,
  jobMasterUserId: string,
  developments: JobFormDevelopmentRow[],
): string | null {
  if (!explicitId) return null
  const explicit = developments.find((d) => d.id === explicitId)
  if (!explicit || explicit.master_user_id === jobMasterUserId) return explicitId
  return null
}

/**
 * Options for the Development select: active (un-archived) developments,
 * name-sorted. The currently linked development is kept even when archived
 * (or owned elsewhere), so an existing link never renders as a bare id.
 */
export function developmentPickerOptions(
  developments: JobFormDevelopmentRow[],
  currentDevelopmentId: string | null,
): Array<{ id: string; name: string }> {
  const byId = new Map<string, string>()
  for (const d of developments) {
    if (d.archived_at && d.id !== currentDevelopmentId) continue
    if (!byId.has(d.id)) byId.set(d.id, (d.name ?? '').trim() || '—')
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

/**
 * Validation for the inline "+ New development" create: trimmed non-empty name
 * that doesn't collide (case-insensitively) with an ACTIVE development. Returns
 * the trimmed name to insert, or an error string.
 */
export function validateNewDevelopmentName(
  raw: string,
  developments: JobFormDevelopmentRow[],
): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim()
  if (!name) return { ok: false, error: 'Type a development name first.' }
  const key = name.toLowerCase()
  const clash = developments.find((d) => !d.archived_at && (d.name ?? '').trim().toLowerCase() === key)
  if (clash) return { ok: false, error: `"${(clash.name ?? '').trim()}" already exists — pick it from the list.` }
  return { ok: true, name }
}
