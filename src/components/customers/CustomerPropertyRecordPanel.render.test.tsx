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
  it('keeps the paste box folded without pasteFirst', () => {
    renderWithProviders(<CustomerPropertyRecordPanel address={lookedUp.address} fields={lookedUp} onChange={() => {}} />)
    expect(screen.queryByLabelText('Pasted CAD page')).toBeNull()
  })
})
