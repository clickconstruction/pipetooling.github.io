/**
 * Who may make a signed hours statement (punch list #212, the owner's call 6 of 2026-10-29): the payroll roles — a
 * dev, the controller, a pay-approved master — make the paper with the money on it; an assistant makes the hours-only
 * paper. The table's policies (`can_touch_hours_statement`, migration 20261030030000) hold the same line, so these
 * only shape the screens: a role that may not make one never sees the section, and an assistant's pay switch is fixed
 * off. Mirrors the People → Hours and Payroll lines (`usePeopleAccess.ts`).
 */

export type HoursStatementMaker = { role: string | null | undefined; canAccessPay: boolean }

/** The section and the window show to a dev, the controller, an assistant, and a master with pay access. */
export function canMakeHoursStatement(v: HoursStatementMaker): boolean {
  const role = v.role ?? null
  if (role === 'dev' || role === 'controller' || role === 'assistant') return true
  return role === 'master_technician' && v.canAccessPay
}

/** The pay switch is theirs: a dev, the controller, a pay-approved master. An assistant's is fixed off. */
export function hoursStatementPayAllowed(v: HoursStatementMaker): boolean {
  const role = v.role ?? null
  if (role === 'dev' || role === 'controller') return true
  return role === 'master_technician' && v.canAccessPay
}
