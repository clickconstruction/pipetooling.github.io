import type { BidCountRow } from '../../types/bids'

export function csvEscapeField(value: string): string {
  const s = value ?? ''
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function sanitizeCsvFilenamePart(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

/** Builds the counts CSV body (no BOM). Caller prepends `\uFEFF` for Excel. */
export function buildCountsCsv(rows: BidCountRow[]): string {
  const headerLabels = ['Count', 'Fixture or Tie-in', 'Group/Tag', 'Plan Page']
  const lines = [headerLabels.map((h) => csvEscapeField(h)).join(',')]
  for (const row of rows) {
    lines.push(
      [
        String(row.count),
        csvEscapeField(row.fixture),
        csvEscapeField(row.group_tag ?? ''),
        csvEscapeField(row.page ?? ''),
      ].join(','),
    )
  }
  return lines.join('\n')
}
