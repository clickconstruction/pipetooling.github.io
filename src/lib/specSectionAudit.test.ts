import { describe, expect, it } from 'vitest'

import { AUDIT_PIN_PRIORITY, buildFixtureNameAudit, foldFixtureNameSpellings, ruleLabel } from './specSectionAudit'
import { classifySpecSection } from './classifySpecSection'
import type { SpecSectionMatchRule } from './classifySpecSection'

const RULES: SpecSectionMatchRule[] = [
  { pattern: 'CO', matchKind: 'exact', sectionCode: '22 05 76', priority: 40 },
  { pattern: 'DEMO', matchKind: 'exact', sectionCode: null, priority: 50 },
  { pattern: 'WC-', matchKind: 'starts_with', sectionCode: '22 42 13', priority: 100 },
  { pattern: 'WATER', matchKind: 'contains', sectionCode: '22 11 16', priority: 220 },
]

describe('buildFixtureNameAudit', () => {
  it('splits coded from uncoded, sorts both by bid count desc then name', () => {
    const audit = buildFixtureNameAudit(
      [
        { fixture: 'GPR-11', bidCount: 3 },
        { fixture: 'WC-1', bidCount: 64 },
        { fixture: '11/2IN 90 GAS', bidCount: 17 },
        { fixture: 'DEMO', bidCount: 41 },
        { fixture: 'ft of 3/4IN WATER', bidCount: 58 },
        { fixture: 'RH-1', bidCount: 17 },
      ],
      RULES,
    )
    expect(audit.uncoded.map((r) => r.fixture)).toEqual(['11/2IN 90 GAS', 'RH-1', 'GPR-11'])
    expect(audit.coded.map((r) => r.fixture)).toEqual(['WC-1', 'ft of 3/4IN WATER', 'DEMO'])
    expect(audit.total).toBe(6)
    expect(audit.uncodedCount).toBe(3)
    expect(audit.codedCount).toBe(3)
    expect(audit.coveragePct).toBe(50)
  })

  it('a deliberate no-code rule counts as covered, with its rule label', () => {
    const audit = buildFixtureNameAudit([{ fixture: 'DEMO', bidCount: 41 }], RULES)
    expect(audit.uncodedCount).toBe(0)
    expect(audit.coded[0]).toMatchObject({ outcome: 'no-code', sectionCode: null, ruleLabel: 'exactly DEMO' })
  })

  it('matched rows carry section code and provenance', () => {
    const audit = buildFixtureNameAudit([{ fixture: 'WC-1', bidCount: 2 }], RULES)
    expect(audit.coded[0]).toMatchObject({ outcome: 'matched', sectionCode: '22 42 13', ruleLabel: 'starts with WC-' })
  })

  it('skips blank names and reports 100% coverage on an empty set', () => {
    const audit = buildFixtureNameAudit([{ fixture: '   ', bidCount: 5 }], RULES)
    expect(audit.total).toBe(0)
    expect(audit.coveragePct).toBe(100)
  })

  it('folds case variants into one name — the modal counts what the Dashboard card counts (J29-F4)', () => {
    // The audit RPC groups BY btrim(fixture) (case-preserving); the card's RPC counts
    // DISTINCT lower(btrim(fixture)). Same predicate on both sides ⇒ one row per fold.
    const rpcRows = [
      { fixture: 'GPR-11', bidCount: 3 },
      { fixture: 'gpr-11', bidCount: 5 },
      { fixture: 'Gpr-11', bidCount: 1 },
      { fixture: 'RH-1', bidCount: 17 },
      { fixture: 'wc-1', bidCount: 2 },
      { fixture: 'WC-1', bidCount: 64 },
    ]
    const audit = buildFixtureNameAudit(rpcRows, RULES)
    // What the card's SQL would count: distinct lower(trim) names matching no rule.
    const cardUncoded = new Set(
      rpcRows.map((r) => r.fixture.trim().toLowerCase()).filter((n) => classifySpecSection(n, RULES).outcome === 'unmatched'),
    ).size
    expect(audit.uncodedCount).toBe(cardUncoded)
    expect(audit.uncodedCount).toBe(2)
    expect(audit.uncoded.map((r) => r.fixture)).toEqual(['RH-1', 'gpr-11'])
    expect(audit.uncoded[1]).toMatchObject({ bidCount: 9, spellings: ['gpr-11', 'GPR-11', 'Gpr-11'] })
    expect(audit.coded[0]).toMatchObject({ fixture: 'WC-1', bidCount: 66, spellings: ['WC-1', 'wc-1'] })
    expect(audit.total).toBe(3)
  })

  it('foldFixtureNameSpellings trims, folds and names each group by its most-used spelling', () => {
    expect(foldFixtureNameSpellings([{ fixture: ' Demo ', bidCount: 1 }, { fixture: 'DEMO', bidCount: 4 }, { fixture: '', bidCount: 9 }])).toEqual([
      { fixture: 'DEMO', bidCount: 5, spellings: ['DEMO', 'Demo'] },
    ])
  })

  it('pin priority sits between seeded exacts and pattern rules', () => {
    expect(AUDIT_PIN_PRIORITY).toBeGreaterThan(50)
    expect(AUDIT_PIN_PRIORITY).toBeLessThan(100)
  })

  it('ruleLabel spells the match kinds', () => {
    expect(ruleLabel({ pattern: ' X ', matchKind: 'contains', sectionCode: null, priority: 1 })).toBe('contains X')
  })
})
