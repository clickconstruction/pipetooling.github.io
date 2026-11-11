import type { LienHelpClerk } from './lienHelpSheet'

/**
 * Where each county clerk takes a filing, as the office typed it in Settings (punch list #314, change 10). Pure.
 *
 * A help sheet that says *file with the Alder County Clerk* leaves a first-timer to find the address, the fee and the
 * hours. The app holds none of those and must not guess one, so Settings carry a short list the office types once:
 * one clerk per line, `County | where to file | fee | hours`. A county with no line prints as it did before.
 */

/** The county as a key: `Alder`, `alder county` and ` ALDER ` are one clerk. */
export function clerkCountyKey(county: string | null | undefined): string {
  return (county ?? '').trim().replace(/\s+county$/i, '').replace(/\s+/g, ' ').toLowerCase()
}

export type LienCountyClerkRow = LienHelpClerk & { county: string }

/** The list as typed, read line by line. A line with no county, or with nothing after it, is skipped. */
export function parseCountyClerks(text: string | null | undefined): LienCountyClerkRow[] {
  const rows: LienCountyClerkRow[] = []
  const seen = new Set<string>()
  for (const line of (text ?? '').split(/\r?\n/)) {
    const [county = '', where = '', fee = '', hours = ''] = line.split('|').map((part) => part.trim())
    const key = clerkCountyKey(county)
    // The first line for a county stands, so a second one typed by mistake cannot change what prints without being seen.
    if (!key || seen.has(key) || !(where || fee || hours)) continue
    seen.add(key)
    rows.push({ county: county.replace(/\s+county$/i, '').trim(), where, fee, hours })
  }
  return rows
}

/** The clerk for a property's county; undefined when the office has typed none. */
export function lienClerkFor(text: string | null | undefined, county: string | null | undefined): LienHelpClerk | undefined {
  const key = clerkCountyKey(county)
  if (!key) return undefined
  const row = parseCountyClerks(text).find((r) => clerkCountyKey(r.county) === key)
  return row ? { where: row.where, fee: row.fee, hours: row.hours } : undefined
}

/** Under the Settings box: how a line is typed. */
export const COUNTY_CLERKS_HINT = 'One clerk on each line: County | where to file | fee | hours. The lien help sheets print a clerk’s line beside its papers. A county with no line prints none.'

/** The box's placeholder: one made-up line in the shape the list takes. */
export const COUNTY_CLERKS_EXAMPLE = 'Alder | 100 Court St, Marlow | $26 first page, $4 each more | 8 to 5'
