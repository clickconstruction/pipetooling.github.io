export type DispatchSettingsRosterRow = {
  userId: string
  displayName: string
}

export type DispatchSettingsPeopleSearchResult = {
  value: string
  label: string
}

/**
 * Case-insensitive substring filter over the Dispatch Settings people roster.
 *
 * Empty / whitespace-only queries return no results — the calling picker enforces a min-length
 * gate, so this helper does not need to short-circuit on its own. The result order preserves
 * the roster's incoming order (alphabetical by `displayName` as built upstream).
 */
export function filterRosterByQuery(
  roster: DispatchSettingsRosterRow[],
  query: string,
  max: number,
): DispatchSettingsPeopleSearchResult[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return []
  if (max <= 0) return []
  const out: DispatchSettingsPeopleSearchResult[] = []
  for (const row of roster) {
    const name = row.displayName ?? ''
    if (name.toLowerCase().includes(trimmed)) {
      out.push({ value: row.userId, label: name })
      if (out.length >= max) break
    }
  }
  return out
}
