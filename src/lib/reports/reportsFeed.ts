/**
 * Jobs → Reports feed kernel (vFEED): the little date/preview decisions the
 * newest-first view makes, kept pure. The feed's promise is "readable without
 * tapping": day rules instead of timestamps, and the first lines of a report
 * on the card.
 */
import { formatReportFieldValueInlineList } from '../reportSignatureField'

const DAY_MS = 24 * 60 * 60 * 1000

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "Today" / "Yesterday" / "Mon, Aug 18" / "Aug 18, 2025" (other years). */
export function reportDayLabel(iso: string, now: Date): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dYmd = localYmd(d)
  if (dYmd === localYmd(now)) return 'Today'
  if (dYmd === localYmd(new Date(now.getTime() - DAY_MS))) return 'Yesterday'
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "2:40 pm" — the day header carries the date. */
export function reportTimeLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()
}

/** Group already-sorted (newest-first) rows under day labels, preserving order. */
export function groupReportsByDay<T extends { created_at: string }>(rows: readonly T[], now: Date): { label: string; rows: T[] }[] {
  const groups: { label: string; rows: T[] }[] = []
  for (const r of rows) {
    const label = reportDayLabel(r.created_at, now)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.rows.push(r)
    else groups.push({ label, rows: [r] })
  }
  return groups
}

export type ReportPreviewLine = { label: string; value: string }

/**
 * The first `max` non-empty fields, formatted for one line each: signature
 * data-URLs read "✍ signed", list values join with " · " (the shared
 * formatter), and long values clip with an ellipsis so the card stays a card.
 */
export function reportPreviewLines(fieldValues: Record<string, string> | null | undefined, max = 2): ReportPreviewLine[] {
  if (!fieldValues) return []
  const out: ReportPreviewLine[] = []
  for (const [label, raw] of Object.entries(fieldValues)) {
    if (out.length >= max) break
    const v = (raw ?? '').trim()
    if (!v) continue
    const value = v.startsWith('data:image') ? '✍ signed' : formatReportFieldValueInlineList(v)
    const clipped = value.length > 90 ? `${value.slice(0, 89).trimEnd()}…` : value
    out.push({ label, value: clipped })
  }
  return out
}
