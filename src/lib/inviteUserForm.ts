import type { UserRole } from '../hooks/useAuth'
import { humanRoleLabel } from './roleLabels'

/**
 * Pure rules for the Invite-via-email / Manually-add-user dialogs (Active Accounts).
 *
 * The role is an explicit choice: both dialogs open with nothing selected and the
 * submit button stays disabled until the admin picks one. The previous default was
 * `master_technician` — one forgotten dropdown shipped a field hire with office-wide
 * access. Least privilege means no privileged default, not a safer default.
 */

/** The dialogs hold `''` until a role is chosen. */
export type RoleChoice = UserRole | ''

export type InviteDraft = {
  email: string
  role: RoleChoice
  /** Manually-add only: the initial password the admin hands over. */
  password?: string
  /** Manually-add requires a password; Invite does not (the invitee sets their own). */
  requirePassword?: boolean
}

export function roleChosen(role: RoleChoice): role is UserRole {
  return role !== ''
}

/** Send / Create is allowed only with a non-blank email, a chosen role, and (manual add) a password. */
export function inviteFormValid(draft: InviteDraft): boolean {
  if (!draft.email.trim()) return false
  if (!roleChosen(draft.role)) return false
  if (draft.requirePassword && !(draft.password ?? '').length) return false
  return true
}

/** Roles whose access can be narrowed to specific service types from the dialog. */
export function roleTakesServiceTypes(role: RoleChoice): boolean {
  return role === 'estimator' || role === 'subcontractor' || role === 'helpers'
}

/**
 * Telemetry target for `user_invited` / `user_created` nav-click rows:
 * `#<role>` or `#<role>:training` — the two facts the journey map wanted
 * (which role, and whether training mode was chosen at the invite moment).
 */
export function userCreatedTelemetryTarget(role: UserRole, training: boolean): string {
  return `#${role}${training ? ':training' : ''}`
}

/** Desk-precedent confirm copy for re-roling a live account from the Active Accounts row select. */
export function roleChangeConfirmMessage(who: string, from: string | null | undefined, to: UserRole): string {
  const fromPart = from ? ` from ${humanRoleLabel(from)}` : ''
  return `Change ${who}'s role${fromPart} to ${humanRoleLabel(to)}? Their navigation and access change on next load.`
}
