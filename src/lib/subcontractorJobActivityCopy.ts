/** Mirrors `kind` strings from RPC `list_my_accessible_job_activity_events`. */
export type SubcontractorActivitySource = 'thread_note' | 'field_report' | 'clock' | 'schedule'

export const SUBCONTRACTOR_ACTIVITY_SOURCE_ORDER: SubcontractorActivitySource[] = [
  'thread_note',
  'field_report',
  'clock',
  'schedule',
]

export const subcontractorActivitySourceLabel: Record<SubcontractorActivitySource, string> = {
  thread_note: 'Thread note',
  field_report: 'Field report',
  clock: 'Clock session',
  schedule: 'Schedule',
}

export const subcontractorActivitySourceMeaning: Record<SubcontractorActivitySource, string> = {
  thread_note: 'Someone posted a note for this job.',
  field_report: 'Someone made a report for this job.',
  clock: 'Someone punched in/out on this job.',
  schedule: 'Work was scheduled on this job.',
}

/**
 * Plain-text “Label - meaning” line (e.g. tooling, tests). The Activity on this job modal uses
 * {@link subcontractorActivitySourceLabel} / {@link subcontractorActivitySourceMeaning} with `<strong>`
 * on the label instead.
 */
export function subcontractorActivityLegendLine(src: SubcontractorActivitySource): string {
  return `${subcontractorActivitySourceLabel[src]} - ${subcontractorActivitySourceMeaning[src]}`
}

const RPC_KIND_MAP: Partial<Record<string, SubcontractorActivitySource>> = {
  thread_note: 'thread_note',
  field_report: 'field_report',
  clock: 'clock',
  schedule: 'schedule',
}

export function subcontractorActivityLabelForRpcKind(kind: string): string {
  const k = RPC_KIND_MAP[kind.trim()]
  if (k) return subcontractorActivitySourceLabel[k]
  return kind.trim() ? kind : 'Activity'
}
