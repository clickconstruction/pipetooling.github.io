/**
 * The roster view (People spine PR 1, v2.3698).
 *
 * `public.roster_people` is the one answer to "who is a person": one row per human — the
 * login `users` row, the roster `people` row, or the linked pair — with the classification
 * flags every roster used to derive for itself. Two rollups come ready to use:
 *
 *   - `is_pay_roster`    — a real person (not a twin, not a sample) with neither half archived.
 *                          Pay lists take this: dev rows with a pay-config row are paid people.
 *   - `is_active_roster` — `is_pay_roster` and not a dev — the crew-picker rule that
 *                          `activeRoster.ts` states in TypeScript.
 *
 * The view carries names, roles, kinds, flags and employment dates only. Contact columns
 * (email, phone, notes, sign-in times) stay on the `users` / `people` reads and their policies;
 * join by `user_id` / `person_id` when a surface needs them.
 *
 * The pay tables are still keyed by `person_name` (their PRIMARY KEY), so the membership
 * test here is by `person_id` when the pay row carries one, else by the trimmed `pay_name`.
 * A pay row that matches NO roster row keeps its old behaviour (shown) — the guardrail is
 * about rows that match a non-person or an archived person, never about hiding money.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { withSupabaseRetry } from '../../utils/errorHandling'

export type RosterAccountKind = 'person' | 'external' | 'sample' | 'twin'

export type RosterPerson = {
  user_id: string | null
  person_id: string | null
  row_key: string
  pay_name: string
  account_name: string | null
  roster_name: string | null
  role: string | null
  kind: string | null
  account_kind: RosterAccountKind
  is_digital_twin: boolean
  is_sample: boolean
  is_dev: boolean
  read_only: boolean
  needs_supervision: boolean
  user_archived_at: string | null
  person_archived_at: string | null
  is_archived: boolean
  is_pay_roster: boolean
  is_active_roster: boolean
  has_login: boolean
  has_roster_row: boolean
  start_date: string | null
  end_date: string | null
  master_user_id: string | null
}

export const ROSTER_PEOPLE_COLUMNS =
  'user_id, person_id, row_key, pay_name, account_name, roster_name, role, kind, account_kind, is_digital_twin, is_sample, is_dev, read_only, needs_supervision, user_archived_at, person_archived_at, is_archived, is_pay_roster, is_active_roster, has_login, has_roster_row, start_date, end_date, master_user_id'

/** Every roster row the viewer may see (the view runs with owner rights: everyone sees the same list). */
export async function fetchRosterPeople(supabase: SupabaseClient): Promise<RosterPerson[]> {
  const data = await withSupabaseRetry(
    async () =>
      // The view lands in the generated types after the migration is pushed and `gen-types` runs;
      // until then the table name is cast (the #3521 pattern).
      await (supabase.from('roster_people' as never) as unknown as {
        select: (cols: string) => PromiseLike<{ data: RosterPerson[] | null; error: { message: string } | null }>
      }).select(ROSTER_PEOPLE_COLUMNS),
    'roster people',
    // A missing view (the client deployed before the migration is pushed) is not a blip:
    // fail once, fast, and let the callers take "no verdict".
    { maxRetries: 0 },
  )
  return (data ?? []) as RosterPerson[]
}

/**
 * Pay-roster membership as the pay lists need it: `byPersonId` and `byPayName` (trimmed) both
 * answer "is this pay row's person in the pay roster?". `null` when the roster has not loaded —
 * callers treat null as "no verdict" and keep every row, so a slow load never blanks a pay list.
 */
export type PayRosterIndex = {
  byPersonId: Map<string, boolean>
  byPayName: Map<string, boolean>
}

export function buildPayRosterIndex(rows: readonly RosterPerson[]): PayRosterIndex {
  const byPersonId = new Map<string, boolean>()
  const byPayName = new Map<string, boolean>()
  for (const r of rows) {
    if (r.person_id) byPersonId.set(r.person_id, r.is_pay_roster)
    const name = r.pay_name.trim()
    if (!name) continue
    // Two rows with one name (an archived duplicate beside a live one): the live one wins.
    const prev = byPayName.get(name)
    byPayName.set(name, prev === true ? true : r.is_pay_roster)
  }
  return { byPersonId, byPayName }
}

export type PayRosterRowRef = { person_name: string; person_id?: string | null }

/**
 * Whether one pay-config / pay row belongs on a pay list.
 * - matched by person_id or trimmed name → the roster's verdict (`is_pay_roster`);
 * - matched nowhere → true (an orphan pay row is a data question, not something to hide);
 * - no index yet → true (no verdict).
 */
export function isPayRosterRow(index: PayRosterIndex | null, row: PayRosterRowRef): boolean {
  if (!index) return true
  if (row.person_id) {
    const v = index.byPersonId.get(row.person_id)
    if (v !== undefined) return v
  }
  const v = index.byPayName.get(row.person_name.trim())
  return v === undefined ? true : v
}

/** The pay-config names that belong on a pay list, in the order given. */
export function payRosterNames(
  index: PayRosterIndex | null,
  rows: readonly PayRosterRowRef[],
): string[] {
  return rows.filter((r) => isPayRosterRow(index, r)).map((r) => r.person_name)
}
