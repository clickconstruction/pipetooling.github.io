/**
 * Add to a list: what someone on no list can become, what each choice makes, and the words around it. Every name,
 * company and address here is made up.
 */
import { describe, expect, it } from 'vitest'
import { ADD_TO_A_LIST_LABEL, addToListTitle, addedToListWords, listBusinessTag, listChoiceRefusal, listConfirmLabel, listMadeKey, listOptions, listPlan, papersComeWords, writeOnce, type ListPerson, type MadeRecord } from './paperPartyList'

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

  it('offers four things they can become, with what each makes', () => {
    expect(listOptions(noor)).toEqual([
      { choice: 'customer', title: 'A new customer', sub: 'Haddad Engineering, with Noor Haddad as a person there' },
      { choice: 'supply_house', title: 'A new supply house or vendor', sub: 'Haddad Engineering, with Noor Haddad as a rep' },
      { choice: 'trade', title: 'A new trade company', sub: 'Haddad Engineering, with Noor Haddad as a person there' },
      { choice: 'existing', title: 'Someone at a company we already have', sub: 'Search customers, supply houses and trade companies' },
    ])
  })

  it('someone with no company is the customer themselves, and a supply house or a trade company asks for its name', () => {
    expect(listOptions(alone).map((o) => o.sub)).toEqual([
      'Noor Haddad, as the customer',
      'Type the company’s name. Noor Haddad is added as a rep.',
      'Type the company’s name. Noor Haddad is added as a person there.',
      'Search customers, supply houses and trade companies',
    ])
  })

  it('tags each company it finds by its kind', () => {
    expect(listBusinessTag({ party: 'customer' })).toBe('Customer')
    expect(listBusinessTag({ party: 'supply_house' })).toBe('Supply house')
    expect(listBusinessTag({ party: 'trade' })).toBe('Trade company')
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

  it('a new trade company needs its name, starts with the trade Plumbing, and takes them as a person there', () => {
    expect(listPlan('trade', noor, null)).toEqual({ kind: 'new-trade', companyName: 'Haddad Engineering', trades: ['Plumbing'], person: { name: 'Noor Haddad', email: 'noor@haddadeng.example' } })
    expect(listChoiceRefusal('trade', alone, null)).toBe('Type the trade company’s name.')
    expect(listPlan('trade', alone, null)).toBeNull()
    expect(listConfirmLabel('trade', null)).toBe('Add as a trade company')
  })

  it('a trade company we keep can be picked like any other', () => {
    const mech = { table: 'gc_companies' as const, id: 'g1', name: 'ZZ Sample Mechanical LLC', party: 'trade' as const }
    expect(listPlan('existing', noor, mech)).toEqual({ kind: 'existing', business: mech, person: { name: 'Noor Haddad', email: 'noor@haddadeng.example' } })
    expect(listConfirmLabel('existing', mech)).toBe('Add to ZZ Sample Mechanical LLC')
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

// A press that fails after an earlier write landed leaves the window open. The next press finds that write and goes on
// from it (the audit of punch list #403, finding 10).
describe('a press after a failure', () => {
  const house = listMadeKey('house', ['Haddad Engineering'])

  it('knows a write by what it was for, trimmed and in any case', () => {
    expect(listMadeKey('house', [' haddad ENGINEERING '])).toBe(house)
    expect(listMadeKey('customer', ['Haddad Engineering'])).not.toBe(house)
    expect(listMadeKey('house', ['Haddad Supply'])).not.toBe(house)
    expect(listMadeKey('kept', ['customers', 'c1', 'Noor Haddad', 'noor@haddadeng.example'])).not.toBe(listMadeKey('kept', ['customers', 'c1', 'Noor Haddad', 'noor@elsewhere.example']))
    expect(listMadeKey('kept', ['customers', 'c1', 'Noor Haddad', ''])).not.toBe(listMadeKey('kept', ['supply_houses', 'c1', 'Noor Haddad', '']))
  })

  it('keeps the parts apart, whatever they hold', () => {
    expect(listMadeKey('kept', ['a|b', 'c'])).not.toBe(listMadeKey('kept', ['a', 'b|c']))
    expect(listMadeKey('kept', ['a","b', 'c'])).not.toBe(listMadeKey('kept', ['a', 'b","c']))
  })

  it('writes on the first press and hands the same record back after, writing nothing', async () => {
    const made = new Map<string, MadeRecord>()
    let writes = 0
    const write = async () => {
      writes += 1
      return { table: 'supply_houses', id: `h${writes}` }
    }
    expect(await writeOnce(made, house, write)).toEqual({ table: 'supply_houses', id: 'h1' })
    expect(await writeOnce(made, house, write)).toEqual({ table: 'supply_houses', id: 'h1' })
    expect(writes).toBe(1)
  })

  it('keeps nothing from a write that fails, so the next press writes again', async () => {
    const made = new Map<string, MadeRecord>()
    await expect(
      writeOnce(made, house, async () => {
        throw new Error('Failed to fetch')
      }),
    ).rejects.toThrow('Failed to fetch')
    expect(made.size).toBe(0)
    expect(await writeOnce(made, house, async () => ({ table: 'supply_houses', id: 'h2' }))).toEqual({ table: 'supply_houses', id: 'h2' })
  })

  it('writes again for something else', async () => {
    const made = new Map<string, MadeRecord>()
    await writeOnce(made, house, async () => ({ table: 'supply_houses', id: 'h1' }))
    expect(await writeOnce(made, listMadeKey('house', ['Haddad Supply']), async () => ({ table: 'supply_houses', id: 'h2' }))).toEqual({ table: 'supply_houses', id: 'h2' })
    expect(made.size).toBe(2)
  })
})
