// @vitest-environment jsdom
/**
 * Repro: typing a new customer's name into the "Link to customer" search box
 * and then reaching for "Create customer from job".
 *
 * The search input writes `customerSearch`; the create flow reads
 * `customerName` (a separate input further down the section). On a job with no
 * customer_name the typed text therefore never reaches the create handler and
 * the button stays disabled — the "I typed a name and it wouldn't save" report.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { JobFormCustomerSection } from './JobFormCustomerSection'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { Database } from '../../types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']

afterEach(cleanup)

const EXISTING: CustomerRow[] = [
  {
    id: 'cust-1',
    name: 'Alpha Builders',
    address: '1 Main St',
    contact_info: null,
    date_met: null,
    master_user_id: 'master-1',
    customer_type: 'commercial',
    archived_at: null,
  } as unknown as CustomerRow,
]

/** Mirrors the shell: customerSearch and customerName are separate state atoms. */
function Harness({ initialCustomerName = '', onOpenCreate }: { initialCustomerName?: string; onOpenCreate: () => void }) {
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerName, setCustomerName] = useState(initialCustomerName)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [jobAddress, setJobAddress] = useState('')
  const ref = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  return (
    <JobFormCustomerSection
      expanded
      setExpanded={() => {}}
      customerId={customerId}
      setCustomerId={setCustomerId}
      gcCustomerId={null}
      setGcCustomerId={() => {}}
      linkedBidGc={null}
      customerSearch={customerSearch}
      setCustomerSearch={setCustomerSearch}
      customerName={customerName}
      setCustomerName={setCustomerName}
      customerEmail=""
      setCustomerEmail={() => {}}
      customerPhone=""
      setCustomerPhone={() => {}}
      dateMet=""
      setDateMet={() => {}}
      googleDriveLink=""
      setGoogleDriveLink={() => {}}
      jobPicturesLink=""
      setJobPicturesLink={() => {}}
      jobAddress={jobAddress}
      setJobAddress={setJobAddress}
      customers={EXISTING}
      customersLoading={false}
      masterForFormCustomer="master-1"
      billingCustomerHighlight={false}
      jobPicturesLinkHighlight={false}
      billingCustomerHighlightRef={ref}
      jobPicturesLinkHighlightRef={ref}
      jobPicturesLinkInputRef={inputRef}
      googleDriveInputRef={inputRef}
      onImport={() => {}}
      onOpenCreateCustomerModal={onOpenCreate}
    />
  )
}

function searchBox(): HTMLInputElement {
  return screen.getByLabelText(/Search customers to link/i) as HTMLInputElement
}

function createButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /Create customer from job/i }) as HTMLButtonElement
}

/** The separate "Customer Name" field the create handler actually reads. */
function nameField(): HTMLInputElement {
  return screen.getByLabelText('Customer Name') as HTMLInputElement
}

describe('Customer section — create from a name typed into the search box', () => {
  it('shows "No customers found" for a name that does not exist', () => {
    renderWithProviders(<Harness onOpenCreate={() => {}} />)
    fireEvent.change(searchBox(), { target: { value: 'Zeta Mechanical' } })
    expect(screen.getByText(/No customers found/i)).toBeTruthy()
  })

  it('the typed name enables Create customer from job and reaches the handler', () => {
    const onOpenCreate = vi.fn()
    renderWithProviders(<Harness onOpenCreate={onOpenCreate} />)
    fireEvent.change(searchBox(), { target: { value: 'Zeta Mechanical' } })

    expect(createButton().disabled).toBe(false)
    fireEvent.click(createButton())
    expect(onOpenCreate).toHaveBeenCalledTimes(1)
    // customerName — what handleCreateCustomerFromJob inserts — now carries it.
    expect(nameField().value).toBe('Zeta Mechanical')
  })

  it('offers an inline "+ Create" row in the empty dropdown', () => {
    const onOpenCreate = vi.fn()
    renderWithProviders(<Harness onOpenCreate={onOpenCreate} />)
    fireEvent.change(searchBox(), { target: { value: 'Zeta Mechanical' } })

    const createRow = screen.getByText(/\+ Create/)
    expect(createRow.textContent).toContain('Zeta Mechanical')
    fireEvent.click(createRow)
    expect(onOpenCreate).toHaveBeenCalledTimes(1)
    expect(nameField().value).toBe('Zeta Mechanical')
  })

  it('the typed name wins over a stale customer_name prefill', () => {
    const onOpenCreate = vi.fn()
    renderWithProviders(<Harness initialCustomerName="Old Job Name" onOpenCreate={onOpenCreate} />)
    fireEvent.change(searchBox(), { target: { value: 'Zeta Mechanical' } })

    fireEvent.click(createButton())
    expect(onOpenCreate).toHaveBeenCalled()
    expect(nameField().value).toBe('Zeta Mechanical')
  })

  it('leaves an existing link alone — no create row once a customer is picked', () => {
    renderWithProviders(<Harness onOpenCreate={() => {}} />)
    fireEvent.change(searchBox(), { target: { value: 'Alpha' } })
    fireEvent.click(screen.getByText('Alpha Builders'))

    expect(screen.queryByText(/\+ Create/)).toBeNull()
    expect(screen.queryByRole('button', { name: /Create customer from job/i })).toBeNull()
    expect(screen.getByRole('button', { name: /Clear link/i })).toBeTruthy()
  })
})
