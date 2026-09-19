/**
 * View as (v2.3606): the sample accounts — one real user per role a dev may imitate, hidden
 * from every human surface like a digital twin, listed under Settings → Active accounts →
 * Sample accounts. A dev imitates one to see a page as that role. The names and emails are a
 * convention so "Create the missing samples" is idempotent and the accounts are easy to find.
 */
import { ROLES } from './userRoles'
import { humanRoleLabel } from './roleLabels'

export const SAMPLE_EMAIL_DOMAIN = 'samples.pipetooling.local'

/** Every role but dev — the roles `login-as-user` will mint. */
export const IMITABLE_ROLES: readonly string[] = ROLES.filter((r) => r !== 'dev')

export const sampleEmailForRole = (role: string): string => `sample-${role.replace(/_/g, '-')}@${SAMPLE_EMAIL_DOMAIN}`

export const sampleNameForRole = (role: string): string => `Sample ${humanRoleLabel(role as never).toLowerCase()}`

export type SampleAccountRow = { id: string; role: string | null; is_sample?: boolean | null; archived_at?: string | null }

/** The live sample account per role, by role. */
export function sampleAccountsByRole<T extends SampleAccountRow>(users: ReadonlyArray<T>): Map<string, T> {
  const out = new Map<string, T>()
  for (const u of users) {
    if (u.is_sample !== true || u.archived_at != null || !u.role) continue
    if (!out.has(u.role)) out.set(u.role, u)
  }
  return out
}

/** The imitable roles with no live sample yet — what "Create the missing samples" makes. */
export function missingSampleRoles(users: ReadonlyArray<SampleAccountRow>): string[] {
  const have = sampleAccountsByRole(users)
  return IMITABLE_ROLES.filter((r) => !have.has(r))
}

/** A throwaway password for a sample account: nobody signs in as it directly, a dev imitates it. */
export function sampleAccountPassword(random: () => number = Math.random): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 28; i += 1) out += alphabet[Math.floor(random() * alphabet.length)]
  return out
}

// ─── the door (PR 2, v2.3608) ────────────────────────────────────────────────

/** The Roles list, leaders first, the field last — the order a dev reads them in. */
export const VIEW_AS_ROLE_ORDER: readonly string[] = ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers']

export type ViewAsSwitches = {
  role?: string | null
  read_only?: boolean | null
  estimator_prospects_access?: boolean | null
  team_prospects_access?: boolean | null
}

/** The switch chips under a role or a person: what this account has on top of its role. */
export function switchChipsFor(u: ViewAsSwitches): string[] {
  const out: string[] = []
  if (u.read_only) out.push('training mode')
  if (u.team_prospects_access) out.push('Hiring')
  if (u.role === 'estimator' && u.estimator_prospects_access) out.push('estimator prospects')
  return out
}

export type ViewAsPerson = { id: string; name: string | null; email: string | null; role: string | null }

/** The People search: name, email or role, any case, every word must hit. */
export function filterViewAsPeople<T extends ViewAsPerson>(people: ReadonlyArray<T>, query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...people]
  return people.filter((p) => {
    const hay = `${p.name ?? ''} ${p.email ?? ''} ${p.role ?? ''}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}
