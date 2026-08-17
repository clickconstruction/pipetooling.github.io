// Id-first lookup over usePayConfig's name-keyed state map (identity Phase D,
// docs/PERSON_IDENTITY_PLAN.md). The map stays keyed by person_name — it is
// the roster join for dozens of People-page call sites and people_pay_config's
// PRIMARY KEY is still person_name — but rows carry person_id, so consumers
// that know a person's id (e.g. EmploymentEntry.personId) can resolve through
// it and survive name drift between users/people/pay rows. Same pattern as
// payFlagsIndex (v2.1122) and PeopleReviewTab's payConfigById (v2.1266).

import type { PayConfigRow } from '../../types/peoplePayConfig'

/** Derive the person_id → row index from the name-keyed map. */
export function buildPayConfigById(
  payConfig: Record<string, PayConfigRow>,
): Record<string, PayConfigRow> {
  const byId: Record<string, PayConfigRow> = {}
  for (const row of Object.values(payConfig)) {
    if (row.person_id && !(row.person_id in byId)) byId[row.person_id] = row
  }
  return byId
}

/** Person's pay config: person_id first, person_name fallback. */
export function payConfigForPerson(
  payConfig: Record<string, PayConfigRow>,
  payConfigById: Record<string, PayConfigRow>,
  name: string,
  personId?: string | null,
): PayConfigRow | undefined {
  if (personId) {
    const byId = payConfigById[personId]
    if (byId) return byId
  }
  return payConfig[name]
}
