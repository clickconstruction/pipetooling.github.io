/**
 * Add to a list: what someone on no list can become, what each choice makes, and the words around it. Every name,
 * company and address here is made up.
 */
import { describe, expect, it } from 'vitest'
import { ADD_TO_A_LIST_LABEL, addToListTitle, addedToListWords, listChoiceRefusal, listConfirmLabel, listOptions, listPlan, papersComeWords, type ListPerson } from './paperPartyList'

const noor: ListPerson = { name: 'Noor Haddad', email: 'noor@haddadeng.example', company: 'Haddad Engineering' }
const alone: ListPerson = { name: 'Noor Haddad', email: 'noor@haddadeng.example', company: '' }
const ridgeway = { table: 'customers' as const, id: 'c1', name: 'Ridgeway Builders', party: 'customer' as const }
const tallgrass = { table: 'supply_houses' as const, id: 'h1', name: 'Tallgrass Supply Co.', party: 'supply_house' as const }

describe('the window', () => {
  it('is named for the person', () => {
    expect(ADD_TO_A_LIST_LABEL).toBe('Add to a list')
    expect(addToListTitle(noor)).toBe('Add Noor Haddad to a list')
    expect(addToListTitle({ name: ' ' })).toBe('Add them to a list')
  })

  it('offers three things they can become, with what each makes', () => {
    expect(listOptions(noor)).toEqual([
      { choice: 'customer', title: 'A new customer', sub: 'Haddad Engineering, with Noor Haddad as a person there' },
      { choice: 'supply_house', title: 'A new supply house or vendor', sub: 'Haddad Engineering, with Noor Haddad as a rep' },
      { choice: 'existing', title: 'Someone at a company we already have', sub: 'Search customers and supply houses' },
    ])
  })

  it('someone with no company is the customer themselves, and a supply house asks for its name', () => {
    expect(listOptions(alone).map((o) => o.sub)).toEqual(['Noor Haddad, as the customer', 'Type the company’s name. Noor Haddad is added as a rep.', 'Search customers and supply houses'])
  })

  it('says which papers come with them', () => {
    expect(papersComeWords(['Mutual secrecy agreement'])).toBe('1 paper comes with them: Mutual secrecy agreement.')
    expect(papersComeWords(['Mutual secrecy agreement', 'Credit terms letter'])).toBe('2 papers come with them: Mutual secrecy agreement, Credit terms letter.')
    expect(papersComeWords(['A', 'B', 'C', 'D', 'E'])).toBe('5 papers come with them: A, B, C and 2 more.')
    expect(papersComeWords([])).toBe('')
  })
})

describe('a choice', () => {
  it('a new customer is made with them as a person there, or as the customer when they have no company', () => {
    expect(listPlan('customer', noor, null)).toEqual({ kind: 'new-customer', customerName: 'Haddad Engineering', person: { name: 'Noor Haddad', email: 'noor@haddadeng.example' } })
    expect(listPlan('customer', alone, null)).toEqual({ kind: 'new-customer', customerName: 'Noor Haddad', person: null })
  })

  it('a new supply house needs its name, and takes them as a rep', () => {
    expect(listPlan('supply_house', noor, null)).toEqual({ kind: 'new-supply-house', houseName: 'Haddad Engineering', person: { name: 'Noor Haddad', email: 'noor@haddadeng.example' } })
    expect(listChoiceRefusal('supply_house', alone, null)).toBe('Type the supply house’s or the vendor’s name.')
    expect(listPlan('supply_house', alone, null)).toBeNull()
  })

  it('a company the app has needs picking, and takes them as a person on file there', () => {
    expect(listChoiceRefusal('existing', noor, null)).toBe('Pick the company they are at.')
    expect(listPlan('existing', noor, null)).toBeNull()
    expect(listPlan('existing', noor, ridgeway)).toEqual({ kind: 'existing', business: ridgeway, person: { name: 'Noor Haddad', email: 'noor@haddadeng.example' } })
    expect(listPlan('existing', alone, tallgrass)?.kind).toBe('existing')
  })

  it('nobody is added with no name to add', () => {
    expect(listChoiceRefusal('customer', { name: ' ', email: '', company: 'Haddad Engineering' }, null)).toBe('The paper kept no name for them. Send it again with the signer’s name first.')
    expect(listChoiceRefusal('customer', noor, null)).toBeNull()
  })

  it('the button names the act and where they go', () => {
    expect(listConfirmLabel('customer', null)).toBe('Add as a customer')
    expect(listConfirmLabel('supply_house', null)).toBe('Add as a supply house')
    expect(listConfirmLabel('existing', null)).toBe('Add to a company')
    expect(listConfirmLabel('existing', ridgeway)).toBe('Add to Ridgeway Builders')
  })

  it('says where they went, and that the paper came along', () => {
    expect(addedToListWords(noor, 'Ridgeway Builders', 1)).toBe('Noor Haddad is with Ridgeway Builders now. Their paper came with them.')
    expect(addedToListWords(noor, 'Tallgrass Supply Co.', 3)).toBe('Noor Haddad is with Tallgrass Supply Co. now. Their papers came with them.')
    expect(addedToListWords(noor, 'the customers', 0)).toBe('Noor Haddad is with the customers now.')
  })
})
