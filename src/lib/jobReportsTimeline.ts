import {
  isPercentFieldKey,
  tryParsePercent0to100,
} from './reportTemplateFieldDisplay'
import { isReportSignatureImageDataUrl } from './reportSignatureField'
import { stripLeadingRawJobIdPrefix } from './jobs/jobFormatting'

/**
 * Pure kernel for the job Reports timeline (v2.1548 — mockup option B):
 * per-report initials / completion percent / one-line preview, plus the
 * header's percent arc ("0% → 60%").
 */

export interface JobReportsTimelineReportLike {
  id: string
  created_by_name?: string | null
  field_values?: Record<string, string> | null
}

export interface JobReportsTimelineItem {
  id: string
  /** Up to two initials from the author's name; '?' when unknown. */
  initials: string
  /** Completion percent recorded on this report, when present. */
  percent: number | null
  /** First non-empty answer that isn't the percent or a signature — single line. */
  previewLine: string
}

export function jobReportAuthorInitials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]![0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

export function jobReportPercent(fieldValues: Record<string, string> | null | undefined): number | null {
  if (!fieldValues) return null
  for (const [label, value] of Object.entries(fieldValues)) {
    if (!isPercentFieldKey(label)) continue
    const p = tryParsePercent0to100(value)
    if (p != null) return p
  }
  return null
}

export function jobReportPreviewLine(fieldValues: Record<string, string> | null | undefined): string {
  if (!fieldValues) return ''
  for (const [label, value] of Object.entries(fieldValues)) {
    if (isPercentFieldKey(label)) continue
    // Strip the "<uuid> - " prefix HCP-imported notes carry (v2.1574) so the
    // preview line leads with the human part, not the import artifact.
    const s = stripLeadingRawJobIdPrefix((value ?? '').trim()).trim()
    if (!s || isReportSignatureImageDataUrl(s)) continue
    return s.split('\n')[0]!.trim()
  }
  return ''
}

export function buildJobReportsTimelineItems(
  reports: JobReportsTimelineReportLike[],
): JobReportsTimelineItem[] {
  return reports.map((r) => ({
    id: r.id,
    initials: jobReportAuthorInitials(r.created_by_name),
    percent: jobReportPercent(r.field_values),
    previewLine: jobReportPreviewLine(r.field_values),
  }))
}

/**
 * Header percent arc from reports ordered NEWEST FIRST (the RPC's order):
 * "from" is the oldest recorded percent, "to" the newest. Null when no report
 * carries a percent; from === to collapses to a single value for display.
 */
export function jobReportsPercentArc(
  reports: JobReportsTimelineReportLike[],
): { fromPercent: number; toPercent: number } | null {
  const percents = reports
    .map((r) => jobReportPercent(r.field_values))
    .filter((p): p is number => p != null)
  if (percents.length === 0) return null
  return { fromPercent: percents[percents.length - 1]!, toPercent: percents[0]! }
}
