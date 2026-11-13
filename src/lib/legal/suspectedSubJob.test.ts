import { describe, expect, it } from 'vitest'
import { partyNameTokens, partyNamesMatch, setGcDoneWords, suspectedSubJob, suspectedSubJobLabel, type SuspectedSubJobInput } from './suspectedSubJob'

const brund: SuspectedSubJobInput = { hasGc: false, customerName: 'Brund & Assoc.', ownerOfRecord: 'Tune 5 Properties LLC', customerType: 'commercial', gcPaysByDefault: false, customerIsGcElsewhere: false, ownerContractConfirmed: false }

describe('party names, loosely', () => {
  it('drops punctuation and the business suffixes', () => {
    expect(partyNameTokens('Brund & Assoc., LLC')).toEqual(['brund'])
    expect(partyNameTokens('The Jordan Example Family Trust')).toEqual(['jordan', 'example'])
    expect(partyNameTokens('Tune 5 Properties')).toEqual(['tune', '5'])
  })
  it('matches a homeowner to the trust or LLC that holds the house, and a company to itself with a suffix', () => {
    expect(partyNamesMatch('Jordan Example', 'Jordan Example Family Trust')).toBe(true)
    expect(partyNamesMatch('Example Holdings LLC', 'Jordan Example')).toBe(true)
    expect(partyNamesMatch('Brund & Assoc.', 'Brund and Associates, Inc.')).toBe(true)
    expect(partyNamesMatch('Brund & Assoc.', 'Tune 5 Properties LLC')).toBe(false)
    expect(partyNamesMatch('', 'Anyone')).toBe(false)
    expect(partyNamesMatch('LLC', 'Inc')).toBe(false)
  })
})

describe('suspectedSubJob (punch list #166)', () => {
  it('flags job 891’s shape: no GC, another owner of record, a commercial customer', () => {
    expect(suspectedSubJob(brund)).toEqual({ suspected: true, owner: 'Tune 5 Properties LLC', customer: 'Brund & Assoc.', signals: ['the customer is commercial'] })
    expect(suspectedSubJobLabel('891', suspectedSubJob(brund) as Extract<ReturnType<typeof suspectedSubJob>, { suspected: true }>)).toBe('Probably a subcontract on 891: the owner of record (Tune 5 Properties LLC) is not Brund & Assoc., and the customer is commercial')
  })
  it('is quiet once the job has a GC, or the office said it is ours with the owner', () => {
    expect(suspectedSubJob({ ...brund, hasGc: true })).toEqual({ suspected: false, why: 'has_gc' })
    expect(suspectedSubJob({ ...brund, ownerContractConfirmed: true })).toEqual({ suspected: false, why: 'confirmed' })
  })
  it('is quiet with no owner of record, or when the owner is the customer', () => {
    expect(suspectedSubJob({ ...brund, ownerOfRecord: '' })).toEqual({ suspected: false, why: 'no_owner' })
    expect(suspectedSubJob({ ...brund, ownerOfRecord: 'Brund and Associates Inc' })).toEqual({ suspected: false, why: 'owner_is_customer' })
  })
  it('needs a second signal: a homeowner whose house is held by a trust is not a subcontractor’s customer', () => {
    const house = { ...brund, customerName: 'Jordan Example', ownerOfRecord: 'Oak Hollow Land Trust', customerType: 'residential' }
    expect(suspectedSubJob(house)).toEqual({ suspected: false, why: 'no_second_signal' })
    expect(suspectedSubJob({ ...house, gcPaysByDefault: true })).toEqual(expect.objectContaining({ suspected: true, signals: ['the customer pays as a GC by default'] }))
    expect(suspectedSubJob({ ...house, customerIsGcElsewhere: true })).toEqual(expect.objectContaining({ suspected: true, signals: ['the customer is the GC on another job'] }))
    expect((suspectedSubJob({ ...brund, gcPaysByDefault: true, customerIsGcElsewhere: true }) as { signals: string[] }).signals).toHaveLength(3)
  })
  it('words the toast after Set the GC', () => {
    expect(setGcDoneWords('Brund & Assoc.', '891')).toBe('Brund & Assoc. is now the GC on 891. The customer slot cleared, the bills go to the GC, and the monthly notices are tracked from here.')
  })
})
