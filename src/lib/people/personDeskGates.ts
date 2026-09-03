/**
 * Person Desk role gates (v2.2701). The Desk adds no permissions: every gate
 * here restates one that already exists on the surface the section mirrors,
 * so that widening a control is a one-line change in exactly one place (plus
 * the edge function or policy that actually enforces it).
 */
export type PersonDeskViewer = {
  role: string | null
  isDev: boolean
  canAccessPay: boolean
  canAccessHours: boolean
  canAccessVehicles: boolean
  canAccessLicenses: boolean
  canAccessContracts: boolean
  /** The viewer is in training mode: every write is blocked server-side. */
  readOnly: boolean
}

const OFFICE_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller'])

/** Who can open the Desk at all — the set that can open People. */
export function canOpenPersonDesk(role: string | null | undefined): boolean {
  return role != null && OFFICE_ROLES.has(role)
}

/** Role, service types, sign-in email, set password — the account edge functions hard-check dev. */
export function canEditAccount(v: PersonDeskViewer): boolean {
  return v.isDev && !v.readOnly
}

/** The people who onboard and offboard: dev, controller, or a pay-approved master (v2.2713, owner decision 2). */
function isOffboardingRole(v: PersonDeskViewer): boolean {
  return v.isDev || v.role === 'controller' || (v.role === 'master_technician' && v.canAccessPay)
}

/** Archive / restore — `archive-user` / `restore-user` admit the same set in code (v2.2713; was dev-only). */
export function canArchiveAccount(v: PersonDeskViewer): boolean {
  return isOffboardingRole(v) && !v.readOnly
}

/** Training mode — `users_guard_privileged_columns` admits the same set, never on your own row (v2.2713; was dev-only). */
export function canSetTrainingMode(v: PersonDeskViewer): boolean {
  return isOffboardingRole(v) && !v.readOnly
}

/** Imitate stays dev-only in the UI regardless of what the edge function admits. */
export function canImitate(v: PersonDeskViewer): boolean {
  return v.isDev
}

/** Team-lead links: office roles (the Team leads modal gate). */
export function canEditTeamLeads(v: PersonDeskViewer): boolean {
  return !v.readOnly && (v.isDev || v.role === 'master_technician' || v.role === 'assistant' || v.role === 'controller')
}

/** Full / Strip leader dashboard visibility is dev-only. */
export function canEditLeaderVisibility(v: PersonDeskViewer): boolean {
  return v.isDev && !v.readOnly
}

/** Dispatch / Estimator inbox groups live on Settings and are dev-managed. */
export function canEditGroups(v: PersonDeskViewer): boolean {
  return v.isDev && !v.readOnly
}

export function canWorkHours(v: PersonDeskViewer): boolean {
  return !v.readOnly && (v.canAccessHours || v.canAccessPay)
}

export function canSeeHours(v: PersonDeskViewer): boolean {
  return v.canAccessHours || v.canAccessPay
}
