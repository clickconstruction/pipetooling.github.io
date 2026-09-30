import { describe, expect, it } from 'vitest'
import { PROPERTY_KIND_BADGE_FILLS, propertyKindBadge, propertyKindQuestion } from './propertyKindBadge'

describe('propertyKindBadge (v2.4160)', () => {
  it('a commercial property is an orange C, a residential one a blue R', () => {
    expect(propertyKindBadge({ customerAddressId: 'a1', kind: 'non_residential' }, '11730 TX-29')).toMatchObject({
      kind: 'non_residential',
      letter: 'C',
      fill: PROPERTY_KIND_BADGE_FILLS.commercial,
      label: 'Commercial property at 11730 TX-29 — change the kind',
    })
    expect(propertyKindBadge({ customerAddressId: 'a1', kind: 'residential' })).toMatchObject({ kind: 'residential', letter: 'R', fill: PROPERTY_KIND_BADGE_FILLS.residential })
  })

  it('an unset kind (blank, null, or a value the kernel does not know) is a red ? that asks', () => {
    for (const kind of ['', null, undefined, 'mixed']) {
      const b = propertyKindBadge({ customerAddressId: 'a1', kind })
      expect(b).toMatchObject({ kind: '', letter: '?', fill: PROPERTY_KIND_BADGE_FILLS.unknown })
      expect(b?.title).toContain('Not set yet')
    }
  })

  it('v2.4212 · a job with no linked property but a customer is a ? that will save the address as a property; no customer, no badge', () => {
    const b = propertyKindBadge({ customerAddressId: null, kind: undefined, customerId: 'c1' }, '1780 FM 1343')
    expect(b).toMatchObject({ kind: '', letter: '?', fill: PROPERTY_KIND_BADGE_FILLS.unknown, unlinked: true })
    expect(b?.title).toContain('saved as a property')
    expect(b?.label).toContain('1780 FM 1343')
    // whatever kind the board thinks it read, an unlinked job has no property to have read it from
    expect(propertyKindBadge({ customerAddressId: '', kind: 'residential', customerId: 'c1' })?.letter).toBe('?')
    expect(propertyKindBadge({ customerAddressId: null, kind: 'residential' })).toBeNull()
    expect(propertyKindBadge({ customerAddressId: '', kind: '', customerId: null })).toBeNull()
    expect(propertyKindBadge({ customerAddressId: 'a1', kind: 'residential', customerId: 'c1' })).toMatchObject({ letter: 'R', unlinked: false })
  })

  it('the question names the address, or the job when the address is blank', () => {
    expect(propertyKindQuestion('8507 Culebra Road\nSan Antonio, TX', '1029 · Backflow')).toBe('What kind of property is 8507 Culebra Road?')
    expect(propertyKindQuestion('200 Test Lane, San Antonio, TX 78209', '1051 · Band Job B')).toBe('What kind of property is 200 Test Lane?')
    expect(propertyKindQuestion('  ', '1029 · Backflow')).toBe('What kind of property is 1029 · Backflow?')
  })
})
