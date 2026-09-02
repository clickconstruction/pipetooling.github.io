import { describe, expect, it } from 'vitest'

import { AUDIT_PIN_PRIORITY, buildFixtureNameAudit, ruleLabel } from './specSectionAudit'
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

  it('pin priority sits between seeded exacts and pattern rules', () => {
    expect(AUDIT_PIN_PRIORITY).toBeGreaterThan(50)
    expect(AUDIT_PIN_PRIORITY).toBeLessThan(100)
  })

  it('ruleLabel spells the match kinds', () => {
    expect(ruleLabel({ pattern: ' X ', matchKind: 'contains', sectionCode: null, priority: 1 })).toBe('contains X')
  })
})
