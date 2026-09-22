/**
 * People → Users lenses (People spine PR 5, v2.3702): the one roster, three column sets.
 *
 *   contact — today's row: email, phone, note, the needs rail (the default);
 *   account — what Active Accounts showed per person: role, last sign-in, training mode,
 *             supervision, and the desk door for password / name / merge / archive;
 *   pay     — what the People pay config modal showed: wage, office wage, salary, record
 *             hours, vehicle deal, and the salaried workday.
 *
 * A lens is only a column set over the same grouped rows and search; the pay lens is for
 * viewers with pay access. `?lens=` on the URL is the deep link the Payroll tab uses.
 */

export type UsersTabLens = 'contact' | 'account' | 'pay'

export const USERS_TAB_LENSES: ReadonlyArray<{ key: UsersTabLens; label: string; title: string }> = [
  { key: 'contact', label: 'Contact', title: 'Email, phone, note and what needs you' },
  { key: 'account', label: 'Account', title: 'Role, sign-in, training mode, supervision' },
  { key: 'pay', label: 'Pay', title: 'Wage, office rate, salary, vehicle deal, workday' },
]

export function parseUsersTabLens(raw: string | null | undefined): UsersTabLens {
  return raw === 'account' || raw === 'pay' ? raw : 'contact'
}

/** The lenses this viewer may switch to (the pay lens needs pay access; a phone shows contact only). */
export function usersTabLensesFor(viewer: { canAccessPay: boolean; narrowViewport: boolean }): UsersTabLens[] {
  if (viewer.narrowViewport) return ['contact']
  return viewer.canAccessPay ? ['contact', 'account', 'pay'] : ['contact', 'account']
}

/** A lens the viewer may not use falls back to contact — never a blank roster. */
export function resolveUsersTabLens(raw: string | null | undefined, viewer: { canAccessPay: boolean; narrowViewport: boolean }): UsersTabLens {
  const wanted = parseUsersTabLens(raw)
  return usersTabLensesFor(viewer).includes(wanted) ? wanted : 'contact'
}

/** The pay lens shows every pay-config person, so the no-login fold stays open there. */
export function lensForcesNoLoginOpen(lens: UsersTabLens): boolean {
  return lens === 'pay'
}

/** The deep link the Payroll tab's old "People pay config" button becomes. */
export const USERS_TAB_PAY_LENS_PATH = '/people?tab=users&lens=pay'
