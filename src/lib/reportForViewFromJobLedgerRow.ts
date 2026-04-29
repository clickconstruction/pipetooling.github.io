import type { ReportForView } from '../components/ReportViewModal'
import type { Database, Json } from '../types/database'
import {
  formatReportFieldValueForThreadSummary,
  REPORT_FIELD_LABEL_JOB_COMPLETION,
  REPORT_FIELD_LABEL_LEGACY_WHO,
} from './reportTemplateFieldDisplay'

export type ReportForJobLedgerRow = Database['public']['Functions']['list_reports_for_job_ledger']['Returns'][number]
export type ReportForBidListRow = Database['public']['Functions']['list_reports_for_bid']['Returns'][number]

function fieldValuesJsonToRecord(fv: Json | undefined): Record<string, string> {
  if (fv == null || typeof fv !== 'object' || Array.isArray(fv)) return {}
  const o: Record<string, string> = {}
  for (const [k, v] of Object.entries(fv as Record<string, unknown>)) {
    if (v != null) o[k] = String(v)
  }
  return o
}

/** Map RPC row from `list_reports_for_job_ledger` to the modal’s view shape. */
export function reportForViewFromJobLedgerRow(r: ReportForJobLedgerRow): ReportForView {
  return {
    id: r.id,
    template_name: r.template_name,
    job_display_name: r.job_display_name,
    created_at: r.created_at,
    created_by_name: r.created_by_name,
    field_values: fieldValuesJsonToRecord(r.field_values),
    reported_at_lat: r.reported_at_lat != null ? Number(r.reported_at_lat) : null,
    reported_at_lng: r.reported_at_lng != null ? Number(r.reported_at_lng) : null,
  }
}

/** Map RPC row from `list_reports_for_bid` to the modal’s view shape. */
export function reportForViewFromListReportsForBidRow(r: ReportForBidListRow): ReportForView {
  return {
    id: r.id,
    template_name: r.template_name,
    job_display_name: r.job_display_name,
    created_at: r.created_at,
    created_by_name: r.created_by_name,
    field_values: fieldValuesJsonToRecord(r.field_values),
    reported_at_lat: r.reported_at_lat != null ? Number(r.reported_at_lat) : null,
    reported_at_lng: r.reported_at_lng != null ? Number(r.reported_at_lng) : null,
  }
}

export function firstNonEmptyFieldValueSummary(report: ReportForView, maxLen = 120): string {
  const raw = report.field_values
  if (raw == null) return ''
  const hasNewCompletionKey = Object.prototype.hasOwnProperty.call(raw, REPORT_FIELD_LABEL_JOB_COMPLETION)
  const entries = Object.entries(raw).filter(([label]) => {
    if (label === REPORT_FIELD_LABEL_LEGACY_WHO && hasNewCompletionKey) return false
    return true
  })
  for (const [label, v] of entries) {
    const t = (v ?? '').trim()
    if (!t) continue
    const line = formatReportFieldValueForThreadSummary(label, t)
    return line.length > maxLen ? `${line.slice(0, maxLen - 1)}…` : line
  }
  return ''
}
