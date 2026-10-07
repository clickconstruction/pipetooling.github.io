/**
 * Main's own tests for the person to reach at a company (the schedule's PR 1b), run on the test
 * data: the spike's own case, Hillside Excavation's Greg Paulk, whose record has no phone or email.
 */
import { describe, expect, it } from 'vitest'
import { partnerReach } from './followUpSheet'
import { partnerById } from './lookups'
import { initialGcState } from './schedule/testState'

describe('the person to reach at a company', () => {
  it('stands in a made-up number and address where the record has none', () => {
    const reach = partnerReach(partnerById(initialGcState(), 'hillside')!)
    expect(reach).toMatchObject({ name: 'Greg Paulk', first: 'Greg', email: 'greg@hillsideexcavation.example', madeUp: true })
    expect(reach.phone).toMatch(/^\(210\) 555-01\d\d$/)
  })

  it('reads the record’s own number and address, and the company’s name with no contact', () => {
    const hillside = partnerById(initialGcState(), 'hillside')!
    expect(partnerReach({ ...hillside, phone: '(210) 555-0161', email: 'greg@hillside.example' })).toEqual({ name: 'Greg Paulk', first: 'Greg', phone: '(210) 555-0161', email: 'greg@hillside.example', madeUp: false })
    expect(partnerReach({ ...hillside, contact: '' })).toMatchObject({ name: 'Hillside Excavation', first: 'Hillside', email: 'hillside@hillsideexcavation.example' })
  })
})
