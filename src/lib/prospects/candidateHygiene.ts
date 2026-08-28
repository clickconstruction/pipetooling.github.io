/**
 * Hiring-board duplicate & contact hygiene (v2.2459).
 *
 * The board grew silent copies: the same applicant added twice to one role
 * column (identical phone/email), and the same person sitting in several
 * role columns. This module detects both from normalized phone/email keys,
 * plus the per-role contact debt (candidates never contacted).
 *
 * Only the rows passed in are compared — callers pass the active Screen
 * candidates, so Hired/Passed rows never flag anything.
 */

export type HygieneCandidate = {
  id: string
  phone_number: string | null
  email: string | null
  role_id: string | null
  rank_order: number
  last_contact: string | null
}

/** Digits only; a leading US "1" on an 11-digit number is dropped. <7 digits → null. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  return digits.length >= 7 ? digits : null
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  const e = (raw ?? '').trim().toLowerCase()
  return e.includes('@') ? e : null
}

export type CandidateHygiene = {
  /** Duplicate row id → the id of the row it duplicates (same role, better rank). */
  duplicateOf: Record<string, string>
  /** Candidate id → other role_ids holding a matching phone/email candidate. */
  crossRoles: Record<string, string[]>
  /** role_id → count of active candidates never contacted (duplicates excluded). */
  neverContactedByRole: Record<string, number>
  /** role_id → the top-ranked never-contacted candidate ("call next"; duplicates excluded). */
  callNextByRole: Record<string, string>
}

function keysOf(c: HygieneCandidate): string[] {
  const keys: string[] = []
  const p = normalizePhone(c.phone_number)
  const e = normalizeEmail(c.email)
  if (p) keys.push(`p:${p}`)
  if (e) keys.push(`e:${e}`)
  return keys
}

export function analyzeCandidates(rows: readonly HygieneCandidate[]): CandidateHygiene {
  // Union of rows per identity key.
  const byKey = new Map<string, HygieneCandidate[]>()
  for (const row of rows) {
    for (const key of keysOf(row)) {
      const list = byKey.get(key) ?? []
      list.push(row)
      byKey.set(key, list)
    }
  }

  const duplicateOf: Record<string, string> = {}
  const crossRolesSets = new Map<string, Set<string>>()

  for (const list of byKey.values()) {
    if (list.length < 2) continue
    // In-column duplicates: same role, keeper = best (lowest) rank_order.
    const byRole = new Map<string, HygieneCandidate[]>()
    for (const row of list) {
      const roleKey = row.role_id ?? ''
      const roleList = byRole.get(roleKey) ?? []
      roleList.push(row)
      byRole.set(roleKey, roleList)
    }
    for (const roleList of byRole.values()) {
      if (roleList.length < 2) continue
      const sorted = [...roleList].sort((a, b) => a.rank_order - b.rank_order)
      const keeper = sorted[0]!
      for (const dup of sorted.slice(1)) {
        if (dup.id !== keeper.id && !(dup.id in duplicateOf)) duplicateOf[dup.id] = keeper.id
      }
    }
    // Cross-role membership: every row learns the *other* roles in its match set.
    for (const row of list) {
      for (const other of list) {
        if (other.id === row.id) continue
        if ((other.role_id ?? '') === (row.role_id ?? '')) continue
        if (!other.role_id) continue
        let set = crossRolesSets.get(row.id)
        if (!set) {
          set = new Set()
          crossRolesSets.set(row.id, set)
        }
        set.add(other.role_id)
      }
    }
  }

  const crossRoles: Record<string, string[]> = {}
  for (const [id, set] of crossRolesSets) crossRoles[id] = [...set]

  const neverContactedByRole: Record<string, number> = {}
  const callNextCandidate: Record<string, HygieneCandidate> = {}
  for (const row of rows) {
    if (row.last_contact != null) continue
    if (row.id in duplicateOf) continue
    const roleKey = row.role_id ?? ''
    neverContactedByRole[roleKey] = (neverContactedByRole[roleKey] ?? 0) + 1
    const best = callNextCandidate[roleKey]
    if (!best || row.rank_order < best.rank_order) callNextCandidate[roleKey] = row
  }
  const callNextByRole: Record<string, string> = {}
  for (const [roleKey, row] of Object.entries(callNextCandidate)) callNextByRole[roleKey] = row.id

  return { duplicateOf, crossRoles, neverContactedByRole, callNextByRole }
}
