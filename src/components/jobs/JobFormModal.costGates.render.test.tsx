// @vitest-environment jsdom
/**
 * Edit Job's cost gates, on the form itself (the Job form map's second pass, cut 1). The rules are
 * `lib/jobs/jobFormCostGates.ts` and have their own tests; this pins the wiring: what the form's three cost
 * loads read is what decides Delete against Reassign in the delete window, and which labor line on the Costs
 * table says *Open on Jobs →*. The two cost hooks are stand-ins a case sets before it opens the job.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'

const seat = vi.hoisted(() => ({ role: 'dev', values: new Map<string, unknown>() }))
const db = vi.hoisted(() => ({ job: null as unknown }))
const labor = vi.hoisted(() => ({
  value: {
    editJobTeamLaborLoading: false,
    editJobTeamLaborRow: null as unknown,
    editJobTeamLaborError: false,
    editJobSubLaborLoading: false,
    editJobSubLaborData: null as { count: number; total: number } | null,
    editJobSubLaborError: false,
  },
}))
const snapshot = vi.hoisted(() => ({
  value: {
    materialsAccordionOpen: 'billed' as string | null,
    jobMaterialsSnapshotLoading: false,
    supplyInvoiceTotal: 0,
    supplyInvoiceRpcFailed: false,
    supplyInvoiceLines: [] as unknown[],
    mercuryAllocLines: [] as unknown[],
    mercuryFetchFailed: false,
    mercuryCardExclusions: undefined,
    mercuryCardCostLines: [] as unknown[],
    mercuryCardTagByTxId: undefined,
    tallyPartLines: [] as unknown[],
    tallyFetchFailed: false,
    mercuryCardTotal: 0,
    tallyPartsTotal: 0,
    toggleMaterialsAccordion: () => {},
  },
}))

vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  // One value per role, so the form's effects keyed on the signed-in user see a steady object.
  const value = () => {
    if (!seat.values.has(seat.role)) seat.values.set(seat.role, makeUseAuthValue({ role: seat.role }))
    return seat.values.get(seat.role)
  }
  return { useAuth: value, useOptionalAuth: value, AuthProvider: ({ children }: { children: unknown }) => children }
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: async () => db.job }))
vi.mock('../../hooks/useJobFormLabor', () => ({ useJobFormLabor: () => labor.value }))
vi.mock('./useJobCostSnapshot', () => ({ useJobCostSnapshot: () => snapshot.value }))

import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import JobFormModal from './JobFormModal'
import { moneyText } from '../../test/moneyText'

const cleanLabor = { ...labor.value }
const cleanSnapshot = { ...snapshot.value }
const teamRow = (jobCost: number, manHours: number) => ({ jobId: 'job-cedar', hcpNumber: '940', jobName: 'Cedar Bend', jobAddress: '', people: ['Sam'], manHours, jobCost, breakdown: [] })

beforeEach(() => {
  seat.role = 'dev'
  labor.value = { ...cleanLabor }
  snapshot.value = { ...cleanSnapshot }
})

async function openCedarBend(job: Record<string, unknown> = {}) {
  db.job = makeJob({ id: 'job-cedar', hcp_number: '940', job_name: 'Cedar Bend', status: 'working', ...job })
  renderWithProviders(
    <JobFormModal mode="edit" editJobId="job-cedar" initialJob={null} billingCustomerHighlightInitial={false} fixturesSectionHighlightInitial={false} jobPicturesLinkHighlightInitial={false} alsoOpenCreateCustomerModal={false} onClose={vi.fn()} onSaved={null} />,
  )
  await settle()
  await screen.findByDisplayValue('Cedar Bend')
}

/** Press the footer's Delete and hand back the delete window. */
async function openDeleteWindow() {
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  const title = await screen.findByText('Delete job from Billing?')
  return within(title.parentElement as HTMLElement)
}

describe('Edit Job: Delete against Reassign follows the cost loads', () => {
  it('a job with no cost and every read back offers a plain Delete', async () => {
    await openCedarBend()
    const win = await openDeleteWindow()
    expect(win.getByRole('button', { name: 'Delete' })).toBeTruthy()
    expect(win.queryByRole('button', { name: 'Reassign to another job…' })).toBeNull()
    expect(win.queryByText('This job has costs attached')).toBeNull()
  })

  it('team labor on the job turns Delete into Reassign and lists it', async () => {
    labor.value = { ...cleanLabor, editJobTeamLaborRow: teamRow(320, 8) }
    await openCedarBend()
    const win = await openDeleteWindow()
    expect(win.getByText('This job has costs attached')).toBeTruthy()
    expect(win.getByText(moneyText(/Team labor \(est\.\): \$320\.00/))).toBeTruthy()
    expect(win.getByRole('button', { name: 'Reassign to another job…' })).toBeTruthy()
    expect(win.queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  it('parts and the job’s own charges are summed into the window’s two lines', async () => {
    snapshot.value = { ...cleanSnapshot, supplyInvoiceTotal: 100, tallyPartLines: [{ id: 't1', fixtureName: 'Lav', quantity: 1, partName: 'P-trap', lineTotal: 40.5, createdAt: null, createdByName: null }] }
    await openCedarBend({ materials: [{ id: 'm1', description: 'Permit', amount: 125, charged_on: null, memo: null }] })
    const win = await openDeleteWindow()
    expect(win.getByText(moneyText(/supply invoices: \$140\.50/))).toBeTruthy()
    expect(win.getByText(moneyText('Billed materials: $125.00'))).toBeTruthy()
    expect(win.getByRole('button', { name: 'Reassign to another job…' })).toBeTruthy()
  })

  it('a cost read that failed on a job showing no cost still forces Reassign, and says why', async () => {
    snapshot.value = { ...cleanSnapshot, tallyFetchFailed: true }
    await openCedarBend()
    const win = await openDeleteWindow()
    expect(win.getByText(/Couldn’t verify this job’s costs/)).toBeTruthy()
    expect(win.queryByText('This job has costs attached')).toBeNull()
    expect(win.getByRole('button', { name: 'Reassign to another job…' })).toBeTruthy()
    expect(win.queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  it('a cost read still in flight holds the press as Checking costs…', async () => {
    labor.value = { ...cleanLabor, editJobSubLaborLoading: true }
    await openCedarBend()
    const win = await openDeleteWindow()
    const checking = win.getByRole('button', { name: 'Checking costs…' }) as HTMLButtonElement
    expect(checking.disabled).toBe(true)
    expect(win.queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(win.queryByRole('button', { name: 'Reassign to another job…' })).toBeNull()
  })
})

describe('Edit Job: the Costs table’s labor lines open on Jobs by role and by what loaded', () => {
  const withLabor = () => {
    labor.value = { ...cleanLabor, editJobTeamLaborRow: teamRow(320, 8), editJobSubLaborData: { count: 2, total: 900 } }
  }
  const door = (key: 'team' | 'sub') => within(screen.getByTestId(`money-row-${key}`)).queryByText('Open on Jobs →')

  it('a dev gets the door on both labor lines', async () => {
    withLabor()
    await openCedarBend()
    expect(door('team')).toBeTruthy()
    expect(door('sub')).toBeTruthy()
  })

  it('the office gets the sub door and not the team one', async () => {
    seat.role = 'assistant'
    withLabor()
    await openCedarBend()
    expect(door('team')).toBeNull()
    expect(door('sub')).toBeTruthy()
  })

  it('no sheet on the job and no team row: neither line opens', async () => {
    labor.value = { ...cleanLabor, editJobSubLaborData: { count: 0, total: 0 } }
    await openCedarBend()
    expect(door('team')).toBeNull()
    expect(door('sub')).toBeNull()
  })

  it('the sub door reads the number typed in the form: a job with none saved and none typed has no door', async () => {
    withLabor()
    await openCedarBend({ hcp_number: '' })
    expect(door('team')).toBeTruthy()
    expect(door('sub')).toBeNull()
  })
})
