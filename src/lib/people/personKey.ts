/**
 * Person Desk identity spine.
 *
 * One human can be up to three rows: a login account (`users.id`), a roster
 * row (`people.id`), and a pay identity (the trimmed name that
 * `people_pay_config`, `people_hours`, pay stubs, offsets and licenses key on).
 * No column joins all three, and a person may legitimately have only one or
 * two of them. The Desk therefore keys on this record, resolved once when it
 * opens, and every section declares which field it needs. A missing field is
 * not an error: it is a "gap", and the header turns each gap into the one
 * button that creates it (never silently — see docs/recent-features for the
 * owner decision).
 */

export type PersonKeyUserRow = {
  id: string
  name: string | null
  email: string | null
  role: string | null
  archived_at: string | null
  read_only?: boolean | null
  last_sign_in_at?: string | null
}

export type PersonKeyPersonRow = {
  id: string
  name: string
  email: string | null
  kind: string
  archived_at: string | null
  account_user_id: string | null
}

export type PersonGap =
  /** No `people` row: HR file, portal, compliance docs, work orders and employment dates cannot exist. */
  | 'no_roster_row'
  /** No `users` row: sessions, schedule, team lead, vehicle, housing, write-ups cannot exist. */
  | 'no_login'
  /** A roster row shares the account's email but `account_user_id` is null — two identities until linked. */
  | 'unlinked_email_match'
  /** Account name and roster name differ; pay tables key on the account name, so joins can split. */
  | 'pay_name_mismatch'
  /** No `people_pay_config` row under the pay name — no wage, no pay report. */
  | 'no_pay_config'

export type PersonKey = {
  userId: string | null
  personId: string | null
  /** Trimmed account name when an account exists (pay identity keys on `users.name`), else the roster name. */
  payName: string | null
  displayName: string
  email: string | null
  role: string | null
  personKind: string | null
  archived: boolean
  isSub: boolean
  gaps: PersonGap[]
  /** Set with the `unlinked_email_match` gap: the roster row a Link would attach. */
  emailMatchedPersonId: string | null
  emailMatchedPersonName: string | null
  rosterName: string | null
}

export type ResolvePersonKeyInput = {
  user: PersonKeyUserRow | null
  person: PersonKeyPersonRow | null
  /** A roster row matched by email only (account_user_id null) when `person` is null. */
  emailMatchedPerson?: PersonKeyPersonRow | null
  /** Pay-config names visible to the caller, or null when the caller cannot read the table (no gap is raised then). */
  payConfigNames: readonly string[] | null
}

/** Roles that never carry pay config — a missing row is not a gap for them. */
const NO_PAY_ROLES = new Set(['primary'])
const NO_PAY_KINDS = new Set(['primary'])

function trimOrNull(s: string | null | undefined): string | null {
  const t = (s ?? '').trim()
  return t ? t : null
}

export function resolvePersonKey(input: ResolvePersonKeyInput): PersonKey {
  const user = input.user
  const person = input.person
  const emailMatch = !person && input.emailMatchedPerson && !input.emailMatchedPerson.account_user_id ? input.emailMatchedPerson : null

  const userName = trimOrNull(user?.name)
  const rosterName = trimOrNull(person?.name)
  const payName = userName ?? rosterName
  const role = trimOrNull(user?.role)
  const personKind = trimOrNull(person?.kind) ?? trimOrNull(emailMatch?.kind)
  const gaps: PersonGap[] = []

  if (!person) gaps.push(emailMatch ? 'unlinked_email_match' : 'no_roster_row')
  if (!user) gaps.push('no_login')
  if (user && person && userName && rosterName && userName !== rosterName) gaps.push('pay_name_mismatch')
  const paysNobody = (role != null && NO_PAY_ROLES.has(role)) || (personKind != null && NO_PAY_KINDS.has(personKind))
  if (payName && input.payConfigNames != null && !paysNobody && !input.payConfigNames.some((n) => n.trim() === payName)) {
    gaps.push('no_pay_config')
  }

  const isSub = role === 'subcontractor' || personKind === 'sub'
  return {
    userId: user?.id ?? null,
    personId: person?.id ?? null,
    payName,
    displayName: userName ?? rosterName ?? trimOrNull(emailMatch?.name) ?? 'Unknown',
    email: trimOrNull(user?.email) ?? trimOrNull(person?.email),
    role,
    personKind,
    archived: Boolean(user?.archived_at) || Boolean(person?.archived_at),
    isSub,
    gaps,
    emailMatchedPersonId: emailMatch?.id ?? null,
    emailMatchedPersonName: trimOrNull(emailMatch?.name),
    rosterName,
  }
}

/** What the header says for each gap and what its button does. */
export function describePersonGap(gap: PersonGap, key: Pick<PersonKey, 'displayName' | 'rosterName' | 'emailMatchedPersonName' | 'payName'>): {
  label: string
  action: string
  detail: string
} {
  switch (gap) {
    case 'no_roster_row':
      return {
        label: 'No roster row',
        action: 'Create roster row',
        detail: 'Without one there is no HR file, portal, paperwork or employment dates. Creating it asks for the kind and does nothing else.',
      }
    case 'no_login':
      return {
        label: 'No login',
        action: 'Invite as user',
        detail: 'Without an account there are no clock sessions, schedule, team lead, vehicle or housing. Invite from the Users row.',
      }
    case 'unlinked_email_match':
      return {
        label: `Roster row "${key.emailMatchedPersonName ?? '?'}" shares this email but is not linked`,
        action: 'Link account',
        detail: 'Two identities until linked: the account and the roster row. Linking sets the roster row to this account.',
      }
    case 'pay_name_mismatch':
      return {
        label: `Roster name "${key.rosterName ?? '?'}" differs from the account name "${key.displayName}"`,
        action: `Reconcile to "${key.displayName}"`,
        detail: 'Pay tables key on the account name. Reconciling renames the roster row and cascades every pay table in one pass.',
      }
    case 'no_pay_config':
      return {
        label: `No pay setup under "${key.payName ?? '?'}"`,
        action: 'Set up pay',
        detail: 'No wage on file, so no pay report can be generated. Opens the same pay setup Payroll uses.',
      }
  }
}

/** `?person=u:<users.id>` or `?person=p:<people.id>` — the Desk's route-agnostic deep link. */
export function personDeskParam(key: { userId?: string | null; personId?: string | null }): string | null {
  if (key.userId) return `u:${key.userId}`
  if (key.personId) return `p:${key.personId}`
  return null
}

export function parsePersonDeskParam(raw: string | null | undefined): { userId?: string; personId?: string } | null {
  const s = (raw ?? '').trim()
  const m = /^([up]):([0-9a-f-]{36})$/i.exec(s)
  if (!m) return null
  const id = m[2]!
  return m[1]!.toLowerCase() === 'u' ? { userId: id } : { personId: id }
}

/** Relative "last seen" for the header: today / Nd ago / Nmo ago / never. */
export function describeLastSeen(lastSignInIso: string | null | undefined, nowMs: number): string {
  if (!lastSignInIso) return 'never signed in'
  const ms = nowMs - Date.parse(lastSignInIso)
  if (!Number.isFinite(ms) || ms < 0) return 'signed in today'
  const days = Math.floor(ms / 86_400_000)
  if (days === 0) return 'signed in today'
  if (days < 30) return `signed in ${days}d ago`
  const months = Math.floor(days / 30)
  return `signed in ${months}mo ago`
}
