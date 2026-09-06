/**
 * Workflow step assignment rules (journey-map Tier-3 B21, cluster C62 —
 * J31-4 / J31-N3).
 *
 * Two lists used to disagree about who can hold a step: the Workflow page's
 * office branch read every `users` row while the superintendent branch (and
 * both branches of the Add-Step modal) read only `subcontractor | helpers |
 * primary` (+ `master_technician`). Every office assignee — an assistant, the
 * controller, an estimator — therefore rendered "(not a user)" for a
 * superintendent, and the picker could not offer them. One list now feeds
 * every roster query: every role the app knows (`ROLES`); RLS decides what
 * each viewer actually gets back.
 *
 * The same module owns the notify-defaults rule: the three per-step
 * "notify the assigned person" toggles default to `false` at the DB, so a
 * freshly assigned step nudged nobody until somebody opened the Notify fold.
 * They now turn on the first time a step gains an assignee; an office that
 * turns them off afterwards keeps that choice through reassignments.
 */
import { ROLES } from '../userRoles'
import type { UserRole } from '../../hooks/useAuth'
import { activeRosterOnly, type ActiveRosterRow } from '../people/activeRoster'

/** Every role a workflow step may be assigned to — the `.in('role', …)` list for roster reads. */
export const WORKFLOW_ASSIGNABLE_USER_ROLES: readonly UserRole[] = ROLES

export type WorkflowUserRow = ActiveRosterRow & { name: string | null }

/**
 * Split one `users` read into the two sets the Workflow page keeps:
 * - `roster`: who the assign picker offers — active accounts only (no twins,
 *   no archived), dev rows included because the owner legitimately takes steps;
 * - `userNamesLower`: every returned account name, lowercased — the
 *   "(not a user)" suffix compares against this, so a step held by an account
 *   the viewer can read never looks like a ghost.
 */
export function buildWorkflowUserRoster<T extends WorkflowUserRow>(rows: readonly T[]): { roster: T[]; userNamesLower: Set<string> } {
  const named = rows.filter((r): r is T & { name: string } => !!r.name && r.name.trim() !== '')
  const userNamesLower = new Set<string>()
  for (const r of named) userNamesLower.add(r.name.trim().toLowerCase())
  return { roster: activeRosterOnly(named, { includeDev: true }), userNamesLower }
}

export type NotifyAssignedPatch = {
  notify_assigned_when_started: true
  notify_assigned_when_complete: true
  notify_assigned_when_reopened: true
}

/** The per-step "notify the assigned person" toggles, all on. */
export const NOTIFY_ASSIGNED_ALL_ON: NotifyAssignedPatch = {
  notify_assigned_when_started: true,
  notify_assigned_when_complete: true,
  notify_assigned_when_reopened: true,
}

const isBlank = (s: string | null | undefined): boolean => !s || s.trim() === ''

/**
 * Patch to apply alongside an assignment write, or `null` when nothing should
 * change: the toggles turn on only when a step that had nobody gains someone.
 * Reassigning A → B and clearing an assignee leave the office's choice alone.
 */
export function notifyAssignedDefaultsOnAssign(
  previousName: string | null | undefined,
  nextName: string | null | undefined,
): NotifyAssignedPatch | null {
  if (isBlank(nextName)) return null
  if (!isBlank(previousName)) return null
  return NOTIFY_ASSIGNED_ALL_ON
}
