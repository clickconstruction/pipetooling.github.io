import { describe, expect, it } from 'vitest'
import { jobSearchEvidenceModeForRole } from './jobSearchEvidence'

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
