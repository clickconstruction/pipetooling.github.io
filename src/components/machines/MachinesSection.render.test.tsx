// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders, useAuthModuleMock } from '../../test/renderSmokeMocks'
import type { Fleet } from '../../lib/machines/machinesIo'
import { defaultLevels, todayDay, type MachineCheck } from '../../lib/machines/machines'
import { MachinesSection } from './MachinesSection'

vi.mock('../../hooks/useAuth', () => useAuthModuleMock({ profileName: 'Carla Nguyen' }))

const fleet: Fleet = {
  machines: [
    { id: 'm1', unitLabel: 'E-12', make: 'Kubota', model: 'KX040', kind: 'excavator', templateId: 't1', code: 'E12KX040', jobId: 'j1', jobWords: '972 · Tovi Pinpoint', heldSince: '2026-11-04T13:00:00Z', levels: defaultLevels('excavator'), rental: null, driveLink: null },
    { id: 'm2', unitLabel: 'R-1', make: 'Bobcat', model: 'E35', kind: 'excavator', templateId: 't1', code: 'R1BOBE35', jobId: null, jobWords: null, heldSince: null, levels: defaultLevels('excavator'), rental: { from: 'Sunbelt', agreementNo: '48812-3', outOn: '2026-11-03', dueBack: '2026-11-30' }, driveLink: 'https://drive.google.com/drive/folders/abc' },
    { id: 'm3', unitLabel: 'Sunbelt rental', make: 'Bobcat', model: 'S70', kind: 'skid_steer', templateId: 't2', code: 'RZZT09T4', jobId: 'j2', jobWords: '1088 · Riders Walk', heldSince: null, levels: defaultLevels('skid_steer'), rental: { from: 'Sunbelt', agreementNo: '', outOn: todayDay(), dueBack: '' }, driveLink: null },
  ],
  templates: [
    { id: 't1', name: 'Small excavator', kind: 'excavator', size: 'small', levels: defaultLevels('excavator'), sort: 10, active: true },
    { id: 't2', name: 'Skid steer', kind: 'skid_steer', size: null, levels: defaultLevels('skid_steer'), sort: 20, active: true },
  ],
  questions: [],
  checks: [photographed()],
}
/** The tech's pre-use check on the rental with the agreement's first page taken and nothing else yet. */
function photographed(): MachineCheck {
  return { id: 'c3', kind: 'pre', machineId: 'm3', jobId: 'j2', jobWords: '1088 · Riders Walk', day: todayDay(), byName: 'Mateo Ruiz', startedAt: new Date().toISOString(), signedAt: null, verdict: 'unfinished', answers: [], levels: {}, hours: null, photos: [{ id: 'p1', shot: 'agreement', fileName: 'agreement.jpg', src: null, driveFileId: null, filedAt: null, failWhy: null }], leftWhere: null, runAnyway: null, dispatchedAt: null }
}
const io = vi.hoisted(() => ({ loadFleet: vi.fn(), addMachine: vi.fn(async () => 'm3'), placeMachine: vi.fn(async () => {}), saveLevels: vi.fn(async () => {}), saveRental: vi.fn(async () => {}), saveTemplate: vi.fn(async () => {}) }))
vi.mock('../../lib/machines/machinesIo', () => io)
const photos = vi.hoisted(() => ({ photoSrc: vi.fn(async () => 'blob:agreement-p1'), runAnyway: vi.fn(async () => {}) }))
vi.mock('../../lib/machines/checksIo', () => photos)
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

  it('a rental whose agreement came in as a photo shows the photo, and Type it off the photo opens the editor beside it', async () => {
    renderWithProviders(<MachinesSection />)
    await screen.findByText('Sunbelt rental · Bobcat S70')
    const chips = [...document.querySelectorAll('[data-rental-chip]')].map((c) => c.textContent)
    expect(chips.some((c) => c?.includes('Rental · Sunbelt · agreement photo in · number not typed yet · open-ended'))).toBe(true)
    const box = document.querySelector('[data-agreement-box]')
    expect(box?.textContent).toContain('Agreement photo in')
    expect(box?.textContent).toContain('Mateo Ruiz took it today')
    // the signed URL arrives a beat after the board draws
    const img = await screen.findByAltText('The agreement, agreement.jpg')
    expect(img.getAttribute('src')).toBe('blob:agreement-p1')
    expect(photos.photoSrc).toHaveBeenCalledWith('m3', 'p1')
    expect(screen.getByText('Open the photo').getAttribute('href')).toBe('blob:agreement-p1')
    fireEvent.click(screen.getByText('Type it off the photo'))
    expect(document.querySelector('[data-rental-editor-photo]')).toBeTruthy()
    expect(screen.getByText('Read the agreement number and the due-back day off the paper.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Agreement number'), { target: { value: '48812-9' } })
    fireEvent.change(screen.getByLabelText('Due back'), { target: { value: '2026-11-20' } })
    fireEvent.click(screen.getByText('Save the rental'))
    expect(io.saveRental).toHaveBeenCalledWith('m3', expect.objectContaining({ from: 'Sunbelt', agreementNo: '48812-9', dueBack: '2026-11-20' }))
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
