// @vitest-environment jsdom
/**
 * Edit-tab fact rows (v2.1681, "option C"): the people/customer/links stretch
 * reads as label · value · pencil rows; opening a row reveals the classic
 * editor for that field. These smokes cover the resting read-out, row
 * expansion, and the billing-highlight gate force-opening the Customer row.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { JobFormEditFactRows } from './JobFormEditFactRows'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { Database } from '../../types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']

afterEach(cleanup)

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
}: {
  billingCustomerHighlight?: boolean
  customerId?: string | null
}) {
  const [phone, setPhone] = useState('(210) 415-5375')
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
      gcCustomerId={null}
      setGcCustomerId={() => {}}
      linkedBidGc={null}
      customerSearch=""
      setCustomerSearch={() => {}}
      customerName="Todd Cop"
      setCustomerName={() => {}}
      customerEmail="Todd@CopProperties.com"
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
      setJobAddress={() => {}}
      customers={CUSTOMERS}
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
    expect(screen.getByText('linked')).toBeTruthy()
    // Folders row: the set Files link is inline; Pictures (unset) is absent.
    expect(screen.getByRole('link', { name: 'Files' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Pictures' })).toBeNull()
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

  it('opening the Project row reveals the shared project picker', () => {
    renderWithProviders(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Project' }))
    const select = screen.getByLabelText('Project') as HTMLSelectElement
    expect(select.options.length).toBe(2)
    expect(select.options[1]?.textContent).toContain('Gun Dog Rough In')
  })
})
