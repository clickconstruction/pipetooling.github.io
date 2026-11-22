// @vitest-environment jsdom
/**
 * Render-smoke tests for Find their names on permits, with a phone or a web domain as a reason
 * (v2.8303). A name that shares a phone with the customer is offered however unlike the two
 * names read, with the phone on a green chip. Compare gains a phones row and a web domains row.
 * Nothing is tied until a person presses. Every name, phone and domain here is made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { BuilderRow } from '../../lib/research/permitBuilders'

const { siteIo, io } = vi.hoisted(() => ({
  siteIo: {
    loadNameAnswers: vi.fn(),
    loadBidsOfCustomers: vi.fn(),
    loadNameContactMatches: vi.fn(),
    loadNameByKey: vi.fn(),
    loadPermitsByHouseNumber: vi.fn(),
    loadPermitsOfName: vi.fn(),
    loadOurContactRows: vi.fn(),
    loadCompanyLookupFacts: vi.fn(),
    recordNameAnswer: vi.fn(),
  },
  io: { loadBuilders: vi.fn() },
}))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/research/bidSiteIo', () => siteIo)
vi.mock('../../lib/research/permitResearchIo', () => io)
vi.mock('./BidGcTiedNames', () => ({ BidGcTiedNames: () => <div data-testid="tied-names" /> }))

import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { FindNamesSheet } from './FindNamesSheet'

installDomShims()

const builder = (key: string, contact: string, permits: number): BuilderRow => ({ key, name: null, sample_contact: contact, kind: null, mark: null, mark_reason: null, mark_by_name: null, mark_at: null, permits, open: 0, last_permit_on: '2026-11-01', plumber: null, plumber_jobs: 0, bids: 0, won: 0, last_bid_on: null })
const PHONE = { customer_id: 'c1', builder_key: 'hartwellinteriors', reason: 'phone', value: '2105550142', heard_from: 'permit' }

beforeEach(() => {
  for (const fn of Object.values(siteIo)) fn.mockReset()
  io.loadBuilders.mockReset().mockImplementation(async (city: string) => (city === 'San Antonio' ? [builder('ridgewaybuilderstexas', 'Ridgeway Builders of Texas LLC', 7)] : []))
  siteIo.loadNameAnswers.mockResolvedValue({ rows: [], me: 'u1' })
  siteIo.loadBidsOfCustomers.mockResolvedValue([])
  siteIo.loadPermitsByHouseNumber.mockResolvedValue([])
  siteIo.loadNameContactMatches.mockResolvedValue([PHONE])
  siteIo.loadNameByKey.mockResolvedValue({ key: 'hartwellinteriors', name: 'Hartwell Interiors', permits: 0, lastOn: '2026-10-21', kind: null, allPermits: 3 })
  siteIo.loadPermitsOfName.mockResolvedValue([{ id: 'p1', city: 'Austin', address: '5 FAR RD', zip: '78701', contact: 'Hartwell Interiors', contact_phone: '2105550142', work_type: null, permit_type: 'Plumbing Permit', kind: 'plumbing', stage: 'issued', issued_on: '2026-10-21', submitted_on: null }])
  siteIo.loadOurContactRows.mockResolvedValue({ customers: [{ contact_info: { phone: '(210) 555-0142', email: 'office@ridgeway.example' }, billing_email: null }], persons: [] })
  siteIo.loadCompanyLookupFacts.mockResolvedValue([])
})

const sheet = () => renderWithProviders(<FindNamesSheet customerIds={['c1']} customerName="Ridgeway Builders" onClose={() => {}} />)

describe('FindNamesSheet, a shared phone as a reason', () => {
  it('offers a name that shares a phone with them, read by its key when no list carries it', async () => {
    sheet()
    await waitFor(() => expect(screen.getByText('The same phone, (210) 555-0142')).toBeTruthy())
    expect(siteIo.loadNameContactMatches).toHaveBeenCalledWith(['c1'])
    expect(siteIo.loadNameByKey).toHaveBeenCalledWith('hartwellinteriors')
    expect(screen.getByText('Listed on 3 permits we can see · last Oct 21')).toBeTruthy()
    // The name that begins theirs is still offered, on the name alone.
    expect(screen.getByText('One name begins the other')).toBeTruthy()
    // Nothing was tied by the read.
    expect(siteIo.recordNameAnswer).not.toHaveBeenCalled()
  })

  it('does not read a name by its key when Builders already carries it', async () => {
    siteIo.loadNameContactMatches.mockResolvedValue([{ ...PHONE, builder_key: 'ridgewaybuilderstexas' }])
    sheet()
    await waitFor(() => expect(screen.getByText('The same phone, (210) 555-0142')).toBeTruthy())
    expect(siteIo.loadNameByKey).not.toHaveBeenCalled()
  })

  it('draws as before when the read is not on the database yet', async () => {
    siteIo.loadNameContactMatches.mockResolvedValue(null)
    sheet()
    await waitFor(() => expect(screen.getByText('One name begins the other')).toBeTruthy())
    expect(screen.queryByText(/The same phone/)).toBeNull()
    expect(siteIo.loadNameByKey).not.toHaveBeenCalled()
  })

  it('puts the phones beside each other in Compare and marks the one they share', async () => {
    sheet()
    await waitFor(() => expect(screen.getByText('The same phone, (210) 555-0142')).toBeTruthy())
    const row = screen.getByText('Hartwell Interiors').closest('div') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Compare ›' }))
    const compare = await screen.findByTestId('name-compare')
    expect(siteIo.loadOurContactRows).toHaveBeenCalledWith(['c1'])
    expect(siteIo.loadCompanyLookupFacts).toHaveBeenCalledWith('hartwellinteriors')
    const words = compare.textContent ?? ''
    expect(words).toContain('Phones we hold for them(210) 555-0142')
    expect(words).toContain('Phones listed with this name(210) 555-0142')
    expect(words).toContain('Web domains we hold for themridgeway.example')
    expect(words).toContain('Web domains found for this nameNone found')
  })

  it('still draws the rest of Compare, with the reason, when what each side holds cannot be read', async () => {
    siteIo.loadOurContactRows.mockRejectedValue({ message: 'permission denied for table customers', code: '42501' })
    sheet()
    await waitFor(() => expect(screen.getByText('The same phone, (210) 555-0142')).toBeTruthy())
    const row = screen.getByText('Hartwell Interiors').closest('div') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Compare ›' }))
    const compare = await screen.findByTestId('name-compare')
    expect(compare.textContent).toContain('Where this name’s permits are')
    expect(compare.textContent).not.toContain('Phones we hold for them')
    expect(screen.getByText(/The phones and web domains could not be read\./)).toBeTruthy()
  })
})
