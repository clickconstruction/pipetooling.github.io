/**
 * Who may make a signed hours statement (punch list #212): a dev and the controller, and no one else — Diane's call of
 * 2026-11-02, since the paper is payroll data. It revises the owner's call 6 of 2026-10-29, which let a pay-approved
 * master make the paper with the money and an assistant the hours-only paper; both go. The table's policies
 * (`can_touch_hours_statement`, narrowed by migration 20261103063000) hold the same line, so these only shape the
 * screens: a role that may not make one never sees the section, and the pay switch belongs to whoever sees it.
 */

export type HoursStatementMaker = { role: string | null | undefined; canAccessPay: boolean }

/** The section and the window show to a dev and the controller alone. */
export function canMakeHoursStatement(v: HoursStatementMaker): boolean {
  const role = v.role ?? null
  return role === 'dev' || role === 'controller'
}

/** The pay switch is theirs whenever the window is: a dev and the controller. */
export function hoursStatementPayAllowed(v: HoursStatementMaker): boolean {
  return canMakeHoursStatement(v)
}

/** The chip beside the section's heading, so an office reader knows why a colleague cannot see it. */
export const HOURS_STATEMENT_ROLES_CHIP = 'Controllers and devs only'
