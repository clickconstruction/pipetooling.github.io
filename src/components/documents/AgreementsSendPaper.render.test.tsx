// @vitest-environment jsdom
/**
 * Documents → Agreements, Send a paper: the press reads the Contract Book and offers its papers; a paper with nothing
 * to sign names why and is not a press; a picked paper asks who it is with; a picked person on the roster opens the
 * Send window on the plan, with nothing written before; and a sent paper tells the list to read again. The Contract
 * library's Send to… starts it at Who is it with?, and the paper step's own door opens the library.
 *
 * Since punch list #403 the second window also finds a supply house, its reps, a customer and the people on file
 * there, and takes someone on no list. An outside party's paper is written only at Send: its contact is found, a typed
 * signer is kept with the company when the office says so, and the row is filed under the party's stored name.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { OFFLINE_READ_MESSAGE } from '../../lib/offlineRecoveryState'
import { AgreementsSendPaper } from './AgreementsSendPaper'

const io = vi.hoisted(() => ({
  reads: 0,
  fail: null as null | Error,
  book: [] as unknown[],
  personDocuments: [] as unknown[],
  rosterNames: [] as string[],
  roster: [] as Array<{ name: string; sub: boolean }>,
  facts: [] as string[],
  /** What a party's send did, in order. */
  party: [] as string[],
  customers: [] as Array<{ id: string; name: string }>,
  /** What a customer search throws, when it fails. */
  failSearch: null as unknown,
  /** The contact a picked record already has, when the look before the window finds one. */
  found: null as string | null,
}))
vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: 'assistant', user: { id: 'u1' } })
  return { useAuth: auth, useOptionalAuth: auth }
})
vi.mock('../../lib/documents/agreementsSendIo', () => ({
  readAgreementsSendBook: async () => {
    io.reads += 1
    if (io.fail) throw io.fail
    return { book: io.book, personDocuments: io.personDocuments, rosterNames: io.rosterNames, roster: io.roster }
  },
}))
vi.mock('../../lib/documents/paperPartyIo', () => ({
  readPartyShortLists: async () => ({
    customerPeople: [{ id: 'cp1', name: 'Dana Ruiz', email: 'dana@ridgeway.example', customerId: 'c1', customerName: 'Ridgeway Builders' }],
    supplyHouses: [{ id: 'h1', name: 'Tallgrass Supply Co.' }],
    reps: [{ id: 'r1', name: 'Lena Park', label: 'Branch manager', email: 'lena@tallgrass.example', houseId: 'h1', houseName: 'Tallgrass Supply Co.' }],
  }),
  searchPartyCustomers: async () => {
    if (io.failSearch) throw io.failSearch
    return io.customers
  },
  findPartyContact: async () => io.found,
  readCopiesOut: async (ids: string[]) => ids.map((docId) => ({ docId, signerName: 'Lena Park', signerTitle: 'Branch manager', signerEmail: 'lena@tallgrass.example', sentAt: '2026-11-01T18:00:00Z' })),
  readPartyContact: async (record: { table: string; id: string }) => {
    io.party.push(`contact ${record.table}:${record.id}`)
    return '3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d'
  },
  makeContactForAddress: async (email: string, name: string) => {
    io.party.push(`made ${email} as ${name}`)
    return '9a1b2c3d-0a4d-4e8b-9c6f-1d2e3a4b5c6d'
  },
  keepSignerWithBusiness: async (business: { table: string; id: string }, signer: { name: string; email: string }) => {
    io.party.push(`kept ${signer.name} with ${business.table}:${business.id}`)
    return { table: 'customer_contact_persons', id: 'cp-new' }
  },
}))
vi.mock('../../lib/contracts/personPaperSendIo', () => ({
  readPersonSendFactsByName: async (personName: string, documentName: string) => {
    io.facts.push(`${personName}|${documentName}`)
    return { target: { personName, documentName }, initialEmail: 'bryce@example.com', personId: null, sender: null }
  },
  readSenderFacts: async () => ({ name: 'Grace Hale', email: 'grace@example.com' }),
  materializeQuickSendRow: async (pending: { personName: string; documentName: string; plan: { kind: string }; party?: { contactId: string; name: string } }) => {
    io.party.push(`wrote ${pending.plan.kind} ${pending.personName} · ${pending.documentName} · ${pending.party?.name}`)
    return 'party-row'
  },
}))
// The Send window is its own file's to test: here it says what it was opened on, and its button says it sent.
vi.mock('../contracts/ContractSendWindow', () => ({
  ContractSendWindow: (p: {
    again?: boolean
    docId: string | null
    quickSendPlan?: { kind: string } | null
    target: { personName: string; documentName: string } | null
    initialEmail: string
    initialSignerName?: string
    initialSignerTitle?: string
    party?: { name: string; unlisted: boolean; keepWith: string | null } | null
    preparePartyPaper?: (input: { signerName: string; signerEmail: string; typedCompany: string; keep: boolean }) => Promise<string>
    onSent: (s: { docId: string; emailed: boolean; planKind: string | null }) => void
  }) => (
    <div data-testid="send-window">
      {`${p.again ? 'again' : 'first'}|${p.docId}|${p.quickSendPlan?.kind}|${p.target?.personName}|${p.target?.documentName}`}
      {p.party ? <span data-testid="send-window-party">{`${p.party.name || 'nobody'}|${p.party.unlisted ? 'unlisted' : 'listed'}|keep ${p.party.keepWith ?? 'nobody'}|${p.initialSignerName}|${p.initialSignerTitle}|${p.initialEmail}`}</span> : null}
      <button type="button" onClick={() => p.onSent({ docId: 'new', emailed: true, planKind: p.quickSendPlan?.kind ?? null })}>
        fake send
      </button>
      {p.preparePartyPaper ? (
        <button
          type="button"
          onClick={() =>
            void p.preparePartyPaper!({ signerName: p.initialSignerName || 'Wren Castillo', signerEmail: p.initialEmail || 'wren@example.com', typedCompany: p.party?.unlisted ? 'Haddad Engineering' : '', keep: p.party?.keepWith != null }).then((docId) => {
              io.party.push(`sends ${docId}`)
              p.onSent({ docId, emailed: true, planKind: null })
            })
          }
        >
          fake party send
        </button>
      ) : null}
    </div>
  ),
}))

/** Every name here is made up. */
const bookRow = (over: Record<string, unknown>) => ({
  id: 'b1',
  document_name: 'Subcontractor Handbook',
  book_body_html: '<p>Rules</p>',
  book_body_format: 'html',
  canonical_document_url: null,
  form_template_id: null,
  book_version_date: null,
  updated_at: '2026-10-01T00:00:00Z',
  audience: 'sub',
  flow_kind: null,
  ...over,
})
const sentCopy = { id: 'd9', person_name: 'Priya Nair', document_name: 'Subcontractor Handbook', status: 'sent', lineage_version: 1, sent_at: '2026-11-01T00:00:00Z', signer_last_viewed_at: null, signed_at: null, url: null, signing_body_html: '<p>Rules</p>', signing_body_format: 'html', canonical_document_url: null }

beforeEach(() => {
  io.reads = 0
  io.fail = null
  io.book = [bookRow({}), bookRow({ id: 'b2', document_name: 'Empty shell', book_body_html: '' }), bookRow({ id: 'b3', document_name: 'W-9', book_body_html: null, form_template_id: 'f1' })]
  io.personDocuments = [sentCopy]
  io.rosterNames = ['Bryce Tolland', 'Priya Nair']
  io.roster = [
    { name: 'Bryce Tolland', sub: true },
    { name: 'Priya Nair', sub: false },
  ]
  io.facts = []
  io.party = []
  io.customers = []
  io.failSearch = null
  io.found = null
})
afterEach(() => cleanup())

describe('AgreementsSendPaper', () => {
  it('reads the Book on the press and offers its papers; one with no words names why and is not a press', async () => {
    renderWithProviders(<AgreementsSendPaper onSent={() => {}} onOpenLibrary={() => {}} />)
    expect(io.reads).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Send a paper' }))
    const dialog = await screen.findByRole('dialog', { name: 'Send a paper' })
    expect(io.reads).toBe(1)
    expect(Array.from(dialog.querySelectorAll('button')).map((b) => b.textContent)).toEqual(['×', 'Subcontractor HandbookFrom the Contract Book', 'W-9A form from the Contract Book', 'Contract library'])
    expect(screen.getByTestId('send-paper-no-words').textContent).toBe('Empty shellNo words yet. Write it in the Contract Book first.')
    fireEvent.change(screen.getByLabelText('Find a paper'), { target: { value: 'zebra' } })
    expect(await screen.findByText('No papers match ‘zebra’.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
    expect(screen.getByRole('button', { name: /^W-9/ })).toBeTruthy()
  })

  it('a paper, then a person with no copy yet: the Send window opens on a plan that writes only at Send', async () => {
    const onSent = vi.fn()
    renderWithProviders(<AgreementsSendPaper onSent={onSent} onOpenLibrary={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send a paper' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Subcontractor Handbook/ }))
    // Who is it with? lists the roster with nothing typed, and Someone not in any list last.
    const picker = await screen.findByRole('dialog', { name: 'Send Subcontractor Handbook: who is it with?' })
    await waitFor(() => expect(Array.from(picker.querySelectorAll('[data-testid="paper-party-row"]')).map((b) => b.textContent)).toEqual(['Bryce TollandSigns for themselvesSub', 'Priya NairSigns for themselvesStaff', 'Someone not in any listType their name and email next.Not on a list']))
    fireEvent.click(screen.getByRole('button', { name: /^Bryce Tolland/ }))
    expect((await screen.findByTestId('send-window')).textContent).toContain('first|null|insert|Bryce Tolland|Subcontractor Handbook')
    expect(io.facts).toEqual(['Bryce Tolland|Subcontractor Handbook'])
    fireEvent.click(screen.getByRole('button', { name: 'fake send' }))
    await waitFor(() => expect(screen.queryByTestId('send-window')).toBeNull())
    expect(onSent).toHaveBeenCalledTimes(1)
  })

  it('a person who already has it out is sent the same copy again', async () => {
    renderWithProviders(<AgreementsSendPaper onSent={() => {}} onOpenLibrary={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send a paper' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Subcontractor Handbook/ }))
    fireEvent.click(await screen.findByRole('button', { name: /^Priya Nair/ }))
    expect((await screen.findByTestId('send-window')).textContent).toContain('again|d9|reuse|Priya Nair|Subcontractor Handbook')
  })

  it('says why when the Book does not read, and opens nothing', async () => {
    io.fail = new Error('permission denied for table contract_template_documents')
    renderWithProviders(<AgreementsSendPaper onSent={() => {}} onOpenLibrary={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send a paper' }))
    expect(await screen.findByText('permission denied for table contract_template_documents')).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Send a paper' })).toBeNull()
  })

  it('with no paper in the Book names the Contract library, and the press opens it', async () => {
    io.book = []
    const onOpenLibrary = vi.fn()
    renderWithProviders(<AgreementsSendPaper onSent={() => {}} onOpenLibrary={onOpenLibrary} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send a paper' }))
    const dialog = await screen.findByRole('dialog', { name: 'Send a paper' })
    expect(dialog.textContent).toContain('No papers in the Contract Book yet. Contract library is where a paper is written.')
    fireEvent.click(screen.getByRole('button', { name: 'Contract library' }))
    expect(onOpenLibrary).toHaveBeenCalledTimes(1)
    // The paper step steps aside for the library.
    expect(screen.queryByRole('dialog', { name: 'Send a paper' })).toBeNull()
  })

  it('a paper another door named starts at the person, on a fresh read', async () => {
    renderWithProviders(<AgreementsSendPaper onSent={() => {}} onOpenLibrary={() => {}} startOn={{ documentName: 'W-9' }} />)
    expect(await screen.findByRole('dialog', { name: 'Send W-9: who is it with?' })).toBeTruthy()
    expect(io.reads).toBe(1)
    expect(screen.queryByRole('dialog', { name: 'Send a paper' })).toBeNull()
  })

  it('someone who signed the paper is not offered a second copy', async () => {
    io.personDocuments = [{ ...sentCopy, status: 'signed', signed_at: '2026-11-02' }]
    renderWithProviders(<AgreementsSendPaper onSent={() => {}} onOpenLibrary={() => {}} startOn={{ documentName: 'Subcontractor Handbook' }} />)
    const picker = await screen.findByRole('dialog', { name: 'Send Subcontractor Handbook: who is it with?' })
    await waitFor(() => expect(picker.querySelectorAll('[data-testid="paper-party-row"]').length).toBe(2))
    expect(screen.queryByRole('button', { name: /^Priya Nair/ })).toBeNull()
  })

  /** Open the second window on the handbook and press a chip. */
  const openPicker = async (chip?: string) => {
    renderWithProviders(<AgreementsSendPaper onSent={() => {}} onOpenLibrary={() => {}} startOn={{ documentName: 'Subcontractor Handbook' }} />)
    await screen.findByRole('dialog', { name: 'Send Subcontractor Handbook: who is it with?' })
    if (chip) fireEvent.click(screen.getByRole('button', { name: chip }))
  }

  it('a rep is picked: the supply house is the party, the rep signs, and nothing is written until Send', async () => {
    await openPicker('Supply houses')
    fireEvent.click(await screen.findByRole('button', { name: /^Lena Park/ }))
    expect((await screen.findByTestId('send-window-party')).textContent).toBe('Tallgrass Supply Co.|listed|keep nobody|Lena Park|Branch manager|lena@tallgrass.example')
    expect(io.party).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'fake party send' }))
    await waitFor(() => expect(io.party).toEqual(['contact supply_house_contacts:r1', 'wrote insert party:3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d · Subcontractor Handbook · Tallgrass Supply Co.', 'sends party-row']))
  })

  it('a company with nobody picked: the typed signer is kept with it, then its contact is found', async () => {
    io.customers = [{ id: 'c2', name: 'Tallgrass Homes' }]
    await openPicker()
    fireEvent.change(screen.getByLabelText('Find a person or a company'), { target: { value: 'tallgrass homes' } })
    fireEvent.click(await screen.findByRole('button', { name: /^Tallgrass Homes/ }, { timeout: 3000 }))
    expect((await screen.findByTestId('send-window-party')).textContent).toBe('Tallgrass Homes|listed|keep Tallgrass Homes|||')
    fireEvent.click(screen.getByRole('button', { name: 'fake party send' }))
    await waitFor(() =>
      expect(io.party).toEqual([
        'kept Wren Castillo with customers:c2',
        'contact customer_contact_persons:cp-new',
        'wrote insert party:3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d · Subcontractor Handbook · Tallgrass Homes',
        'sends party-row',
      ]),
    )
  })

  it('a customer search that fails says so, keeps the other rows, and reads again on Retry', async () => {
    io.failSearch = new Error('TypeError: Failed to fetch')
    io.customers = [{ id: 'c2', name: 'Tallgrass Homes' }]
    await openPicker()
    fireEvent.change(screen.getByLabelText('Find a person or a company'), { target: { value: 'tallgrass' } })
    const retry = await screen.findByRole('button', { name: 'Retry' }, { timeout: 3000 })
    expect(screen.getByText(OFFLINE_READ_MESSAGE)).toBeTruthy()
    // The supply house and the last row still list under the failure.
    expect(screen.getByRole('button', { name: /^Tallgrass Supply Co\./ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Someone not in any list/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Tallgrass Homes/ })).toBeNull()
    io.failSearch = null
    fireEvent.click(retry)
    expect(await screen.findByRole('button', { name: /^Tallgrass Homes/ }, { timeout: 3000 })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('a customer search that is refused says why, and a new keystroke clears it', async () => {
    io.failSearch = { code: '42501', message: 'permission denied for table customers' }
    await openPicker()
    const find = screen.getByLabelText('Find a person or a company')
    fireEvent.change(find, { target: { value: 'tallgrass' } })
    const said = await screen.findByText(/^The customers did not read/, undefined, { timeout: 3000 })
    expect(said.textContent).not.toBe('The customers did not read.')
    expect(screen.getByRole('button', { name: /^Someone not in any list/ })).toBeTruthy()
    io.failSearch = null
    fireEvent.change(find, { target: { value: 'tallgrass h' } })
    expect(screen.queryByText(/^The customers did not read/)).toBeNull()
  })

  it('someone on no list: their contact is made from the address, and the paper keeps the company typed', async () => {
    await openPicker()
    fireEvent.click(await screen.findByRole('button', { name: /^Someone not in any list/ }))
    expect((await screen.findByTestId('send-window-party')).textContent).toBe('nobody|unlisted|keep nobody|||')
    fireEvent.click(screen.getByRole('button', { name: 'fake party send' }))
    await waitFor(() => expect(io.party).toEqual(['made wren@example.com as Wren Castillo', 'wrote insert party:9a1b2c3d-0a4d-4e8b-9c6f-1d2e3a4b5c6d · Subcontractor Handbook · Haddad Engineering', 'sends party-row']))
  })

  it('a party that already has the paper out is sent the same copy again, and no second row is written', async () => {
    io.personDocuments = [{ ...sentCopy, id: 'p-out', person_name: 'party:3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d' }]
    await openPicker('Supply houses')
    fireEvent.click(await screen.findByRole('button', { name: /^Lena Park/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'fake party send' }))
    await waitFor(() => expect(io.party).toEqual(['contact supply_house_contacts:r1', 'sends p-out']))
  })

  // The owner's third decision of 2026-11-22: a second signer at the same company.
  const outAtTallgrass = () => {
    io.found = '3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d'
    io.personDocuments = [{ ...sentCopy, id: 'p-out', person_name: 'party:3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d' }]
  }

  it('a company that already has the paper out: the window says who has it and offers both ways, with nothing written', async () => {
    outAtTallgrass()
    await openPicker('Supply houses')
    fireEvent.click(await screen.findByRole('button', { name: /^Tallgrass Supply Co\./ }))
    const dialog = await screen.findByRole('dialog', { name: 'Subcontractor Handbook is already out' })
    expect(dialog.textContent).toContain('Tallgrass Supply Co. has one copy waiting on a signature.')
    expect(screen.getByTestId('party-copy-out').textContent).toBe('Lena Park already has this paper out, sent Nov 1.')
    expect(screen.getByRole('button', { name: /^Send it to Lena Park again/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Send a second copy to someone else/ })).toBeTruthy()
    expect(screen.queryByTestId('send-window')).toBeNull()
    expect(io.party).toEqual([])
  })

  it('Send it to them again opens the copy that is out, on the person who has it', async () => {
    outAtTallgrass()
    await openPicker('Supply houses')
    fireEvent.click(await screen.findByRole('button', { name: /^Tallgrass Supply Co\./ }))
    fireEvent.click(await screen.findByRole('button', { name: /^Send it to Lena Park again/ }))
    expect((await screen.findByTestId('send-window')).textContent).toContain('again|p-out|undefined|Lena Park|Subcontractor Handbook')
    expect(screen.getByTestId('send-window-party').textContent).toBe('Tallgrass Supply Co.|listed|keep Tallgrass Supply Co.|Lena Park|Branch manager|lena@tallgrass.example')
    // The copy is written already: Send email writes no row.
    expect(screen.queryByRole('button', { name: 'fake party send' })).toBeNull()
    expect(io.party).toEqual([])
  })

  it('a second copy is a row of its own, and the copy that is out is left alone', async () => {
    outAtTallgrass()
    await openPicker('Supply houses')
    fireEvent.click(await screen.findByRole('button', { name: /^Tallgrass Supply Co\./ }))
    fireEvent.click(await screen.findByRole('button', { name: /^Send a second copy to someone else/ }))
    expect((await screen.findByTestId('send-window')).textContent).toContain('first|null|')
    expect(screen.getByTestId('send-window-party').textContent).toBe('Tallgrass Supply Co.|listed|keep Tallgrass Supply Co.|||')
    fireEvent.click(screen.getByRole('button', { name: 'fake party send' }))
    await waitFor(() => expect(io.party[io.party.length - 1]).toBe('sends party-row'))
    // The mock's contact is the one that holds the copy that is out: a first send would have reused it.
    expect(io.party.filter((line) => line.startsWith('wrote'))).toEqual(['wrote insert party:3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d · Subcontractor Handbook · Tallgrass Supply Co.'])
    expect(io.party).not.toContain('sends p-out')
  })

  it('a person picked who has it out already is offered the same two ways, and a second copy is the company’s', async () => {
    outAtTallgrass()
    await openPicker('Supply houses')
    fireEvent.click(await screen.findByRole('button', { name: /^Lena Park/ }))
    await screen.findByRole('dialog', { name: 'Subcontractor Handbook is already out' })
    fireEvent.click(screen.getByRole('button', { name: /^Send a second copy to someone else/ }))
    // The boxes open empty: the person picked is the one who has it.
    expect((await screen.findByTestId('send-window-party')).textContent).toBe('Tallgrass Supply Co.|listed|keep Tallgrass Supply Co.|||')
  })
})
