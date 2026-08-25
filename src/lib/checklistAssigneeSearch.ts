/**
 * People search for the roadmap Add-task modal's assignee list (and any other
 * checkbox roster): filter as you type, but NEVER hide someone already
 * checked — the list must always show everything Save is about to do.
 * Pure; the modal owns the input state and renders the result.
 */

export type AssigneeSearchPerson = { id: string; name: string; email: string }

/**
 * Case-insensitive substring match on what the row DISPLAYS — the name, or
 * the email only when there's no name; empty query matches everyone.
 * Never both: matching hidden emails made "ma" hit every @gmail.com person.
 */
export function matchesPersonQuery(
  person: Pick<AssigneeSearchPerson, 'name' | 'email'>,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const label = person.name.trim() || person.email
  return label.toLowerCase().includes(q)
}

/**
 * Rows to render: everyone matching the query, plus everyone checked (kept in
 * place so selections stay visible while filtering). Order is preserved —
 * rows never jump while typing.
 */
export function visibleAssigneeRows<T extends AssigneeSearchPerson>(
  users: readonly T[],
  query: string,
  checked: Readonly<Record<string, boolean>>,
): T[] {
  return users.filter((u) => checked[u.id] === true || matchesPersonQuery(u, query))
}

/**
 * The Enter shortcut's target: defined only when the query is non-empty and
 * EXACTLY one unchecked person matches — so Enter never does anything the
 * "↵ add <name>" pill didn't announce.
 */
export function singleEnterTarget<T extends AssigneeSearchPerson>(
  users: readonly T[],
  query: string,
  checked: Readonly<Record<string, boolean>>,
): T | null {
  if (!query.trim()) return null
  const matches = users.filter((u) => checked[u.id] !== true && matchesPersonQuery(u, query))
  return matches.length === 1 ? (matches[0] ?? null) : null
}
