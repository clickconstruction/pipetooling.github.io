/**
 * Teammate email chips kernel: turns the user roster into tap-to-fill chips
 * for typed-email To fields (GC Review's Email once / per-GC Email dialogs).
 * Chips show first names; colliding first names get "First L." labels; the
 * full email + role live in the chip tooltip.
 */

export type TeammateChipUser = {
  id: string
  name: string
  email: string | null
  role: string
}

export type TeammateChip = {
  email: string
  /** Short label for the chip (first name, disambiguated on collision). */
  label: string
  /** Tooltip: full name · email · role. */
  title: string
}

/** Mirrors the GC Review Standing copies picker cohort (v2.1431). */
export const OFFICE_CAPABLE_ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'primary'] as const

function firstNameOf(name: string, email: string): string {
  const first = name.trim().split(/\s+/)[0] ?? ''
  if (first) return first
  return email.split('@')[0] ?? email
}

function lastInitialOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  const last = parts.length > 1 ? parts[parts.length - 1] : ''
  return last ? `${last.charAt(0).toUpperCase()}.` : ''
}

export function buildTeammateEmailChips(users: TeammateChipUser[]): TeammateChip[] {
  const eligible = users
    .filter(
      (u) => (OFFICE_CAPABLE_ROLES as readonly string[]).includes(u.role) && (u.email ?? '').includes('@'),
    )
    .map((u) => ({ ...u, email: (u.email ?? '').trim().toLowerCase() }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const firstNameCounts = new Map<string, number>()
  for (const u of eligible) {
    const key = firstNameOf(u.name, u.email).toLowerCase()
    firstNameCounts.set(key, (firstNameCounts.get(key) ?? 0) + 1)
  }

  return eligible.map((u) => {
    const first = firstNameOf(u.name, u.email)
    const collides = (firstNameCounts.get(first.toLowerCase()) ?? 0) > 1
    const initial = collides ? lastInitialOf(u.name) : ''
    return {
      email: u.email,
      label: initial ? `${first} ${initial}` : first,
      title: `${u.name.trim() || u.email} · ${u.email} · ${u.role.replace(/_/g, ' ')}`,
    }
  })
}

/** Case/whitespace-insensitive "is this chip the current To value" check. */
export function chipMatchesValue(chipEmail: string, value: string): boolean {
  return value.trim().toLowerCase() === chipEmail
}
