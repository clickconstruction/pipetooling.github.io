/** Canonical pay / hours subject: stable people.id with legacy person_name during rollout. */

export type PaySubjectRow = {
  person_name: string
  person_id?: string | null
}

/** Stable key for maps: prefer roster id. */
export function paySubjectKey(row: Pick<PaySubjectRow, 'person_id' | 'person_name'>): string {
  if (row.person_id) return row.person_id
  return row.person_name.trim()
}

/** Display label: still roster name string in UI until full person_id-only keys. */
export function paySubjectDisplayName(row: Pick<PaySubjectRow, 'person_name'>): string {
  return row.person_name.trim()
}

export function resolvePersonIdFromRosterName(
  roster: readonly { id: string; name: string; archived_at?: string | null }[],
  personName: string,
): string | null {
  const t = personName.trim()
  if (!t) return null
  const active = roster.filter((p) => !p.archived_at)
  const hits = active.filter((p) => (p.name ?? '').trim() === t)
  if (hits.length === 1) return hits[0]!.id
  return null
}
