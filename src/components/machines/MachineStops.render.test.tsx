// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders, useAuthModuleMock } from '../../test/renderSmokeMocks'
import { defaultLevels, todayDay, type Machine, type MachineAssignment, type MachineCheck, type MachineQuestion } from '../../lib/machines/machines'
import type { DayPlan } from '../../lib/machines/assignmentsIo'
import type { JobMachines } from '../../lib/machines/checksIo'
import type { MachineTemplate } from '../../lib/machines/machinesIo'
import { BlockMachineChips, BlockMachinesRow, ClockOutMachinesStop, MachineArrivalStop, RailMachineStops } from './MachineStops'

vi.mock('../../hooks/useAuth', () => useAuthModuleMock({ profileName: 'Mateo Ruiz' }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ or: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) }) } }))

const today = todayDay()
const e12: Machine = { id: 'm1', unitLabel: 'E-12', make: 'Kubota', model: 'KX040', kind: 'excavator', templateId: 't1', code: 'E12KX040', jobId: null, jobWords: null, heldSince: null, levels: defaultLevels('excavator'), rental: null, driveLink: null }
const medium: MachineTemplate = { id: 't1', name: 'Medium excavator', kind: 'excavator', size: 'medium', levels: defaultLevels('excavator'), sort: 2, active: true }
const skid: MachineTemplate = { id: 't2', name: 'Skid steer', kind: 'skid_steer', size: null, levels: defaultLevels('skid_steer'), sort: 4, active: true }
const questions: MachineQuestion[] = [
  { id: 'q1', templateId: 't1', machineId: null, words: 'Tracks tight?', holdsMachine: false, when: 'pre' },
  { id: 'q2', templateId: null, machineId: null, words: 'Leaks under it?', holdsMachine: true, when: 'both' },
]
const plan: MachineAssignment = { id: 'as1', machineId: 'm1', jobId: 'job-1', jobWords: '972 · Test', day: today, broughtBy: 'Luis Ortega', answer: null, answeredAt: null, why: '' }
const signed: MachineCheck = { id: 'c1', kind: 'pre', machineId: 'm1', jobId: 'job-1', jobWords: '972 · Test', day: today, byName: 'Mateo Ruiz', startedAt: new Date().toISOString(), signedAt: new Date().toISOString(), verdict: 'safe', answers: [], levels: {}, hours: 1418, photos: [], leftWhere: null, runAnyway: null, dispatchedAt: null }

const state = vi.hoisted(() => ({ day: null as unknown, job: null as unknown }))
const plans = vi.hoisted(() => ({
  loadDay: vi.fn(async () => state.day),
  peekDay: vi.fn(() => null),
  subscribePlans: vi.fn(() => () => {}),
  forgetDay: vi.fn(),
  addAssignment: vi.fn(async () => {}),
  patchAssignment: vi.fn(async () => {}),
  removeAssignment: vi.fn(async () => {}),
}))
vi.mock('../../lib/machines/assignmentsIo', () => plans)
const checks = vi.hoisted(() => ({
  loadJobMachines: vi.fn(async () => state.job),
  answerArrival: vi.fn(async () => {}),
  startCheck: vi.fn(async () => ({ id: 'c-new', kind: 'pre', machineId: 'm1', jobId: 'job-1', jobWords: '972 · Test', day: new Date().toISOString().slice(0, 10), byName: 'Mateo Ruiz', startedAt: new Date().toISOString(), signedAt: null, verdict: 'unfinished', answers: [], levels: {}, hours: null, photos: [], leftWhere: null, runAnyway: null, dispatchedAt: null })),
  patchCheck: vi.fn(async () => {}),
  signCheck: vi.fn(async () => {}),
  holdMachine: vi.fn(async () => null),
  addCheckPhoto: vi.fn(),
  photoSrc: vi.fn(async () => null),
  loadQuestions: vi.fn(async () => questions),
}))
vi.mock('../../lib/machines/checksIo', () => checks)
const fleet = vi.hoisted(() => ({
  addMachine: vi.fn(async () => 'm-new'),
  saveRental: vi.fn(async () => {}),
}))
vi.mock('../../lib/machines/machinesIo', async (orig) => ({ ...(await orig<typeof import('../../lib/machines/machinesIo')>()), ...fleet }))

describe('the machine stops on a job’s day', () => {
  beforeEach(() => {
    const day: DayPlan = { day: today, machines: [e12], templates: [medium, skid], assignments: [plan], checks: [] }
    const job: JobMachines = { machines: [e12], questions: [], checks: [], assignments: [plan] }
    state.day = day
    state.job = job
  })
  afterEach(() => cleanup())

  it('the block editor lists the planned machine and the block wears its chip', async () => {
    renderWithProviders(
      <>
        <BlockMachinesRow jobId="job-1" day={today} userId="u1" />
        <BlockMachineChips jobId="job-1" day={today} />
      </>,
    )
    expect(await screen.findByText(/E-12 · Kubota KX040/)).toBeTruthy()
    expect(document.querySelector('[data-block-machine-chips="1"]')?.textContent).toContain('E-12 · Luis')
    fireEvent.click(screen.getByText('Remove'))
    expect(plans.removeAssignment).toHaveBeenCalledWith(plan)
  })

  it('the picker adds a machine not on the board yet from a template, ours or a rental, and plans it in one press', async () => {
    renderWithProviders(<BlockMachinesRow jobId="job-1" day={today} userId="u1" />)
    await screen.findByText(/E-12 · Kubota KX040/)
    fireEvent.click(screen.getByText('+ Add a machine'))
    fireEvent.click(screen.getByText('+ A machine not on the board yet'))
    expect(await screen.findByText(/stops before it runs/)).toBeTruthy()
    expect(document.querySelector('[data-template-blanks]')?.textContent).toBe('Fuel, Hydraulic oil, Engine oil and Coolant · 2 stops before it runs, 1 when leaving')
    const add = screen.getByText('Add it to this job') as HTMLButtonElement
    expect(add.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'E-14' } })
    fireEvent.change(screen.getByLabelText('Make'), { target: { value: 'Kubota' } })
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'KX057' } })
    fireEvent.click(screen.getByText('Add E-14 to this job'))
    await vi.waitFor(() => expect(plans.addAssignment).toHaveBeenCalledWith({ machineId: 'm-new', jobId: 'job-1', day: today, createdBy: 'u1' }))
    expect(fleet.addMachine).toHaveBeenCalledWith({ unitLabel: 'E-14', make: 'Kubota', model: 'KX057', templateId: 't1', kind: 'excavator' })
    expect(fleet.saveRental).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(document.querySelector('[data-machine-picker]')).toBeNull())

    fireEvent.click(screen.getByText('+ Add a machine'))
    fireEvent.click(screen.getByText('+ A machine not on the board yet'))
    fireEvent.change(await screen.findByLabelText('Template'), { target: { value: 't2' } })
    fireEvent.click(screen.getByText('Rental'))
    fireEvent.change(screen.getByLabelText('Rented from'), { target: { value: 'Sunbelt' } })
    fireEvent.change(screen.getByLabelText('Agreement number'), { target: { value: '48812-3' } })
    fireEvent.change(screen.getByLabelText('Make'), { target: { value: 'Bobcat' } })
    fireEvent.change(screen.getByLabelText('Due back'), { target: { value: '2026-11-20' } })
    fireEvent.click(screen.getByText('Add the Sunbelt rental to this job'))
    await vi.waitFor(() => expect(fleet.saveRental).toHaveBeenCalledWith('m-new', { from: 'Sunbelt', agreementNo: '48812-3', outOn: today, dueBack: '2026-11-20' }))
    expect(fleet.addMachine).toHaveBeenLastCalledWith({ unitLabel: 'Rental 48812-3', make: 'Bobcat', model: '', templateId: 't2', kind: 'skid_steer' })
  })

  it('the morning asks whether the planned machine is here, and Here opens the walk on this job', async () => {
    renderWithProviders(<MachineArrivalStop jobId="job-1" jobWords="972 · Test" userId="u1" byName="Mateo Ruiz" />)
    expect(await screen.findByText('Is E-12 here?')).toBeTruthy()
    expect(screen.getByText(/Luis Ortega brings it/)).toBeTruthy()
    fireEvent.click(screen.getByText('Here, check it'))
    await vi.waitFor(() => expect(checks.answerArrival).toHaveBeenCalledWith(plan, e12, 'here'))
    expect(await screen.findByText('Pre-use check · E-12')).toBeTruthy()
  })

  it('the rail draws the walk, then the leaving stop once it is signed, and the clock-out review lists the machine', async () => {
    const { unmount } = renderWithProviders(<RailMachineStops jobId="job-1" jobWords="972 · Test" day={today} userId="u1" byName="Mateo Ruiz" />)
    expect(await screen.findByText('Check E-12 before you run it')).toBeTruthy()
    expect(screen.queryByText(/Leaving E-12/)).toBeNull()
    unmount()
    const job: JobMachines = { machines: [{ ...e12, jobId: 'job-1', jobWords: '972 · Test' }], questions: [], checks: [signed], assignments: [plan] }
    state.job = job
    renderWithProviders(
      <>
        <RailMachineStops jobId="job-1" jobWords="972 · Test" day={today} userId="u1" byName="Mateo Ruiz" />
        <ClockOutMachinesStop jobId="job-1" jobWords="972 · Test" userId="u1" byName="Mateo Ruiz" />
      </>,
    )
    expect(await screen.findByText(/E-12 checked · Mateo Ruiz/)).toBeTruthy()
    expect(screen.getByText('Leaving E-12 · hours and fuel')).toBeTruthy()
    expect(document.querySelector('[data-clock-out-machine="none"]')?.textContent).toContain('Leaving E-12')
  })
})
