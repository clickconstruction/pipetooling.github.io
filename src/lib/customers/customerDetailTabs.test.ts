import { describe, expect, it } from 'vitest'
import { CUSTOMER_TAB_LABELS, customerDetailTabs, parseCustomerTab, sameNameCustomerIds, sameNameRowsWords } from './customerDetailTabs'

describe('customerDetailTabs', () => {
  it('draws Permits last for the office and estimators, and not at all for anyone else', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator'] as const) {
      expect(customerDetailTabs(role)).toEqual(['profile', 'estimates', 'jobs', 'invoices', 'permits'])
    }
    for (const role of ['subcontractor', 'helpers', 'superintendent', 'primary', null] as const) {
      expect(customerDetailTabs(role)).toEqual(['profile', 'estimates', 'jobs', 'invoices'])
    }
  })

  it('names every tab', () => {
    expect(customerDetailTabs('dev').map((t) => CUSTOMER_TAB_LABELS[t])).toEqual(['Profile', 'Estimates', 'Jobs', 'Invoices', 'Permits'])
  })
})

describe('parseCustomerTab', () => {
  it('reads the tab the link names', () => {
    expect(parseCustomerTab('permits', customerDetailTabs('estimator'))).toBe('permits')
    expect(parseCustomerTab('invoices', customerDetailTabs('subcontractor'))).toBe('invoices')
  })

  it('reads Profile for a tab this role does not hold, an unknown one, or none', () => {
    expect(parseCustomerTab('permits', customerDetailTabs('subcontractor'))).toBe('profile')
    expect(parseCustomerTab('nope', customerDetailTabs('dev'))).toBe('profile')
    expect(parseCustomerTab(null, customerDetailTabs('dev'))).toBe('profile')
  })
})

describe('sameNameCustomerIds', () => {
  const customers = [
    { id: 'a', name: 'Sample Builders, LLC' },
    { id: 'b', name: 'sample builders' },
    { id: 'c', name: 'Sample Builders of Texas' },
    { id: 'd', name: null },
    { id: 'e', name: 'LLC' },
  ]

  it('puts this customer first, then every other row of the same keyed name', () => {
    expect(sameNameCustomerIds('b', 'sample builders', customers)).toEqual(['b', 'a'])
    expect(sameNameCustomerIds('a', 'Sample Builders, LLC', customers)).toEqual(['a', 'b'])
  })

  it('leaves a longer name alone: beginning the same is not the same name', () => {
    expect(sameNameCustomerIds('c', 'Sample Builders of Texas', customers)).toEqual(['c'])
  })

  it('stands alone when the name has nothing to key, so blank rows are never read as one GC', () => {
    expect(sameNameCustomerIds('d', null, customers)).toEqual(['d'])
    expect(sameNameCustomerIds('e', 'LLC', customers)).toEqual(['e'])
  })

  it('stands alone when the customer list is empty', () => {
    expect(sameNameCustomerIds('z', 'Sample Builders', [])).toEqual(['z'])
  })

  it('still finds the rows of its name when the list does not hold this customer, as an archived one is left out of it', () => {
    expect(sameNameCustomerIds('z', 'Sample Builders', customers)).toEqual(['z', 'a', 'b'])
  })
})

describe('sameNameRowsWords', () => {
  it('says how many other rows were read with this one, and nothing when it stands alone', () => {
    expect(sameNameRowsWords(0)).toBeNull()
    expect(sameNameRowsWords(1)).toBe('Read together with 1 other customer row of the same name.')
    expect(sameNameRowsWords(2)).toBe('Read together with 2 other customer rows of the same name.')
  })
})
