export type ParsedCountImportRow = {
  fixture: string
  count: number
  group_tag: string | null
  page: string | null
}

export function parseCountsImportText(text: string): { rows: ParsedCountImportRow[]; skippedCount: number } {
  const rows: ParsedCountImportRow[] = []
  let skippedCount = 0
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const delimiter = trimmed.includes('\t') ? '\t' : ','
    const cells = trimmed.split(delimiter).map((c) => c.trim())
    const fixture = cells[0] ?? ''
    const countStr = cells[1] ?? ''
    const groupTag = cells.length >= 4 ? ((cells[2] ?? '').trim() || null) : null
    const page = (cells.length >= 4 ? (cells[3] ?? '') : (cells[2] ?? '')).trim() || null
    if (!fixture || !countStr) {
      skippedCount++
      continue
    }
    const count = parseFloat(countStr)
    if (isNaN(count) || count < 0) {
      skippedCount++
      continue
    }
    rows.push({ fixture, count, group_tag: groupTag, page })
  }
  return { rows, skippedCount }
}
