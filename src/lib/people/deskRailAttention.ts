/**
 * People → Person tab rail (PR 3): every person grouped by kind, with the
 * attention dot and the short reason that earns it. Pure: the tab loads the
 * facts, this decides who leads.
 */

export type RailPersonInput = {
  /** users.id when there is an account, else null. */
  userId: string | null
  /** people.id when there is a roster row, else null. */
  personId: string | null
  name: string
  /** users.role or people.kind, normalised to a kind label key. */
  kind: string
  archived: boolean
}

export type RailFacts = {
  pendingByUserId: Record<string, { count: number; hours: number }>
  unsentDocsByName: Record<string, number>
  expiringByName: Record<string, number>
  expiredByName: Record<string, number>
}

export type RailAttention = 'red' | 'amber' | 'green'

export type RailRow = RailPersonInput & {
  attention: RailAttention
  /** "23 · doc" style badge; '' when green. */
  badge: string
  reasons: string[]
}

export type RailSection = { label: string; rows: RailRow[] }

const KIND_ORDER: Array<[string, string]> = [
  ['master_technician', 'Master Technicians'],
  ['assistant', 'Assistants'],
  ['controller', 'Controllers'],
  ['superintendent', 'Superintendents'],
  ['estimator', 'Estimators'],
  ['helper', 'Helpers'],
  ['sub', 'Subcontractors'],
  ['primary', 'Primaries'],
  ['dev', 'Devs'],
]

export function normaliseKind(roleOrKind: string | null | undefined): string {
  switch (roleOrKind) {
    case 'helpers':
      return 'helper'
    case 'subcontractor':
      return 'sub'
    default:
      return roleOrKind ?? 'other'
  }
}

export function buildRailRow(p: RailPersonInput, f: RailFacts): RailRow {
  const reasons: string[] = []
  const badge: string[] = []
  let attention: RailAttention = 'green'
  const pending = p.userId ? f.pendingByUserId[p.userId] : undefined
  if (pending && pending.count > 0) {
    reasons.push(`${pending.count} session${pending.count === 1 ? '' : 's'} waiting`)
    badge.push(String(pending.count))
    attention = 'amber'
  }
  const unsent = f.unsentDocsByName[p.name.trim()] ?? 0
  if (unsent > 0) {
    reasons.push(`${unsent} document${unsent === 1 ? '' : 's'} unsent`)
    badge.push('doc')
    attention = 'amber'
  }
  const expiring = f.expiringByName[p.name.trim()] ?? 0
  if (expiring > 0) {
    reasons.push(`${expiring} expiring`)
    badge.push('exp')
    attention = 'amber'
  }
  const expired = f.expiredByName[p.name.trim()] ?? 0
  if (expired > 0) {
    reasons.push(`${expired} expired`)
    badge.push('exp!')
    attention = 'red'
  }
  if (p.userId && !p.personId && p.kind !== 'dev' && p.kind !== 'primary') {
    reasons.push('no roster row')
    badge.push('id')
    if (attention === 'green') attention = 'amber'
  }
  return { ...p, attention, badge: badge.join(' · '), reasons }
}

export function buildRailSections(people: readonly RailPersonInput[], facts: RailFacts, search: string): { attention: RailRow[]; sections: RailSection[]; archived: RailRow[] } {
  const q = search.trim().toLowerCase()
  const rows = people.filter((p) => q === '' || p.name.toLowerCase().includes(q)).map((p) => buildRailRow(p, facts))
  const active = rows.filter((r) => !r.archived).sort((a, b) => a.name.localeCompare(b.name))
  const attention = active.filter((r) => r.attention !== 'green').sort((a, b) => (a.attention === b.attention ? a.name.localeCompare(b.name) : a.attention === 'red' ? -1 : 1))
  const sections: RailSection[] = []
  for (const [kind, label] of KIND_ORDER) {
    const list = active.filter((r) => r.kind === kind)
    if (list.length > 0) sections.push({ label, rows: list })
  }
  const other = active.filter((r) => !KIND_ORDER.some(([k]) => k === r.kind))
  if (other.length > 0) sections.push({ label: 'Other', rows: other })
  return { attention, sections, archived: rows.filter((r) => r.archived) }
}
