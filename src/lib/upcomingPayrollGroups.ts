/**
 * Per-person view of the "Upcoming payroll — not yet reported" modal: the summary's person-weeks
 * grouped under one row per person, a sort key that orders people (weeks always stay with their
 * person), and a what-if exclusion set that drops people from the totals without hiding them.
 * Pure — the modal owns the state and calls these on render.
 */

import type { UpcomingPayrollLine } from './upcomingPayrollSummary'

export type UpcomingPersonGroup = {
  personName: string
  weekCount: number
  hours: number
  estimatedGrossDollars: number
  /** This person's weeks, oldest first — the order the summary already emits. */
  lines: UpcomingPayrollLine[]
}

export type UpcomingSortKey = 'name' | 'hours' | 'gross'

export type UpcomingSort = { key: UpcomingSortKey; dir: 1 | -1 }

/** Default ordering matches the table before this view existed: people A → Z. */
export const DEFAULT_UPCOMING_SORT: UpcomingSort = { key: 'name', dir: 1 }

/** One group per person, in first-seen order (the summary emits people A → Z). */
export function groupUpcomingPayrollByPerson(lines: readonly UpcomingPayrollLine[]): UpcomingPersonGroup[] {
  const byName = new Map<string, UpcomingPersonGroup>()
  for (const line of lines) {
    let g = byName.get(line.personName)
    if (!g) {
      g = { personName: line.personName, weekCount: 0, hours: 0, estimatedGrossDollars: 0, lines: [] }
      byName.set(line.personName, g)
    }
    g.weekCount += 1
    g.hours += line.hours
    g.estimatedGrossDollars += line.estimatedGrossDollars
    g.lines.push(line)
  }
  return [...byName.values()]
}

/**
 * Clicking a sort control: a new key takes its natural direction (names ascending, amounts and
 * hours biggest first); the same key again flips.
 */
export function nextUpcomingSort(current: UpcomingSort, key: UpcomingSortKey): UpcomingSort {
  if (current.key === key) return { key, dir: current.dir === 1 ? -1 : 1 }
  return { key, dir: key === 'name' ? 1 : -1 }
}

export function sortUpcomingGroups(groups: readonly UpcomingPersonGroup[], sort: UpcomingSort): UpcomingPersonGroup[] {
  const out = [...groups]
  out.sort((a, b) => {
    const primary =
      sort.key === 'name'
        ? a.personName.localeCompare(b.personName)
        : sort.key === 'hours'
          ? a.hours - b.hours
          : a.estimatedGrossDollars - b.estimatedGrossDollars
    // Ties (two people at $0.00) fall back to name so the order is stable across renders.
    return (primary === 0 ? a.personName.localeCompare(b.personName) : primary) * sort.dir
  })
  return out
}

export type UpcomingTotals = {
  totalPeople: number
  includedPeople: number
  excludedPeople: number
  /** Person-weeks belonging to included people. */
  personWeeks: number
  hours: number
  estimatedGrossDollars: number
  /** What the excluded people would have added — shown as "−$X" next to the total. */
  excludedGrossDollars: number
}

export function upcomingTotals(groups: readonly UpcomingPersonGroup[], excluded: ReadonlySet<string>): UpcomingTotals {
  const t: UpcomingTotals = {
    totalPeople: groups.length,
    includedPeople: 0,
    excludedPeople: 0,
    personWeeks: 0,
    hours: 0,
    estimatedGrossDollars: 0,
    excludedGrossDollars: 0,
  }
  for (const g of groups) {
    if (excluded.has(g.personName)) {
      t.excludedPeople += 1
      t.excludedGrossDollars += g.estimatedGrossDollars
      continue
    }
    t.includedPeople += 1
    t.personWeeks += g.weekCount
    t.hours += g.hours
    t.estimatedGrossDollars += g.estimatedGrossDollars
  }
  return t
}

/** Toggle one person in the exclusion set (returns a new set — React state). */
export function toggleExcluded(excluded: ReadonlySet<string>, personName: string): Set<string> {
  const next = new Set(excluded)
  if (next.has(personName)) next.delete(personName)
  else next.add(personName)
  return next
}

/** Parse a persisted sort; anything malformed falls back to the default. */
export function parseUpcomingSort(raw: string | null | undefined): UpcomingSort {
  if (!raw) return DEFAULT_UPCOMING_SORT
  try {
    const v = JSON.parse(raw) as { key?: unknown; dir?: unknown }
    const key = v.key === 'name' || v.key === 'hours' || v.key === 'gross' ? v.key : null
    const dir = v.dir === 1 || v.dir === -1 ? v.dir : null
    return key && dir ? { key, dir } : DEFAULT_UPCOMING_SORT
  } catch {
    return DEFAULT_UPCOMING_SORT
  }
}
