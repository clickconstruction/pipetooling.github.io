import { ymdAddDays } from '../utils/dateUtils'

/**
 * "Who makes up overhead" table kernel (v2.2675) for People → Overhead.
 *
 * Rows are people; columns are the three pool components (office labor, bid
 * labor, office parts) plus the total, over a trailing window ending on the
 * company calendar day. Each cell carries the amount AND its share of the
 * column, so "who" reads at a glance.
 *
 * Attribution: labor lines carry the clock user's name. Parts lines carry a
 * person only when the tab could resolve one (Mercury debit-card nickname);
 * supply-house invoices, ACH/wire/check purchases, and tally lines have no
 * person and land on ONE explicit "no person" row rather than vanishing —
 * the column still sums to the pool.
 *
 * Pure: no React, no Supabase. Same approval/pricing semantics as the pool.
 */

export type OverheadPeopleWindowKey = 'day' | 'week' | 'month' | 'quarter'

export const OVERHEAD_PEOPLE_WINDOWS: ReadonlyArray<{ key: OverheadPeopleWindowKey; label: string; days: number }> = [
  { key: 'day', label: 'Today', days: 1 },
  { key: 'week', label: 'Last 7 days', days: 7 },
  { key: 'month', label: 'Last 30 days', days: 30 },
  { key: 'quarter', label: 'Last 90 days', days: 90 },
]

export type OverheadPeopleLaborInput = {
  workDate: string
  userName: string
  bucket: 'office' | 'bid'
  hours: number
  laborUsd: number
}

export type OverheadPeoplePartsInput = {
  workDate: string
  amountUsd: number
  /** Resolved person (card nickname) or null when the purchase has no person. */
  person: string | null
}

export type OverheadPeopleRow = {
  name: string
  officeLaborUsd: number
  bidLaborUsd: number
  officePartsUsd: number
  totalUsd: number
  /** Office + bid clock hours (labor rows only; 0 for the no-person parts row). */
  hours: number
  /** The synthetic "no person" parts row. */
  unattributed: boolean
}

export type OverheadPeopleTotals = {
  officeLaborUsd: number
  bidLaborUsd: number
  officePartsUsd: number
  totalUsd: number
  hours: number
}

export type OverheadPeopleTable = {
  startYmd: string
  endYmd: string
  days: number
  rows: OverheadPeopleRow[]
  totals: OverheadPeopleTotals
}

export const OVERHEAD_PEOPLE_NO_PERSON_LABEL = 'No person — supply invoices, ACH/wire, tally'

const num = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/**
 * Card nicknames usually carry the card's last four ("Malachi 6783"); strip
 * that so the purchase merges with the person's labor row. A shared card
 * ("Taunya or Wendi") has no suffix and stays its own row on purpose.
 */
export function overheadPeopleDisplayName(raw: string): string {
  return raw.trim().replace(/\s+\d{4}$/, '')
}

export function buildOverheadPeopleTable(input: {
  labor: ReadonlyArray<OverheadPeopleLaborInput>
  parts: ReadonlyArray<OverheadPeoplePartsInput>
  endYmd: string
  days: number
}): OverheadPeopleTable {
  const days = Math.max(1, Math.floor(input.days))
  const startYmd = ymdAddDays(input.endYmd, -(days - 1))
  const inWindow = (ymd: string) => ymd >= startYmd && ymd <= input.endYmd

  const byKey = new Map<string, OverheadPeopleRow>()
  const rowFor = (name: string, unattributed = false): OverheadPeopleRow => {
    const display = overheadPeopleDisplayName(name)
    const key = unattributed ? ' unattributed' : display.toLowerCase()
    let row = byKey.get(key)
    if (!row) {
      row = {
        name: unattributed ? OVERHEAD_PEOPLE_NO_PERSON_LABEL : display,
        officeLaborUsd: 0,
        bidLaborUsd: 0,
        officePartsUsd: 0,
        totalUsd: 0,
        hours: 0,
        unattributed,
      }
      byKey.set(key, row)
    }
    return row
  }

  for (const l of input.labor) {
    if (!inWindow(l.workDate)) continue
    const name = l.userName.trim()
    if (!name) continue
    const row = rowFor(name)
    const usd = num(l.laborUsd)
    if (l.bucket === 'office') row.officeLaborUsd += usd
    else row.bidLaborUsd += usd
    row.hours += num(l.hours)
    row.totalUsd += usd
  }
  for (const p of input.parts) {
    if (!inWindow(p.workDate)) continue
    const usd = num(p.amountUsd)
    if (usd === 0) continue
    const person = p.person?.trim() ?? ''
    const row = person ? rowFor(person) : rowFor('', true)
    row.officePartsUsd += usd
    row.totalUsd += usd
  }

  const rows = [...byKey.values()].sort((a, b) => {
    if (a.unattributed !== b.unattributed) return a.unattributed ? 1 : -1
    if (b.totalUsd !== a.totalUsd) return b.totalUsd - a.totalUsd
    return a.name.localeCompare(b.name)
  })
  const totals = rows.reduce<OverheadPeopleTotals>(
    (t, r) => ({
      officeLaborUsd: t.officeLaborUsd + r.officeLaborUsd,
      bidLaborUsd: t.bidLaborUsd + r.bidLaborUsd,
      officePartsUsd: t.officePartsUsd + r.officePartsUsd,
      totalUsd: t.totalUsd + r.totalUsd,
      hours: t.hours + r.hours,
    }),
    { officeLaborUsd: 0, bidLaborUsd: 0, officePartsUsd: 0, totalUsd: 0, hours: 0 },
  )
  return { startYmd, endYmd: input.endYmd, days, rows, totals }
}

/** Share of a column (0–1); null when the column total is not positive. */
export function overheadPeopleShare(value: number, columnTotal: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(columnTotal) || columnTotal <= 0) return null
  return value / columnTotal
}
