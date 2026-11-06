// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders, useAuthModuleMock } from '../../test/renderSmokeMocks'
import type { Fleet } from '../../lib/machines/machinesIo'
import { defaultLevels, todayDay } from '../../lib/machines/machines'
import { MachinesSection } from './MachinesSection'

vi.mock('../../hooks/useAuth', () => useAuthModuleMock({ profileName: 'Carla Nguyen' }))

const fleet: Fleet = {
  machines: [
    { id: 'm1', unitLabel: 'E-12', make: 'Kubota', model: 'KX040', kind: 'excavator', templateId: 't1', code: 'E12KX040', jobId: 'j1', jobWords: '972 · Tovi Pinpoint', heldSince: '2026-11-04T13:00:00Z', levels: defaultLevels('excavator'), rental: null, driveLink: null },
    { id: 'm2', unitLabel: 'R-1', make: 'Bobcat', model: 'E35', kind: 'excavator', templateId: 't1', code: 'R1BOBE35', jobId: null, jobWords: null, heldSince: null, levels: defaultLevels('excavator'), rental: { from: 'Sunbelt', agreementNo: '48812-3', outOn: '2026-11-03', dueBack: '2026-11-30' }, driveLink: 'https://drive.google.com/drive/folders/abc' },
  ],
  templates: [{ id: 't1', name: 'Small excavator', kind: 'excavator', size: 'small', levels: defaultLevels('excavator'), sort: 10, active: true }],
  questions: [],
  checks: [],
}
const io = vi.hoisted(() => ({ loadFleet: vi.fn(), addMachine: vi.fn(async () => 'm3'), placeMachine: vi.fn(async () => {}), saveLevels: vi.fn(async () => {}), saveRental: vi.fn(async () => {}), saveTemplate: vi.fn(async () => {}) }))
vi.mock('../../lib/machines/machinesIo', () => io)
io.loadFleet.mockImplementation(async () => fleet)
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ or: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) }) } }))

describe('the machines board at People → Vehicles', () => {
  afterEach(() => cleanup())

  it('draws a card per machine with its template, its place and its rental, and the gauge editor opens', async () => {
    renderWithProviders(<MachinesSection />)
    expect(await screen.findByText('E-12 · Kubota KX040')).toBeTruthy()
    expect(screen.getAllByText('Small excavator')).toHaveLength(2)
    expect(screen.getByText('On 972 · Tovi Pinpoint')).toBeTruthy()
    expect(screen.getByText('In the yard')).toBeTruthy()
    expect(document.querySelector('[data-rental-chip]')?.textContent).toContain('Rental · Sunbelt · agreement 48812-3')
    fireEvent.click(document.querySelector('[data-machine-gauges="E-12"]')!)
    expect(screen.getByText('Gauges on E-12')).toBeTruthy()
    expect(document.querySelectorAll('[data-gauge-row]')).toHaveLength(4)
    fireEvent.click(screen.getByText('Save E-12’s gauges'))
    expect(io.saveLevels).toHaveBeenCalledWith('m1', expect.any(Array))
  })

  it('Add a machine as a rental mints its label from who it is from, with the number free to wait for the photo', async () => {
    renderWithProviders(<MachinesSection />)
    await screen.findByText('E-12 · Kubota KX040')
    fireEvent.click(screen.getByText('+ Add a machine'))
    fireEvent.click(screen.getByText('Rental'))
    expect(screen.queryByLabelText('Unit')).toBeNull()
    fireEvent.change(screen.getByLabelText('Rented from'), { target: { value: 'Sunbelt' } })
    fireEvent.change(screen.getByLabelText('Make'), { target: { value: 'Bobcat' } })
    fireEvent.change(screen.getByLabelText('Due back'), { target: { value: '2026-11-20' } })
    fireEvent.click(screen.getByText('Add the Sunbelt rental'))
    expect(io.addMachine).toHaveBeenLastCalledWith(expect.objectContaining({ unitLabel: 'Sunbelt rental', make: 'Bobcat', kind: 'excavator' }))
    await vi.waitFor(() => expect(io.saveRental).toHaveBeenLastCalledWith('m3', { from: 'Sunbelt', agreementNo: '', outOn: todayDay(), dueBack: '2026-11-20' }))
  })

  it('Add a machine writes the row with its template', async () => {
    renderWithProviders(<MachinesSection />)
    await screen.findByText('E-12 · Kubota KX040')
    fireEvent.click(screen.getByText('+ Add a machine'))
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'E-14' } })
    fireEvent.change(screen.getByLabelText('Make'), { target: { value: 'Kubota' } })
    fireEvent.click(screen.getByText('Add E-14'))
    expect(io.addMachine).toHaveBeenCalledWith(expect.objectContaining({ unitLabel: 'E-14', make: 'Kubota', templateId: 't1', kind: 'excavator' }))
  })
})
