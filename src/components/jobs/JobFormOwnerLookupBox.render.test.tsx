// @vitest-environment jsdom
/**
 * Owner of record · the Property record row that fills itself (PR 2): a GC
 * job with an address shows the roll's answer and Use (which calls the shared
 * write for every job at the address and hands the row back); a miss shows
 * the paste door that unfolds the record panel; a direct job and a confirmed
 * row render nothing; a likely homestead adds the shared red line.
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
const lookupMock = vi.fn()
const builderMock = vi.fn()
const jobsMock = vi.fn()
const rowMock = vi.fn()
vi.mock('../../lib/jobs/ownerConfirmJobFormClient', () => ({
  fetchIsBuilderCustomer: (id: string) => builderMock(id),
  lookupPropertyRecordCached: (address: string) => lookupMock(address),
  fetchJobsAtProperty: (address: string, self: unknown) => jobsMock(address, self),
  fetchCustomerAddressRow: (id: string) => rowMock(id),
}))
const confirmMock = vi.fn()
vi.mock('../../lib/jobs/ownerConfirmWrite', () => ({ confirmOwnerForProperty: (input: unknown) => confirmMock(input) }))

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import JobFormOwnerLookupBox from './JobFormOwnerLookupBox'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { proposalFromLookupPayload } from '../../lib/customers/propertyLookupClient'
import { HOMESTEAD_LINE } from '../../lib/jobs/ownerConfirm'

afterEach(cleanup)
beforeEach(() => {
  lookupMock.mockReset()
  builderMock.mockReset().mockResolvedValue(false)
  jobsMock.mockReset().mockImplementation((_a: string, self: unknown) => Promise.resolve([self, { jobId: 'j2', customerId: null, gcCustomerId: 'gc1', customerAddressId: null }]))
  rowMock.mockReset().mockResolvedValue({ id: 'addr-new', customer_id: 'gc1', address: '9703 Lenox Hl, San Antonio, TX', owner_confirmed_at: '2026-09-15T00:00:00Z' })
  confirmMock.mockReset().mockResolvedValue({ updated: [], inserted: [{ customerAddressId: 'addr-new', jobIds: ['j1', 'j2'] }], skipped: [] })
})

function payload(owner: string, mailing: string) {
  return {
    ok: true,
    county_geocoder: 'Bexar',
    parcel: { propId: '123', ownerName: owner, nameCare: '', legalDescription: 'CB 4696A BLK 3 LOT 35', situsAddress: '9703 LENOX HL, SAN ANTONIO, TX', mailingAddress: mailing, county: 'Bexar', source: 'Bexar Appraisal District', taxYear: '2025' },
  }
}

const base = {
  jobId: 'j1',
  jobAddress: '9703 Lenox Hl, San Antonio, TX',
  customerId: null,
  customerName: '',
  gcCustomerId: 'gc1',
  gcCustomerName: 'RMC- Dudley Mason',
  customerAddressId: null,
  linkedOwnerConfirmedAt: null,
}

describe('JobFormOwnerLookupBox', () => {
  it('a GC job: found on the roll → owner, mail to, legal + provenance, county, Use; Use writes through the shared helper for every job at the address and hands the row back', async () => {
    lookupMock.mockImplementation(async (a: string) => proposalFromLookupPayload(a, payload('KHAN UMAR & BANGASH SHAZMEENA', '3203 SPIDER LILY, SAN ANTONIO, TX 78258')))
    const onConfirmed = vi.fn()
    renderWithProviders(<JobFormOwnerLookupBox {...base} onConfirmed={onConfirmed} />)
    await waitFor(() => expect(screen.getByTestId('owner-lookup-box').getAttribute('data-state')).toBe('found'))
    expect(lookupMock).toHaveBeenCalledTimes(1)
    // The card (v2.3666) is a suggestion — it names the address it answers, not a green "found".
    expect(screen.getByText("The appraisal roll's answer for 9703 Lenox Hl")).toBeTruthy()
    expect(screen.getByTestId('owner-lookup-owner').textContent).toBe('Khan Umar & Bangash Shazmeena')
    expect(screen.getByText(/3203 Spider Lily/i)).toBeTruthy()
    expect(screen.getByText(/CB 4696A BLK 3 LOT 35/)).toBeTruthy()
    expect(screen.getByText(/Bexar Appraisal District · 2025/)).toBeTruthy()
    expect(screen.getByText('Check this parcel on Bexar CAD ↗')).toBeTruthy()
    // mail-elsewhere is a plain phrase under Reads as, not an unexplained chip.
    expect(screen.getByText('Mails somewhere other than the job site')).toBeTruthy()
    expect(screen.getByTestId('owner-lookup-use').textContent).toBe('Save this owner')
    expect(screen.queryByTestId('owner-lookup-homestead')).toBeNull()

    fireEvent.click(screen.getByTestId('owner-lookup-use'))
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1))
    const input = confirmMock.mock.calls[0]![0] as { address: string; jobs: { jobId: string }[]; source: { kind: string }; userId: string }
    expect(input.address).toBe('9703 Lenox Hl, San Antonio, TX')
    expect(input.jobs.map((j) => j.jobId)).toEqual(['j1', 'j2'])
    expect(input.source.kind).toBe('proposal')
    expect(input.userId).toBe('smoke-auth-user-1')
    expect(onConfirmed.mock.calls[0]![0]).toMatchObject({ id: 'addr-new' })
  })

  it('the roll’s one-string address reads as an envelope: the districts’ % is c/o, the state stays upper-case, and the parent hears a suggestion is waiting', async () => {
    lookupMock.mockImplementation(async (a: string) => proposalFromLookupPayload(a, payload('SABRA TEXAS HOLDINGS LP', '% SABRA HEALTH CARE REIT INC 18500 VON KARMAN AVE STE 550, IRVINE, CA 92612')))
    const onSuggestion = vi.fn()
    renderWithProviders(<JobFormOwnerLookupBox {...base} onConfirmed={vi.fn()} onSuggestion={onSuggestion} />)
    await waitFor(() => expect(screen.getByTestId('owner-lookup-box').getAttribute('data-state')).toBe('found'))
    const lines = [...(document.querySelector('.ownerCardAddress') as HTMLElement).children].map((c) => c.textContent)
    expect(lines).toEqual(['Sabra Texas Holdings Lp', 'c/o Sabra Health Care Reit Inc', '18500 Von Karman Ave Ste 550', 'Irvine, CA 92612'])
    expect(document.body.textContent).not.toContain('%')
    expect(onSuggestion).toHaveBeenLastCalledWith(true)
  })

  it('a likely homestead adds the shared red line with the CAD link beside it', async () => {
    lookupMock.mockImplementation(async (a: string) => proposalFromLookupPayload(a, payload('LAGAN JOEL C & SHANNON', '9703 LENOX HL, SAN ANTONIO, TX 78258')))
    renderWithProviders(<JobFormOwnerLookupBox {...base} onConfirmed={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('owner-lookup-homestead')).toBeTruthy())
    expect(screen.getByText('likely homestead')).toBeTruthy()
    expect(screen.getByTestId('owner-lookup-homestead').textContent).toContain(HOMESTEAD_LINE)
    expect(screen.getByText('Check this parcel on Bexar CAD ↗')).toBeTruthy()
  })

  it('a miss: "No parcel under the pin" and the paste door unfolds the property record panel', async () => {
    lookupMock.mockImplementation(async (a: string) => proposalFromLookupPayload(a, { ok: true, county_geocoder: 'Bexar', parcel: null, parcel_error: 'no parcel' }))
    renderWithProviders(<JobFormOwnerLookupBox {...base} onConfirmed={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('owner-lookup-box').getAttribute('data-state')).toBe('miss'))
    expect(screen.getByText(/No parcel under the pin/)).toBeTruthy()
    expect(screen.queryByTestId('owner-lookup-use')).toBeNull()
    fireEvent.click(screen.getByTestId('owner-lookup-paste-door'))
    expect(screen.getByTestId('owner-lookup-paste-panel')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save the owner on 9703 Lenox Hl' })).toBeTruthy()
  })

  it('a direct job renders nothing and never looks up; a builder in the customer row with no GC does', async () => {
    lookupMock.mockImplementation(async (a: string) => proposalFromLookupPayload(a, payload('SOMEONE', '1 ELSEWHERE')))
    const { unmount } = renderWithProviders(<JobFormOwnerLookupBox {...base} gcCustomerId={null} gcCustomerName="" customerId="c-maria" customerName="Maria Delgado" onConfirmed={() => {}} />)
    await waitFor(() => expect(builderMock).toHaveBeenCalledWith('c-maria'))
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByTestId('owner-lookup-box')).toBeNull()
    expect(lookupMock).not.toHaveBeenCalled()
    unmount()
    builderMock.mockResolvedValue(true)
    renderWithProviders(<JobFormOwnerLookupBox {...base} gcCustomerId={null} gcCustomerName="" customerId="c-sp" customerName="Southern Post Construction" onConfirmed={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('owner-lookup-box').getAttribute('data-state')).toBe('found'))
  })

  it('a linked row with a confirmed owner renders nothing; an unsaved job renders nothing', async () => {
    lookupMock.mockImplementation(async (a: string) => proposalFromLookupPayload(a, payload('SOMEONE', '1 ELSEWHERE')))
    const { unmount } = renderWithProviders(<JobFormOwnerLookupBox {...base} customerAddressId="addr-1" linkedOwnerConfirmedAt="2026-09-14T00:00:00Z" onConfirmed={() => {}} />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByTestId('owner-lookup-box')).toBeNull()
    expect(lookupMock).not.toHaveBeenCalled()
    unmount()
    renderWithProviders(<JobFormOwnerLookupBox {...base} jobId={null} onConfirmed={() => {}} />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByTestId('owner-lookup-box')).toBeNull()
    expect(lookupMock).not.toHaveBeenCalled()
  })
})
