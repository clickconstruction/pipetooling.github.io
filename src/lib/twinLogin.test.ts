import { describe, expect, it } from 'vitest'
import { twinAliasEmail } from './twinLogin'

describe('twinAliasEmail', () => {
  it('maps twin:<role> to instance 1 and twin:<role>:<n> to that instance', () => {
    expect(twinAliasEmail('twin:estimator')).toBe('twin-estimator-1@twins.pipetooling.local')
    expect(twinAliasEmail('twin:estimator:2')).toBe('twin-estimator-2@twins.pipetooling.local')
    expect(twinAliasEmail('twin:master_technician')).toBe('twin-master_technician-1@twins.pipetooling.local')
  })
  it('anything else keeps the fixed dev account (null)', () => {
    expect(twinAliasEmail('1')).toBeNull()
    expect(twinAliasEmail('twin:')).toBeNull()
    expect(twinAliasEmail('twin:Estimator')).toBeNull()
    expect(twinAliasEmail(null)).toBeNull()
  })
})
