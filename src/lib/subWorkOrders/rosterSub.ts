/**
 * The crew-vs-sub rule (Work Orders one-row spine, PR 1): a roster row is a
 * sub when it is kind `sub` and has no login or a subcontractor login.
 * Teammates carry kind `sub` too (superintendent logins) — the account role
 * is what tells them apart. Lives alone so the sheet-party and outstanding
 * kernels can share it without an import cycle.
 */
export type NeedsWorkOrderRosterPerson = {
  id: string
  name: string
  kind: string
  /** `users.role` behind `people.account_user_id`; null when the person has no login. */
  accountRole?: string | null
}

export function isRosterSub(p: Pick<NeedsWorkOrderRosterPerson, 'kind' | 'accountRole'> | undefined): boolean {
  if (!p || p.kind !== 'sub') return false
  const role = (p.accountRole ?? '').trim()
  return role === '' || role === 'subcontractor'
}
