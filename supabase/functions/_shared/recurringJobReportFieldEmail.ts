/** Subset of `src/lib/reportTemplateFieldDisplay` for Edge HTML emails (no React). */

export const REPORT_FIELD_LABEL_JOB_COMPLETION = 'How complete is the job?'
export const REPORT_FIELD_LABEL_LEGACY_WHO = 'Who was on the job?'
export const REPORT_SIGNATURE_ON_FILE = '[Signature on file]'

export function isReportSignatureImageDataUrl(s: string): boolean {
  const t = (s ?? '').trim()
  return t.startsWith('data:image/') && t.includes(';base64,')
}

function tryParsePercent0to100(raw: string): number | null {
  if (raw == null || raw === '') return null
  const n = Number.parseInt(String(raw).trim(), 10)
  if (Number.isNaN(n) || n < 0 || n > 100) return null
  return n
}

export function formatReportFieldValueForRead(label: string, value: string): string {
  if (isReportSignatureImageDataUrl(value)) return ''
  if (label === REPORT_FIELD_LABEL_JOB_COMPLETION || label === REPORT_FIELD_LABEL_LEGACY_WHO) {
    const p = tryParsePercent0to100(value)
    if (p != null) return `${p}%`
  }
  return value
}

export function displayLabelForFieldKey(fieldKey: string): string {
  if (fieldKey === REPORT_FIELD_LABEL_LEGACY_WHO) return REPORT_FIELD_LABEL_JOB_COMPLETION
  return fieldKey
}
