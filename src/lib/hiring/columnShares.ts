/**
 * Hiring column share, PR 5 (to-dos/helper-tryout-loop): who a column can be shared with, the
 * chip on the header, and the line under the Hiring switch in Settings → Active accounts.
 *
 * The rule itself lives in the database (`team_prospect_role_shares`, `user_hiring_shared_role_ids()`,
 * v2.3798). This only decides what to list and what to say. Pure: no React, no supabase.
 */
import { formatDenverCalendarDayShort } from '../../utils/dateUtils'

export type ColumnShare = {
  role_id: string
  user_id: string
  shared_by: string | null
  created_at: string | null
}

export type ShareableAccount = {
  id: string
  name: string | null
  role: string
  estimator_prospects_access?: boolean | null
  team_prospects_access?: boolean | null
  archived_at?: string | null
  is_sample?: boolean | null
}

const PROSPECTS_STAFF_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller'])

/** The client twin of `user_has_prospects_staff_access()`. */
export function hasProspectsStaffAccess(u: Pick<ShareableAccount, 'role' | 'estimator_prospects_access'>): boolean {
  if (PROSPECTS_STAFF_ROLES.has(u.role)) return true
  return u.role === 'estimator' && Boolean(u.estimator_prospects_access)
}

/**
 * Who *Share with…* lists: accounts with prospects staff access and without the Hiring switch —
 * full holders already see everything, and a share to anyone else grants nothing. Archived and
 * sample accounts are left out. Sorted by name.
 */
export function shareableAccounts<T extends ShareableAccount>(users: readonly T[]): T[] {
  return users
    .filter((u) => hasProspectsStaffAccess(u) && !u.team_prospects_access && !u.archived_at && !u.is_sample)
    .sort((a, b) => displayName(a).localeCompare(displayName(b)))
}

export function displayName(u: Pick<ShareableAccount, 'name' | 'id'>): string {
  return (u.name ?? '').trim() || 'Unnamed account'
}

/** The shares on one column. */
export function sharesForColumn(shares: readonly ColumnShare[], roleId: string): ColumnShare[] {
  return shares.filter((s) => s.role_id === roleId)
}

/** The header chip: `shared with 2`, or null when the column is not shared. */
export function sharedWithChip(shares: readonly ColumnShare[], roleId: string): string | null {
  const n = sharesForColumn(shares, roleId).length
  return n === 0 ? null : `shared with ${n}`
}

/** `shared by Todd, Sep 18` under a ticked name; `shared` when the sharer is unknown. */
export function sharedByLine(share: ColumnShare, nameOf: (userId: string) => string | null): string {
  const who = share.shared_by ? nameOf(share.shared_by) : null
  const when = share.created_at ? formatDenverCalendarDayShort(new Date(share.created_at).getTime()) : null
  if (who && when) return `shared by ${who}, ${when}`
  if (who) return `shared by ${who}`
  if (when) return `shared ${when}`
  return 'shared'
}

/**
 * The Active accounts line for one account: `Plumber · HVAC Tech — by Todd, Sep 18`, columns in
 * board order, the sharer and day of the latest share; null when nothing is shared with them.
 */
export function sharedColumnsLine(
  userId: string,
  shares: readonly ColumnShare[],
  roles: ReadonlyArray<{ id: string; name: string }>,
  nameOf: (userId: string) => string | null,
): string | null {
  const mine = shares.filter((s) => s.user_id === userId)
  if (mine.length === 0) return null
  const byRole = new Map(mine.map((s) => [s.role_id, s]))
  const names = roles.filter((r) => byRole.has(r.id)).map((r) => r.name)
  // A share on a column the viewer cannot name (deleted between reads) still counts.
  const unnamed = mine.length - names.length
  const columns = [...names, ...(unnamed > 0 ? [`${unnamed} more`] : [])].join(' · ')
  const latest = [...mine].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0]
  const who = latest?.shared_by ? nameOf(latest.shared_by) : null
  const when = latest?.created_at ? formatDenverCalendarDayShort(new Date(latest.created_at).getTime()) : null
  const tail = who && when ? ` — by ${who}, ${when}` : who ? ` — by ${who}` : when ? ` — ${when}` : ''
  return `${columns}${tail}`
}
