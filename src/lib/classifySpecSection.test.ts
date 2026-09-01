import { describe, expect, it } from 'vitest'

import { classifySpecSection, type SpecSectionMatchRule } from './classifySpecSection'

/**
 * Mirror of the migration seed (20260901181000_division22_spec_sections.sql) so the
 * kernel is proven against the exact rule set prod will run. If the seed changes in
 * a later migration, update this copy alongside it.
 */
const SEEDED_RULES: SpecSectionMatchRule[] = [
  { pattern: 'GCO', matchKind: 'exact', sectionCode: '22 05 76', priority: 10 },
  { pattern: 'FCO', matchKind: 'exact', sectionCode: '22 05 76', priority: 20 },
  { pattern: 'WCO', matchKind: 'exact', sectionCode: '22 05 76', priority: 30 },
  { pattern: 'CO', matchKind: 'exact', sectionCode: '22 05 76', priority: 40 },
  { pattern: 'DEMO', matchKind: 'exact', sectionCode: null, priority: 50 },
  { pattern: 'WC-', matchKind: 'starts_with', sectionCode: '22 42 13', priority: 100 },
  { pattern: 'U-', matchKind: 'starts_with', sectionCode: '22 42 13', priority: 110 },
  { pattern: 'L-', matchKind: 'starts_with', sectionCode: '22 42 16', priority: 120 },
  { pattern: 'SH-', matchKind: 'starts_with', sectionCode: '22 42 23', priority: 130 },
  { pattern: 'FS-', matchKind: 'starts_with', sectionCode: '22 13 19', priority: 140 },
  { pattern: 'FD-', matchKind: 'contains', sectionCode: '22 13 19', priority: 150 },
  { pattern: 'TP-', matchKind: 'starts_with', sectionCode: '22 11 19', priority: 160 },
  { pattern: 'WH-', matchKind: 'starts_with', sectionCode: '22 33 00', priority: 170 },
  { pattern: 'WASTE', matchKind: 'contains', sectionCode: '22 13 16', priority: 200 },
  { pattern: 'STORM', matchKind: 'contains', sectionCode: '22 14 13', priority: 210 },
  { pattern: 'WATER', matchKind: 'contains', sectionCode: '22 11 16', priority: 220 },
]

function codeFor(name: string): string | null {
  const m = classifySpecSection(name, SEEDED_RULES)
  return m.outcome === 'matched' ? m.sectionCode : null
}

describe('classifySpecSection', () => {
  it('classifies the house naming conventions to the right sections', () => {
    expect(codeFor('WC-1')).toBe('22 42 13')
    expect(codeFor('U-2')).toBe('22 42 13')
    expect(codeFor('L-3')).toBe('22 42 16')
    expect(codeFor('SH-1')).toBe('22 42 23')
    expect(codeFor('FS-2')).toBe('22 13 19')
    expect(codeFor('TP-1')).toBe('22 11 19')
    expect(codeFor('WH-1')).toBe('22 33 00')
    expect(codeFor('GCO')).toBe('22 05 76')
    expect(codeFor('ft of 4IN WASTE')).toBe('22 13 16')
    expect(codeFor('ft of 3/4IN WATER')).toBe('22 11 16')
    expect(codeFor('3/4IN 90 WATER')).toBe('22 11 16')
  })

  it('exact CO matches only the cleanout, never COPPER', () => {
    expect(codeFor('CO')).toBe('22 05 76')
    expect(classifySpecSection('3/4IN 90 COPPER VIEGA', SEEDED_RULES).outcome).toBe('unmatched')
  })

  it('contains FD- still hits size-prefixed floor drains', () => {
    expect(codeFor('4IN FD-1')).toBe('22 13 19')
    expect(codeFor('2IN FD-1')).toBe('22 13 19')
  })

  it('EDF- does not false-positive on the FD- contains rule', () => {
    // "EDF-1" contains "DF-" but not "FD-": stays unmatched until the owner pins it.
    expect(classifySpecSection('EDF-1', SEEDED_RULES).outcome).toBe('unmatched')
  })

  it('priority decides when several rules hit: STORM beats the WATER catch-all', () => {
    expect(codeFor('ft of 6IN STORM WATER')).toBe('22 14 13')
  })

  it('DEMO is deliberately no-code — distinct from unmatched', () => {
    const m = classifySpecSection('DEMO', SEEDED_RULES)
    expect(m.outcome).toBe('no-code')
  })

  it('gas rows stay unmatched until the owner decides their section', () => {
    expect(classifySpecSection('11/2IN 90 GAS', SEEDED_RULES).outcome).toBe('unmatched')
    expect(classifySpecSection('GPR-10', SEEDED_RULES).outcome).toBe('unmatched')
    expect(classifySpecSection('RH-1', SEEDED_RULES).outcome).toBe('unmatched')
  })

  it('is case-insensitive and trims both sides', () => {
    expect(codeFor('  wc-1  ')).toBe('22 42 13')
    const rules: SpecSectionMatchRule[] = [{ pattern: '  Demo ', matchKind: 'exact', sectionCode: null, priority: 1 }]
    expect(classifySpecSection('demo', rules).outcome).toBe('no-code')
  })

  it('handles empty names, empty patterns, and unsorted rule input', () => {
    expect(classifySpecSection('', SEEDED_RULES).outcome).toBe('unmatched')
    expect(classifySpecSection(null, SEEDED_RULES).outcome).toBe('unmatched')
    const unsorted: SpecSectionMatchRule[] = [
      { pattern: 'WATER', matchKind: 'contains', sectionCode: '22 11 16', priority: 220 },
      { pattern: '', matchKind: 'contains', sectionCode: '22 05 76', priority: 1 },
      { pattern: 'STORM', matchKind: 'contains', sectionCode: '22 14 13', priority: 210 },
    ]
    const m = classifySpecSection('STORM WATER LINE', unsorted)
    expect(m.outcome === 'matched' && m.sectionCode).toBe('22 14 13')
  })
})
