import { isReportSignatureImageDataUrl, REPORT_SIGNATURE_ON_FILE } from './reportSignatureField'

/** Label after migration (Superintendent Report first field). */
export const REPORT_FIELD_LABEL_JOB_COMPLETION = 'How complete is the job?'
/** JSON key in older `reports.field_values` before rename. */
export const REPORT_FIELD_LABEL_LEGACY_WHO = 'Who was on the job?'

export function normalizePercentFieldValueToString(raw: string | undefined | null): string {
  if (raw == null || raw === '') return '0'
  const n = Number.parseInt(String(raw).trim(), 10)
  if (Number.isNaN(n)) return '0'
  return String(Math.max(0, Math.min(100, n)))
}

export function tryParsePercent0to100(raw: string | undefined | null): number | null {
  if (raw == null || raw === '') return null
  const n = Number.parseInt(String(raw).trim(), 10)
  if (Number.isNaN(n) || n < 0 || n > 100) return null
  return n
}

/** One-line value for read-only report body. */
export function formatReportFieldValueForRead(
  label: string,
  value: string,
  opts?: { inputType?: 'long_text' | 'percent_0_100' | 'signature_png' | null },
): string {
  const t = opts?.inputType
  if (t === 'signature_png' || isReportSignatureImageDataUrl(value)) {
    return ''
  }
  if (t === 'percent_0_100' || label === REPORT_FIELD_LABEL_JOB_COMPLETION) {
    const p = tryParsePercent0to100(value)
    if (p != null) return `${p}%`
  }
  if (label === REPORT_FIELD_LABEL_LEGACY_WHO) {
    const p = tryParsePercent0to100(value)
    if (p != null) return `${p}%`
  }
  return value
}

/** Heading shown above a field in read-only view (migrates legacy key to the new copy). */
export function displayLabelForFieldKey(fieldKey: string): string {
  if (fieldKey === REPORT_FIELD_LABEL_LEGACY_WHO) return REPORT_FIELD_LABEL_JOB_COMPLETION
  return fieldKey
}

export function isPercentFieldKey(label: string): boolean {
  return label === REPORT_FIELD_LABEL_JOB_COMPLETION || label === REPORT_FIELD_LABEL_LEGACY_WHO
}

/** One line for Stages Notes thread preview under the report template name. */
export function formatReportFieldValueForThreadSummary(label: string, value: string): string {
  const t = (value ?? '').trim()
  if (isReportSignatureImageDataUrl(t)) {
    return REPORT_SIGNATURE_ON_FILE
  }
  if (isPercentFieldKey(label)) {
    const p = tryParsePercent0to100(t)
    if (p != null) return `I think the job is ${p}% complete`
  }
  return t
}

type FieldForSubmit = { label: string; input_type?: string | null }

export function fieldValueForSubmit(
  f: FieldForSubmit,
  fieldValues: Record<string, string>,
): string {
  const it = f.input_type ?? 'long_text'
  if (it === 'percent_0_100') {
    return normalizePercentFieldValueToString(fieldValues[f.label])
  }
  if (it === 'signature_png') {
    return fieldValues[f.label] ?? ''
  }
  return fieldValues[f.label] ?? ''
}
