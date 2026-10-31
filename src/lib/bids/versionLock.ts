/**
 * A locked bid version (v2.6234; the owner: *in versioning a user should have the option to lock down that
 * version so only they can edit, if they choose; this should definitely not be enabled by default*). A
 * version has an owner, the person who made or adopted it; the owner may lock it so only they write its
 * counts, takeoff, prices, CountTooling projects and plan sets. A dev or a master may unlock it. The
 * database holds the rule (a guard trigger); this kernel holds who sees which press and the words. Pure.
 */
export type LockableVersion = { id: string; name: string; owner_user_id?: string | null; locked_by?: string | null; locked_at?: string | null }

export type LockRole = string | null | undefined

/** Dev and master may lock or unlock any version; everyone else only their own. */
export function mayOverrideLock(role: LockRole): boolean {
  return role === 'dev' || role === 'master_technician'
}

/** Who may press Lock on a version that is open: its owner, a dev or a master. */
export function mayLock(v: Pick<LockableVersion, 'owner_user_id' | 'locked_by'>, userId: string | null | undefined, role: LockRole): boolean {
  if (v.locked_by) return false
  return mayOverrideLock(role) || (!!userId && v.owner_user_id === userId)
}

/** Who may press Unlock: the one who locked it, its owner, a dev or a master. */
export function mayUnlock(v: Pick<LockableVersion, 'owner_user_id' | 'locked_by'>, userId: string | null | undefined, role: LockRole): boolean {
  if (!v.locked_by) return false
  return mayOverrideLock(role) || (!!userId && (v.locked_by === userId || v.owner_user_id === userId))
}

/** True when this person's writes to the version would be refused. */
export function lockBlocks(v: Pick<LockableVersion, 'locked_by'>, userId: string | null | undefined, role: LockRole): boolean {
  return !!v.locked_by && v.locked_by !== userId && !mayOverrideLock(role)
}

/** The badge's words: *Locked · William* or, for the holder, *Locked · you*. */
export function lockBadgeWords(v: Pick<LockableVersion, 'locked_by'>, userId: string | null | undefined, nameOf: (id: string) => string | null | undefined): string {
  if (!v.locked_by) return ''
  return v.locked_by === userId ? 'Locked · you' : `Locked · ${nameOf(v.locked_by) ?? 'someone'}`
}

/** The badge's title for someone else: who to ask. */
export function lockTitleWords(v: Pick<LockableVersion, 'locked_by'>, userId: string | null | undefined, nameOf: (id: string) => string | null | undefined): string {
  if (!v.locked_by) return ''
  if (v.locked_by === userId) return 'Only you edit this version. Press Unlock to let others in.'
  return `${nameOf(v.locked_by) ?? 'Someone'} locked this version. Only they edit it. Ask them, or a master, to unlock it.`
}

/** The lock press's title: what it will do. */
export const LOCK_PRESS_TITLE = 'Lock this version so only you edit its counts, takeoff, prices, projects and plan sets. Others still read it, and a master can unlock it.'
export const UNLOCK_PRESS_TITLE = 'Unlock this version so anyone with the bid can edit it again.'
