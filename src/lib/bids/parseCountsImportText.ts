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

// CountTooling's schedule blocks — `--- Duct ---` (D17), `--- Water sizing ---` (WATER-PLAN
// rung 5) and, since its ALT-GROUPS rung 2, an alternate's own `--- Alternate: <name> · Water
// sizing ---`. Their rows are a schedule (sizes, pounds, gpm), never counts: a water row
// `Cold main<TAB>1″<TAB>…` used to import as fixture "Cold main" × 1. A blank line or the next
// framed heading ends the block; the alternate's suffixed heading names the same alternate.
export const COUNT_SCHEDULE_HEADING_RE = /^---\s*(Duct|Water sizing)\s*---$/i
export const COUNT_ALTERNATE_SCHEDULE_SUFFIX_RE = /\s*·\s*(Duct|Water sizing)$/i

// CountTooling's `[Group] ` name prefix (a circuit, an area, an alternate). Lifted into
// group_tag and taken OFF the fixture: a bracketed name matched no book entry and no
// other version's row (both matchers compare the exact name), which is how the group
// column stayed empty on every import since the classic table (v2.4188).
export const COUNT_GROUP_PREFIX_RE = /^\[([^\]]*)\]\s*/

// v2.4686: the scope heading says what the copy covers — `every sheet` is the whole takeoff
// (Copy to /Tooling → All Canvases), anything else is a part of it (This Canvas Only, …). The
// import review reads it to decide whether a row missing from the copy was deleted on purpose.
export const COUNT_SCOPE_HEADING_RE = /^---\s*Counts,/i
export type CountsImportScope = 'all' | 'partial' | 'unknown'

export function parseCountsImportText(text: string): {
  rows: ParsedCountImportRow[]
  skippedCount: number
  sourceLink: string | null
  /** The alternate groups the text names, first spelling kept, in the order they appear. */
  alternateGroups: string[]
  /** v2.4686: what the scope heading said the copy covers; 'unknown' without one (a hand-typed paste). */
  scope: CountsImportScope
} {
  const rows: ParsedCountImportRow[] = []
  const alternateGroups: string[] = []
  let skippedCount = 0
  let scope: CountsImportScope = 'unknown'
  // First match anywhere in the blob → the source view link (stored opaque, as-is).
  const sourceLink = text.match(COUNT_SOURCE_LINK_RE)?.[0] ?? null
  const lines = text.split(/\r?\n/)
  let inAlternate: string | null = null
  // Inside a schedule block (duct / water sizing): rows are structure, neither counts nor "skipped".
  let inSchedule = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      inAlternate = null
      inSchedule = false
      continue
    }
    // Skip the footer line carrying the source link — it is not a count row and
    // must not be reported as "skipped".
    if (COUNT_SOURCE_LINK_RE.test(trimmed)) continue
    const alt = trimmed.match(COUNT_ALTERNATE_HEADING_RE)
    if (alt) {
      const raw = alt[1]!.trim()
      const schedule = COUNT_ALTERNATE_SCHEDULE_SUFFIX_RE.test(raw)
      const name = raw.replace(COUNT_ALTERNATE_SCHEDULE_SUFFIX_RE, '').trim()
      inAlternate = name
      inSchedule = schedule
      if (name && !alternateGroups.some((g) => g.toLowerCase() === name.toLowerCase())) alternateGroups.push(name)
      continue
    }
    if (COUNT_SCHEDULE_HEADING_RE.test(trimmed)) {
      inAlternate = null
      inSchedule = true
      continue
    }
    // Framed headings are structure, not counts — and not "skipped" either.
    if (COUNT_HEADING_LINE_RE.test(trimmed)) {
      if (COUNT_SCOPE_HEADING_RE.test(trimmed)) scope = /every sheet/i.test(trimmed) ? 'all' : 'partial'
      inAlternate = null
      inSchedule = false
      continue
    }
    if (inSchedule) continue
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
  return { rows, skippedCount, sourceLink, alternateGroups, scope }
}
