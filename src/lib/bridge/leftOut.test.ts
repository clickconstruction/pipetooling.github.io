import { describe, expect, it } from 'vitest'
import { addressWords, isLeftOut, type LeftOutRule } from './leftOut'

const development: LeftOutRule = { kind: 'development', key: 'dev-1', label: 'Oak Hollow' }
const customer: LeftOutRule = { kind: 'customer', key: 'cust-1', label: 'Ridgeway Builders' }
const address: LeftOutRule = { kind: 'address', key: '12 elm st', label: '12 Elm St' }

describe('isLeftOut', () => {
  it('leaves nothing out with an empty list', () => {
    expect(isLeftOut({ developmentId: 'dev-1', customerId: 'cust-1', address: '12 Elm St' }, [])).toBe(false)
  })

  it('matches a development by its id', () => {
    expect(isLeftOut({ developmentId: 'dev-1' }, [development])).toBe(true)
    expect(isLeftOut({ developmentId: 'dev-2' }, [development])).toBe(false)
    expect(isLeftOut({ developmentId: null }, [development])).toBe(false)
  })

  it('matches a customer as the customer or as the general contractor', () => {
    expect(isLeftOut({ customerId: 'cust-1' }, [customer])).toBe(true)
    expect(isLeftOut({ customerId: 'other', gcCustomerId: 'cust-1' }, [customer])).toBe(true)
    expect(isLeftOut({ customerId: 'other', gcCustomerId: 'other' }, [customer])).toBe(false)
  })

  it('matches an address by its words, whatever the case or the spacing', () => {
    expect(addressWords('  12   ELM st ')).toBe('12 elm st')
    expect(isLeftOut({ address: 'Unit B, 12  Elm St, Austin' }, [address])).toBe(true)
    expect(isLeftOut({ address: '14 Elm St' }, [address])).toBe(false)
    expect(isLeftOut({ address: null }, [address])).toBe(false)
  })
})
