/**
 * People → Users row ordering, filtering and the no-login fold (v2.2762).
 * Pure: the tab hands in its roster rows already tagged by the rail kernel;
 * this decides which show, in what order, and how many hide behind the fold.
 */
import type { RailRow } from './deskRailAttention'
import type { RowNeeds } from './rowNeeds'

export type UsersTabFilter = 'all' | 'nologin' | 'attention' | 'hours' | 'field' | 'office'

export const USERS_TAB_FILTERS: Array<{ key: UsersTabFilter; label: string }> = [
  { key: 'all', label: 'Everyone' },
  { key: 'nologin', label: 'No login' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'hours', label: 'Hours to approve' },
  { key: 'field', label: 'Field' },
  { key: 'office', label: 'Office' },
]

const FIELD_KINDS = new Set(['sub', 'helper', 'superintendent'])

export function rowMatchesFilter(row: RailRow, filter: UsersTabFilter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'nologin':
      return row.userId == null
    case 'attention':
      return row.attention !== 'green'
    case 'hours':
      return (row.rowNeeds?.hoursWaiting ?? 0) > 0
    case 'field':
      return FIELD_KINDS.has(row.kind)
    case 'office':
      return !FIELD_KINDS.has(row.kind)
  }
}

/**
 * v2.2809: a rail row re-read through the grouped needs — the dot and the Needs attention
 * filter follow `needs` (hours and facts never move them), and the row carries the needs
 * for the status column to render.
 */
export function applyRowNeeds(row: RailRow, rowNeeds: RowNeeds): RailRow {
  return { ...row, attention: rowNeeds.attention, reasons: rowNeeds.reasons, rowNeeds }
}

/** Account rows first, then roster-only rows, alphabetical within each. */
export function orderUsersTabRows(rows: readonly RailRow[]): RailRow[] {
  return [...rows].sort((a, b) => {
    const la = a.userId ? 0 : 1
    const lb = b.userId ? 0 : 1
    if (la !== lb) return la - lb
    return a.name.localeCompare(b.name)
  })
}

/** How many roster-only rows a group shows before folding the rest behind "+ N more without a login". */
export const NO_LOGIN_FOLD_THRESHOLD = 6

/**
 * Splits a group into the rows always shown and the roster-only rows that
 * hide behind the fold. The fold only applies when it would hide at least two
 * rows and nothing is forcing everything open (a search, the No-login filter,
 * or the user having opened it).
 */
export function foldNoLoginRows(
  ordered: readonly RailRow[],
  opts: { forceOpen: boolean; threshold?: number },
): { shown: RailRow[]; folded: RailRow[] } {
  const threshold = opts.threshold ?? NO_LOGIN_FOLD_THRESHOLD
  const noLogin = ordered.filter((r) => r.userId == null)
  if (opts.forceOpen || noLogin.length <= threshold + 1) return { shown: [...ordered], folded: [] }
  const keep = new Set(noLogin.slice(0, threshold).map((r) => r.personId ?? r.name))
  const shown: RailRow[] = []
  const folded: RailRow[] = []
  for (const r of ordered) {
    if (r.userId != null || keep.has(r.personId ?? r.name)) shown.push(r)
    else folded.push(r)
  }
  return { shown, folded }
}

/** "16 · 2 with a login" — the group header count. */
export function describeGroupCount(rows: readonly RailRow[]): string {
  const total = rows.length
  const withLogin = rows.filter((r) => r.userId != null).length
  if (total === 0) return ''
  if (withLogin === total) return String(total)
  if (withLogin === 0) return `${total} · no logins`
  return `${total} · ${withLogin} with a login`
}
