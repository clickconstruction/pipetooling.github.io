/**
 * A roster row whose linked account is archived (v2.8467, a gap punch list #389's walk found). The account's own
 * archive mark says the person has left, and the dev seat already writes no sheet for them
 * (`_shared/devMcpSubLabor.ts`). The Sub Labor sheet form read only the roster row's own mark, so it still offered
 * them. These say which accounts to ask about, which of them have left, and mark each row with the answer. Pure.
 */

type Linked = { account_user_id?: string | null }

/** The accounts the roster rows are linked to, each once. */
export function linkedAccountIds(rows: readonly Linked[]): string[] {
  return [...new Set(rows.map((r) => (r.account_user_id ?? '').trim()).filter((id) => id !== ''))]
}

/**
 * The linked accounts that have left: the ones asked about that are not among the live ones the reader can see.
 * An archived account is closed to the office by row security, so it is known by its absence, never read. A reader
 * who sees no linked account at all (a failed read, a role the accounts are closed to) is told nothing: nobody has left.
 */
export function accountsThatLeft(asked: readonly string[], liveIds: Iterable<string>): string[] {
  const live = new Set(liveIds)
  if (!asked.some((id) => live.has(id))) return []
  return asked.filter((id) => !live.has(id))
}

/** Each row with `account_archived`: true when its linked account is one of the archived ones. A row with no account is false. */
export function withAccountArchived<T extends Linked>(rows: readonly T[], archivedAccountIds: Iterable<string>): (T & { account_archived: boolean })[] {
  const gone = new Set(archivedAccountIds)
  return rows.map((r) => ({ ...r, account_archived: Boolean(r.account_user_id && gone.has(r.account_user_id)) }))
}

/** True when a roster row is not offered for a new sheet because its account is archived. */
export function accountHasLeft(row: { account_archived?: boolean | null }): boolean {
  return row.account_archived === true
}
