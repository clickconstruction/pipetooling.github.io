// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders, useAuthModuleMock } from '../../test/renderSmokeMocks'
import { defaultLevels, todayDay, type Machine, type MachineAssignment, type MachineCheck } from '../../lib/machines/machines'
import type { DayPlan } from '../../lib/machines/assignmentsIo'
import type { JobMachines } from '../../lib/machines/checksIo'
import { BlockMachineChips, BlockMachinesRow, ClockOutMachinesStop, MachineArrivalStop, RailMachineStops } from './MachineStops'

vi.mock('../../hooks/useAuth', () => useAuthModuleMock({ profileName: 'Mateo Ruiz' }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ or: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) }) } }))

const today = todayDay()
const e12: Machine = { id: 'm1', unitLabel: 'E-12', make: 'Kubota', model: 'KX040', kind: 'excavator', templateId: 't1', code: 'E12KX040', jobId: null, jobWords: null, heldSince: null, levels: defaultLevels('excavator'), rental: null, driveLink: null }
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
}))
vi.mock('../../lib/machines/checksIo', () => checks)

describe('the machine stops on a job’s day', () => {
  beforeEach(() => {
    const day: DayPlan = { day: today, machines: [e12], assignments: [plan], checks: [] }
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
