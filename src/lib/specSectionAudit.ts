/**
 * Division 22 audit kernel (v2.2598): classify every distinct fixture name ever
 * counted (from the `spec_section_fixture_name_audit` RPC) through the rules
 * ledger, and shape the audit modal's view — uncoded names first, worst
 * offenders (most bids) on top, plus coverage stats.
 *
 * "Uncoded" = unmatched only. A `no-code` hit (a rule with NULL section, e.g.
 * DEMO) is a deliberate decision and counts as covered.
 */

import { classifySpecSection, type SpecSectionMatchRule } from './classifySpecSection'

export type FixtureNameAuditInput = {
  fixture: string
  bidCount: number
}

export type FixtureNameAuditRow = {
  /** The most-used spelling of this name (case-folded group, v2.2896). */
  fixture: string
  /** Bids across every spelling of the name (a bid using two spellings counts once per spelling). */
  bidCount: number
  /** Every distinct spelling seen, most bids first — `fixture` is `spellings[0]`. */
  spellings: string[]
  outcome: 'matched' | 'no-code' | 'unmatched'
  sectionCode: string | null
  /** Human label of the rule that decided a matched/no-code row ("starts with WC-"). */
  ruleLabel: string | null
}

export type FixtureNameAudit = {
  /** Unmatched names, most-bids first. */
  uncoded: FixtureNameAuditRow[]
  /** Matched + deliberate no-code names, most-bids first. */
  coded: FixtureNameAuditRow[]
  total: number
  codedCount: number
  uncodedCount: number
  /** 0–100, rounded; 100 when there are no names at all. */
  coveragePct: number
}

const KIND_LABEL: Record<SpecSectionMatchRule['matchKind'], string> = {
  starts_with: 'starts with',
  contains: 'contains',
  exact: 'exactly',
}

export function ruleLabel(rule: SpecSectionMatchRule): string {
  return `${KIND_LABEL[rule.matchKind]} ${rule.pattern.trim()}`
}

/**
 * Fold the audit RPC's case-preserving rows ("WC-1" and "wc-1" arrive as two
 * rows) into one name per `lower(trim())` — the same key the Dashboard card's
 * `spec_section_uncoded_name_count` RPC counts (v2.2896, journey-map J29-F4).
 * Matching is case-insensitive on both sides, so the two spellings were always
 * one decision; counting them twice made the modal say 1,187 under a card that
 * said 1,145. The spelling with the most bids names the group.
 */
export function foldFixtureNameSpellings(names: ReadonlyArray<FixtureNameAuditInput>): Array<FixtureNameAuditInput & { spellings: string[] }> {
  const groups = new Map<string, Array<{ fixture: string; bidCount: number }>>()
  for (const n of names) {
    const fixture = n.fixture.trim()
    if (!fixture) continue
    const key = fixture.toLowerCase()
    const g = groups.get(key)
    if (g) g.push({ fixture, bidCount: n.bidCount })
    else groups.set(key, [{ fixture, bidCount: n.bidCount }])
  }
  const out: Array<FixtureNameAuditInput & { spellings: string[] }> = []
  for (const g of groups.values()) {
    g.sort((a, b) => b.bidCount - a.bidCount || a.fixture.localeCompare(b.fixture))
    out.push({
      fixture: g[0]!.fixture,
      bidCount: g.reduce((sum, v) => sum + v.bidCount, 0),
      spellings: g.map((v) => v.fixture),
    })
  }
  return out
}

export function buildFixtureNameAudit(
  names: ReadonlyArray<FixtureNameAuditInput>,
  rules: ReadonlyArray<SpecSectionMatchRule>,
): FixtureNameAudit {
  const uncoded: FixtureNameAuditRow[] = []
  const coded: FixtureNameAuditRow[] = []

  for (const n of foldFixtureNameSpellings(names)) {
    const { fixture, bidCount, spellings } = n
    const match = classifySpecSection(fixture, rules)
    if (match.outcome === 'unmatched') {
      uncoded.push({ fixture, bidCount, spellings, outcome: 'unmatched', sectionCode: null, ruleLabel: null })
    } else if (match.outcome === 'no-code') {
      coded.push({ fixture, bidCount, spellings, outcome: 'no-code', sectionCode: null, ruleLabel: ruleLabel(match.rule) })
    } else {
      coded.push({
        fixture,
        bidCount,
        spellings,
        outcome: 'matched',
        sectionCode: match.sectionCode,
        ruleLabel: ruleLabel(match.rule),
      })
    }
  }

  const byBids = (a: FixtureNameAuditRow, b: FixtureNameAuditRow) =>
    b.bidCount - a.bidCount || a.fixture.localeCompare(b.fixture)
  uncoded.sort(byBids)
  coded.sort(byBids)

  const total = uncoded.length + coded.length
  return {
    uncoded,
    coded,
    total,
    codedCount: coded.length,
    uncodedCount: uncoded.length,
    coveragePct: total === 0 ? 100 : Math.round((coded.length / total) * 100),
  }
}

/** Priority for audit-pinned exact rules: after the seeded exacts (10–50), before every pattern rule (100+). */
export const AUDIT_PIN_PRIORITY = 60
