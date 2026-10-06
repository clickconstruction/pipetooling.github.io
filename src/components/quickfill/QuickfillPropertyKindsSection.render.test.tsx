// @vitest-environment jsdom
/**
 * Render smokes for the Quickfill "Property kinds" station (v2.4727): the
 * lien-clock group first, the Google Maps door, the hint on the switch, a pick
 * writing the property's kind and turning into the green line with Undo, a
 * typed-address row linking its jobs, and the foot line for no-customer jobs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { QuickfillPropertyKindsSection } from './QuickfillPropertyKindsSection'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { PropertyKindRow } from '../../lib/quickfill/propertyKinds'

vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }) } }))

const savePropertyKind = vi.fn(async () => undefined)
const linkJobPropertyAndSaveKind = vi.fn(async (input: { jobId: string }) => ({ customerAddressId: `p-${input.jobId}`, reused: false }))
vi.mock('../../lib/jobs/propertyKindWrite', () => ({
  savePropertyKind: (...a: unknown[]) => savePropertyKind(...(a as [])),
  linkJobPropertyAndSaveKind: (...a: unknown[]) => linkJobPropertyAndSaveKind(...(a as [{ jobId: string }])),
}))

const lienRow: PropertyKindRow = {
  key: 'addr:p1',
  customerAddressId: 'p1',
  customerId: 'c1',
  customerName: 'Culebra Crossing Partners LLC',
  gcName: 'Ventana Builders',
  address: '8507 Culebra Road, San Antonio, TX 78251',
  jobs: [
    { id: 'a', label: '1211 · Suite B rough-in', stage: 'Billed', openBalance: 18420 },
    { id: 'b', label: '1240 · Suite C top-out', stage: 'Billed', openBalance: 9110 },
  ],
  lienClock: true,
  openBalance: 27530,
  hint: { kind: 'non_residential', why: 'a GC on the job' },
}

const typedRow: PropertyKindRow = {
  key: 'typed:c2:14110 nacogdoches rd',
  customerAddressId: null,
  customerId: 'c2',
  customerName: 'Maria Castillo',
  gcName: null,
  address: '14110 Nacogdoches Rd, San Antonio, TX 78247',
  jobs: [{ id: 'w', label: '1302 · Water heater swap', stage: 'Working', openBalance: 0 }],
  lienClock: false,
  openBalance: 0,
  hint: null,
}

describe('QuickfillPropertyKindsSection', () => {
  beforeEach(() => {
    savePropertyKind.mockClear()
    linkJobPropertyAndSaveKind.mockClear()
  })

  it('groups lien-clock rows first, opens the address in Google Maps and outlines the hint', async () => {
    renderWithProviders(<QuickfillPropertyKindsSection rows={[typedRow, lienRow]} noCustomerCount={3} loading={false} onKindSaved={() => undefined} onJobLinked={() => undefined} />)
    await settle()
    const headers = screen.getAllByText(/Lien clock running|Before the bill goes out/)
    expect(headers[0]?.textContent).toMatch(/Lien clock running \(1\)/)
    expect(headers[1]?.textContent).toMatch(/Before the bill goes out \(1\)/)
    // the lien-clock row draws first, so its door is the first Maps link on the page
    const maps = screen.getAllByTitle('Open in Google Maps')[0] as HTMLAnchorElement
    expect(maps.href).toContain('google.com/maps/search/')
    expect(maps.href).toContain(encodeURIComponent('8507 Culebra Road'))
    expect(maps.target).toBe('_blank')
    expect(screen.getByText(/a GC on the job/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Commercial · looks right/ })).toBeTruthy()
    expect(screen.getByText(/The lien clock is running/)).toBeTruthy()
    expect(screen.getByText(/3 unpaid jobs have/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Missing job info' }).getAttribute('href')).toBe('/quickfill#no-customer-stages')
  })

  it('a pick on a saved property writes its kind and leaves a green line with Undo', async () => {
    const onKindSaved = vi.fn()
    renderWithProviders(<QuickfillPropertyKindsSection rows={[lienRow]} noCustomerCount={0} loading={false} onKindSaved={onKindSaved} onJobLinked={() => undefined} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /Commercial · looks right/ }))
    await waitFor(() => expect(savePropertyKind).toHaveBeenCalledWith('p1', 'non_residential'))
    expect(onKindSaved).toHaveBeenCalledWith('p1', 'non_residential')
    const line = await screen.findByTestId('property-kind-saved')
    expect(line.textContent).toMatch(/8507 Culebra Road.*marked commercial · 1211 and 1240 follow · the lien window/)
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(savePropertyKind).toHaveBeenCalledWith('p1', ''))
    expect(onKindSaved).toHaveBeenLastCalledWith('p1', '')
  })

  it('a pick on a typed address saves it as a property and links each job', async () => {
    const onJobLinked = vi.fn()
    renderWithProviders(<QuickfillPropertyKindsSection rows={[typedRow]} noCustomerCount={0} loading={false} onKindSaved={() => undefined} onJobLinked={onJobLinked} />)
    await settle()
    expect(screen.getByText(/Not one of Maria Castillo's saved properties yet/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Residential' }))
    await waitFor(() => expect(linkJobPropertyAndSaveKind).toHaveBeenCalledWith({ jobId: 'w', customerId: 'c2', jobAddress: typedRow.address, kind: 'residential' }))
    expect(onJobLinked).toHaveBeenCalledWith('w', 'p-w', 'residential')
    expect(savePropertyKind).not.toHaveBeenCalled()
  })

  it('says when everything is marked', async () => {
    renderWithProviders(<QuickfillPropertyKindsSection rows={[]} noCustomerCount={0} loading={false} onKindSaved={() => undefined} onJobLinked={() => undefined} />)
    await settle()
    expect(screen.getByText("Every unpaid job's property is marked.")).toBeTruthy()
  })
})
