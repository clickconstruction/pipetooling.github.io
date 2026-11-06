// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders, useAuthModuleMock } from '../../test/renderSmokeMocks'
import { defaultLevels, todayDay, type Machine, type MachineCheck, type MachineQuestion } from '../../lib/machines/machines'
import { MachineCheckSheet } from './MachineCheckSheet'

vi.mock('../../hooks/useAuth', () => useAuthModuleMock({ profileName: 'Mateo Ruiz' }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ or: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) }) } }))
const io = vi.hoisted(() => ({
  startCheck: vi.fn(),
  patchCheck: vi.fn(async () => {}),
  signCheck: vi.fn(async () => {}),
  holdMachine: vi.fn(async () => 'dr1'),
  addCheckPhoto: vi.fn(),
  photoSrc: vi.fn(async () => null),
}))
vi.mock('../../lib/machines/checksIo', () => io)

const machine: Machine = { id: 'm1', unitLabel: 'E-12', make: 'Kubota', model: 'KX040', kind: 'excavator', templateId: 't1', code: 'E12KX040', jobId: 'j1', jobWords: '972 · Tovi Pinpoint', heldSince: null, levels: defaultLevels('excavator'), rental: null, driveLink: null }
const questions: MachineQuestion[] = [
  { id: 'q1', templateId: null, machineId: null, words: 'Hydraulic hoses and cylinders, no leaks', holdsMachine: true, when: 'pre' },
  { id: 'q2', templateId: null, machineId: null, words: 'Lights, horn and the backup alarm work', holdsMachine: false, when: 'pre' },
  { id: 'q3', templateId: null, machineId: null, words: 'Nothing new broken or leaking since the morning', holdsMachine: true, when: 'post' },
]
const today = todayDay()
const open: MachineCheck = { id: 'c1', kind: 'pre', machineId: 'm1', jobId: 'j1', jobWords: '972 · Tovi Pinpoint', day: today, byName: 'Mateo Ruiz', startedAt: new Date().toISOString(), signedAt: null, verdict: 'unfinished', answers: [], levels: {}, hours: null, photos: [], leftWhere: null, runAnyway: null, dispatchedAt: null }

describe('the pre-use check sheet', () => {
  afterEach(() => cleanup())

  it('walks one question at a time, writes each pick, and the sign press names the verdict', async () => {
    const onClose = vi.fn()
    renderWithProviders(<MachineCheckSheet machine={machine} questions={questions} checks={[open]} jobId="j1" jobWords="972 · Tovi Pinpoint" userId="u1" byName="Mateo Ruiz" onClose={onClose} />)
    expect(screen.getByText('Pre-use check · E-12')).toBeTruthy()
    expect(document.querySelector('[data-machine-progress]')?.textContent).toContain('0 of 2 answered')
    expect(screen.getByText('2 left on the walk')).toBeTruthy()
    fireEvent.click(screen.getByText('Yes'))
    expect(io.patchCheck).toHaveBeenCalledWith('c1', { answers: [expect.objectContaining({ questionId: 'q1', pick: 'yes' })] })
    fireEvent.click(screen.getByText('No'))
    expect(screen.getByLabelText('What is wrong')).toBeTruthy()
    expect(screen.getByText('E-12 is safe to run')).toBeTruthy()
    fireEvent.click(screen.getByText('E-12 is safe to run'))
    await vi.waitFor(() => expect(io.signCheck).toHaveBeenCalled())
    expect(io.holdMachine).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('a No on a holding question holds the machine and the sign tells Dispatch', async () => {
    renderWithProviders(<MachineCheckSheet machine={machine} questions={questions} checks={[open]} jobId="j1" jobWords="972 · Tovi Pinpoint" userId="u1" byName="Mateo Ruiz" onClose={() => {}} />)
    fireEvent.click(screen.getByText('No'))
    fireEvent.click(screen.getByText('Close this one'))
    fireEvent.click(screen.getByText('Yes'))
    expect(screen.getByText('Finish the walk, E-12 stays held')).toBeTruthy()
    fireEvent.click(screen.getByText('Finish the walk, E-12 stays held'))
    await vi.waitFor(() => expect(io.holdMachine).toHaveBeenCalled())
  })

  it('the leaving check asks where it is tonight before it signs', () => {
    renderWithProviders(<MachineCheckSheet machine={machine} questions={questions} checks={[{ ...open, id: 'c2', kind: 'post' }]} kind="post" jobId="j1" jobWords="972 · Tovi Pinpoint" userId="u1" byName="Mateo Ruiz" onClose={() => {}} />)
    expect(screen.getByText('Leaving it · E-12')).toBeTruthy()
    fireEvent.click(screen.getByText('Yes'))
    expect(screen.getByText('Say where it is tonight')).toBeTruthy()
    fireEvent.click(screen.getByText('Back to the yard'))
    expect(io.patchCheck).toHaveBeenCalledWith('c2', { leftWhere: 'yard', leftJobId: null })
    expect(screen.getByText('I left E-12 as it says')).toBeTruthy()
  })
})
