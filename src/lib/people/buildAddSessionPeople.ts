export type AddSessionPersonOption = { value: string; label: string }

/**
 * Build SearchableSelect options for the "add clock session" person picker on
 * People → Hours: every Hours person (by name) that maps to a real user account.
 *
 * A clock session needs a `user_id`, so:
 * - Names with no matching user are dropped.
 * - On duplicate user names, the first user wins (names are effectively unique;
 *   the day-audit modal resolves name → user via `.eq('name', …).maybeSingle()`).
 * - Each Hours name appears at most once; result is sorted by label (case-insensitive).
 */
export function buildAddSessionPeople(
  peopleNames: readonly string[],
  users: readonly { id: string; name: string }[],
): AddSessionPersonOption[] {
  const userIdByName = new Map<string, string>()
  for (const u of users) {
    if (!u?.id || !u.name) continue
    if (!userIdByName.has(u.name)) userIdByName.set(u.name, u.id)
  }

  const seenNames = new Set<string>()
  const options: AddSessionPersonOption[] = []
  for (const name of peopleNames) {
    if (seenNames.has(name)) continue
    const userId = userIdByName.get(name)
    if (!userId) continue
    seenNames.add(name)
    options.push({ value: userId, label: name })
  }

  options.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return options
}
