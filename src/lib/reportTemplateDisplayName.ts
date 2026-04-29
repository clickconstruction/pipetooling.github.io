import type { UserRole } from '../hooks/useAuth'

const SUPERINTENDENT_REPORT_LEGACY_NAME = 'Superintendent Report'
const STATUS_REPORT_LABEL = 'Status Report'

/**
 * Viewer-facing report template label. Maps legacy stored name `Superintendent Report`
 * to **Status Report** (same as current `report_templates` row).
 */
export function displayReportTemplateName(
  name: string,
  _viewerRole: UserRole | null | undefined,
): string {
  if (name === SUPERINTENDENT_REPORT_LEGACY_NAME) return STATUS_REPORT_LABEL
  return name
}

/**
 * Short label for Additional Report modal template chips: same as {@link displayReportTemplateName}
 * minus a redundant trailing word "Report" (case-insensitive), e.g. "Status Report" → "Status".
 */
export function additionalReportModalTemplateChipLabel(
  name: string,
  viewerRole: UserRole | null | undefined,
): string {
  const full = displayReportTemplateName(name, viewerRole).trim()
  const stripped = full.replace(/\s+report$/i, '').trim()
  return stripped.length > 0 ? stripped : full
}

/** Status + Job Complete templates get a persistent blue chip style in Additional Report (see modal). */
export function additionalReportModalBlueChipTemplate(name: string): boolean {
  const trimmed = name.trim()
  if (trimmed === 'Job Complete') return true
  return displayReportTemplateName(trimmed, null) === STATUS_REPORT_LABEL
}

/** Prefer Status template row for Additional Report default selection. */
export function findStatusReportTemplateId(templates: readonly { id: string; name: string }[]): string | undefined {
  for (const t of templates) {
    if (displayReportTemplateName(t.name, null) === STATUS_REPORT_LABEL) return t.id
  }
  return undefined
}
