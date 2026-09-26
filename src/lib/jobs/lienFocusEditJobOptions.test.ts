import { describe, expect, it } from 'vitest'
import { lienFocusEditJobOptions } from './lienFocusEditJobOptions'

/** The one mapping both lien desks read: a door's focus → what Edit Job opens on. */
describe('lienFocusEditJobOptions', () => {
  it('the property-record door opens the Property record row', () => {
    expect(lienFocusEditJobOptions('property-record')).toEqual({ propertyRecordFocus: true })
  })

  it('the fact rows ring themselves on the Edit tab', () => {
    expect(lienFocusEditJobOptions('gc')).toEqual({ focusRow: 'gc' })
    expect(lienFocusEditJobOptions('lien-contract')).toEqual({ focusRow: 'lien-contract' })
    expect(lienFocusEditJobOptions('status')).toEqual({ focusRow: 'status' })
  })

  it('% done lives on the Bill tab, ringed', () => {
    expect(lienFocusEditJobOptions('pct')).toEqual({ initialTab: 'bill', focusRow: 'pct' })
  })

  it('line items land on the Bill tab, flashed; bill alone just lands there', () => {
    expect(lienFocusEditJobOptions('line-items')).toEqual({ initialTab: 'bill', fixturesSectionHighlight: true })
    expect(lienFocusEditJobOptions('bill')).toEqual({ initialTab: 'bill' })
  })

  it('no focus opens the window as it is', () => {
    expect(lienFocusEditJobOptions(undefined)).toEqual({})
    expect(lienFocusEditJobOptions(null)).toEqual({})
  })
})
