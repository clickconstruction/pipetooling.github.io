/**
 * /accept-invite arming kernel (v2.2837 — J24-F1/N3).
 *
 * The set-password form on /accept-invite used to arm on *any* live session, so a hire
 * re-opening the bare URL from history (or any signed-in user wandering there) got a form
 * that silently reset the current account's password. The page now arms only when the
 * session arrived through the invite:
 *
 * - The invite email lands with `#access_token=…&type=invite` (supabase-js consumes and
 *   clears that hash asynchronously). `markInvitePendingFromHash` runs before that in
 *   `main.tsx` and remembers the arrival in sessionStorage (`accept_invite_pending`).
 * - `resolveAcceptInviteState` turns (session?, invite hash?, pending flag?, error hash?)
 *   into one of four views. A live session with no invite evidence is "already set up".
 * - The flag is cleared once the password is set.
 */

export const ACCEPT_INVITE_PENDING_KEY = 'accept_invite_pending'

export type AcceptInviteView = 'set-password' | 'already-set-up' | 'invalid-link' | 'loading'

export interface AcceptInviteHash {
  /** `type=invite` (or `type=signup`) with an access token — the link the invite email sends. */
  inviteHashPresent: boolean
  /** Supabase's dead/used-link redirect: `error=access_denied` / `error_code=otp_expired`. */
  errorHash: boolean
  accessToken: string | null
  refreshToken: string | null
  type: string | null
}

const INVITE_TYPES = new Set(['invite', 'signup'])

/** Pure: read the invite-relevant facts out of a `window.location.hash` string (with or without the leading `#`). */
export function parseAcceptInviteHash(hash: string): AcceptInviteHash {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const type = params.get('type')
  const accessToken = params.get('access_token')
  const errorHash = params.get('error_code') === 'otp_expired' || params.get('error') === 'access_denied'
  return {
    inviteHashPresent: !!accessToken && !!type && INVITE_TYPES.has(type),
    errorHash,
    accessToken,
    refreshToken: params.get('refresh_token'),
    type,
  }
}

export interface AcceptInviteStateInput {
  /** `null` while the session check is still running. */
  hasSession: boolean | null
  inviteHashPresent: boolean
  pendingInviteFlag: boolean
  errorHash: boolean
}

/**
 * Pure: which view /accept-invite shows.
 *
 * | hash            | flag | session | view            |
 * |-----------------|------|---------|-----------------|
 * | error           | no   | any     | invalid-link    |
 * | error           | yes  | null    | loading         |
 * | error           | yes  | yes     | set-password    | (their live session IS the invite session — J24-N3)
 * | error           | yes  | no      | invalid-link    |
 * | invite / none   | any  | null    | loading         |
 * | invite / none   | any  | no      | invalid-link    |
 * | invite          | any  | yes     | set-password    |
 * | none            | yes  | yes     | set-password    |
 * | none            | no   | yes     | already-set-up  | (J24-F1: the bare-URL revisit)
 */
export function resolveAcceptInviteState(input: AcceptInviteStateInput): AcceptInviteView {
  const { hasSession, inviteHashPresent, pendingInviteFlag, errorHash } = input
  if (errorHash) {
    if (!pendingInviteFlag) return 'invalid-link'
    if (hasSession === null) return 'loading'
    return hasSession ? 'set-password' : 'invalid-link'
  }
  if (hasSession === null) return 'loading'
  if (!hasSession) return 'invalid-link'
  if (inviteHashPresent || pendingInviteFlag) return 'set-password'
  return 'already-set-up'
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** sessionStorage, or null where the accessor itself throws (privacy modes, some embeds). */
export function safeSessionStorage(): StorageLike | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null
  } catch {
    return null
  }
}

/** Remember an invite arrival. Returns true when the hash was an invite hash and the flag was set. */
export function markInvitePendingFromHash(hash: string, storage: StorageLike | null): boolean {
  if (!parseAcceptInviteHash(hash).inviteHashPresent) return false
  try {
    storage?.setItem(ACCEPT_INVITE_PENDING_KEY, '1')
    return !!storage
  } catch {
    return false
  }
}

export function readInvitePending(storage: StorageLike | null): boolean {
  try {
    return storage?.getItem(ACCEPT_INVITE_PENDING_KEY) === '1'
  } catch {
    return false
  }
}

export function clearInvitePending(storage: StorageLike | null): void {
  try {
    storage?.removeItem(ACCEPT_INVITE_PENDING_KEY)
  } catch {
    /* best effort */
  }
}
