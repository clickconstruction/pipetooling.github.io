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
  fixture: string
  bidCount: number
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

export function buildFixtureNameAudit(
  names: ReadonlyArray<FixtureNameAuditInput>,
  rules: ReadonlyArray<SpecSectionMatchRule>,
): FixtureNameAudit {
  const uncoded: FixtureNameAuditRow[] = []
  const coded: FixtureNameAuditRow[] = []

  for (const n of names) {
    const fixture = n.fixture.trim()
    if (!fixture) continue
    const match = classifySpecSection(fixture, rules)
    if (match.outcome === 'unmatched') {
      uncoded.push({ fixture, bidCount: n.bidCount, outcome: 'unmatched', sectionCode: null, ruleLabel: null })
    } else if (match.outcome === 'no-code') {
      coded.push({ fixture, bidCount: n.bidCount, outcome: 'no-code', sectionCode: null, ruleLabel: ruleLabel(match.rule) })
    } else {
      coded.push({
        fixture,
        bidCount: n.bidCount,
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
