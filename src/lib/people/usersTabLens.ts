/**
 * People → Users lenses (People spine PR 5, v2.3702): the one roster, four column sets.
 *
 *   contact — today's row: email, phone, note, the needs rail (the default);
 *   account — what Active Accounts showed per person: role, last sign-in, training mode,
 *             supervision, and the desk door for password / name / merge / archive;
 *   pay     — what the People pay config modal showed: wage, office wage, salary, record
 *             hours, vehicle deal, and the salaried workday;
 *   sites   — v2.8657, a dev's alone: each person's seat on CountTooling and on TakeoffTooling, read
 *             over the two bridges. It shows and changes nothing.
 *
 * A lens is only a column set over the same grouped rows and search; the pay lens is for
 * viewers with pay access and the sites lens for a dev. `?lens=` on the URL is the deep link the Payroll tab uses.
 */

import { describeLastSeen } from './personKey'

export type UsersTabLens = 'contact' | 'account' | 'pay' | 'sites'

export const USERS_TAB_LENSES: ReadonlyArray<{ key: UsersTabLens; label: string; title: string }> = [
  { key: 'contact', label: 'Contact', title: 'Email, phone, note and what needs you' },
  { key: 'account', label: 'Account', title: 'Role, sign-in, training mode, supervision' },
  { key: 'pay', label: 'Pay', title: 'Wage, office rate, salary, vehicle deal, workday' },
  { key: 'sites', label: 'Sites', title: 'Their seat on CountTooling and on TakeoffTooling' },
]

export function parseUsersTabLens(raw: string | null | undefined): UsersTabLens {
  return raw === 'account' || raw === 'pay' || raw === 'sites' ? raw : 'contact'
}

/** The lenses this viewer may switch to (the pay lens needs pay access, the sites lens a dev; a phone shows contact only). */
export function usersTabLensesFor(viewer: { canAccessPay: boolean; narrowViewport: boolean; isDev?: boolean }): UsersTabLens[] {
  if (viewer.narrowViewport) return ['contact']
  const lenses: UsersTabLens[] = viewer.canAccessPay ? ['contact', 'account', 'pay'] : ['contact', 'account']
  if (viewer.isDev) lenses.push('sites')
  return lenses
}

/** A lens the viewer may not use falls back to contact — never a blank roster. */
export function resolveUsersTabLens(raw: string | null | undefined, viewer: { canAccessPay: boolean; narrowViewport: boolean; isDev?: boolean }): UsersTabLens {
  const wanted = parseUsersTabLens(raw)
  return usersTabLensesFor(viewer).includes(wanted) ? wanted : 'contact'
}

/** The pay lens shows every pay-config person, so the no-login fold stays open there. */
export function lensForcesNoLoginOpen(lens: UsersTabLens): boolean {
  return lens === 'pay'
}

/** The deep link the Payroll tab's old "People pay config" button becomes. */
export const USERS_TAB_PAY_LENS_PATH = '/people?tab=users&lens=pay'

/**
 * The Account lens's Sign-in cell: the column header already says "Sign-in", so the words are
 * the desk's `describeLastSeen` without its "signed in" — "today", "12d ago", "2mo ago", "never".
 */
export function lensSignInLabel(lastSignInIso: string | null | undefined, nowMs: number): string {
  if (!lastSignInIso) return 'never'
  return describeLastSeen(lastSignInIso, nowMs).replace(/^signed in /, '')
}
