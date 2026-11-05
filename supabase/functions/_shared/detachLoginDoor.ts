/**
 * The detach door (punch list #266, v2.6532): a person's sign-in taken away while the person stays. The auth account is
 * deleted by the row's id; `on_auth_user_deleted` (v2.6511) clears `users.login_attached_at`, and every row that points
 * at the person — clock sessions, Charged as, pay, paperwork, the People record — stays where it is. This is the pure
 * part: which rows are refused and why.
 */

export type DetachCandidate = {
  id: string
  name: string | null
  login_attached_at: string | null
  is_sample: boolean | null
  is_digital_twin: boolean | null
}

export type DetachRefusal = { status: number; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The id the body names, trimmed and shaped like one; a refusal otherwise. */
export function detachUserIdOf(body: { user_id?: unknown }): { userId: string } | DetachRefusal {
  const id = typeof body.user_id === 'string' ? body.user_id.trim() : ''
  if (!id) return { status: 400, error: 'Missing required field: user_id' }
  if (!UUID.test(id)) return { status: 400, error: 'user_id must be a uuid' }
  return { userId: id }
}

/** A refusal once the row is read: no row, no login to take away, the caller's own, a fixture account. */
export function detachRowRefusal(row: DetachCandidate | null, callerId: string): DetachRefusal | null {
  if (!row) return { status: 404, error: 'No person with that id' }
  const who = row.name ?? 'This person'
  if (row.id === callerId) return { status: 400, error: 'You cannot remove your own login.' }
  if (row.is_sample || row.is_digital_twin) return { status: 400, error: 'A sample or a twin keeps its login; retire it from its own door.' }
  if (!row.login_attached_at) return { status: 400, error: `${who} has no login to remove.` }
  return null
}

/** What goes and what stays, for the confirm and the answer. */
export const DETACH_WORDS = {
  goes: 'the sign-in, any password, and their push devices',
  stays: 'the person, their hours, Charged as, pay, paperwork and portal',
} as const
