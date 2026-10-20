import type { Vectors } from './vectors'

/**
 * The People strip (Bridge redraw PR 6): Vectors and Vectors by the day fold
 * under one strip, closed by default and remembered per browser, with a
 * one-line summary of the pay week while closed. Pure but for the storage pair.
 */

export const BRIDGE_PEOPLE_OPEN_KEY = 'bridge_people_open_v1'

export function readPeopleOpen(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(BRIDGE_PEOPLE_OPEN_KEY) === '1'
  } catch {
    return false
  }
}

export function writePeopleOpen(open: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(BRIDGE_PEOPLE_OPEN_KEY, open ? '1' : '0')
  } catch {
    /* a private window or blocked storage: the strip still toggles */
  }
}

const shortK = (n: number): string => `${n < 0 ? '−' : ''}$${Math.abs(n) >= 100_000 ? `${(Math.abs(n) / 1000).toFixed(0)}k` : Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(1)}k` : `${Math.round(Math.abs(n))}`}`
const signed = (n: number): string => `${n >= 0 ? '+' : ''}${shortK(n)}`
const firstName = (name: string): string => name.split(/\s+/)[0] ?? name

/** One line for the closed strip: the top contributors on approved hours, who waits, billed and collected. */
export function peopleSummary(v: Vectors | null, weekLabel: string, isCurrentWeek: boolean): string {
  if (!v) return `pay week ${weekLabel}${isCurrentWeek ? ' (so far)' : ''} · reading…`
  const parts: string[] = [`pay week ${weekLabel}${isCurrentWeek ? ' (so far)' : ''}`]
  const field = v.rows.filter((r) => r.contributionUsd != null && r.fieldHours > 0).sort((a, b) => (b.contributionUsd ?? 0) - (a.contributionUsd ?? 0))
  if (field.length > 0) {
    const top = field.slice(0, 2).map((r) => `${firstName(r.name)} ${signed(r.contributionUsd ?? 0)}`)
    parts.push(`${top.join(', ')}${field.length > 2 ? ` and ${field.length - 2} more` : ''} on approved hours`)
  } else parts.push('no approved field hours yet')
  const waiting = v.rows.filter((r) => r.pendingHours > 0).length
  if (waiting > 0) parts.push(`${waiting} ${waiting === 1 ? 'person' : 'people'} with hours waiting`)
  if (v.totals.billedUsd > 0 || v.totals.collectedUsd > 0) parts.push(`billed ${shortK(v.totals.billedUsd)}, collected ${shortK(v.totals.collectedUsd)}`)
  if (v.unattributed.collectedUsd > 0) parts.push(`${shortK(v.unattributed.collectedUsd)} collected on nobody's row`)
  return parts.join(' · ')
}
