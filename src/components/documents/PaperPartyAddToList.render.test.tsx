// @vitest-environment jsdom
/**
 * Add to a list: the window reads who the paper's party is and which papers come with them, offers what they can
 * become, and writes nothing until the last press. A new supply house is made with them as a rep; a company the app
 * already keeps takes them as a person on file; a new customer is made in the app's own form. Every name is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { OFFLINE_READ_MESSAGE } from '../../lib/offlineRecoveryState'
import { PaperPartyAddToList } from './PaperPartyAddToList'

const io = vi.hoisted(() => ({
  person: { contactId: 'k1', name: 'Noor Haddad', email: 'noor@haddadeng.example', company: 'Haddad Engineering' },
  papers: ['Mutual secrecy agreement'],
  did: [] as string[],
  failName: null as null | Error,
  failRead: null as null | Error,
  /** What a customer search and the short lists' read throw, when they fail. */
  failSearch: null as unknown,
  failLists: null as unknown,
  /** What the trade company search throws, when it fails. */
  failTrades: null as unknown,
  /** How many customers the app's own form saved. */
  customersMade: 0,
}))
vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: 'assistant', user: { id: 'u1' } })
  return { useAuth: auth, useOptionalAuth: auth }
})
vi.mock('../../lib/documents/paperPartyIo', () => ({
  readListPerson: async () => {
    if (io.failRead) throw io.failRead
    return io.person
  },
  readPartyPaperNames: async () => io.papers,
  readPartyShortLists: async () => {
    if (io.failLists) throw io.failLists
    return { customerPeople: [], supplyHouses: [{ id: 'h1', name: 'Tallgrass Supply Co.' }], reps: [] }
  },
  searchPartyCustomers: async (typed: string) => {
    if (io.failSearch) throw io.failSearch
    return typed.toLowerCase().includes('ridge') ? [{ id: 'c1', name: 'Ridgeway Builders' }] : []
  },
  searchTradeCompanies: async (typed: string) => {
    if (io.failTrades) throw io.failTrades
    return typed.toLowerCase().includes('mech') ? [{ table: 'gc_companies', id: 'g1', name: 'ZZ Sample Mechanical LLC', party: 'trade' }] : []
  },
  addTradeCompany: async (name: string, trades: string[], person: { name: string; email: string }) => {
    io.did.push(`trade ${name} (${trades.join(', ')}) with ${person.name}`)
    return { companyId: 'g-new', personRowId: 'gp-new' }
  },
  keepSignerWithTradeCompany: async (companyId: string, signer: { name: string; email: string }) => {
    io.did.push(`kept ${signer.name} at gc_companies:${companyId}`)
    return { table: 'gc_company_people', id: 'gp-kept' }
  },
  addSupplyHouse: async (name: string) => {
    io.did.push(`house ${name}`)
    return 'h-new'
  },
  keepSignerWithBusiness: async (business: { table: string; id: string }, signer: { name: string; email: string }) => {
    io.did.push(`kept ${signer.name} with ${business.table}:${business.id}`)
    return { table: business.table === 'customers' ? 'customer_contact_persons' : 'supply_house_contacts', id: 'p-new' }
  },
  namePartyContact: async (contactId: string, record: { table: string; id: string }, kind: string, name?: string) => {
    if (io.failName) throw io.failName
    io.did.push(`named ${contactId} as ${kind} ${record.table}:${record.id}${name ? ` (${name})` : ''}`)
    return contactId
  },
}))
// The app's own New customer form is its own file's to test: here it says what it opened on and makes a customer.
vi.mock('../NewCustomerForm', () => ({
  default: (p: { initialValues?: { name?: string; email?: string }; onCreated?: (c: { id: string; name: string }) => void; onCancel?: () => void }) => (
    <div data-testid="new-customer-form">
      {`${p.initialValues?.name}|${p.initialValues?.email ?? ''}`}
      <button
        type="button"
        onClick={() => {
          io.customersMade += 1
          p.onCreated?.({ id: 'c-new', name: p.initialValues?.name ?? '' })
        }}
      >
        fake save customer
      </button>
      <button type="button" onClick={() => p.onCancel?.()}>
        fake cancel customer
      </button>
    </div>
  ),
}))

beforeEach(() => {
  io.person = { contactId: 'k1', name: 'Noor Haddad', email: 'noor@haddadeng.example', company: 'Haddad Engineering' }
  io.papers = ['Mutual secrecy agreement']
  io.did = []
  io.failName = null
  io.failRead = null
  io.failSearch = null
  io.failLists = null
  io.failTrades = null
  io.customersMade = 0
})
afterEach(() => cleanup())

const open = async (onAdded = vi.fn(), onClose = vi.fn()) => {
  renderWithProviders(<PaperPartyAddToList documentId="d1" onClose={onClose} onAdded={onAdded} />)
  await screen.findByRole('dialog', { name: 'Add Noor Haddad to a list' })
  return { onAdded, onClose }
}

describe('PaperPartyAddToList', () => {
  it('names the person, offers what they can become, and says which paper comes with them', async () => {
    await open()
    expect(screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).checked)).toEqual([true, false, false, false])
    expect(screen.getByRole('radiogroup').textContent).toBe(
      'A new customerHaddad Engineering, with Noor Haddad as a person thereA new supply house or vendorHaddad Engineering, with Noor Haddad as a repA new trade companyHaddad Engineering, with Noor Haddad as a person thereSomeone at a company we already haveSearch customers, supply houses and trade companies',
    )
    expect(screen.getByTestId('paper-party-list-papers').textContent).toBe('1 paper comes with them: Mutual secrecy agreement.')
    expect(screen.getByRole('button', { name: 'Add as a customer' })).toBeTruthy()
    expect(io.did).toEqual([])
  })

  it('a new supply house is made, they are kept as its rep, and their contact is named', async () => {
    const { onAdded } = await open()
    fireEvent.click(screen.getByRole('radio', { name: /A new supply house or vendor/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add as a supply house' }))
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith('Noor Haddad is with Haddad Engineering now. Their paper came with them.'))
    expect(io.did).toEqual(['house Haddad Engineering', 'kept Noor Haddad with supply_houses:h-new', 'named k1 as supply_house supply_house_contacts:p-new'])
  })

  it('a new trade company is made with the trade Plumbing and them there, and their contact is named (punch list #403, step 6)', async () => {
    const { onAdded } = await open()
    fireEvent.click(screen.getByRole('radio', { name: /A new trade company/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add as a trade company' }))
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith('Noor Haddad is with Haddad Engineering now. Their paper came with them.'))
    expect(io.did).toEqual(['trade Haddad Engineering (Plumbing) with Noor Haddad', 'named k1 as trade gc_company_people:gp-new'])
  })

  it('a trade company we keep is found by name, and they are kept there', async () => {
    const { onAdded } = await open()
    fireEvent.click(screen.getByRole('radio', { name: /Someone at a company we already have/ }))
    fireEvent.change(screen.getByLabelText('Find a customer, a supply house or a trade company'), { target: { value: 'mech' } })
    const row = await screen.findByRole('button', { name: /ZZ Sample Mechanical LLC/ })
    expect(row.textContent).toBe('ZZ Sample Mechanical LLCTrade company')
    fireEvent.click(row)
    fireEvent.click(screen.getByRole('button', { name: 'Add to ZZ Sample Mechanical LLC' }))
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith('Noor Haddad is with ZZ Sample Mechanical LLC now. Their paper came with them.'))
    expect(io.did).toEqual(['kept Noor Haddad at gc_companies:g1', 'named k1 as trade gc_company_people:gp-kept'])
  })

  it('a supply house needs a name before anything is written', async () => {
    io.person = { ...io.person, company: '' }
    await open()
    fireEvent.click(screen.getByRole('radio', { name: /A new supply house or vendor/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add as a supply house' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Type the supply house’s or the vendor’s name.')
    expect(io.did).toEqual([])
  })

  it('a company the app already keeps: found by name, picked, and they are kept there', async () => {
    const { onAdded } = await open()
    fireEvent.click(screen.getByRole('radio', { name: /Someone at a company we already have/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add to a company' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Pick the company they are at.')
    fireEvent.change(screen.getByLabelText('Find a customer, a supply house or a trade company'), { target: { value: 'ridge' } })
    fireEvent.click(await screen.findByRole('button', { name: /^Ridgeway Builders/ }, { timeout: 3000 }))
    expect(screen.getByTestId('paper-party-list-picked').textContent).toBe('They are at Ridgeway Builders.')
    fireEvent.click(screen.getByRole('button', { name: 'Add to Ridgeway Builders' }))
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith('Noor Haddad is with Ridgeway Builders now. Their paper came with them.'))
    expect(io.did).toEqual(['kept Noor Haddad with customers:c1', 'named k1 as customer customer_contact_persons:p-new'])
  })

  it('a supply house is found in the short list the window holds', async () => {
    await open()
    fireEvent.click(screen.getByRole('radio', { name: /Someone at a company we already have/ }))
    fireEvent.change(screen.getByLabelText('Find a customer, a supply house or a trade company'), { target: { value: 'tall' } })
    expect(await screen.findByRole('button', { name: /^Tallgrass Supply Co\./ })).toBeTruthy()
  })

  it('a customer search that fails says so under the find box, and reads again on Retry', async () => {
    io.failSearch = new Error('TypeError: Failed to fetch')
    await open()
    fireEvent.click(screen.getByRole('radio', { name: /Someone at a company we already have/ }))
    fireEvent.change(screen.getByLabelText('Find a customer, a supply house or a trade company'), { target: { value: 'ridge' } })
    const retry = await screen.findByRole('button', { name: 'Retry' }, { timeout: 3000 })
    expect(screen.getByText(OFFLINE_READ_MESSAGE)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Ridgeway Builders/ })).toBeNull()
    io.failSearch = null
    fireEvent.click(retry)
    expect(await screen.findByRole('button', { name: /^Ridgeway Builders/ }, { timeout: 3000 })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('supply houses that do not read say so, and read again on Retry', async () => {
    io.failLists = new Error('TypeError: Failed to fetch')
    await open()
    fireEvent.click(screen.getByRole('radio', { name: /Someone at a company we already have/ }))
    const retry = await screen.findByRole('button', { name: 'Retry' })
    expect(screen.getByText(OFFLINE_READ_MESSAGE)).toBeTruthy()
    io.failLists = null
    fireEvent.click(retry)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull())
    fireEvent.change(screen.getByLabelText('Find a customer, a supply house or a trade company'), { target: { value: 'tall' } })
    expect(await screen.findByRole('button', { name: /^Tallgrass Supply Co\./ })).toBeTruthy()
  })

  it('a refused read names its reason after the window’s own sentence', async () => {
    io.failLists = { code: '42501', message: 'permission denied for table supply_houses' }
    io.failSearch = { code: '42501', message: 'permission denied for table customers' }
    await open()
    fireEvent.click(screen.getByRole('radio', { name: /Someone at a company we already have/ }))
    const houses = await screen.findByText(/^The supply houses did not read/)
    expect(houses.textContent).not.toBe('The supply houses did not read.')
    fireEvent.change(screen.getByLabelText('Find a customer, a supply house or a trade company'), { target: { value: 'ridge' } })
    const customers = await screen.findByText(/^The customers did not read/, undefined, { timeout: 3000 })
    expect(customers.textContent).not.toBe('The customers did not read.')
  })

  it('a new customer is made in the app’s own form, on the company’s name, then they are kept there', async () => {
    const { onAdded } = await open()
    fireEvent.click(screen.getByRole('button', { name: 'Add as a customer' }))
    expect((await screen.findByTestId('new-customer-form')).textContent).toContain('Haddad Engineering|')
    expect(io.did).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'fake save customer' }))
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith('Noor Haddad is with Haddad Engineering now. Their paper came with them.'))
    expect(io.did).toEqual(['kept Noor Haddad with customers:c-new', 'named k1 as customer customer_contact_persons:p-new'])
  })

  it('someone with no company is the customer themselves: the form opens on their own name and address', async () => {
    io.person = { ...io.person, company: '' }
    const { onAdded } = await open()
    fireEvent.click(screen.getByRole('button', { name: 'Add as a customer' }))
    expect((await screen.findByTestId('new-customer-form')).textContent).toContain('Noor Haddad|noor@haddadeng.example')
    fireEvent.click(screen.getByRole('button', { name: 'fake save customer' }))
    await waitFor(() => expect(onAdded).toHaveBeenCalled())
    expect(io.did).toEqual(['named k1 as customer customers:c-new'])
  })

  it('cancelling the customer form writes nothing and comes back to the window', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Add as a customer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'fake cancel customer' }))
    expect(await screen.findByRole('dialog', { name: 'Add Noor Haddad to a list' })).toBeTruthy()
    expect(io.did).toEqual([])
  })

  it('says why when they could not be added, and stays open', async () => {
    io.failName = new Error('Someone has already said who they are. Close this and read the list again.')
    const { onAdded } = await open()
    fireEvent.click(screen.getByRole('radio', { name: /A new supply house or vendor/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add as a supply house' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Someone has already said who they are. Close this and read the list again.')
    expect(onAdded).not.toHaveBeenCalled()
  })

  it('a rep with no address on the paper is named on the supply house’s own row', async () => {
    io.person = { ...io.person, email: '' }
    const { onAdded } = await open()
    fireEvent.click(screen.getByRole('radio', { name: /A new supply house or vendor/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add as a supply house' }))
    await waitFor(() => expect(onAdded).toHaveBeenCalled())
    expect(io.did).toEqual(['house Haddad Engineering', 'named k1 as supply_house supply_houses:h-new (Noor Haddad)'])
  })

  // A press that fails after an earlier write landed leaves the window open. Pressing again goes on from that write, so
  // nothing is made twice (the audit of punch list #403, finding 10).
  describe('a press after a failure', () => {
    beforeEach(() => {
      io.failName = new Error('Failed to fetch')
    })

    it('makes no second supply house and keeps the rep once', async () => {
      const { onAdded } = await open()
      fireEvent.click(screen.getByRole('radio', { name: /A new supply house or vendor/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Add as a supply house' }))
      await screen.findByRole('alert')
      expect(io.did).toEqual(['house Haddad Engineering', 'kept Noor Haddad with supply_houses:h-new'])
      io.failName = null
      fireEvent.click(screen.getByRole('button', { name: 'Add as a supply house' }))
      await waitFor(() => expect(onAdded).toHaveBeenCalledWith('Noor Haddad is with Haddad Engineering now. Their paper came with them.'))
      expect(io.did).toEqual(['house Haddad Engineering', 'kept Noor Haddad with supply_houses:h-new', 'named k1 as supply_house supply_house_contacts:p-new'])
    })

    it('keeps the customer the form saved: the form does not open again', async () => {
      const { onAdded } = await open()
      fireEvent.click(screen.getByRole('button', { name: 'Add as a customer' }))
      fireEvent.click(await screen.findByRole('button', { name: 'fake save customer' }))
      await screen.findByRole('alert')
      io.failName = null
      fireEvent.click(screen.getByRole('button', { name: 'Add as a customer' }))
      await waitFor(() => expect(onAdded).toHaveBeenCalledWith('Noor Haddad is with Haddad Engineering now. Their paper came with them.'))
      expect(screen.queryByTestId('new-customer-form')).toBeNull()
      expect(io.customersMade).toBe(1)
      expect(io.did).toEqual(['kept Noor Haddad with customers:c-new', 'named k1 as customer customer_contact_persons:p-new'])
    })

    it('keeps the person once at a company the app already keeps', async () => {
      const { onAdded } = await open()
      fireEvent.click(screen.getByRole('radio', { name: /Someone at a company we already have/ }))
      fireEvent.change(screen.getByLabelText('Find a customer, a supply house or a trade company'), { target: { value: 'ridge' } })
      fireEvent.click(await screen.findByRole('button', { name: /^Ridgeway Builders/ }, { timeout: 3000 }))
      fireEvent.click(screen.getByRole('button', { name: 'Add to Ridgeway Builders' }))
      await screen.findByRole('alert')
      io.failName = null
      fireEvent.click(screen.getByRole('button', { name: 'Add to Ridgeway Builders' }))
      await waitFor(() => expect(onAdded).toHaveBeenCalledWith('Noor Haddad is with Ridgeway Builders now. Their paper came with them.'))
      expect(io.did).toEqual(['kept Noor Haddad with customers:c1', 'named k1 as customer customer_contact_persons:p-new'])
    })

    it('makes a new supply house when the name was changed between presses', async () => {
      const { onAdded } = await open()
      fireEvent.click(screen.getByRole('radio', { name: /A new supply house or vendor/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Add as a supply house' }))
      await screen.findByRole('alert')
      io.failName = null
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Haddad Supply' } })
      fireEvent.click(screen.getByRole('button', { name: 'Add as a supply house' }))
      await waitFor(() => expect(onAdded).toHaveBeenCalledWith('Noor Haddad is with Haddad Supply now. Their paper came with them.'))
      expect(io.did.filter((d) => d.startsWith('house '))).toEqual(['house Haddad Engineering', 'house Haddad Supply'])
    })
  })
})
