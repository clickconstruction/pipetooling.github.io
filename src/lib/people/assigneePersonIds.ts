// Resolve sub-sheet assignee picker names to people.id for the
// people_labor_job_assignees belt-and-braces write (person-identity Phase D,
// docs/PERSON_IDENTITY_PLAN.md).
//
// The durable write is still assigned_to_name — the DB trigger
// sync_people_labor_job_assignees DELETEs + rebuilds the junction from the
// delimited name string on every write, so a junction row alone would be
// wiped by the next name edit. This resolver only backstops names the
// server-side resolve_pay_person_id can't map (e.g. a picked person whose
// roster row the resolver misses), mirroring PeopleSubsTab's assignGroup.

export type AssigneeRosterPerson = { id: string; name: string | null; email: string | null }
export type AssigneeRosterUser = { name: string | null; email: string | null }

/**
 * Picker names → people ids. People rows match by trimmed name; account-holding
 * users match via their people row (linked by email — the same link the picker
 * dedupes on). Unknown names are skipped; ids are deduped, picker order kept.
 */
export function assigneePersonIdsForNames(
  names: string[],
  people: AssigneeRosterPerson[],
  users: AssigneeRosterUser[],
): string[] {
  const byName = new Map<string, string>()
  const byEmail = new Map<string, string>()
  for (const p of people) {
    const n = p.name?.trim()
    if (n && !byName.has(n)) byName.set(n, p.id)
    const e = p.email?.trim().toLowerCase()
    if (e && !byEmail.has(e)) byEmail.set(e, p.id)
  }
  for (const u of users) {
    const n = u.name?.trim()
    if (!n || byName.has(n)) continue
    const e = u.email?.trim().toLowerCase()
    const pid = e ? byEmail.get(e) : undefined
    if (pid) byName.set(n, pid)
  }
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of names) {
    const pid = byName.get(raw.trim())
    if (pid && !seen.has(pid)) {
      seen.add(pid)
      out.push(pid)
    }
  }
  return out
}
