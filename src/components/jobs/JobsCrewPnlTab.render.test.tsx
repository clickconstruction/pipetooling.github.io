// @vitest-environment jsdom
/**
 * Wiring smoke for Jobs → Crew P&L's Vehicle part (Wheels PR 3, v2.5039): the tab reads the deals'
 * fixed rates off People → Vehicles and the office job, prices each person's field hours, nets the
 * part out of profit and says how. The kernel's suite holds the arithmetic. Supabase is stubbed
 * empty, so the roster is empty and rows key on names.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const loadWheelsFixedRates = vi.fn()
vi.mock('../../lib/people/wheelsData', () => ({ loadWheelsFixedRates: (input: unknown) => loadWheelsFixedRates(input) }))
vi.mock('../../lib/overheadOfficeJobSettings', () => ({ fetchOverheadOfficeJobLedgerIdFromAppSettings: async () => 'office' }))

import JobsCrewPnlTab from './JobsCrewPnlTab'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { TeamLaborRow } from '../../utils/teamLabor'

const labor = (jobId: string, personName: string, hours: number, cost: number): TeamLaborRow => ({
  jobId,
  hcpNumber: jobId,
  jobName: jobId,
  jobAddress: '',
  people: [personName],
  manHours: hours,
  jobCost: cost,
  breakdown: [{ personName, hours, cost, byWorkDate: [{ workDate: '2026-09-01', hours, cost }] }],
})
// Mike: 8 h on a job and 3 h on the office job; Ana: 4 h on a job.
const teamLaborData = [labor('j1', 'Mike Z', 8, 240), labor('office', 'Mike Z', 3, 90), labor('j2', 'Ana', 4, 100)]
const wheelsRow = (name: string, arrangement: string, fixedRate: number | null) => ({ userId: null, name, arrangement, fixedRate })

function renderTab() {
  return renderWithProviders(
    <JobsCrewPnlTab jobs={[]} laborJobs={[]} teamLaborData={teamLaborData} loading={false} driveMileageCost={null} driveTimePerMile={null} onOpenJobDetail={vi.fn()} />,
  )
}

beforeEach(() => {
  loadWheelsFixedRates.mockReset()
})

describe('JobsCrewPnlTab · the Vehicle part (v2.5039)', () => {
  it('prices each deal’s field hours, the office job left out, and nets it out of profit', async () => {
    loadWheelsFixedRates.mockResolvedValue({ window: { start: '2026-07-12', end: '2026-10-09', days: 90 }, rows: [wheelsRow('Mike Z', 'company', 5.91), wheelsRow('Ana', 'none', 2.5)] })
    renderTab()
    await settle()
    expect(loadWheelsFixedRates).toHaveBeenCalledWith(expect.objectContaining({ users: [] }))
    expect(screen.getByRole('columnheader', { name: 'Vehicle' })).toBeTruthy()
    const mike = screen.getByText('Mike Z').closest('tr')!
    // 8 field h × $5.91 = $47.28; profit −$330 labor − $47.28 vehicle with no billing
    expect(within(mike).getByText('$47.28').getAttribute('title')).toBe('$5.91/field h × 8 field h')
    expect(within(mike).getByText('−$377.28')).toBeTruthy()
    // Ana's deal is None: Review charges her no vehicle, so neither does Crew P&L
    const ana = screen.getByText('Ana').closest('tr')!
    expect(within(ana).getByText('−$100.00')).toBeTruthy()
    expect(screen.getByTestId('crew-pnl-vehicle-total').textContent).toBe('$47.28')
    expect(screen.getByTestId('crew-pnl-vehicle-note').textContent).toContain('over 2026-07-12 to 2026-10-09')
  })

  it('a failed rates read still loads the table, with no Vehicle part, and says so', async () => {
    loadWheelsFixedRates.mockRejectedValue(new Error('offline'))
    renderTab()
    await settle()
    const mike = screen.getByText('Mike Z').closest('tr')!
    expect(within(mike).getByText('−$330.00')).toBeTruthy()
    expect(screen.getByTestId('crew-pnl-vehicle-total').textContent).toBe('—')
    expect(screen.getByTestId('crew-pnl-vehicle-note').textContent).toContain('could not be read')
  })
})
