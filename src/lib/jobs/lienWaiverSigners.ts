/**
 * Who a lien waiver's "Who signs" pick offers (v2.5231): the company's leaders and its devs, since the database
 * lets either sign and the Dashboard inbox lists what waits on either. The job's own leader comes first, then the
 * leaders, then the devs, each group by name. A leader is shown by his notes before the comma ("Malachi Whites,
 * Master Plumber"); a dev by his name, since a dev's notes hold license numbers.
 */

export const LIEN_WAIVER_SIGNER_ROLES = ['master_technician', 'dev'] as const

export type LienWaiverSignerRow = {
  id: string
  name: string | null
  notes: string | null
  role: string | null
  archived_at: string | null
}

export type LienWaiverSigner = { id: string; name: string }

export function lienWaiverSignerName(u: Pick<LienWaiverSignerRow, 'name' | 'notes' | 'role'>): string {
  const named = (u.name ?? '').trim()
  if (u.role === 'dev') return named || 'the dev'
  return ((u.notes ?? '').trim() || named || 'the leader').replace(/,.*$/, '')
}

export function lienWaiverSignerChoices(rows: ReadonlyArray<LienWaiverSignerRow>, jobMasterUserId: string | null | undefined): LienWaiverSigner[] {
  const rank = (u: LienWaiverSignerRow) => (u.id === jobMasterUserId ? 0 : u.role === 'dev' ? 2 : 1)
  return rows
    .filter((u) => !u.archived_at)
    .map((u) => ({ id: u.id, name: lienWaiverSignerName(u), rank: rank(u) }))
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
    .map(({ id, name }) => ({ id, name }))
}
