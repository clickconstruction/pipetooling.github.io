// @vitest-environment jsdom
/**
 * Bill Customer's owner line (v2.3450): on a GC job with no owner it shows
 * the roll's answer with Use and the write goes through the shared helper; a
 * direct job shows nothing; an owner the nightly run saved unconfirmed offers
 * Confirm; a roll miss shows the paste sentence and unfolds the paste box.
 * Wiring-level only — the rule lives in src/lib/jobs/ownerConfirm.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Tables = Record<string, unknown>
const tables = vi.hoisted(() => ({ rows: {} as Record<string, unknown> }))

vi.mock('../../lib/supabase', () => {
  function builder(table: string) {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'update', 'in', 'insert', 'order']) b[m] = () => b
    b.maybeSingle = () => Promise.resolve({ data: (tables.rows[table] as Tables | null) ?? null, error: null })
    b.limit = () => Promise.resolve({ data: (tables.rows[`${table}:limit`] as unknown[]) ?? [], error: null })
    b.then = (ok?: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok, ko)
    return b
  }
  return { supabase: { from: (table: string) => builder(table), functions: { invoke: () => Promise.resolve({ data: null, error: null }) } } }
})
const lookupMock = vi.fn()
vi.mock('../../lib/customers/propertyLookupClient', async () => {
  const actual = await vi.importActual<typeof import('../../lib/customers/propertyLookupClient')>('../../lib/customers/propertyLookupClient')
  return { ...actual, lookupPropertyRecord: (address: string) => lookupMock(address) }
})
const confirmMock = vi.fn()
const stampMock = vi.fn()
vi.mock('../../lib/jobs/ownerConfirmWrite', () => ({
  confirmOwnerForProperty: (input: unknown) => confirmMock(input),
  stampOwnerConfirmed: (id: string, userId: string | null) => stampMock(id, userId),
}))
// The paste box is the property record panel's own (PR 1 reuses it too); here a marker is enough.
vi.mock('../customers/CustomerPropertyRecordPanel', () => ({ default: () => <div data-testid="paste-panel-marker" /> }))

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { proposalFromLookupPayload } from '../../lib/customers/propertyLookupClient'
import { resetPropertyLookupCache } from '../../lib/customers/propertyLookupCache'
import BillCustomerOwnerLine from './BillCustomerOwnerLine'

afterEach(cleanup)
beforeEach(() => {
  resetPropertyLookupCache()
  lookupMock.mockReset()
  confirmMock.mockReset()
  confirmMock.mockResolvedValue({ updated: [], inserted: [], skipped: [] })
  stampMock.mockReset()
  stampMock.mockResolvedValue(undefined)
  tables.rows = {
    jobs_ledger: { id: 'j650', job_address: '5498 Cibolo Valley Dr 200, Schertz, TX 78108', customer_id: 'c-ati', customer_name: 'ATI Schertz', gc_customer_id: 'c-loberg', customer_address_id: null },
    'jobs_ledger:limit': [],
    customers: { name: 'Loberg Contracting' },
    customer_addresses: null,
    job_property_owners: null,
  }
})

function payload(owner: string, mailing: string) {
  return { ok: true, county_geocoder: 'Guadalupe', parcel: { propId: '12345', ownerName: owner, nameCare: '', legalDescription: 'LOT 1', situsAddress: '5498 CIBOLO VALLEY DR, SCHERTZ, TX', mailingAddress: mailing, county: 'Guadalupe', source: 'Guadalupe Appraisal District', taxYear: '2025' } }
}

describe('BillCustomerOwnerLine', () => {
  it('a GC job with no owner: the roll’s answer with provenance, and Use writes the property through the shared helper', async () => {
    lookupMock.mockImplementation(async (address: string) => proposalFromLookupPayload(address, payload('SCHERTZ STATION LTD', '4040 BROADWAY STE 600, SAN ANTONIO, TX 78209')))
    renderWithProviders(<BillCustomerOwnerLine jobId="j650" userId="u-taunya" />)
    await waitFor(() => expect(screen.getByTestId('bill-customer-owner-line').getAttribute('data-state')).toBe('found'))
    expect(screen.getByText(/Owner of record for 5498 Cibolo Valley Dr 200:/)).toBeTruthy()
    expect(screen.getByText('Schertz Station Ltd')).toBeTruthy()
    expect(screen.getByText(/\(Guadalupe Appraisal District 2025\) — not yet on the job\./)).toBeTruthy()
    expect(screen.getByText(/so the lien notice can be mailed when it is due/)).toBeTruthy()
    fireEvent.click(screen.getByTestId('bill-customer-owner-use'))
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1))
    const input = confirmMock.mock.calls[0]![0] as { address: string; jobs: unknown[]; userId: string | null }
    expect(input.address).toBe('5498 Cibolo Valley Dr 200, Schertz, TX 78108')
    expect(input.jobs).toEqual([{ jobId: 'j650', customerId: 'c-ati', gcCustomerId: 'c-loberg', customerAddressId: null }])
    expect(input.userId).toBe('u-taunya')
    await waitFor(() => expect(screen.getByTestId('bill-customer-owner-line').getAttribute('data-state')).toBe('saved'))
    expect(screen.getByText(/Schertz Station Ltd — on the job\./)).toBeTruthy()
  })

  it('a direct job (no GC, customer not a builder) shows nothing and never asks the roll', async () => {
    tables.rows.jobs_ledger = { ...(tables.rows.jobs_ledger as Record<string, unknown>), gc_customer_id: null }
    const { container } = renderWithProviders(<BillCustomerOwnerLine jobId="j650" userId="u-taunya" />)
    await new Promise((r) => setTimeout(r, 20))
    expect(container.querySelector('[data-testid="bill-customer-owner-line"]')).toBeNull()
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it('an owner the nightly run saved from the roll offers Confirm, which stamps the record', async () => {
    tables.rows.jobs_ledger = { ...(tables.rows.jobs_ledger as Record<string, unknown>), customer_address_id: 'addr1' }
    tables.rows.customer_addresses = { id: 'addr1', address: '5498 Cibolo Valley Dr 200, Schertz, TX 78108', owner_name: '', owner_company: 'SCHERTZ STATION LTD', owner_mailing_address: '4040 Broadway', owner_confirmed_at: null, parcel_source: 'Guadalupe Appraisal District', parcel_tax_year: '2025' }
    renderWithProviders(<BillCustomerOwnerLine jobId="j650" userId="u-taunya" />)
    await waitFor(() => expect(screen.getByTestId('bill-customer-owner-line').getAttribute('data-state')).toBe('unconfirmed'))
    expect(screen.getByText(/from the roll \(2025\), not yet confirmed/)).toBeTruthy()
    fireEvent.click(screen.getByTestId('bill-customer-owner-confirm'))
    await waitFor(() => expect(stampMock).toHaveBeenCalledWith('addr1', 'u-taunya'))
    await waitFor(() => expect(screen.getByTestId('bill-customer-owner-line').getAttribute('data-state')).toBe('saved'))
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it('a confirmed owner shows nothing; a roll miss shows the amber paste sentence and unfolds the paste box', async () => {
    tables.rows.jobs_ledger = { ...(tables.rows.jobs_ledger as Record<string, unknown>), customer_address_id: 'addr1' }
    tables.rows.customer_addresses = { id: 'addr1', address: 'x', owner_name: '', owner_company: 'Typed Owner LLC', owner_mailing_address: '1 Main', owner_confirmed_at: '2026-09-14T00:00:00Z', parcel_source: '' }
    const first = renderWithProviders(<BillCustomerOwnerLine jobId="j650" userId="u-taunya" />)
    await new Promise((r) => setTimeout(r, 20))
    expect(first.container.querySelector('[data-testid="bill-customer-owner-line"]')).toBeNull()
    first.unmount()

    tables.rows.customer_addresses = null
    tables.rows.jobs_ledger = { ...(tables.rows.jobs_ledger as Record<string, unknown>), customer_address_id: null }
    lookupMock.mockImplementation(async (address: string) => proposalFromLookupPayload(address, { ok: true, county_geocoder: 'Guadalupe', parcel: null, parcel_error: 'no parcel' }))
    renderWithProviders(<BillCustomerOwnerLine jobId="j650" userId="u-taunya" />)
    await waitFor(() => expect(screen.getByTestId('bill-customer-owner-line').getAttribute('data-state')).toBe('miss'))
    expect(screen.getByText(/No owner of record on file for 5498 Cibolo Valley Dr 200/)).toBeTruthy()
    fireEvent.click(screen.getByTestId('bill-customer-owner-paste-door'))
    expect(screen.getByTestId('bill-customer-owner-paste-panel')).toBeTruthy()
    expect(screen.getByTestId('paste-panel-marker')).toBeTruthy()
  })
})
