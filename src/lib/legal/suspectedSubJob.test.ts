import { describe, expect, it } from 'vitest'
import { partyNameTokens, partyNamesMatch, setGcDoneWords, suspectedSubJob, suspectedSubJobLabel, type SuspectedSubJobInput } from './suspectedSubJob'

const burd: SuspectedSubJobInput = { hasGc: false, customerName: 'Burd & Assoc.', ownerOfRecord: 'Take 5 Properties LLC', customerType: 'commercial', gcPaysByDefault: false, customerIsGcElsewhere: false, ownerContractConfirmed: false }

describe('party names, loosely', () => {
  it('drops punctuation and the business suffixes', () => {
    expect(partyNameTokens('Burd & Assoc., LLC')).toEqual(['burd'])
    expect(partyNameTokens('The Jordan Example Family Trust')).toEqual(['jordan', 'example'])
    expect(partyNameTokens('Take 5 Properties')).toEqual(['take', '5'])
  })
  it('matches a homeowner to the trust or LLC that holds the house, and a company to itself with a suffix', () => {
    expect(partyNamesMatch('Jordan Example', 'Jordan Example Family Trust')).toBe(true)
    expect(partyNamesMatch('Example Holdings LLC', 'Jordan Example')).toBe(true)
    expect(partyNamesMatch('Burd & Assoc.', 'Burd and Associates, Inc.')).toBe(true)
    expect(partyNamesMatch('Burd & Assoc.', 'Take 5 Properties LLC')).toBe(false)
    expect(partyNamesMatch('', 'Anyone')).toBe(false)
    expect(partyNamesMatch('LLC', 'Inc')).toBe(false)
  })
})

describe('suspectedSubJob (punch list #166)', () => {
  it('flags job 891’s shape: no GC, another owner of record, a commercial customer', () => {
    expect(suspectedSubJob(burd)).toEqual({ suspected: true, owner: 'Take 5 Properties LLC', customer: 'Burd & Assoc.', signals: ['the customer is commercial'] })
    expect(suspectedSubJobLabel('891', suspectedSubJob(burd) as Extract<ReturnType<typeof suspectedSubJob>, { suspected: true }>)).toBe('Probably a subcontract on 891: the owner of record (Take 5 Properties LLC) is not Burd & Assoc., and the customer is commercial')
  })
  it('is quiet once the job has a GC, or the office said it is ours with the owner', () => {
    expect(suspectedSubJob({ ...burd, hasGc: true })).toEqual({ suspected: false, why: 'has_gc' })
    expect(suspectedSubJob({ ...burd, ownerContractConfirmed: true })).toEqual({ suspected: false, why: 'confirmed' })
  })
  it('is quiet with no owner of record, or when the owner is the customer', () => {
    expect(suspectedSubJob({ ...burd, ownerOfRecord: '' })).toEqual({ suspected: false, why: 'no_owner' })
    expect(suspectedSubJob({ ...burd, ownerOfRecord: 'Burd and Associates Inc' })).toEqual({ suspected: false, why: 'owner_is_customer' })
  })
  it('needs a second signal: a homeowner whose house is held by a trust is not a subcontractor’s customer', () => {
    const house = { ...burd, customerName: 'Jordan Example', ownerOfRecord: 'Oak Hollow Land Trust', customerType: 'residential' }
    expect(suspectedSubJob(house)).toEqual({ suspected: false, why: 'no_second_signal' })
    expect(suspectedSubJob({ ...house, gcPaysByDefault: true })).toEqual(expect.objectContaining({ suspected: true, signals: ['the customer pays as a GC by default'] }))
    expect(suspectedSubJob({ ...house, customerIsGcElsewhere: true })).toEqual(expect.objectContaining({ suspected: true, signals: ['the customer is the GC on another job'] }))
    expect((suspectedSubJob({ ...burd, gcPaysByDefault: true, customerIsGcElsewhere: true }) as { signals: string[] }).signals).toHaveLength(3)
  })
  it('words the toast after Set the GC', () => {
    expect(setGcDoneWords('Burd & Assoc.', '891')).toBe('Burd & Assoc. is now the GC on 891. The customer slot cleared, the bills go to the GC, and the monthly notices are tracked from here.')
  })
})
