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
