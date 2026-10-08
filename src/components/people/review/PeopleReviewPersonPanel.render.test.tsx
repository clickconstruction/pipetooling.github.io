// @vitest-environment jsdom
/**
 * People → Review: the per-person panel (punch list #46 row 8, the Review map's step 8), moved out
 * of PeopleReviewTab with its state and loader. These cases pin what the tab did: nothing loads
 * with nobody selected; a selection, a person switch, a reselect after clearing and a new roster
 * each load; Jobs Worked's collapse survives a switch to another person (the tab never reset it);
 * a slower load for the person before never lands over the person now shown; a failed load says
 * so and Retry loads again. The loader is a stand-in; made-up people and jobs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'

vi.mock('../../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})
type Loaded = Awaited<ReturnType<typeof import('../../../lib/people/loadReviewPersonData').loadReviewPersonData>>
const calls: Array<{ personName: string; resolve: (d: Loaded) => void; reject: (e: unknown) => void }> = []
vi.mock('../../../lib/people/loadReviewPersonData', () => ({
  loadReviewPersonData: (input: { personName: string }) =>
    new Promise<Loaded>((resolve, reject) => { calls.push({ personName: input.personName, resolve, reject }) }),
}))

import { PeopleReviewPersonPanel } from './PeopleReviewPersonPanel'
import { EMPTY_REVIEW_OVERHEAD_RATES } from '../../../lib/people/loadReviewOverheadRates'
import { renderWithProviders, settle } from '../../../test/renderSmokeMocks'
import type { ReviewLaborJob } from '../../../lib/people/reviewPersonTypes'

type Props = ComponentProps<typeof PeopleReviewPersonPanel>

const laborJob = (jobName: string): ReviewLaborJob => ({
  source: 'labor', id: `l-${jobName}`, job_date: '2026-10-01', address: '1 Elm St', hoursInfo: '', job_number: '101', click_number: null,
  job_id: `job-${jobName}`, job_name: jobName, service_type_id: null, hours: 8, laborCost: 400, driveCost: 0, partsCost: 0, totalBill: 1000,
  valueCreated: 500, pctComplete: 50, revenueBeforeOverhead: 100, allocatedTotalBill: 200, allocatedRevenueBeforeOverhead: 50,
  allocatedPartsCost: 0, subLaborCost: 0, totalLaborOnJob: 400, totalDriveCostOnJob: 0, totalJobHours: 8, userTotalHoursOnJob: 8,
  userTotalContributionToBill: 200, userTotalContributionToRevenue: 50, userTotalLaborOnJob: 400, userTotalDriveCostOnJob: 0,
})
const data = (jobName: string): Loaded => ({
  laborJobs: [laborJob(jobName)], crewJobs: [], allocatedRevenue: 200, allocatedProfit: 50, hours: [], reports: [], tasks: [], outstandingTasks: [], laborByJobAndPerson: {},
})

const roster = ['Ann', 'Ben']
function props(over: Partial<Props> = {}): Props {
  return {
    selectedPersonName: undefined,
    hasSelection: false,
    roster,
    payConfig: {},
    people: [],
    users: [],
    period: 'last_30_days',
    customRangeStart: '',
    customRangeEnd: '',
    onlyPaidInFull: false,
    reviewView: 'table',
    overheadRates: EMPTY_REVIEW_OVERHEAD_RATES,
    teamSummaryBreakdowns: [],
    getDaysInRange: () => [],
    ...over,
  }
}
const pick = (name: string) => props({ selectedPersonName: name, hasSelection: true })

async function finish(i: number, d: Loaded) {
  await act(async () => { calls[i]!.resolve(d) })
  await settle()
}

describe('PeopleReviewPersonPanel', () => {
  beforeEach(() => { calls.length = 0 })
  afterEach(cleanup)

  it('with nobody selected draws nothing and loads nothing', async () => {
    const { container } = renderWithProviders(<PeopleReviewPersonPanel {...props()} />)
    await settle()
    expect(container.innerHTML).toBe('')
    expect(calls).toHaveLength(0)
  })

  it('loads the selected person and draws their jobs', async () => {
    renderWithProviders(<PeopleReviewPersonPanel {...pick('Ann')} />)
    await settle()
    expect(calls.map((c) => c.personName)).toEqual(['Ann'])
    expect(screen.getByText('Loading…')).toBeTruthy()
    await finish(0, data('Elm St'))
    expect(screen.getByText(/Jobs Worked \(1\)/)).toBeTruthy()
    expect(screen.getByText('Elm St')).toBeTruthy()
  })

  it('keeps Jobs Worked collapsed through a switch to another person, as the tab did', async () => {
    const view = renderWithProviders(<PeopleReviewPersonPanel {...pick('Ann')} />)
    await settle()
    await finish(0, data('Elm St'))
    fireEvent.click(screen.getByRole('button', { name: /Jobs Worked/ }))
    expect(screen.getByText('This Labor / total job labor:')).toBeTruthy()
    view.rerender(<PeopleReviewPersonPanel {...pick('Ben')} />)
    await settle()
    expect(calls.map((c) => c.personName)).toEqual(['Ann', 'Ben'])
    await finish(1, data('Oak Ave'))
    expect(screen.getByText('This Labor / total job labor:')).toBeTruthy()
  })

  it('a slower load for the person before never lands over the person now shown', async () => {
    const view = renderWithProviders(<PeopleReviewPersonPanel {...pick('Ann')} />)
    await settle()
    view.rerender(<PeopleReviewPersonPanel {...pick('Ben')} />)
    await settle()
    await finish(1, data('Oak Ave'))
    await finish(0, data('Elm St'))
    expect(screen.getByText('Oak Ave')).toBeTruthy()
    expect(screen.queryByText('Elm St')).toBeNull()
  })

  it('loads again on a reselect after clearing, and on a new roster', async () => {
    const view = renderWithProviders(<PeopleReviewPersonPanel {...pick('Ann')} />)
    await settle()
    view.rerender(<PeopleReviewPersonPanel {...props()} />)
    await settle()
    expect(calls).toHaveLength(1)
    view.rerender(<PeopleReviewPersonPanel {...pick('Ann')} />)
    await settle()
    expect(calls).toHaveLength(2)
    view.rerender(<PeopleReviewPersonPanel {...pick('Ann')} roster={['Ann', 'Ben', 'Cy']} />)
    await settle()
    expect(calls.map((c) => c.personName)).toEqual(['Ann', 'Ann', 'Ann'])
  })

  it('a failed load says so, and Retry loads again', async () => {
    renderWithProviders(<PeopleReviewPersonPanel {...pick('Ann')} />)
    await settle()
    await act(async () => { calls[0]!.reject(new Error('read failed')) })
    await settle()
    expect(screen.getByText(/Failed to load review data: read failed/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await settle()
    expect(calls.map((c) => c.personName)).toEqual(['Ann', 'Ann'])
  })
})
