import { classifyCountRowUnit, type CountUnit } from './countRowUnit'

export type ParsedCountImportRow = {
  fixture: string
  count: number
  group_tag: string | null
  page: string | null
  /** Stamped from the name convention at import time (CountTooling's `ft of …` / `px of …` prefixes). */
  unit: CountUnit
}

// Stable contract with the CountTooling "Copy to /Tooling" export: the trailing
// "View link:\t<url>" footer carries a deep link back to the source takeoff project.
// Detect by the `t=<uuid>` param shape, not by label or position (those may change).
export const COUNT_SOURCE_LINK_RE =
  /https?:\/\/\S*[?&]t=[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/

// CountTooling frames headings as `--- <text> ---` (the D25 scope header
// `--- Counts, <project> · every sheet · every layer ---` since 2026-09-13, and
// `--- Duct ---`). A heading is never a row: without this, a project named
// "2026 …" parsed as fixture "--- Counts" × 2026 (the comma split).
export const COUNT_HEADING_LINE_RE = /^---\s.*\s---$/

// CountTooling's alternate block (its ALT-GROUPS, 2026-09-29): `--- Alternate: <name> ---`
// opens the rows of a group the customer wants priced with and without; a blank line or
// the next framed heading ends it. The name is the group's name, so a row under it that
// carries no group of its own joins that group.
export const COUNT_ALTERNATE_HEADING_RE = /^---\s*Alternate:\s*(.+?)\s*---$/i

// CountTooling's `[Group] ` name prefix (a circuit, an area, an alternate). Lifted into
// group_tag and taken OFF the fixture: a bracketed name matched no book entry and no
// other version's row (both matchers compare the exact name), which is how the group
// column stayed empty on every import since the classic table (v2.4188).
export const COUNT_GROUP_PREFIX_RE = /^\[([^\]]*)\]\s*/

export function parseCountsImportText(text: string): {
  rows: ParsedCountImportRow[]
  skippedCount: number
  sourceLink: string | null
  /** The alternate groups the text names, first spelling kept, in the order they appear. */
  alternateGroups: string[]
} {
  const rows: ParsedCountImportRow[] = []
  const alternateGroups: string[] = []
  let skippedCount = 0
  // First match anywhere in the blob → the source view link (stored opaque, as-is).
  const sourceLink = text.match(COUNT_SOURCE_LINK_RE)?.[0] ?? null
  const lines = text.split(/\r?\n/)
  let inAlternate: string | null = null
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      inAlternate = null
      continue
    }
    // Skip the footer line carrying the source link — it is not a count row and
    // must not be reported as "skipped".
    if (COUNT_SOURCE_LINK_RE.test(trimmed)) continue
    const alt = trimmed.match(COUNT_ALTERNATE_HEADING_RE)
    if (alt) {
      const name = alt[1]!.trim()
      inAlternate = name
      if (!alternateGroups.some((g) => g.toLowerCase() === name.toLowerCase())) alternateGroups.push(name)
      continue
    }
    // Framed headings are structure, not counts — and not "skipped" either.
    if (COUNT_HEADING_LINE_RE.test(trimmed)) {
      inAlternate = null
      continue
    }
    const delimiter = trimmed.includes('\t') ? '\t' : ','
    const cells = trimmed.split(delimiter).map((c) => c.trim())
    const rawFixture = cells[0] ?? ''
    const prefix = rawFixture.match(COUNT_GROUP_PREFIX_RE)
    const prefixGroup = prefix ? prefix[1]!.trim() || null : null
    const fixture = prefix ? rawFixture.slice(prefix[0].length).trim() : rawFixture
    const countStr = cells[1] ?? ''
    const explicitGroup = cells.length >= 4 ? ((cells[2] ?? '').trim() || null) : null
    const groupTag = explicitGroup ?? prefixGroup ?? inAlternate
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
    rows.push({ fixture, count, group_tag: groupTag, page, unit: classifyCountRowUnit(fixture) })
  }
  return { rows, skippedCount, sourceLink, alternateGroups }
}
