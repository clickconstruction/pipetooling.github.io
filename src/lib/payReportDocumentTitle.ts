/** Chars unsafe in titles / common filesystems — stripped from the name segment. */
const UNSAFE_FOR_TITLE = /[\\/:*?"<>|\u0000-\u001f]/g

function compactPayPeriodDate(isoDate: string): string {
  const parts = isoDate.trim().split('-')
  if (parts.length !== 3) return '000000'
  const [y, m, d] = parts
  if (y === undefined || m === undefined || d === undefined || y.length < 4) return '000000'
  return `${y.slice(-2)}${m}${d}`
}

function nameSegmentForPayTitle(personName: string): string {
  const first = personName.trim().split(/\s+/).find(Boolean) ?? ''
  if (!first) return 'Employee'
  const cleaned = first.replace(UNSAFE_FOR_TITLE, '').trim()
  return cleaned || 'Employee'
}

/** Tab / print-to-PDF title: `PayReport_Firstname_YYMMDD-YYMMDD` (HTML-escape at call site). */
export function buildPayReportDocumentTitle(
  personName: string,
  periodStart: string,
  periodEnd: string,
): string {
  const name = nameSegmentForPayTitle(personName)
  const start = compactPayPeriodDate(periodStart)
  const end = compactPayPeriodDate(periodEnd)
  return `PayReport_${name}_${start}-${end}`
}
