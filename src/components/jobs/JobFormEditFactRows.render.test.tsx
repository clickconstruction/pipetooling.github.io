// @vitest-environment jsdom
/**
 * Edit-tab fact rows (v2.1681, "option C"): the people/customer/links stretch
 * reads as label · value · pencil rows; opening a row reveals the classic
 * editor for that field. These smokes cover the resting read-out, row
 * expansion, and the billing-highlight gate force-opening the Customer row.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
// Owner of record (PR 2): the row's Found box reads the roll and the ledger; here it answers "found" for the GC case so the box is covered by one smoke below.
const lookupMock = vi.fn()
const savePropertyKindMock = vi.fn(async (..._args: unknown[]) => {})
const savePropertyHomesteadMock = vi.fn(async (..._args: unknown[]) => {})
vi.mock('../../lib/jobs/propertyKindWrite', () => ({
  savePropertyKind: (...args: unknown[]) => savePropertyKindMock(...args),
  savePropertyHomestead: (...args: unknown[]) => savePropertyHomesteadMock(...args),
}))
vi.mock('../../lib/jobs/ownerConfirmJobFormClient', () => ({
  fetchIsBuilderCustomer: () => Promise.resolve(false),
  lookupPropertyRecordCached: (address: string) => lookupMock(address),
  fetchJobsAtProperty: (_a: string, self: unknown) => Promise.resolve([self]),
  fetchCustomerAddressRow: () => Promise.resolve(null),
}))
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { useRef, useState } from 'react'
import { JobFormEditFactRows } from './JobFormEditFactRows'
import { proposalFromLookupPayload } from '../../lib/customers/propertyLookupClient'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { Database } from '../../types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']
type PropertyCandidate = Parameters<typeof JobFormEditFactRows>[0]['propertyCandidates'][number]

const OFFICE_PROPERTY: PropertyCandidate = {
  id: 'addr-office',
  customer_id: 'cust-1',
  address: '574 Co Rd 660, Devine TX 78016',
  county: 'Medina',
  legal_description: 'ABS 1 SUR 2',
  owner_name: 'Todd Cop',
  owner_company: '',
  owner_mailing_address: '574 Co Rd 660, Devine TX 78016',
}

afterEach(cleanup)
beforeEach(() => {
  // The roll answers "no parcel" unless a case says otherwise — the older GC cases mount the box and must not care.
  lookupMock.mockReset().mockImplementation(async (a: string) => proposalFromLookupPayload(a, { ok: true, county_geocoder: '', parcel: null }))
})

const CUSTOMERS: CustomerRow[] = [
  {
    id: 'cust-1',
    name: 'Todd Cop',
    address: '6414 Maverick Oak Dr San Antonio, TX 78240',
    contact_info: null,
    date_met: null,
    master_user_id: 'master-1',
    customer_type: 'commercial',
    archived_at: null,
  } as unknown as CustomerRow,
]

const USERS = [
  { id: 'u1', name: 'Abraham' },
  { id: 'u2', name: 'Paige' },
]

function Harness({
  billingCustomerHighlight = false,
  customerId = 'cust-1',
  gc,
  jobId = 'job-1',
  showBillsToOtherParty = false,
  propertyCandidates = [],
  propertyRecordFocus = false,
  customerAddressId = null,
  customerName = 'Todd Cop',
  customerEmail = 'Todd@CopProperties.com',
  customerPhone = '(210) 415-5375',
}: {
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  billingCustomerHighlight?: boolean
  customerId?: string | null
  gc?: CustomerRow
  jobId?: string | null
  showBillsToOtherParty?: boolean
  propertyCandidates?: PropertyCandidate[]
  propertyRecordFocus?: boolean
  customerAddressId?: string | null
}) {
  const [phone, setPhone] = useState(customerPhone)
  const [candidates, setCandidates] = useState(propertyCandidates)
  const divRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  return (
    <JobFormEditFactRows
      users={USERS}
      teamMemberIds={['u1', 'u2']}
      setTeamMemberIds={() => {}}
      accountManagerUserId={null}
      setAccountManagerUserId={() => {}}
      accountManagerRelationship={null}
      setAccountManagerRelationship={() => {}}
      customerId={customerId}
      setCustomerId={() => {}}
      gcCustomerId={gc?.id ?? null}
      setGcCustomerId={() => {}}
      billToParty="customer"
      billCopyOtherParty={false}
      setBillCopyOtherParty={() => {}}
      jobId={jobId}
      showBillsToOtherParty={showBillsToOtherParty}
      setBillToParty={() => {}}
      onCustomerPatched={() => {}}
      linkedBidGc={null}
      customerSearch=""
      setCustomerSearch={() => {}}
      customerName={customerName}
      setCustomerName={() => {}}
      customerEmail={customerEmail}
      setCustomerEmail={() => {}}
      customerPhone={phone}
      setCustomerPhone={setPhone}
      dateMet=""
      setDateMet={() => {}}
      googleDriveLink="https://drive.google.com/drive/folders/files123"
      setGoogleDriveLink={() => {}}
      jobPicturesLink=""
      setJobPicturesLink={() => {}}
      jobAddress="10 Cascade Gln"
      customerAddressId={customerAddressId}
      setCustomerAddressId={() => {}}
      onPropertyAdded={() => {}}
      onOwnerConfirmed={() => {}}
      propertyCandidates={candidates}
      propertyRecordFocus={propertyRecordFocus}
      onPropertyKindSaved={(id, patch) => setCandidates((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))}
      setJobAddress={() => {}}
      customers={gc ? [...CUSTOMERS, gc] : CUSTOMERS}
      customersLoading={false}
      masterForFormCustomer="master-1"
      customerExpandedGate={false}
      billingCustomerHighlight={billingCustomerHighlight}
      jobPicturesLinkHighlight={false}
      billingCustomerHighlightRef={divRef}
      jobPicturesLinkHighlightRef={divRef}
      jobPicturesLinkInputRef={inputRef}
      googleDriveInputRef={inputRef}
      onImport={() => {}}
      onOpenCreateCustomerModal={() => {}}
      projectId={null}
      setProjectId={() => {}}
      projects={[{ id: 'p1', name: 'Gun Dog Rough In', customer_id: 'cust-1', customers: { name: 'Todd Cop' } }]}
      jobPlansLink=""
      setJobPlansLink={() => {}}
      bidId={null}
      setBidId={() => {}}
      linkedBidSummary={null}
      setLinkedBidSummary={() => {}}
      onOpenBidLinkChoice={() => {}}
      projectDisconnectRef={buttonRef}
      developmentId={null}
      setDevelopmentId={() => {}}
      developments={[]}
      onCreateDevelopment={vi.fn(async () => null)}
      projectLinksGate={false}
    />
  )
}

describe('JobFormEditFactRows', () => {
  it('renders every row with its resting value', () => {
    renderWithProviders(<Harness />)
    for (const label of ['Account man', 'Team', 'Customer', 'Phone', 'Email', 'GC/Builder', 'Date met', 'Folders', 'Project', 'Plans', 'Bid', 'Development']) {
      expect(screen.getByRole('button', { name: `Edit ${label}` })).toBeTruthy()
    }
    expect(screen.getByText('Abraham, Paige')).toBeTruthy()
    expect(screen.getByText('(210) 415-5375')).toBeTruthy()
    // v2.1711: the green "linked" chip is gone — only the amber "Not in Customers" warning ever shows.
    expect(screen.queryByText('linked')).toBeNull()
    // Folders row: the set Files link is inline; Pictures (unset) is absent.
    expect(screen.getByRole('link', { name: 'Files' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Pictures' })).toBeNull()
  })

  it('phone and email values are tap-to-call / tap-to-email links (v2.1705)', () => {
    renderWithProviders(<Harness />)
    const phone = screen.getByRole('link', { name: '(210) 415-5375' }) as HTMLAnchorElement
    expect(phone.getAttribute('href')).toBe('tel:2104155375')
    const email = screen.getByRole('link', { name: 'Todd@CopProperties.com' }) as HTMLAnchorElement
    expect(email.getAttribute('href')).toBe('mailto:Todd@CopProperties.com')
  })

  it('opening the Phone row reveals the editor and edits flow to state', () => {
    renderWithProviders(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Phone' }))
    const input = screen.getByLabelText('Customer Phone') as HTMLInputElement
    fireEvent.change(input, { target: { value: '(210) 555-0000' } })
    expect((screen.getByLabelText('Customer Phone') as HTMLInputElement).value).toBe('(210) 555-0000')
    // The row now shows a close toggle instead of the pencil.
    expect(screen.getByRole('button', { name: 'Close Phone editor' })).toBeTruthy()
  })

  it('the billing-highlight gate force-opens the Customer row with the banner', () => {
    renderWithProviders(<Harness billingCustomerHighlight customerId={null} />)
    expect(screen.getByText(/Link a customer before sending this invoice/i)).toBeTruthy()
    expect(screen.getByLabelText(/Search customers to link/i)).toBeTruthy()
  })

  it('a linked GC grows read-only Phone/Email/Date met sub-rows — no pencils (v2.1701)', () => {
    const gc = {
      id: 'gc-1',
      name: 'Done Right Foundation',
      address: '99 Slab Way',
      contact_info: { phone: '(210) 555-1111', email: 'ap@doneright.com' },
      date_met: '2026-05-01',
      master_user_id: 'master-1',
      customer_type: 'commercial',
      archived_at: null,
    } as unknown as CustomerRow
    renderWithProviders(<Harness gc={gc} />)
    expect(screen.getByText(/99 Slab Way/)).toBeTruthy()
    expect(screen.getByText('(210) 555-1111')).toBeTruthy()
    expect(screen.getByText('ap@doneright.com')).toBeTruthy()
    expect(screen.getByText('05/01/26')).toBeTruthy()
    // Read-only: no Edit buttons exist for the GC's sub-rows (the customer's
    // own Phone/Email rows still have theirs — exactly one each).
    expect(screen.getAllByRole('button', { name: 'Edit Phone' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Edit Email' })).toHaveLength(1)
  })

  it('opening the Project row reveals the shared project picker', () => {
    renderWithProviders(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Project' }))
    const select = screen.getByLabelText('Project') as HTMLSelectElement
    expect(select.options.length).toBe(2)
    expect(select.options[1]?.textContent).toContain('Gun Dog Rough In')
  })

  it('share this bill (v2.3376): a two-party job shows the Show <GC> memory row; none without a GC or on an unsaved job', () => {
    const gc = {
      id: 'gc-1',
      name: 'Done Right Foundation',
      address: '99 Slab Way',
      contact_info: { phone: '(210) 555-1111', email: 'ap@doneright.com' },
      date_met: null,
      master_user_id: 'master-1',
      customer_type: 'commercial',
      archived_at: null,
    } as unknown as CustomerRow
    renderWithProviders(<Harness gc={gc} showBillsToOtherParty />)
    expect(screen.getByText('Show Done Right Foundation')).toBeTruthy()
    expect(screen.getByText('on new bills')).toBeTruthy()
    cleanup()
    renderWithProviders(<Harness gc={gc} />)
    expect(screen.getByText('not shared')).toBeTruthy()
    cleanup()
    renderWithProviders(<Harness />)
    expect(screen.queryByText(/^Show /)).toBeNull()
    cleanup()
    renderWithProviders(<Harness gc={gc} jobId={null} />)
    expect(screen.queryByText('Show Done Right Foundation')).toBeNull()
  })

  it('Property record: the job address can be added as a property when no saved one matches (v2.3401)', () => {
    renderWithProviders(<Harness propertyCandidates={[OFFICE_PROPERTY]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Property record' }))
    // The picker still lists the builder's office…
    expect(screen.getByRole('option', { name: '574 Co Rd 660, Devine TX 78016' })).toBeTruthy()
    // …and the job address, which is not on it, is one click from becoming a property.
    const add = screen.getByRole('button', { name: '+ Add 10 Cascade Gln as a property on Todd Cop' })
    fireEvent.click(add)
    expect(screen.getByTestId('job-form-property-add-sheet')).toBeTruthy()
    expect((screen.getByLabelText('Address') as HTMLInputElement).value).toBe('10 Cascade Gln')
    expect(screen.getByRole('button', { name: 'Add property' })).toBeTruthy()
    // Cancel folds the sheet and the offer comes back.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByTestId('job-form-property-add-sheet')).toBeNull()
    expect(screen.getByRole('button', { name: '+ Add 10 Cascade Gln as a property on Todd Cop' })).toBeTruthy()
  })

  it('Property record: a saved property matching the job address is offered to link, not re-added (v2.3401)', () => {
    renderWithProviders(<Harness propertyCandidates={[{ ...OFFICE_PROPERTY, id: 'addr-site', address: '10 Cascade Gln, San Antonio, TX 78255' }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Property record' }))
    expect(screen.getByRole('button', { name: /Link 10 Cascade Gln, San Antonio, TX 78255 — matches the job address/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /as a property on/ })).toBeNull()
  })

  it('Property record: the kind is set on the row — amber chip while unset, saved on the property as picked, Homestead beside residential (v2.3667)', async () => {
    savePropertyKindMock.mockClear()
    const site = { ...OFFICE_PROPERTY, id: 'addr-site', address: '10 Cascade Gln, San Antonio, TX 78255', property_kind: '', homestead: false }
    // the lien screens' door: the row is already open, no click needed
    renderWithProviders(<Harness propertyCandidates={[site]} customerAddressId="addr-site" propertyRecordFocus />)
    expect(screen.getByTestId('property-kind-unset-chip').textContent).toBe('kind not set')
    const block = screen.getByTestId('property-kind-block')
    expect(block.textContent).toContain('a residential property\'s notice is due a month earlier')
    expect(screen.getByTestId('property-kind-switch').dataset.kind).toBe('unset')
    expect(screen.queryByLabelText('Homestead')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Residential' }))
    await waitFor(() => expect(screen.getByTestId('property-kind-switch').dataset.kind).toBe('residential'))
    expect(savePropertyKindMock).toHaveBeenCalledWith('addr-site', 'residential')
    expect(screen.queryByTestId('property-kind-unset-chip')).toBeNull()
    fireEvent.click(screen.getByLabelText('Homestead'))
    await waitFor(() => expect(savePropertyHomesteadMock).toHaveBeenCalledWith('addr-site', true))
    // the property sheet's word here, not the lien screens'
    fireEvent.click(screen.getByRole('button', { name: 'Non-residential' }))
    await waitFor(() => expect(screen.getByTestId('property-kind-switch').dataset.kind).toBe('non_residential'))
    expect(screen.queryByLabelText('Homestead')).toBeNull()
  })

  it('Property record: an older caller that does not load the kind shows no kind control', () => {
    renderWithProviders(<Harness propertyCandidates={[{ ...OFFICE_PROPERTY, id: 'addr-site' }]} customerAddressId="addr-site" />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Property record' }))
    expect(screen.queryByTestId('property-kind-block')).toBeNull()
    expect(screen.queryByTestId('property-kind-unset-chip')).toBeNull()
  })

  it('Property record: no saved properties yet still offers the job address (v2.3401)', () => {
    renderWithProviders(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Property record' }))
    expect(screen.getByText('No saved properties on Todd Cop yet.')).toBeTruthy()
    expect(screen.getByRole('button', { name: '+ Add 10 Cascade Gln as a property on Todd Cop' })).toBeTruthy()
  })

  it('a GC job — GC set, no customer — reads the GC as the only party on the Customer row (v2.3403)', () => {
    const gc = { ...CUSTOMERS[0]!, id: 'gc-1', name: 'RMC- Dudley Mason' } as CustomerRow
    renderWithProviders(<Harness customerId={null} customerName="" customerEmail="" customerPhone="" gc={gc} />)
    expect(screen.getByText('none · GC job — RMC- Dudley Mason is the party')).toBeTruthy()
    expect(screen.queryByText('Not in Customers')).toBeNull()
  })

  it('Property record on a GC job: the row looks the site up by itself and shows the roll’s owner with Use; a direct job gets no box (owner of record, PR 2)', async () => {
    lookupMock.mockImplementation(async (address: string) =>
      proposalFromLookupPayload(address, {
        ok: true,
        county_geocoder: 'Bexar',
        parcel: { propId: '1', ownerName: 'KHAN UMAR & BANGASH SHAZMEENA', nameCare: '', legalDescription: 'CB 4696A BLK 3 LOT 35', situsAddress: '10 CASCADE GLN', mailingAddress: '3203 SPIDER LILY, SAN ANTONIO, TX 78258', county: 'Bexar', source: 'Bexar Appraisal District', taxYear: '2025' },
      }),
    )
    const gc = { ...CUSTOMERS[0]!, id: 'gc-1', name: 'RMC- Dudley Mason' } as CustomerRow
    const { unmount } = renderWithProviders(<Harness customerId={null} customerName="" customerEmail="" customerPhone="" gc={gc} />)
    await waitFor(() => expect(screen.getByTestId('owner-lookup-box').getAttribute('data-state')).toBe('found'))
    expect(screen.getByText('Khan Umar & Bangash Shazmeena')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save this owner' })).toBeTruthy()
    // The row above stops contradicting the card: it says a suggestion is waiting (v2.3666).
    await waitFor(() => expect(screen.getByText('1 suggestion')).toBeTruthy())
    expect(screen.getByText('Not linked yet')).toBeTruthy()
    unmount()
    // A direct job (customer, no GC, not a builder): no lookup, no box.
    renderWithProviders(<Harness />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByTestId('owner-lookup-box')).toBeNull()
  })
})
