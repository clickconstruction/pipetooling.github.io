// @vitest-environment jsdom
/**
 * Render smoke for Expected Manpower, the section under the Schedule Dispatch
 * hub's People grid: the day picker, the headline, the job table with its
 * folds, the payroll estimate's gate, and what it draws when there is nothing.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { HubExpectedManpowerSection, type HubExpectedManpowerSectionProps } from './HubExpectedManpowerSection'
import type { JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { HUB_EXPECTED_MANPOWER_ALL_WEEK } from '../../lib/scheduleDispatchExpectedManpower'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

const DAYS = ['2026-09-28', '2026-09-29', '2026-09-30']
const MON = '2026-09-28'

function block(over: Partial<JobScheduleBlockRow>): JobScheduleBlockRow {
  return {
    id: 'blk',
    job_id: 'job-1',
    bid_id: null,
    assignee_user_id: 'abraham',
    work_date: MON,
    time_start: '08:00:00',
    time_end: '12:00:00',
    note: null,
    shared_block_group_id: null,
    created_by: null,
    created_at: '2026-09-25T15:00:00Z',
    updated_at: '2026-09-25T15:00:00Z',
    field_moved_at: null,
    field_moved_from: null,
    ...over,
  }
}

const WEEK = [
  block({ id: '1', assignee_user_id: 'abraham', job_id: 'job-1' }),
  block({ id: '2', assignee_user_id: 'paige', job_id: 'job-1', time_end: '16:00:00' }),
  block({ id: '3', assignee_user_id: 'abraham', job_id: 'job-2', time_start: '13:00:00', time_end: '15:00:00' }),
  block({ id: '4', assignee_user_id: 'paige', job_id: 'job-2', work_date: '2026-09-29' }),
]
const TITLES: Record<string, string> = { 'job-1': 'J927 · Berg AirBnb', 'job-2': 'J412 · Rough-in' }

function makeProps(over: Partial<HubExpectedManpowerSectionProps> = {}): HubExpectedManpowerSectionProps {
  return {
    show: true,
    hubWeekBlocks: WEEK,
    visibleDayKeys: DAYS,
    hubExpectedManpowerDayKey: MON,
    onHubExpectedManpowerDayChange: vi.fn(),
    getJobDisplayTitle: (id) => TITLES[id] ?? '— · Job',
    hubPeopleNameById: new Map([
      ['abraham', 'Abraham'],
      ['paige', 'Paige'],
    ]),
    canShowExpectedManpowerPayroll: false,
    hubHourlyWageByUserId: new Map(),
    onOpenJob: vi.fn(),
    scheduleTodayYmd: MON,
    ...over,
  }
}

const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
const panel = () => screen.getByRole('tabpanel')

describe('HubExpectedManpowerSection', () => {
  it('draws nothing while it is hidden or no day is visible', async () => {
    const hidden = renderWithProviders(<HubExpectedManpowerSection {...makeProps({ show: false })} />)
    await settle()
    expect(hidden.container.querySelector('section')).toBeNull()
    hidden.unmount()
    const noDays = renderWithProviders(<HubExpectedManpowerSection {...makeProps({ visibleDayKeys: [] })} />)
    await settle()
    expect(noDays.container.querySelector('section')).toBeNull()
  })

  it('offers a tab per visible day and All week, and reports the pick to the page', async () => {
    const onHubExpectedManpowerDayChange = vi.fn()
    renderWithProviders(<HubExpectedManpowerSection {...makeProps({ onHubExpectedManpowerDayChange })} />)
    await settle()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Mon (09/28)', 'Tue (09/29)', 'Wed (09/30)', 'All week'])
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false'])
    expect(tabs[0]?.getAttribute('title')).toBe('Today')
    fireEvent.click(tabs[1]!)
    expect(onHubExpectedManpowerDayChange).toHaveBeenLastCalledWith('2026-09-29')
    fireEvent.click(tabs[3]!)
    expect(onHubExpectedManpowerDayChange).toHaveBeenLastCalledWith(HUB_EXPECTED_MANPOWER_ALL_WEEK)
  })

  it('heads the day with its hours, jobs and people, and the week under the table', async () => {
    const { container } = renderWithProviders(<HubExpectedManpowerSection {...makeProps()} />)
    await settle()
    expect(text(panel())).toContain('Mon (09/28): 14 person-hours · 2 jobs · 2 people')
    expect(text(panel())).toContain('Scheduled by job (2)')
    expect(text(container)).toContain('This week: 18 person-hours')
  })

  it('lists each job with its hours and people, open, and opens the job on a click', async () => {
    const onOpenJob = vi.fn()
    renderWithProviders(<HubExpectedManpowerSection {...makeProps({ onOpenJob })} />)
    await settle()
    const job = screen.getByRole('button', { name: /^Open job J927 · Berg AirBnb, 12 person-hours, 2 people$/ })
    fireEvent.click(job)
    expect(onOpenJob).toHaveBeenCalledWith('job-1')
    const detail = screen.getByRole('region', { name: 'Scheduled assignees on J927 · Berg AirBnb' })
    const rows = within(detail).getAllByRole('row').map((r) => text(r))
    expect(rows[0]).toBe('PersonHoursWindow')
    expect(rows.slice(1).some((r) => r.startsWith('Abraham4'))).toBe(true)
    expect(rows.slice(1).some((r) => r.startsWith('Paige8'))).toBe(true)
  })

  it('folds one job, and folds the whole table', async () => {
    renderWithProviders(<HubExpectedManpowerSection {...makeProps()} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Hide assignees for J927 · Berg AirBnb' }))
    expect(screen.queryByRole('region', { name: 'Scheduled assignees on J927 · Berg AirBnb' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Scheduled assignees on J412 · Rough-in' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Show assignees for J927 · Berg AirBnb' })).toBeTruthy()

    const all = screen.getByRole('button', { name: 'Hide scheduled jobs for this day, 2 jobs' })
    fireEvent.click(all)
    expect(all.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('button', { name: 'Show scheduled jobs for this day, 2 jobs' })).toBeTruthy()
  })

  it('opens every job again when the day changes, and folds every job on All week', async () => {
    const view = renderWithProviders(<HubExpectedManpowerSection {...makeProps()} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Hide assignees for J927 · Berg AirBnb' }))

    view.rerender(<HubExpectedManpowerSection {...makeProps({ hubExpectedManpowerDayKey: '2026-09-29' })} />)
    await settle()
    expect(text(panel())).toContain('Tue (09/29): 4 person-hours · 1 job · 1 person')
    expect(screen.getByRole('region', { name: 'Scheduled assignees on J412 · Rough-in' })).toBeTruthy()

    view.rerender(
      <HubExpectedManpowerSection {...makeProps({ hubExpectedManpowerDayKey: HUB_EXPECTED_MANPOWER_ALL_WEEK })} />,
    )
    await settle()
    expect(text(panel())).toContain('person-hours · 2 jobs · 2 people')
    expect(screen.queryAllByRole('region', { name: /^Scheduled assignees on/ })).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Show assignees for J412 · Rough-in' }))
    const detail = screen.getByRole('region', { name: 'Scheduled assignees on J412 · Rough-in' })
    expect(text(within(detail).getAllByRole('row')[0]!)).toBe('DayPersonHoursWindow')
  })

  it('keeps what is folded while it is hidden', async () => {
    const view = renderWithProviders(<HubExpectedManpowerSection {...makeProps()} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Hide assignees for J927 · Berg AirBnb' }))
    view.rerender(<HubExpectedManpowerSection {...makeProps({ show: false })} />)
    await settle()
    expect(view.container.querySelector('section')).toBeNull()
    view.rerender(<HubExpectedManpowerSection {...makeProps()} />)
    await settle()
    expect(screen.getByRole('button', { name: 'Show assignees for J927 · Berg AirBnb' })).toBeTruthy()
  })

  it('shows the payroll estimate only to someone who may see it', async () => {
    const wages = new Map([
      ['abraham', 30],
      ['paige', 25],
    ])
    const view = renderWithProviders(<HubExpectedManpowerSection {...makeProps({ hubHourlyWageByUserId: wages })} />)
    await settle()
    expect(text(panel())).not.toContain('Est. $')
    view.rerender(
      <HubExpectedManpowerSection
        {...makeProps({ hubHourlyWageByUserId: wages, canShowExpectedManpowerPayroll: true })}
      />,
    )
    await settle()
    // Job 1: Abraham 4 h × $30 + Paige 8 h × $25.
    expect(text(panel())).toContain('Est. $320.00')
  })

  it('says so when the day has nothing scheduled', async () => {
    renderWithProviders(<HubExpectedManpowerSection {...makeProps({ hubExpectedManpowerDayKey: '2026-09-30' })} />)
    await settle()
    expect(text(panel())).toBe('No schedule blocks for Wed (09/30).')
  })

  it('draws the tabs and the week, and no panel content, when no day is picked', async () => {
    const { container } = renderWithProviders(
      <HubExpectedManpowerSection {...makeProps({ hubExpectedManpowerDayKey: null })} />,
    )
    await settle()
    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(text(panel())).toBe('')
    expect(text(container)).toContain('This week: 18 person-hours')
  })

  it('counts the hours hidden from a superintendent in the headline and the week', async () => {
    const hiddenBlockCounts = [{ user_id: 'cruz', day: MON, hidden_count: 1, hidden_hours: 6 }]
    const { container } = renderWithProviders(<HubExpectedManpowerSection {...makeProps({ hiddenBlockCounts })} />)
    await settle()
    expect(text(panel())).toContain(
      'Mon (09/28): 20 person-hours · 14 on your projects · 2 jobs · 2 people · 1 busy elsewhere',
    )
    expect(text(container)).toContain('This week: 24 person-hours · 18 on your projects')
  })

  it('says who is busy elsewhere when the day has nothing on the viewer’s projects', async () => {
    const hiddenBlockCounts = [{ user_id: 'cruz', day: '2026-09-30', hidden_count: 2, hidden_hours: 6 }]
    renderWithProviders(
      <HubExpectedManpowerSection {...makeProps({ hubExpectedManpowerDayKey: '2026-09-30', hiddenBlockCounts })} />,
    )
    await settle()
    expect(text(panel())).toBe(
      'No blocks on your projects for Wed (09/30) · 6 person-hours busy elsewhere (1 person)',
    )
  })
})
