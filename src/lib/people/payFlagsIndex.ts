/**
 * Shared index over `list_people_pay_flags` rows (C1, PERSON_IDENTITY_PLAN.md /
 * FRAGILITY_REMEDIATION_PLAN.md): lookups are person_id-FIRST with trimmed-name
 * fallback, so a rename between pay config and roster can no longer silently
 * drop someone's salary flag. The RPC has returned `person_id` since Phase B
 * (migration 20260714120000 added the column to the RETURNS TABLE); consumers
 * had all been indexing by name only.
 *
 * The 2026-07-30 prod audit confirmed zero rows where the id-first answer
 * differs from the name answer, so flipping consumers to this index is
 * answer-preserving today — the win is what happens on FUTURE renames.
 */

/** Row shape of `list_people_pay_flags` (see migration 20260722230000). */
export type PayFlagRpcRow = {
  person_name: string | null
  person_id: string | null
  is_salary: boolean | null
  record_hours_but_salary: boolean | null
  show_in_hours: boolean | null
}

export type PayFlags = {
  isSalary: boolean
  recordHoursButSalary: boolean
  showInHours: boolean
}

export type PayFlagsIndex = {
  /** person_id-first, trimmed-name fallback. Null when neither key matches. */
  get(ref: { personId?: string | null; name?: string | null }): PayFlags | null
  /** Convenience for the legacy set-membership shape. */
  isSalaried(ref: { personId?: string | null; name?: string | null }): boolean
  byId: ReadonlyMap<string, PayFlags>
  byName: ReadonlyMap<string, PayFlags>
}

function toFlags(r: PayFlagRpcRow): PayFlags {
  return {
    isSalary: r.is_salary === true,
    recordHoursButSalary: r.record_hours_but_salary === true,
    showInHours: r.show_in_hours === true,
  }
}

export function buildPayFlagsIndex(rows: readonly PayFlagRpcRow[] | null | undefined): PayFlagsIndex {
  const byId = new Map<string, PayFlags>()
  const byName = new Map<string, PayFlags>()
  for (const r of rows ?? []) {
    const flags = toFlags(r)
    if (r.person_id) byId.set(r.person_id, flags)
    const n = r.person_name?.trim()
    if (n) byName.set(n, flags)
  }
  const get = (ref: { personId?: string | null; name?: string | null }): PayFlags | null => {
    if (ref.personId) {
      const viaId = byId.get(ref.personId)
      if (viaId) return viaId
    }
    const n = ref.name?.trim()
    if (n) {
      const viaName = byName.get(n)
      if (viaName) return viaName
    }
    return null
  }
  return {
    get,
    isSalaried: (ref) => get(ref)?.isSalary === true,
    byId,
    byName,
  }
}
