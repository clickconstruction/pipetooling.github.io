/**
 * Supervision (to-dos/supervision, PR 1): the one rule.
 *
 * A job-day is covered when at least one person on it does not need supervision.
 * Masters never need it; a helper or a sub needs it until the office flips
 * `users.needs_supervision` off. Office roles and superintendents are not
 * supervision for field work. Those people are the job-day's supervisors — there
 * can be several — and everyone else on the block is supervised by them. Nothing
 * here is assigned; it is read off whoever is listed or clocked.
 *
 * Pure: no React, no supabase.
 */

export type SupervisionPerson = { id: string; role: string | null; needsSupervision: boolean }

export type Coverage = 'covered' | 'unsupervised' | 'empty'

/** Roles the switch applies to. Everyone else is either a supervisor (masters) or not field labour. */
export const SUPERVISION_SWITCH_ROLES: readonly string[] = ['helpers', 'subcontractor']

/** Does the switch exist for this role at all? */
export function hasSupervisionSwitch(role: string | null | undefined): boolean {
  return role != null && SUPERVISION_SWITCH_ROLES.includes(role)
}

/**
 * Can this person run a job — i.e. count as coverage and carry the supervisor's
 * duties? Masters always; a helper or sub only when the office switched
 * "needs supervision" off; nobody else.
 */
export function isSupervisor(person: Pick<SupervisionPerson, 'role' | 'needsSupervision'>): boolean {
  if (person.role === 'master_technician') return true
  if (hasSupervisionSwitch(person.role)) return !person.needsSupervision
  return false
}

/** Does this person need someone who can run the job on their block? */
export function needsSupervision(person: Pick<SupervisionPerson, 'role' | 'needsSupervision'>): boolean {
  return hasSupervisionSwitch(person.role) && person.needsSupervision
}

/** The supervisors among a crew, masters first, then subs, then qualified helpers; stable within a group. */
export function supervisorsOf<T extends Pick<SupervisionPerson, 'role' | 'needsSupervision'>>(people: readonly T[]): T[] {
  const rank = (p: T) => (p.role === 'master_technician' ? 0 : p.role === 'subcontractor' ? 1 : 2)
  return people
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => isSupervisor(p))
    .sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i)
    .map(({ p }) => p)
}

/** Whether a job-day's people cover it. `empty` when nobody is on it at all. */
export function coverage(people: readonly Pick<SupervisionPerson, 'role' | 'needsSupervision'>[]): Coverage {
  if (people.length === 0) return 'empty'
  return people.some(isSupervisor) ? 'covered' : 'unsupervised'
}

/** The row label for the switch, as the People → Users menu and Active accounts show it. */
export function supervisionLabel(person: Pick<SupervisionPerson, 'role' | 'needsSupervision'>): string {
  if (person.role === 'master_technician') return 'supervises'
  if (!hasSupervisionSwitch(person.role)) return ''
  return person.needsSupervision ? 'needs supervision' : 'can run a job'
}
