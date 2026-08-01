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

// ---------------------------------------------------------------------------
// Settings → Manage developments (v2.1216)
// ---------------------------------------------------------------------------

/**
 * Rename validation: same active-name clash rule as create, but the renamed
 * development itself is excluded (renaming only its casing is fine). Archived
 * rows never clash — the partial unique index ignores them.
 */
export function validateRenameDevelopment(
  developmentId: string,
  raw: string,
  developments: JobFormDevelopmentRow[],
): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim()
  if (!name) return { ok: false, error: 'A development needs a name.' }
  const key = name.toLowerCase()
  const clash = developments.find(
    (d) => d.id !== developmentId && !d.archived_at && (d.name ?? '').trim().toLowerCase() === key,
  )
  if (clash) return { ok: false, error: `"${(clash.name ?? '').trim()}" already exists.` }
  return { ok: true, name }
}

/**
 * Un-archiving re-enters the active-name namespace, so it can collide with an
 * active development created since. Returns the clashing active row, or null
 * when un-archiving is safe.
 */
export function developmentUnarchiveClash(
  dev: JobFormDevelopmentRow,
  developments: JobFormDevelopmentRow[],
): JobFormDevelopmentRow | null {
  const key = (dev.name ?? '').trim().toLowerCase()
  return (
    developments.find(
      (d) => d.id !== dev.id && !d.archived_at && (d.name ?? '').trim().toLowerCase() === key,
    ) ?? null
  )
}

/** Active and archived lists, each name-sorted, for the Settings block (input row type preserved). */
export function sortDevelopmentsForSettings<T extends JobFormDevelopmentRow>(developments: T[]): {
  active: T[]
  archived: T[]
} {
  const byName = (a: T, b: T) =>
    ((a.name ?? '').trim() || '—').localeCompare((b.name ?? '').trim() || '—', undefined, { sensitivity: 'base' })
  return {
    active: developments.filter((d) => !d.archived_at).sort(byName),
    archived: developments.filter((d) => !!d.archived_at).sort(byName),
  }
}

/** development_id → linked-job count, from a bare `jobs_ledger.development_id` column pull. */
export function buildDevelopmentJobCountMap(rows: Array<{ development_id: string | null }>): Map<string, number> {
  const map = new Map<string, number>()
  for (const r of rows) {
    if (!r.development_id) continue
    map.set(r.development_id, (map.get(r.development_id) ?? 0) + 1)
  }
  return map
}
