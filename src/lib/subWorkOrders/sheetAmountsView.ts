/**
 * Who sees a sheet's amounts (punch list #346, PR 6). Taunya's words of 2026-11-15: "office staff should see all the
 * amounts, field staff should only see their".
 *
 * "Theirs" is the sheet's money, by `sheetOwedTo`: the one sub, or the one teammate a sheet with no sub names. A
 * person who is only named on someone else's sheet sees that the sheet exists, its job and its day, and no figure.
 * A sheet that is shared (two subs, or several teammates and no sub) shows its figures to the office alone until it
 * names one person.
 *
 * The office is dev, master technician, assistant and controller (her pick of 2026-11-15, "Yes, those four").
 * Drawing only: RLS still hands a named person the whole row, and closing that read is a policy change of its own.
 *
 * Pure: no React, no Supabase. The `sub-portal` function needs a copy under `_shared/` when PR 6 is built.
 */
import { normalizePersonNameKey } from '../personNameKey'
import type { SheetParties } from './sheetParties'
import { sheetOwedTo, TEAM_SHEET_RULE, type TeamSheetRule } from './teamSheetRule'

/** The roles that see every sheet's amounts (Taunya, 2026-11-15). Every other role sees the amounts of a sheet that pays them. */
export const SHEET_AMOUNT_OFFICE_ROLES: readonly string[] = ['dev', 'master_technician', 'assistant', 'controller']

export type SheetViewer = {
  role: string | null | undefined
  /** The viewer's roster row, when they have one. */
  personId: string | null | undefined
  /** Their name, for a sheet that names people by words alone. */
  name?: string | null
}

export type SheetAmountsView =
  /** The office: every figure. */
  | 'office'
  /** The sheet pays the viewer: every figure. */
  | 'own'
  /** The viewer is named on the sheet and it pays someone else: no figure. */
  | 'named'
  /** The viewer is not on the sheet at all: it is not listed for them. */
  | 'hidden'

export function sheetAmountsView(viewer: SheetViewer, parties: SheetParties, rule: TeamSheetRule = TEAM_SHEET_RULE): SheetAmountsView {
  if (viewer.role && SHEET_AMOUNT_OFFICE_ROLES.includes(viewer.role)) return 'office'
  const nameKey = normalizePersonNameKey(viewer.name ?? '')
  const isViewer = (p: { id: string | null; name: string }) => (viewer.personId && p.id ? p.id === viewer.personId : !!nameKey && normalizePersonNameKey(p.name) === nameKey)
  const paid = sheetOwedTo(parties, rule).person
  if (paid && isViewer(paid)) return 'own'
  return [...parties.contractors, ...parties.teammates].some(isViewer) ? 'named' : 'hidden'
}

/** True when the viewer reads the sheet's dollars. */
export function sheetAmountsShown(view: SheetAmountsView): boolean {
  return view === 'office' || view === 'own'
}

/** What a named person reads in place of the figures. */
export function sheetNamedNotPaidWords(paidTo: string): string {
  return paidTo ? `You are named on this sheet. It is paid to ${paidTo}, so its amounts are not shown.` : 'You are named on this sheet. It does not name one person to pay yet, so its amounts are not shown.'
}

/** A person's sheets as they may read them: the ones that pay them with figures, the ones that only name them without. */
export function sheetsForViewer<T extends { parties: SheetParties }>(viewer: SheetViewer, sheets: readonly T[], rule: TeamSheetRule = TEAM_SHEET_RULE): { withAmounts: T[]; namedOnly: T[] } {
  const withAmounts: T[] = []
  const namedOnly: T[] = []
  for (const s of sheets) {
    const v = sheetAmountsView(viewer, s.parties, rule)
    if (sheetAmountsShown(v)) withAmounts.push(s)
    else if (v === 'named') namedOnly.push(s)
  }
  return { withAmounts, namedOnly }
}
