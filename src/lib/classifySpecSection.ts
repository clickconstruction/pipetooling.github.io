/**
 * Division 22 classification kernel (v2.2580).
 *
 * Matches a fixture NAME (a `bids_count_rows.fixture` string) to a spec section via
 * the org-wide rules ledger (`spec_section_match_rules` → `spec_sections`), at read
 * time — no bid data is ever edited. First match by ascending priority wins.
 *
 * Three outcomes, deliberately distinct:
 *   - matched:   a rule hit and carries a section code.
 *   - no-code:   a rule hit whose sectionCode is null — "deliberately unclassified"
 *                (e.g. DEMO, which is not a Division 22 buyout item). Audit screens
 *                must not count these as gaps.
 *   - unmatched: no rule hit — a genuine ledger gap to surface.
 *
 * Matching is case-insensitive on trimmed strings. `exact` exists so short patterns
 * stay safe ("CO" as contains would grab "COPPER"); `contains` exists so size-prefixed
 * names still hit ("4IN FD-1" contains "FD-").
 */

export type SpecSectionMatchKind = 'starts_with' | 'contains' | 'exact'

export type SpecSectionMatchRule = {
  pattern: string
  matchKind: SpecSectionMatchKind
  /** null = deliberately no code — distinct from unmatched. */
  sectionCode: string | null
  priority: number
}

export type SpecSectionMatch =
  | { outcome: 'matched'; sectionCode: string; rule: SpecSectionMatchRule }
  | { outcome: 'no-code'; rule: SpecSectionMatchRule }
  | { outcome: 'unmatched' }

export function classifySpecSection(
  name: string | null | undefined,
  rules: ReadonlyArray<SpecSectionMatchRule>,
): SpecSectionMatch {
  const needle = (name ?? '').trim().toLowerCase()
  if (!needle) return { outcome: 'unmatched' }

  const ordered = [...rules].sort((a, b) => a.priority - b.priority)
  for (const rule of ordered) {
    const pattern = rule.pattern.trim().toLowerCase()
    if (!pattern) continue
    const hit =
      rule.matchKind === 'exact'
        ? needle === pattern
        : rule.matchKind === 'starts_with'
          ? needle.startsWith(pattern)
          : needle.includes(pattern)
    if (!hit) continue
    if (rule.sectionCode == null) return { outcome: 'no-code', rule }
    return { outcome: 'matched', sectionCode: rule.sectionCode, rule }
  }
  return { outcome: 'unmatched' }
}
