/**
 * The Writeups list's composition (v2.6433; the People → Paperwork spike, v2.6392 → Left): the
 * write-ups, the no-call no-shows and the derived lates merged into one list under the tab's
 * filters and sort. Lifted out of `WriteupsContractsSubTab` so the rule has a test: the
 * subject search holds every kind; the template, status and disclosure filters belong to
 * write-ups, so any of them set hides the no-shows and the lates; the lates show only while
 * *Show attendance (derived)* is on, and that box is **off when the page opens**, the owner's
 * call of 2026-11-02: most office people are late most days by the clock, so the derived rows
 * buried the eight write-ups and five no-shows on file under 175 lates.
 */

export const WRITEUPS_SHOW_ATTENDANCE_DEFAULT = false

export const NCNS_TEMPLATE_SORT_KEY = 'No-call, no-show'
export const LATE_TEMPLATE_SORT_KEY = 'Late arrival (derived)'

export type WriteupsTimelineStatusFilter = 'all' | 'draft' | 'submitted'
export type WriteupsTimelineDisclosureFilter = 'all' | 'discussed_with_subject' | 'withheld_from_subject'
export type WriteupsTimelineSortKey = 'created_at' | 'subject' | 'template'

export type WriteupsTimelineFilters = {
  /** The Subject search, matched inside the name, case folded; blank matches everyone. */
  subject: string
  /** A template id, or '' for every template. */
  templateId: string
  status: WriteupsTimelineStatusFilter
  disclosure: WriteupsTimelineDisclosureFilter
}

export type WriteupLike = {
  subject_name: string
  template_id: string
  template_name: string
  status: string
  disclosure: string | null
  created_at: string
}
export type NcnsLike = { subject_name: string; created_at: string }
export type LateLike = { subject_name: string; work_date: string }

export type WriteupsTimelineRowOf<W, N, L> =
  | { kind: 'writeup'; sortMs: number; writeup: W }
  | { kind: 'ncns'; sortMs: number; ncns: N }
  | { kind: 'late'; sortMs: number; late: L }

export type ComposeWriteupsTimelineInput<W extends WriteupLike, N extends NcnsLike, L extends LateLike> = {
  writeups: readonly W[]
  ncnsRows: readonly N[]
  lateEntries: readonly L[]
  showAttendance: boolean
  filters: WriteupsTimelineFilters
  sortKey: WriteupsTimelineSortKey
}

/** The template, status and disclosure filters are write-up filters: any of them set hides the other kinds. */
export function writeupsTimelineIncludesRecords(filters: Pick<WriteupsTimelineFilters, 'templateId' | 'status' | 'disclosure'>): boolean {
  return !filters.templateId && filters.status === 'all' && filters.disclosure === 'all'
}

function subjectOf<W extends WriteupLike, N extends NcnsLike, L extends LateLike>(row: WriteupsTimelineRowOf<W, N, L>): string {
  return row.kind === 'writeup' ? row.writeup.subject_name : row.kind === 'ncns' ? row.ncns.subject_name : row.late.subject_name
}

function templateOf<W extends WriteupLike, N extends NcnsLike, L extends LateLike>(row: WriteupsTimelineRowOf<W, N, L>): string {
  return row.kind === 'writeup' ? row.writeup.template_name : row.kind === 'ncns' ? NCNS_TEMPLATE_SORT_KEY : LATE_TEMPLATE_SORT_KEY
}

export function composeWriteupsTimeline<W extends WriteupLike, N extends NcnsLike, L extends LateLike>({
  writeups,
  ncnsRows,
  lateEntries,
  showAttendance,
  filters,
  sortKey,
}: ComposeWriteupsTimelineInput<W, N, L>): Array<WriteupsTimelineRowOf<W, N, L>> {
  const q = filters.subject.trim().toLowerCase()
  const matchesSubject = (name: string) => !q || name.toLowerCase().includes(q)

  let wRows = writeups.filter((r) => matchesSubject(r.subject_name))
  if (filters.templateId) wRows = wRows.filter((r) => r.template_id === filters.templateId)
  if (filters.status !== 'all') wRows = wRows.filter((r) => r.status === filters.status)
  if (filters.disclosure !== 'all') wRows = wRows.filter((r) => r.disclosure === filters.disclosure)

  const includeRecords = writeupsTimelineIncludesRecords(filters)
  const nRows = includeRecords ? ncnsRows.filter((r) => matchesSubject(r.subject_name)) : []
  const lRows = includeRecords && showAttendance ? lateEntries.filter((r) => matchesSubject(r.subject_name)) : []

  const timeline: Array<WriteupsTimelineRowOf<W, N, L>> = [
    ...wRows.map((w) => ({ kind: 'writeup' as const, sortMs: new Date(w.created_at).getTime(), writeup: w })),
    ...nRows.map((n) => ({ kind: 'ncns' as const, sortMs: new Date(n.created_at).getTime(), ncns: n })),
    ...lRows.map((l) => ({ kind: 'late' as const, sortMs: new Date(`${l.work_date}T12:00:00`).getTime(), late: l })),
  ]

  timeline.sort((a, b) => {
    if (sortKey === 'subject') {
      const c = subjectOf(a).localeCompare(subjectOf(b), undefined, { sensitivity: 'base' })
      if (c !== 0) return c
      return b.sortMs - a.sortMs
    }
    if (sortKey === 'template') {
      const c = templateOf(a).localeCompare(templateOf(b), undefined, { sensitivity: 'base' })
      if (c !== 0) return c
      return b.sortMs - a.sortMs
    }
    return b.sortMs - a.sortMs
  })
  return timeline
}
