// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { ResearchPermitRow } from '../../lib/research/permitResearch'

// The map canvas is lazy and heavy, and no test here opens it.
vi.mock('./ResearchMapCard', () => ({ ResearchMapCard: () => <div data-testid="closed-map" /> }))

import { PermitPlaceList } from './PermitPlaceList'

/**
 * Closed, the chip it opens on and what an empty chip says (v2.7878). Closed used to open on
 * Passed whatever it held: a city whose closed permits all had a plumber opened on an empty list
 * that blamed filters nobody had set. Every name, street and number here is made up.
 */
function row(over: Partial<ResearchPermitRow> = {}): ResearchPermitRow {
  return {
    id: 'p1', city: 'New Braunfels', source: 'nb', permit_number: 'COM-1', permit_type: 'Commercial', stage: 'applied', residential: false,
    work_type: 'Commercial project', project_name: null, address: '100 SAMPLE ST', zip: '78130', lat: null, lng: null, submitted_on: '2026-11-03', issued_on: null, filed_on: '2026-11-03',
    declared_value: null, area_sf: null, contact: 'Dana Whitlock, Ridgeway Builders', plumber: null, plumber_permit_on: null,
    verdict: null, verdict_reason: null, verdict_look_again_on: null, verdict_prospect_id: null, verdict_by: null, verdict_by_name: null, verdict_at: null,
    ...over,
  }
}
const withPlumber = (id: string, address: string) => row({ id, address, plumber: 'Blue Heron Plumbing', plumber_permit_on: '2026-11-02' })
const passed = (id: string, address: string) => row({ id, address, verdict: 'not_for_us', verdict_reason: 'Too far', verdict_reason_code: 'too_far', verdict_by_name: 'Sam', verdict_at: '2026-11-10T15:00:00Z' })

const press = { onOpen: vi.fn(), onHandTo: vi.fn(), onPutBack: vi.fn(), onKeep: vi.fn(), onSkim: vi.fn(), onInvestigating: vi.fn() }

function list(place: 'kept' | 'pursuing' | 'closed', rows: ResearchPermitRow[]) {
  return <PermitPlaceList place={place} rows={rows} floor={0} me="u1" todayYmd="2026-11-18" researchers={[]} busyId={null} {...press} />
}
const lit = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed')

afterEach(() => {
  cleanup()
  Object.values(press).forEach((f) => f.mockReset())
})

describe('PermitPlaceList, Closed', () => {
  it('opens on Has a plumber when that is the only chip holding permits', () => {
    renderWithProviders(list('closed', [withPlumber('a', '12 KILN LN'), withPlumber('b', '14 KILN LN')]))
    expect(lit('Passed 0')).toBe('false')
    expect(lit('Has a plumber 2')).toBe('true')
    expect(screen.getByText(/12 KILN LN/)).toBeTruthy()
    expect(screen.getAllByText(/Blue Heron Plumbing has it/)).toHaveLength(2)
    expect(document.querySelector('[data-empty-state]')).toBeNull()
  })

  it('still opens on Passed when Passed holds a permit', () => {
    renderWithProviders(list('closed', [passed('a', '60 MILLRACE ROW'), withPlumber('b', '14 KILN LN')]))
    expect(lit('Passed 1')).toBe('true')
    expect(screen.getByText(/60 MILLRACE ROW/)).toBeTruthy()
  })

  it('an empty chip says what fills it and never blames filters', () => {
    renderWithProviders(list('closed', [withPlumber('a', '12 KILN LN')]))
    fireEvent.click(screen.getByRole('button', { name: 'Passed 0' }))
    expect(document.querySelector('[data-empty-state]')?.textContent).toBe('No passed permits yet. Pass on the skim adds the first.')
    fireEvent.click(screen.getByRole('button', { name: 'Pass on the skim' }))
    expect(press.onSkim).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Not pursuing 0' }))
    expect(document.querySelector('[data-empty-state]')?.textContent).toBe('No permits marked not pursuing yet. Not pursuing on a permit you are investigating adds the first.')
    fireEvent.click(screen.getByRole('button', { name: 'Not pursuing on a permit you are investigating' }))
    expect(press.onInvestigating).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/match the filters/)).toBeNull()
  })

  it('an empty Has a plumber names the pull that fills it, with no press', () => {
    renderWithProviders(list('closed', [passed('a', '60 MILLRACE ROW')]))
    fireEvent.click(screen.getByRole('button', { name: 'Has a plumber 0' }))
    const empty = document.querySelector('[data-empty-state]')
    expect(empty?.textContent).toBe('No permits with a plumber yet. The nightly pull adds a permit here once the city shows its plumbing permit.')
    expect(empty?.querySelector('button, a')).toBeNull()
  })

  it('a search that finds nothing still offers to clear the search', () => {
    renderWithProviders(list('closed', [withPlumber('a', '12 KILN LN')]))
    fireEvent.change(screen.getByLabelText('Search closed permits'), { target: { value: 'millrace' } })
    expect(document.querySelector('[data-empty-state]')?.textContent).toBe('No closed permits match ‘millrace’. Clear the search')
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
    expect(screen.getByText(/12 KILN LN/)).toBeTruthy()
  })

  it('holds its chip when the last permit on it leaves, and lets it go once Closed is left', () => {
    const plumber = withPlumber('b', '14 KILN LN')
    const view = renderWithProviders(list('closed', [passed('a', '60 MILLRACE ROW'), plumber]))
    expect(lit('Passed 1')).toBe('true')
    // The passed permit is put back: the chip empties and stays lit, so the person sees what their press did.
    view.rerender(list('closed', [row({ id: 'a', address: '60 MILLRACE ROW' }), plumber]))
    expect(lit('Passed 0')).toBe('true')
    expect(document.querySelector('[data-empty-state]')?.textContent).toContain('No passed permits yet.')
    // Away to Investigating and back: Closed opens again on a chip that holds a permit.
    view.rerender(list('kept', [row({ id: 'a', address: '60 MILLRACE ROW' }), plumber]))
    view.rerender(list('closed', [row({ id: 'a', address: '60 MILLRACE ROW' }), plumber]))
    expect(lit('Has a plumber 1')).toBe('true')
    expect(screen.getByText(/14 KILN LN/)).toBeTruthy()
  })

  it('keeps a picked chip that still holds permits across a visit to another list', () => {
    const rows = [passed('a', '60 MILLRACE ROW'), withPlumber('b', '14 KILN LN')]
    const view = renderWithProviders(list('closed', rows))
    fireEvent.click(screen.getByRole('button', { name: 'Has a plumber 1' }))
    view.rerender(list('pursuing', rows))
    view.rerender(list('closed', rows))
    expect(lit('Has a plumber 1')).toBe('true')
  })

  it('draws a lit chip bold from the first draw, at the chip size (v2.7902)', () => {
    renderWithProviders(list('closed', [withPlumber('a', '12 KILN LN')]))
    const on = screen.getByRole('button', { name: 'Has a plumber 1' })
    const off = screen.getByRole('button', { name: 'Passed 0' })
    // The whole-font shorthand came last in the style and reset both, so a lit chip drew at weight 400 and 16 px.
    // The chip now takes the family alone from the page (jsdom drops the shorthand, so the family is the tell).
    expect(on.style.fontFamily).toBe('inherit')
    expect(on.style.fontWeight).toBe('600')
    expect(on.style.fontSize).toBe('0.78rem')
    expect(off.style.fontWeight).toBe('400')
    // A press moves the weight with the light, and React has no shorthand to warn about.
    const warned = vi.spyOn(console, 'error').mockImplementation(() => {})
    fireEvent.click(off)
    expect(off.style.fontWeight).toBe('600')
    expect(on.style.fontWeight).toBe('400')
    expect(warned).not.toHaveBeenCalled()
    warned.mockRestore()
  })
})
