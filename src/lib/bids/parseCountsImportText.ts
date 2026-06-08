export type ParsedCountImportRow = {
  fixture: string
  count: number
  group_tag: string | null
  page: string | null
}

// Stable contract with the CountTooling "Copy to /Tooling" export: the trailing
// "View link:\t<url>" footer carries a deep link back to the source takeoff project.
// Detect by the `t=<uuid>` param shape, not by label or position (those may change).
export const COUNT_SOURCE_LINK_RE =
  /https?:\/\/\S*[?&]t=[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/

export function parseCountsImportText(text: string): {
  rows: ParsedCountImportRow[]
  skippedCount: number
  sourceLink: string | null
} {
  const rows: ParsedCountImportRow[] = []
  let skippedCount = 0
  // First match anywhere in the blob → the source view link (stored opaque, as-is).
  const sourceLink = text.match(COUNT_SOURCE_LINK_RE)?.[0] ?? null
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    // Skip the footer line carrying the source link — it is not a count row and
    // must not be reported as "skipped".
    if (COUNT_SOURCE_LINK_RE.test(trimmed)) continue
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
  return { rows, skippedCount, sourceLink }
}
