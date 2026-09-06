/**
 * People → Hours: the one roster the grid (and the cost summaries under it) show
 * (journey-map J7-6).
 *
 * The rows are the pay-config key set minus archived accounts, in the org-wide
 * display order. Both pay roles (`people_pay_config` SELECT) and hours-only roles
 * (`list_people_pay_flags` RPC) read every pay-config row, and `get_archived_user_names`
 * is SECURITY DEFINER — so the roster is identical for every viewer **provided the
 * archived set is actually loaded**. It was not for assistants (the hours-tab load only
 * fetched it under `canAccessPay`), which is why an assistant's grid carried eight
 * zero-hour rows for archived helpers the owner's grid did not. The loader gate is fixed
 * in `People.tsx`; this kernel is the single place the row list is derived so the two
 * call sites cannot drift again.
 */
export type HoursGridRosterInput = {
  /** `Object.keys(payConfig)` — every person with a pay-config row. */
  payConfigNames: readonly string[]
  /** Trimmed names of archived `users` rows (`get_archived_user_names`). */
  archivedUserNames: ReadonlySet<string>
  /** `people_hours_display_order` → sequence; missing names sort last, alphabetically. */
  displayOrder: Readonly<Record<string, number>>
}

const UNORDERED = 999_999

export function buildHoursGridRoster({ payConfigNames, archivedUserNames, displayOrder }: HoursGridRosterInput): string[] {
  return payConfigNames
    .filter((n) => !archivedUserNames.has(n.trim()))
    .sort((a, b) => {
      const orderA = displayOrder[a] ?? UNORDERED
      const orderB = displayOrder[b] ?? UNORDERED
      return orderA !== orderB ? orderA - orderB : a.localeCompare(b)
    })
}
