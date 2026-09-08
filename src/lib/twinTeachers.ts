/**
 * Calibration-standard teachers (v2.3091, Settings → Digital twins): which
 * humans the robot program calibrates to. A shadow scored against a
 * calibration-standard estimator's sent number counts toward Gate B; against
 * anyone else it is practice (v2.3080, `users.calibration_standard`).
 *
 * Pure module — decides who is offered as a candidate and how the list reads.
 */

export interface TeacherCandidate {
  id: string
  name: string | null
  email: string
  role: string
  is_digital_twin: boolean
  archived_at: string | null
  calibration_standard: boolean
}

/** Roles whose members send bids the robots could learn from. */
export const TEACHER_ROLES: ReadonlySet<string> = new Set(['estimator', 'dev', 'master_technician', 'assistant'])

/**
 * Humans who could be a calibration standard: estimating roles, not a twin,
 * not archived — plus anyone already flagged (so a flag never hides), standards
 * first, then by name.
 */
export function teacherCandidates(users: readonly TeacherCandidate[]): TeacherCandidate[] {
  return users
    .filter((u) => u.calibration_standard || (!u.is_digital_twin && u.archived_at == null && TEACHER_ROLES.has(u.role)))
    .sort((a, b) => {
      if (a.calibration_standard !== b.calibration_standard) return a.calibration_standard ? -1 : 1
      return (a.name ?? a.email).localeCompare(b.name ?? b.email)
    })
}

/** The one-line summary above the list. */
export function calibrationStandardSummary(users: readonly TeacherCandidate[]): string {
  const standards = users.filter((u) => u.calibration_standard).map((u) => u.name ?? u.email)
  if (standards.length === 0) return 'No calibration standard set — every shadow score counts as practice and Gate B cannot be met.'
  if (standards.length === 1) return `${standards[0]} is the calibration standard — only shadows scored against their sent numbers count toward Gate B.`
  return `${standards.join(', ')} are calibration standards — shadows scored against their sent numbers count toward Gate B.`
}

/** Toast copy after a flip. */
export function calibrationStandardToast(name: string, standard: boolean): string {
  return standard
    ? `${name} is now a calibration standard — shadows scored against their bids count toward Gate B.`
    : `${name} is no longer a calibration standard — their shadow scores now read as practice.`
}
