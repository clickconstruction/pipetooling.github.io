import { describe, expect, it } from 'vitest'
import { isZzTestProspect, withoutZzProspects } from './zzProspects'

const rows = [
  { id: 'a', company_name: 'Bexar Fire Protection' },
  { id: 'z', company_name: 'ZZ Test Cibolo Fire Protection' },
  { id: 'y', company_name: '  zz twin builders' },
  { id: 'n', company_name: null },
]

describe('the ZZ rule for prospects', () => {
  it('reads a ZZ name any case, spaces aside, and not a blank', () => {
    expect(isZzTestProspect(rows[1]!)).toBe(true)
    expect(isZzTestProspect(rows[2]!)).toBe(true)
    expect(isZzTestProspect(rows[0]!)).toBe(false)
    expect(isZzTestProspect(rows[3]!)).toBe(false)
  })
  it('hides the ZZ rows for everyone but a dev, and leaves the list alone otherwise', () => {
    expect(withoutZzProspects(rows, true).map((r) => r.id)).toEqual(['a', 'n'])
    expect(withoutZzProspects(rows, false)).toBe(rows)
  })
})
