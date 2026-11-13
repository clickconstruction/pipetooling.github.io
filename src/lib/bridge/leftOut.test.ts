import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { addressRule, addressWords, isLeftOut, leftOutKey, leftOutPickerNames, leftOutText, leftOutWords, parseLeftOut, withRule, withoutRule, type LeftOutRule } from './leftOut'

const development: LeftOutRule = { kind: 'development', key: 'dev-1', label: 'Oak Hollow' }
const customer: LeftOutRule = { kind: 'customer', key: 'cust-1', label: 'Ridgeway Builders' }
const address: LeftOutRule = { kind: 'address', key: '12 elm st', label: '12 Elm St' }

describe('the saved list', () => {
  it('reads back what it wrote', () => {
    const rules = [development, customer, address]
    expect(parseLeftOut(leftOutText(rules))).toEqual(rules)
  })

  it('reads no row, an empty row and broken text as never saved', () => {
    expect(parseLeftOut(null)).toBeNull()
    expect(parseLeftOut('  ')).toBeNull()
    expect(parseLeftOut('{not json')).toBeNull()
    expect(parseLeftOut('{"kind":"development"}')).toBeNull()
  })

  it('reads a saved empty list as a list that leaves nothing out, not as never saved', () => {
    expect(parseLeftOut('[]')).toEqual([])
  })

  it('drops what is not a rule and keeps a rule named twice once', () => {
    const text = JSON.stringify([development, { kind: 'planet', key: 'x', label: 'X' }, { kind: 'customer', key: '' }, development, null, 7])
    expect(parseLeftOut(text)).toEqual([development])
  })
})

describe('changing the list', () => {
  it('adds a rule once and takes one away', () => {
    expect(withRule([development], customer)).toEqual([development, customer])
    expect(withRule([development], { ...development, label: 'Another name' })).toEqual([development])
    expect(withoutRule([development, customer], development)).toEqual([customer])
  })

  it('makes an address rule from what was typed, and none from too few letters', () => {
    expect(addressRule('  48   Quarry   Road ')).toEqual({ kind: 'address', key: '48 quarry road', label: '48 Quarry Road' })
    expect(addressRule('12 e')).toBeNull()
  })

  it('offers a viewer who hides ZZ tests no ZZ name, and a dev who shows them every name', () => {
    const names = [{ id: 'a', name: 'Oak Hollow' }, { id: 'b', name: 'ZZ Test Meadows' }, { id: 'c', name: ' zz walk' }]
    expect(leftOutPickerNames(names, true)).toEqual([{ id: 'a', name: 'Oak Hollow' }])
    expect(leftOutPickerNames(names, false)).toBe(names)
    const plain = [{ id: 'a', name: 'Oak Hollow' }]
    expect(leftOutPickerNames(plain, true)).toBe(plain)
  })
})

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

describe('the key and the words', () => {
  it('gives one key to one list in any order, and another to another list', () => {
    expect(leftOutKey([development, customer])).toBe(leftOutKey([customer, development]))
    expect(leftOutKey([development])).not.toBe(leftOutKey([development, customer]))
    expect(leftOutKey([])).toBe('')
  })

  it('says what is left out by name, in plain words', () => {
    expect(leftOutWords([])).toBe('Nothing is left out.')
    expect(leftOutWords([development])).toBe('Leaves out Oak Hollow.')
    expect(leftOutWords([development, customer])).toBe('Leaves out Oak Hollow and Ridgeway Builders.')
    expect(leftOutWords([development, customer, address])).toBe('Leaves out Oak Hollow, Ridgeway Builders and 12 Elm St.')
    for (const rules of [[], [development], [development, customer], [development, customer, address]]) expect(plainWordsFailures(leftOutWords(rules))).toEqual([])
  })
})
