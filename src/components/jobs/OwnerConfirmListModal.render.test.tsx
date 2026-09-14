// @vitest-environment jsdom
/**
 * Owner of record · the Fix-ups list that looks itself up (v2.3447): a found
 * row shows the roll's owner and Use, a public owner shows the bond-claim
 * chip and is left out of Use all, a miss shows the paste door that unfolds
 * the record panel, and the footer counts only eligible rows.
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
vi.mock('../../lib/customers/propertyLookupClient', async () => {
  const actual = await vi.importActual<typeof import('../../lib/customers/propertyLookupClient')>('../../lib/customers/propertyLookupClient')
  return { ...actual, lookupPropertyRecord: (address: string) => lookupMock(address) }
})
const confirmMock = vi.fn()
vi.mock('../../lib/jobs/ownerConfirmWrite', () => ({ confirmOwnerForProperty: (input: unknown) => confirmMock(input) }))

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import OwnerConfirmListModal, { resetOwnerConfirmLookupCache } from './OwnerConfirmListModal'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { proposalFromLookupPayload } from '../../lib/customers/propertyLookupClient'
import type { OwnerToConfirmRow } from '../../lib/jobs/ownerConfirm'

afterEach(cleanup)
beforeEach(() => {
  resetOwnerConfirmLookupCache()
  lookupMock.mockReset()
  confirmMock.mockReset()
})

const row = (over: Partial<OwnerToConfirmRow> = {}): OwnerToConfirmRow => ({
  jobId: 'j1',
  hcpNumber: '650',
  clickNumber: '',
  jobAddress: '5498 Cibolo Valley Dr 200, Schertz, TX 78108',
  status: 'billed',
  customerId: 'c-ati',
  customerName: 'ATI Schertz',
  gcCustomerId: 'c-loberg',
  gcName: 'Loberg Contracting',
  customerAddressId: null,
  hasOwner: false,
  ownerConfirmed: false,
  propertyKind: '',
  firstWorkMonth: '2026-06',
  firstDeadline: '2099-09-15',
  ...over,
})

function payload(owner: string, mailing: string, situs: string) {
  return {
    ok: true,
    county_geocoder: 'Guadalupe',
    parcel: { propId: '12345', ownerName: owner, nameCare: '', legalDescription: 'LOT 1', situsAddress: situs, mailingAddress: mailing, county: 'Guadalupe', source: 'Guadalupe Appraisal District', taxYear: '2025' },
  }
}

const ROWS: OwnerToConfirmRow[] = [
  row(),
  row({ jobId: 'j2', hcpNumber: '690', jobAddress: '1200 Kenney Fort Blvd, Round Rock, TX', customerName: 'Knight Contracting', customerId: 'c-knight', gcName: 'Knight Contracting', gcCustomerId: 'c-knight', firstDeadline: '2099-10-15' }),
  row({ jobId: 'j3', hcpNumber: '700', jobAddress: '1 Nowhere Ln, Blanco, TX', firstDeadline: '2099-11-16' }),
]

function wireLookups() {
  lookupMock.mockImplementation(async (address: string) => {
    if (address.startsWith('5498')) return proposalFromLookupPayload(address, payload('SCHERTZ STATION LTD', '4040 BROADWAY STE 600, SAN ANTONIO, TX 78209', '5498 CIBOLO VALLEY DR, SCHERTZ, TX'))
    if (address.startsWith('1200')) return proposalFromLookupPayload(address, payload('CITY OF ROUND ROCK', '221 E MAIN ST, ROUND ROCK, TX 78664', '1200 KENNEY FORT BLVD, ROUND ROCK, TX'))
    return proposalFromLookupPayload(address, { ok: true, county_geocoder: 'Blanco', parcel: null, parcel_error: 'no parcel' })
  })
}

describe('OwnerConfirmListModal', () => {
  it('looks every property up on open; a found row shows the owner + Use, a public row the bond-claim chip, a miss the paste door; Use all counts only eligible rows', async () => {
    wireLookups()
    renderWithProviders(<OwnerConfirmListModal open onClose={() => {}} rows={ROWS} onSaved={() => {}} userId="u1" />)
    expect(screen.getByText('Owner of record · 3 jobs on 3 properties')).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('owner-confirm-subtitle').textContent).toContain('2 found · 1 need a paste'))
    expect(lookupMock).toHaveBeenCalledTimes(3)

    const rows = screen.getAllByTestId('owner-confirm-row')
    expect(rows.map((r) => r.getAttribute('data-state'))).toEqual(['found', 'found', 'miss'])
    expect(screen.getByText('Schertz Station Ltd')).toBeTruthy()
    expect(screen.getByText('landlord · ATI Schertz is the tenant')).toBeTruthy()
    expect(screen.getByText('public owner — bond claim, not a lien')).toBeTruthy()
    expect(screen.getAllByTestId('owner-confirm-use')).toHaveLength(2)
    expect(screen.getByText(/No parcel under the pin/)).toBeTruthy()

    // Use all: the landlord row counts, the public row does not.
    expect(screen.getByTestId('owner-confirm-use-all').textContent).toBe('Use all 1 found')
    expect(screen.getByTestId('owner-confirm-footer').textContent).toBe('0 of 3 confirmed · 2 found and waiting on you · 1 need a paste')

    // The paste door unfolds the record panel under the miss row.
    fireEvent.click(screen.getByTestId('owner-confirm-paste-door'))
    expect(screen.getByTestId('owner-confirm-paste-panel')).toBeTruthy()
    expect(screen.getByLabelText('Owner of record name')).toBeTruthy()
  })

  it('Use writes through the shared helper and turns the row green; the footer counts it', async () => {
    wireLookups()
    confirmMock.mockResolvedValue({ updated: [], inserted: [{ customerAddressId: 'new-1', jobIds: ['j1'] }], skipped: [] })
    const onSaved = vi.fn()
    renderWithProviders(<OwnerConfirmListModal open onClose={() => {}} rows={[ROWS[0]!]} onSaved={onSaved} userId="u1" />)
    await waitFor(() => expect(screen.getByTestId('owner-confirm-use')).toBeTruthy())
    fireEvent.click(screen.getByTestId('owner-confirm-use'))
    await waitFor(() => expect(screen.getByTestId('owner-confirm-row').getAttribute('data-state')).toBe('saved'))
    expect(confirmMock).toHaveBeenCalledTimes(1)
    const call = confirmMock.mock.calls[0]![0] as { address: string; jobs: { jobId: string }[]; source: { kind: string }; userId: string }
    expect(call.address).toBe('5498 Cibolo Valley Dr 200, Schertz, TX 78108')
    expect(call.jobs.map((j) => j.jobId)).toEqual(['j1'])
    expect(call.source.kind).toBe('proposal')
    expect(call.userId).toBe('u1')
    expect(onSaved).toHaveBeenCalled()
    expect(screen.getByText(/Schertz Station Ltd · saved/)).toBeTruthy()
    expect(screen.getByTestId('owner-confirm-footer').textContent).toBe('1 of 1 confirmed · 0 found and waiting on you · 0 need a paste')
  })
})
