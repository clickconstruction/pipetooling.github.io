/**
 * The attach door of `create-user` (punch list #260, v2.6518; lifted here in v2.6528, #264): a users row with no
 * login behind it gets the auth account created ON its own id, so nothing that points at the person moves. This
 * is the pure part — what the body may name, which rows are refused and why, and which address, password, role
 * and name the create runs with — so the function reads as three doors and the rules test on their own.
 */

export type AttachCandidate = {
  id: string
  name: string | null
  role: string
  email: string | null
  login_attached_at: string | null
  is_sample: boolean | null
  is_digital_twin: boolean | null
  archived_at: string | null
}

export type AttachRefusal = { status: number; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The id the body names, trimmed; null when the body names none. */
export function attachUserIdOf(body: { user_id?: unknown }): string | null {
  return typeof body.user_id === 'string' && body.user_id.trim() ? body.user_id.trim() : null
}

/** A refusal before the row is read: a malformed id, or two doors at once. */
export function attachRequestRefusal(userId: string, trialProspectId: string | null): AttachRefusal | null {
  if (trialProspectId) return { status: 400, error: 'user_id and trial_prospect_id do not go together' }
  if (!UUID.test(userId)) return { status: 400, error: 'user_id must be a uuid' }
  return null
}

/** A refusal once the row is read: no row, a login already there, a fixture account, an archived person. */
export function attachRowRefusal(row: AttachCandidate | null): AttachRefusal | null {
  if (!row) return { status: 404, error: 'No person with that id' }
  const who = row.name ?? 'This person'
  if (row.login_attached_at) return { status: 400, error: `${who} already has a login.` }
  if (row.is_sample || row.is_digital_twin) return { status: 400, error: 'A sample or a twin gets its login from its own door.' }
  if (row.archived_at) return { status: 400, error: `${who} is archived. Restore them first.` }
  return null
}

/**
 * What the create runs with on the attach door: the body's address, else the row's own; the body's password, else
 * none (the caller mints an unguessable one and sends the sign-in email); the row's role and name, never the body's.
 */
export function attachDoorFields(row: AttachCandidate, body: { email?: unknown; password?: unknown }): { email: string; password: string | null; role: string; name: string | undefined } {
  const bodyEmail = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : ''
  const password = typeof body.password === 'string' && body.password ? body.password : null
  return { email: bodyEmail || (row.email ?? ''), password, role: row.role, name: row.name ?? undefined }
}

/** GoTrue answers a taken id with a database error; the words a dev reads instead. */
export function attachCreateRefusal(message: string): AttachRefusal | null {
  return /database error/i.test(message) ? { status: 409, error: 'A login already stands behind that id.' } : null
}
