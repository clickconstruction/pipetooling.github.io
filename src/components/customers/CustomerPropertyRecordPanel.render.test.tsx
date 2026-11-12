// @vitest-environment jsdom
/**
 * Paste first (v2.4724): in the lien fix window, a record already looked up that still lacks its
 * legal description or owner opens with the CAD paste box; Edit customer's panel keeps it folded.
 * A page that hides its exemptions says so instead of claiming no homestead.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import CustomerPropertyRecordPanel from './CustomerPropertyRecordPanel'
import { emptyPropertyDraft } from '../../lib/customers/propertyDraft'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

// The function's answer for a street the map lacks (v2.6520): a held pin, no parcel, the county still resolved.
vi.mock('../../lib/customers/propertyLookupClient', async () => {
  const actual = await vi.importActual<typeof import('../../lib/customers/propertyLookupClient')>('../../lib/customers/propertyLookupClient')
  return {
    ...actual,
    lookupPropertyRecord: vi.fn(async (address: string) =>
      actual.proposalFromLookupPayload(address, {
        ok: true,
        county_geocoder: 'Williamson',
        parcel: null,
        pin_hold: { kind: 'street_unknown', detail: 'the map matched only part of the address' },
      }),
    ),
  }
})

afterEach(cleanup)

const lookedUp = { ...emptyPropertyDraft('1200 Ilka Rd, Seguin, TX 78155'), county: 'Guadalupe', parcel_looked_up_at: '2026-10-06T12:00:00Z' }

describe('CustomerPropertyRecordPanel', () => {
  it('opens the paste box first when asked and the roll left the legal description blank; reads a hidden-exemptions page as unknown', () => {
    const onChange = vi.fn()
    renderWithProviders(<CustomerPropertyRecordPanel address={lookedUp.address} fields={lookedUp} onChange={onChange} pasteFirst />)
    const box = screen.getByLabelText('Pasted CAD page')
    fireEvent.change(box, { target: { value: 'Legal Description:\tABS: 131 SUR: BENJAMIN FUQUA 1.2260 AC\nOwner ID:\t257443\nName:\tHALL BRUCE & REBECCA\nExemptions:\tFor privacy reasons not all exemptions are shown online.' } })
    expect(screen.getByText('Owner · HALL BRUCE & REBECCA')).toBeTruthy()
    expect(screen.getByText(/Exemptions · not shown on the page/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Use these' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ legal_description: 'ABS: 131 SUR: BENJAMIN FUQUA 1.2260 AC', owner_name: 'HALL BRUCE & REBECCA' }))
    expect(onChange.mock.calls[0]![0]).not.toHaveProperty('homestead')
  })
  it('asks the homestead question as a yes or a no on a residential property, and says so while nobody has answered (punch list #305)', () => {
    const onChange = vi.fn()
    const home = { ...lookedUp, property_kind: 'residential', homestead_answered_at: '' }
    renderWithProviders(<CustomerPropertyRecordPanel address={home.address} fields={home} onChange={onChange} />)
    const question = document.querySelector('[data-homestead-question]') as HTMLElement
    expect(question.getAttribute('data-homestead-question')).toBe('unanswered')
    expect(question.textContent).toContain("Is this the owner's homestead?")
    expect(question.textContent).toContain('Not answered yet. A lien affidavit on this home waits for a yes or a no.')
    expect(screen.getByRole('button', { name: 'Homestead: yes' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'Homestead: no' }).getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Homestead: no' }))
    expect(onChange).toHaveBeenCalledWith({ homestead: false, homestead_answered_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) })
    fireEvent.click(screen.getByRole('button', { name: 'Homestead: yes' }))
    expect(onChange).toHaveBeenLastCalledWith({ homestead: true, homestead_answered_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) })
  })
  it('shows the answer once one is on record, reads a row from before the column by its flag, and asks nothing of a commercial property', () => {
    const answeredNo = { ...lookedUp, property_kind: 'residential', homestead_answered_at: '2026-11-17T15:00:00Z' }
    const { unmount } = renderWithProviders(<CustomerPropertyRecordPanel address={answeredNo.address} fields={answeredNo} onChange={() => {}} />)
    expect(document.querySelector('[data-homestead-question]')!.getAttribute('data-homestead-question')).toBe('no')
    expect(screen.getByRole('button', { name: 'Homestead: no' }).getAttribute('aria-pressed')).toBe('true')
    expect(document.body.textContent).not.toContain('Not answered yet')
    unmount()
    // No column on the row yet: the flag alone, as the tick read it.
    const older = { ...lookedUp, property_kind: 'residential' }
    const second = renderWithProviders(<CustomerPropertyRecordPanel address={older.address} fields={older} onChange={() => {}} />)
    expect(document.querySelector('[data-homestead-question]')!.getAttribute('data-homestead-question')).toBe('no')
    second.unmount()
    renderWithProviders(<CustomerPropertyRecordPanel address={lookedUp.address} fields={{ ...lookedUp, property_kind: 'non_residential', homestead_answered_at: '' }} onChange={() => {}} />)
    expect(document.querySelector('[data-homestead-question]')).toBeNull()
  })
  it('says the map has no such street when the lookup holds the pin, fills the county alone and never claims a parcel (v2.6520)', async () => {
    const onChange = vi.fn()
    const address = '123 ZZ Test Ln, Taylor, TX 76574'
    renderWithProviders(<CustomerPropertyRecordPanel address={address} fields={emptyPropertyDraft(address)} onChange={onChange} autoLookup />)
    const line = await screen.findByText(/The map has no street by that name near Taylor, so the roll was not asked\. Check the street name, then look up again\./)
    expect(line.textContent).toContain('County still resolved: Williamson.')
    expect(line.textContent).not.toContain('Find the rest on the county appraisal district')
    expect(screen.queryByText(/Found on the appraisal roll/)).toBeNull()
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ county: 'Williamson' }))
    expect(onChange.mock.calls[0]![0]).not.toHaveProperty('owner_name')
  })
  it('keeps the paste box folded without pasteFirst', () => {
    renderWithProviders(<CustomerPropertyRecordPanel address={lookedUp.address} fields={lookedUp} onChange={() => {}} />)
    expect(screen.queryByLabelText('Pasted CAD page')).toBeNull()
  })
  it('takes the owner’s email and phone under the mailing address and hands each to onChange; neither is a lien chip (v2.6497)', () => {
    const onChange = vi.fn()
    renderWithProviders(<CustomerPropertyRecordPanel address={lookedUp.address} fields={{ ...lookedUp, owner_email: '', owner_phone: '' }} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Owner email'), { target: { value: 'owner@novy.example' } })
    expect(onChange).toHaveBeenCalledWith({ owner_email: 'owner@novy.example' })
    fireEvent.change(screen.getByLabelText('Owner phone'), { target: { value: '(512) 555-0142' } })
    expect(onChange).toHaveBeenCalledWith({ owner_phone: '(512) 555-0142' })
    expect(screen.getByText(/3 lien fields missing/)).toBeTruthy()
    expect(screen.queryByText(/owner email/)).toBeNull()
  })
  it('names the kinds Residential and Commercial, as the lien screens do; Commercial writes non_residential and drops homestead', () => {
    const onChange = vi.fn()
    renderWithProviders(<CustomerPropertyRecordPanel address={lookedUp.address} fields={lookedUp} onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Residential' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Non-residential' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Commercial' }))
    expect(onChange).toHaveBeenCalledWith({ property_kind: 'non_residential', homestead: false })
  })
})
