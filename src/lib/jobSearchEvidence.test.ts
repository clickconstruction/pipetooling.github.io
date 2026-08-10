import { describe, expect, it } from 'vitest'
import { bidSearchStatusChip, jobSearchEvidenceModeForRole } from './jobSearchEvidence'

describe('jobSearchEvidenceModeForRole', () => {
  it('gives office roles money mode', () => {
    for (const r of ['dev', 'master_technician', 'assistant', 'controller', 'primary']) {
      expect(jobSearchEvidenceModeForRole(r)).toBe('money')
    }
  })

  it('gives field and estimating roles lines-only (and unknown/null defaults there too)', () => {
    for (const r of ['subcontractor', 'helpers', 'superintendent', 'estimator', '', null, undefined, 'nonsense']) {
      expect(jobSearchEvidenceModeForRole(r)).toBe('lines-only')
    }
  })
})

describe('bidSearchStatusChip', () => {
  it('maps outcomes: won, started, lost, sent-pending, unsent', () => {
    expect(bidSearchStatusChip('won', null).label).toBe('Won')
    expect(bidSearchStatusChip('started_or_complete', null).label).toBe('Started')
    expect(bidSearchStatusChip('lost', '2026-03-01').label).toBe('Lost')
    expect(bidSearchStatusChip(null, '2026-03-01').label).toBe('Pending')
    expect(bidSearchStatusChip(null, null).label).toBe('Unsent')
    expect(bidSearchStatusChip('', '  ').label).toBe('Unsent')
  })
})
