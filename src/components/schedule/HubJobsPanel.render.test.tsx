// @vitest-environment jsdom
/**
 * Render smoke for the Schedule Dispatch hub's Jobs tab: the job and bid rows
 * against the visible days, the search and the two filters, the two empty
 * states, the error lines, and the phone toolbar that folds the filters away.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))
const phone = vi.hoisted(() => ({ isMobile: false }))
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => phone.isMobile }))

import { HubJobsPanel, type HubJobsPanelProps } from './HubJobsPanel'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

const DAYS = ['2026-09-28', '2026-09-29', '2026-09-30']

const ROWS: HubJobsPanelProps['rows'] = [
  {
    id: 'job-1',
    hcp_number: '927',
    job_name: 'Berg AirBnb',
    project_id: null,
    displayTitle: 'J927 · Berg AirBnb',
    totalBlocks: 3,
    byDay: { '2026-09-28': 2, '2026-09-30': 1 },
  },
  {
    id: 'job-2',
    hcp_number: '412',
    job_name: 'Rough-in',
    project_id: null,
    displayTitle: 'J412 · Rough-in',
    totalBlocks: 0,
    byDay: {},
  },
]
const BID_ROWS: HubJobsPanelProps['bidRows'] = [
  { id: 'bid:bid-9', displayTitle: 'Bid visit · B375 · Tower West', totalBlocks: 1, byDay: { '2026-09-29': 1 } },
]

function makeProps(over: Partial<HubJobsPanelProps> = {}): HubJobsPanelProps {
  return {
    rows: ROWS,
    bidRows: BID_ROWS,
    loading: false,
    jobsError: null,
    summariesError: null,
    visibleDayKeys: DAYS,
    hideWeekend: true,
    onHideWeekendChange: vi.fn(),
    onOpenJob: vi.fn(),
    scheduleTodayYmd: '2026-09-28',
    columnFocusDayYmd: '',
    columnScrollKey: 'k',
    ...over,
  }
}

const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1).map((r) => text(r))

beforeEach(() => {
  phone.isMobile = false
})

describe('HubJobsPanel', () => {
  it('heads a column per visible day, the weekday over the date', async () => {
    renderWithProviders(<HubJobsPanel {...makeProps()} />)
    await settle()
    const heads = within(screen.getByRole('table')).getAllByRole('columnheader').map((h) => text(h))
    expect(heads).toEqual(['Job', 'Total', 'Mon(09/28)', 'Tue(09/29)', 'Wed(09/30)', ''])
  })

  it('lists the jobs with a block this week, then the bid visits, a count or a dash per day', async () => {
    renderWithProviders(<HubJobsPanel {...makeProps()} />)
    await settle()
    expect(bodyRows()).toEqual(['J927 · Berg AirBnb32—1Open', 'Bid visit · B375 · Tower West1—1—Open'])
  })

  it('lists every job once "only jobs with blocks" is unticked', async () => {
    renderWithProviders(<HubJobsPanel {...makeProps()} />)
    await settle()
    fireEvent.click(screen.getByLabelText('Only jobs with blocks this week'))
    expect(bodyRows()).toEqual([
      'J927 · Berg AirBnb32—1Open',
      'J412 · Rough-in0———Open',
      'Bid visit · B375 · Tower West1—1—Open',
    ])
  })

  it('narrows both the jobs and the bid visits to the search', async () => {
    renderWithProviders(<HubJobsPanel {...makeProps()} />)
    await settle()
    const search = screen.getByRole('searchbox', { name: 'Search HCP or job name' })
    fireEvent.change(search, { target: { value: 'tower' } })
    expect(bodyRows()).toEqual(['Bid visit · B375 · Tower West1—1—Open'])
    fireEvent.change(search, { target: { value: 'berg' } })
    expect(bodyRows()).toEqual(['J927 · Berg AirBnb32—1Open'])
  })

  it('says nothing matches when the search or the filter leaves no rows', async () => {
    renderWithProviders(<HubJobsPanel {...makeProps({ bidRows: [] })} />)
    await settle()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search HCP or job name' }), { target: { value: 'rough' } })
    expect(bodyRows()).toEqual(['No jobs match your search or filter.'])
  })

  it('says there are no jobs when there are none at all', async () => {
    renderWithProviders(<HubJobsPanel {...makeProps({ rows: [], bidRows: [] })} />)
    await settle()
    expect(bodyRows()).toEqual(['No jobs to show.'])
  })

  it('opens a job from its title or its button, and a bid visit by its bid: anchor', async () => {
    const onOpenJob = vi.fn()
    renderWithProviders(<HubJobsPanel {...makeProps({ onOpenJob })} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'J927 · Berg AirBnb' }))
    expect(onOpenJob).toHaveBeenLastCalledWith('job-1')
    const opens = screen.getAllByRole('button', { name: 'Open' })
    fireEvent.click(opens[0]!)
    expect(onOpenJob).toHaveBeenLastCalledWith('job-1')
    fireEvent.click(opens[1]!)
    expect(onOpenJob).toHaveBeenLastCalledWith('bid:bid-9')
    expect(opens[1]?.getAttribute('title')).toBe('Open the bid (Edit Bid)')
  })

  it('reports the weekend toggle to the page', async () => {
    const onHideWeekendChange = vi.fn()
    renderWithProviders(<HubJobsPanel {...makeProps({ onHideWeekendChange })} />)
    await settle()
    const box = screen.getByLabelText('Hide Saturday and Sunday columns') as HTMLInputElement
    expect(box.checked).toBe(true)
    fireEvent.click(box)
    expect(onHideWeekendChange).toHaveBeenCalledWith(false)
  })

  it('shows the two load errors above the table', async () => {
    const { container } = renderWithProviders(
      <HubJobsPanel {...makeProps({ jobsError: 'Could not load jobs.', summariesError: 'timeout' })} />,
    )
    await settle()
    expect(text(container)).toContain('Could not load jobs.')
    expect(text(container)).toContain('Could not load schedule counts for this week (timeout). Counts shown as 0.')
  })

  it('says Loading… and holds the empty line while the week loads', async () => {
    const { container } = renderWithProviders(<HubJobsPanel {...makeProps({ rows: [], bidRows: [], loading: true })} />)
    await settle()
    expect(text(container)).toContain('Loading…')
    expect(bodyRows()).toEqual([])
  })

  it('on a phone, folds the search behind a magnifier and the two filters into View', async () => {
    phone.isMobile = true
    const onHideWeekendChange = vi.fn()
    renderWithProviders(<HubJobsPanel {...makeProps({ onHideWeekendChange })} />)
    await settle()
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.queryByLabelText('Only jobs with blocks this week')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Search HCP or job name' }))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search HCP or job name' }), { target: { value: 'tower' } })
    expect(bodyRows()).toEqual(['Bid visit · B375 · Tower West1—1—Open'])
    fireEvent.click(screen.getByRole('button', { name: 'Clear search and close' }))
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(bodyRows()).toHaveLength(2)

    const view = screen.getByRole('button', { name: 'View options: only jobs with blocks, hide weekend' })
    fireEvent.click(view)
    expect(view.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getByLabelText('Only jobs with blocks this week'))
    expect(bodyRows()).toHaveLength(3)
    fireEvent.click(screen.getByLabelText('Hide Saturday and Sunday columns'))
    expect(onHideWeekendChange).toHaveBeenCalledWith(false)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(view.getAttribute('aria-expanded')).toBe('false')
  })
})
