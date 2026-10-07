import type { UserRole } from '../../hooks/useAuth'

/**
 * GC mode, door 1 (v2.4832): who opens the GC projects page and its windows (New project, a new
 * set of plans, the plans, the questions, the scope book), and who sees the door on Bids. The
 * client's copy of the database's `gc_office_team()`
 * (`20261008003000_gc_door_1_new_project_team.sql`): the office and estimators. The audience lives
 * in exactly these two places; change both together.
 */
const GC_OFFICE_TEAM: readonly UserRole[] = ['dev', 'master_technician', 'assistant', 'controller', 'estimator']

export function canOpenGcProjects(role: UserRole | null | undefined): boolean {
  return role != null && GC_OFFICE_TEAM.includes(role)
}
