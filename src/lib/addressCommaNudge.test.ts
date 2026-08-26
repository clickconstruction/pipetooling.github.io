import { describe, expect, it } from 'vitest'
import { buildAddressStatementPreview, suggestAddressComma } from './addressCommaNudge'

describe('buildAddressStatementPreview', () => {
  it('splits at the first comma like the portal statement', () => {
    expect(buildAddressStatementPreview('1200 Kenney Fort Blvd, Round Rock, TX 78665')).toEqual({
      street: '1200 Kenney Fort Blvd',
      quiet: 'Round Rock, TX 78665',
    })
  })
  it('keeps a comma-less address whole', () => {
    expect(buildAddressStatementPreview('1200 Kenney Fort Blvd Round Rock, TX 78665')).toEqual({
      street: '1200 Kenney Fort Blvd Round Rock',
      quiet: 'TX 78665',
    })
    expect(buildAddressStatementPreview('TBD — new build off CR 110')).toEqual({
      street: 'TBD — new build off CR 110',
      quiet: null,
    })
  })
  it('is null for blank input', () => {
    expect(buildAddressStatementPreview('')).toBeNull()
    expect(buildAddressStatementPreview('   ')).toBeNull()
  })
})

describe('suggestAddressComma', () => {
  it('inserts the comma before a one-word city', () => {
    expect(suggestAddressComma('1200 Kenney Fort Blvd Round Rock, TX 78665')).toEqual({
      fixed: '1200 Kenney Fort Blvd, Round Rock, TX 78665',
      city: 'Round Rock',
    })
    expect(suggestAddressComma('4110 N Main St Taylor, TX 76574')).toEqual({
      fixed: '4110 N Main St, Taylor, TX 76574',
      city: 'Taylor',
    })
  })
  it('handles multi-word cities, longest match first', () => {
    expect(suggestAddressComma('150 E Sonterra Blvd 200B San Antonio, TX 78258')).toEqual({
      fixed: '150 E Sonterra Blvd 200B, San Antonio, TX 78258',
      city: 'San Antonio',
    })
    expect(suggestAddressComma('13100 W State Hwy 29 Liberty Hill, TX 78642')).toEqual({
      fixed: '13100 W State Hwy 29, Liberty Hill, TX 78642',
      city: 'Liberty Hill',
    })
  })
  it('normalizes state casing but keeps the zip exactly as typed', () => {
    expect(suggestAddressComma('4110 N Main St Taylor Tx 78654')).toEqual({
      fixed: '4110 N Main St, Taylor, TX 78654',
      city: 'Taylor',
    })
  })
  it('works with no state/zip tail at all', () => {
    expect(suggestAddressComma('4110 N Main St Taylor')).toEqual({
      fixed: '4110 N Main St, Taylor',
      city: 'Taylor',
    })
  })
  it('stays quiet when the split already works or nothing matches', () => {
    expect(suggestAddressComma('1200 Kenney Fort Blvd, Round Rock, TX 78665')).toBeNull()
    expect(suggestAddressComma('415 Springtown Way, San Marcos, TX 78666')).toBeNull()
    expect(suggestAddressComma('TBD — new build off CR 110')).toBeNull()
    expect(suggestAddressComma('')).toBeNull()
  })
  it('never leaves an empty street behind', () => {
    expect(suggestAddressComma('Round Rock, TX 78665')).toBeNull()
    expect(suggestAddressComma('San Antonio')).toBeNull()
  })
  it('accepts caller-supplied extra cities', () => {
    expect(suggestAddressComma('9 Mill Rd Smallville, TX 78000', ['Smallville'])).toEqual({
      fixed: '9 Mill Rd, Smallville, TX 78000',
      city: 'Smallville',
    })
  })
})
