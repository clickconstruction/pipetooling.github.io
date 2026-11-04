/**
 * The standings every charge reader shares (punch list #254, v2.6490): the rows `charge_standings()` answers — every
 * login with its Charged as, people who left included, and since v2.6501 every People record with no login with its
 * own — and the one rule for a name two logins share. The Job Summary's Charges and Premium columns, the Charges
 * window and the charged hours statement all price from these rows, so a person who left prices the same for a dev,
 * the controller and a pay-approved master. Before this read each screen read `users` itself, whose select policy
 * shows an archived row to a dev alone.
 *
 * The standing rule for a person (v2.6501): a People record linked to a login reads the login's standing, the one
 * place a Charged as is set for someone who signs in; a record with no login reads its own `people.charge_standing`.
 * On a crew, such a person is keyed `person:<people.id>` where a login's id would go.
 */
import { parseChargeStanding, type ChargeStanding } from './rateCard'

/**
 * A row of `charge_standings()`: a login (`id`, no `person_id`) or a People record with no login (`person_id`, no
 * `id`), its Charged as, and when it left (null while here).
 */
export type ChargeStandingRow = { id: string | null; person_id?: string | null; name: string | null; charge_standing?: unknown; archived_at?: string | null }

/** The login rows alone: a People record with no login has no `id`. */
export function loginRows<T extends { id: string | null }>(rows: ReadonlyArray<T>): Array<T & { id: string }> {
  return rows.filter((r): r is T & { id: string } => r.id != null)
}

/**
 * The row each key reaches when two rows share one: a login still here over one that left, and among the same the
 * last read, so an archived duplicate never shadows the live login whatever order the read answered in.
 */
export function liveOverArchived<T extends { archived_at?: string | null }>(rows: ReadonlyArray<T>, keyOf: (row: T) => string | null): Map<string, T> {
  const out = new Map<string, T>()
  for (const row of rows) {
    const key = keyOf(row)
    if (key == null) continue
    const held = out.get(key)
    if (held && !held.archived_at && row.archived_at) continue
    out.set(key, row)
  }
  return out
}

/** Each login's standing by id, as the Charges window and the charged hours statement price a session. */
export function standingsById(rows: ReadonlyArray<ChargeStandingRow>): Map<string, ChargeStanding> {
  return new Map(loginRows(rows).map((r) => [r.id, parseChargeStanding(r.charge_standing)] as const))
}

/** Each People record with no login, its standing by `people.id`. */
export function standingsByPersonId(rows: ReadonlyArray<ChargeStandingRow>): Map<string, ChargeStanding> {
  const out = new Map<string, ChargeStanding>()
  for (const r of rows) if (r.id == null && r.person_id) out.set(r.person_id, parseChargeStanding(r.charge_standing))
  return out
}

/** The key a People record takes on a crew where a login's id would go: the login's id when linked, else `person:<id>`. */
export const PERSON_KEY_PREFIX = 'person:'
export function crewKeyForPerson(person: { id: string; account_user_id: string | null }): string {
  return person.account_user_id ?? `${PERSON_KEY_PREFIX}${person.id}`
}
/** The `people.id` behind a crew key, or null for a login's. */
export function personIdOfCrewKey(key: string): string | null {
  return key.startsWith(PERSON_KEY_PREFIX) ? key.slice(PERSON_KEY_PREFIX.length) : null
}

/**
 * A People record's standing: through its login when it has one (the login's row, `none` when the login is not among
 * the rows), else its own row. Everyone who prices a crew-day reads it this way, so a day with a login and a person
 * with none prices by the same rule.
 */
export function standingForPerson(rows: ReadonlyArray<ChargeStandingRow>, person: { id: string; account_user_id: string | null }): ChargeStanding {
  if (person.account_user_id) return standingsById(rows).get(person.account_user_id) ?? 'none'
  return standingsByPersonId(rows).get(person.id) ?? 'none'
}

/** The same rule over maps already built, for a loop over many people. */
export function standingLookupForPeople(rows: ReadonlyArray<ChargeStandingRow>): (person: { id: string; account_user_id: string | null }) => ChargeStanding {
  const byId = standingsById(rows)
  const byPersonId = standingsByPersonId(rows)
  return (person) => (person.account_user_id ? byId.get(person.account_user_id) ?? 'none' : byPersonId.get(person.id) ?? 'none')
}
