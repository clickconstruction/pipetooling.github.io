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

  it('a typed COI with a future expiry clears the red; a row with no recognised type counts as nothing (Tier-2 #33)', () => {
    // Before "Add document" existed, a sub could only get here via the Contracts-tab re-type ritual.
    const before = buildSubComplianceBadges([doc({ doc_type: 'agreement', status: 'signed' })], TODAY)
    expect(before.find((b) => b.key === 'coi')).toEqual({ key: 'coi', state: 'missing', label: 'COI missing' })

    const after = buildSubComplianceBadges([doc({ doc_type: 'agreement', status: 'signed' }), doc({ doc_type: 'coi', expires_at: '2027-03-01' })], TODAY)
    expect(after.find((b) => b.key === 'coi')).toEqual({ key: 'coi', state: 'ok', label: 'COI ✓' })

    // A row whose type is blank/unknown never satisfies (or spoils) any badge — the kernel never guesses.
    const untyped = buildSubComplianceBadges([doc({ doc_type: '' }), doc({ doc_type: 'mystery', expires_at: '2020-01-01' })], TODAY)
    expect(untyped).toEqual(buildSubComplianceBadges([], TODAY))
  })

  it('the expiring window is exactly COMPLIANCE_EXPIRING_DAYS days', () => {
    const edge = new Date(Date.UTC(2026, 7, 1 + COMPLIANCE_EXPIRING_DAYS)).toISOString().slice(0, 10)
    const badges = buildSubComplianceBadges([doc({ doc_type: 'coi', expires_at: edge })], TODAY)
    expect(badges.find((b) => b.key === 'coi')?.state).toBe('expiring')
  })
})

describe('pickerComplianceSummary', () => {
  it('collapses to the worst finding: expired beats expiring beats ok; empty is none', async () => {
    const { pickerComplianceSummary } = await import('./subCompliance')
    expect(pickerComplianceSummary([], TODAY)).toEqual({ state: 'none', label: 'nothing on file' })
    const full = [
      doc({ doc_type: 'agreement', status: 'signed' }),
      doc({ doc_type: 'coi', expires_at: '2027-01-01' }),
      doc({ doc_type: 'w9' }),
    ]
    expect(pickerComplianceSummary(full, TODAY)).toEqual({ state: 'ok', label: 'compliant' })
    expect(pickerComplianceSummary([...full.slice(0, 2)], TODAY).state).toBe('bad')
  })

  it('warns when a COI valid today lapses before the proposed window ends', async () => {
    const { pickerComplianceSummary } = await import('./subCompliance')
    const docs = [
      doc({ doc_type: 'agreement', status: 'signed' }),
      doc({ doc_type: 'coi', expires_at: '2026-09-12' }),
      doc({ doc_type: 'w9' }),
    ]
    expect(pickerComplianceSummary(docs, TODAY).state).toBe('ok')
    const withWindow = pickerComplianceSummary(docs, TODAY, '2026-09-20')
    expect(withWindow.state).toBe('warn')
    expect(withWindow.label).toContain('lapses before the window ends')
  })
})
