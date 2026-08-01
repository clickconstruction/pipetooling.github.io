import { describe, expect, it } from 'vitest'
import { buildSubComplianceBadges, COMPLIANCE_EXPIRING_DAYS } from './subCompliance'
import type { ComplianceDocInput } from './subCompliance'

const TODAY = '2026-08-01'

function doc(overrides: Partial<ComplianceDocInput> & { doc_type: string }): ComplianceDocInput {
  return { status: 'signed', expires_at: null, ...overrides }
}

describe('buildSubComplianceBadges', () => {
  it('reports everything missing for a sub with no documents', () => {
    expect(buildSubComplianceBadges([], TODAY)).toEqual([
      { key: 'agreement', state: 'missing', label: 'Agreement missing' },
      { key: 'coi', state: 'missing', label: 'COI missing' },
      { key: 'w9', state: 'missing', label: 'W-9 missing' },
    ])
  })

  it('a sent-but-unsigned agreement still counts as missing', () => {
    const badges = buildSubComplianceBadges([doc({ doc_type: 'agreement', status: 'sent' })], TODAY)
    expect(badges[0]).toEqual({ key: 'agreement', state: 'missing', label: 'Agreement missing' })
  })

  it('grades COI by expiry: ok, expiring within the window, expired past it', () => {
    const ok = buildSubComplianceBadges([doc({ doc_type: 'coi', expires_at: '2026-12-01' })], TODAY)
    expect(ok.find((b) => b.key === 'coi')?.state).toBe('ok')

    const expiring = buildSubComplianceBadges([doc({ doc_type: 'coi', expires_at: '2026-08-20' })], TODAY)
    expect(expiring.find((b) => b.key === 'coi')).toEqual({ key: 'coi', state: 'expiring', label: 'COI expiring' })

    const expired = buildSubComplianceBadges([doc({ doc_type: 'coi', expires_at: '2026-07-15' })], TODAY)
    expect(expired.find((b) => b.key === 'coi')).toEqual({ key: 'coi', state: 'expired', label: 'COI expired' })
  })

  it('the latest of several COIs wins, and an unexpiring one is always ok', () => {
    const badges = buildSubComplianceBadges(
      [doc({ doc_type: 'coi', expires_at: '2026-07-01' }), doc({ doc_type: 'coi', expires_at: '2027-07-01' })],
      TODAY,
    )
    expect(badges.find((b) => b.key === 'coi')?.state).toBe('ok')

    const unexpiring = buildSubComplianceBadges(
      [doc({ doc_type: 'w9', expires_at: null }), doc({ doc_type: 'w9', expires_at: '2026-01-01' })],
      TODAY,
    )
    expect(unexpiring.find((b) => b.key === 'w9')?.state).toBe('ok')
  })

  it('license badge appears only when a license document exists; other is ignored', () => {
    const without = buildSubComplianceBadges([doc({ doc_type: 'other' })], TODAY)
    expect(without.find((b) => b.key === 'license')).toBeUndefined()

    const withLicense = buildSubComplianceBadges([doc({ doc_type: 'license', expires_at: '2026-09-15' })], TODAY)
    expect(withLicense.find((b) => b.key === 'license')?.state).toBe('ok')
  })

  it('the expiring window is exactly COMPLIANCE_EXPIRING_DAYS days', () => {
    const edge = new Date(Date.UTC(2026, 7, 1 + COMPLIANCE_EXPIRING_DAYS)).toISOString().slice(0, 10)
    const badges = buildSubComplianceBadges([doc({ doc_type: 'coi', expires_at: edge })], TODAY)
    expect(badges.find((b) => b.key === 'coi')?.state).toBe('expiring')
  })
})
