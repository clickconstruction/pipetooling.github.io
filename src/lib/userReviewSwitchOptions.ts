import type { SearchableSelectSelectableOption } from '../components/SearchableSelect'

export type SwitchableUser = {
  id: string
  name: string
}

/**
 * Builds the option list for the User Review switch-user modal's
 * `SearchableSelect`.
 *
 * - Omits the current subject (`currentUserId`) — the dropdown is
 *   "people you could switch to", and the modal title already shows who
 *   you're currently viewing. `SearchableSelect` doesn't support
 *   per-option disabled, so omission is the cleanest way to mark the
 *   current user as not-a-destination.
 * - Skips rows with empty / whitespace-only names so the picker never
 *   shows a blank-labelled option (would also break the substring
 *   search in `SearchableSelect.filterSearchableSelectOptionsByQuery`).
 * - Sorts by `name` asc case-insensitive; deterministic tiebreak on `id`
 *   asc so the order is stable across reloads and tests.
 */
export function buildSwitchUserOptions(
  roster: ReadonlyArray<SwitchableUser>,
  currentUserId: string,
): SearchableSelectSelectableOption[] {
  const out: SearchableSelectSelectableOption[] = []
  for (const u of roster) {
    if (!u.id || u.id === currentUserId) continue
    const label = (u.name ?? '').trim()
    if (!label) continue
    out.push({ value: u.id, label })
  }
  out.sort((a, b) => {
    const an = a.label.toLowerCase()
    const bn = b.label.toLowerCase()
    if (an !== bn) return an < bn ? -1 : 1
    return a.value < b.value ? -1 : 1
  })
  return out
}
