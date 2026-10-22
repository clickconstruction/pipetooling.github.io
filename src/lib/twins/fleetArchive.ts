/**
 * Archive and restore a twin from the fleet card (Settings → System → Digital twins & samples, v2.5741). A twin that is
 * done, a second estimator seat that never ran, leaves the fleet the way any account does: `archive-user` bans its
 * sign-in and stamps `archived_at`, reversible with `restore-user`. The fleet card hid nothing before this: a dev's
 * `users` read includes archived rows, so an archived twin kept its row. Now the live rows and an archived fold are
 * split here, the confirm's words come from here, and the twin's live keys are revoked first so no Mac or harness
 * keeps running it. Its runs, shadows and bids stay. Pure.
 */
import { archiveRequestBody, type ArchiveRequestBody } from '../archiveUserDialog'

export interface FleetTwin {
  id: string
  name: string | null
  email: string
  archived_at: string | null
}

export interface FleetKey {
  id: string
  twin_user_id: string
  revoked_at: string | null
}

export interface ConfirmWords {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  danger: boolean
  cancelIsSafe: boolean
}

const nameOf = (t: FleetTwin) => (t.name ?? '').trim() || t.email

/** The fleet in two: the live rows by email, and the archived fold newest first. */
export function splitFleet<T extends FleetTwin>(twins: readonly T[]): { live: T[]; archived: T[] } {
  const live = twins.filter((t) => !t.archived_at).sort((a, b) => a.email.localeCompare(b.email))
  const archived = twins.filter((t) => !!t.archived_at).sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? ''))
  return { live, archived }
}

/** The twin's keys still live: the ones archiving revokes first. */
export function liveKeysOf<K extends FleetKey>(keys: readonly K[], twinId: string): K[] {
  return keys.filter((k) => k.twin_user_id === twinId && !k.revoked_at)
}

/** The confirm before archiving: what goes, what stays, and that Restore brings it back. */
export function archiveTwinConfirm(twin: FleetTwin, liveKeys: number): ConfirmWords {
  const keys = liveKeys === 0 ? 'No key is live.' : liveKeys === 1 ? 'Its one live key is revoked first, so no Mac or harness can run it.' : `Its ${liveKeys} live keys are revoked first, so no Mac or harness can run it.`
  return {
    title: `Archive ${nameOf(twin)}?`,
    message: `${keys} Its runs, shadows and bids stay. Restore brings it back, under the fleet.`,
    confirmLabel: 'Archive',
    cancelLabel: 'Keep it',
    danger: true,
    cancelIsSafe: true,
  }
}

/** The confirm before restoring: it comes back with no key. */
export function restoreTwinConfirm(twin: FleetTwin): ConfirmWords {
  return {
    title: `Restore ${nameOf(twin)}?`,
    message: 'It comes back to the fleet with no live key. Issue a key or Set up on this Mac to run it again.',
    confirmLabel: 'Restore',
    cancelLabel: 'Leave it',
    danger: false,
    cancelIsSafe: true,
  }
}

/** The `archive-user` body: the account by email and name, no customers to move (a twin owns none). */
export function archiveTwinBody(twin: FleetTwin): ArchiveRequestBody {
  return archiveRequestBody({ email: twin.email, name: twin.name }, 0, 'keep', '')
}

/** The fold's label under the fleet. */
export function archivedFoldWords(count: number): string {
  return count === 1 ? '1 archived' : `${count} archived`
}

/** A row in the fold: when it was archived, as a day. */
export function archivedOnWords(twin: FleetTwin, tz: string): string {
  if (!twin.archived_at) return ''
  const day = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(twin.archived_at))
  return `archived ${day}`
}

/** The toast after each. */
export const ARCHIVED_TOAST = (twin: FleetTwin, revoked: number): string =>
  revoked === 0 ? `Archived ${nameOf(twin)}. Restore is under the fleet.` : `Archived ${nameOf(twin)} and revoked ${revoked} key${revoked === 1 ? '' : 's'}. Restore is under the fleet.`
export const RESTORED_TOAST = (twin: FleetTwin): string => `Restored ${nameOf(twin)}. It has no live key yet.`
