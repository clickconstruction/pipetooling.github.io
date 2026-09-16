// @vitest-environment jsdom
/**
 * Render smoke for the Pipeline command bar (Stages tab decomposition PR 3): the buttons and
 * their gates, the search box's wiring and busy hints, the applied-filter chips (only the
 * applied ones render, tap clears, the hidden-groups chip opens the manage modal), and the
 * ⋯ menu slot.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { JobsStagesCommandBar, type JobsStagesCommandBarProps } from './JobsStagesCommandBar'

function props(overrides: Partial<JobsStagesCommandBarProps> = {}): JobsStagesCommandBarProps {
  return {
    onNewJob: vi.fn(),
    shortNewJobButtonLabel: false,
    followupQueueCount: 0,
    onOpenFollowups: vi.fn(),
    canSeeForecast: true,
    onOpenForecast: vi.fn(),
    query: '',
    onQueryChange: vi.fn(),
    includeScheduleTimeInSearch: true,
    scheduleSessionSearchBusy: false,
    serverSearchBusy: false,
    onOpenSessionNotes: vi.fn(),
    onJumpToNumber: vi.fn(() => true),
    filters: {
      sortMode: 'number',
      contract: '',
      gc: '',
      gcOptions: [{ id: 'gc-1', name: 'Knight Homes' }],
      development: '',
      developmentOptions: [],
      accountMan: '',
      accountManOptions: [],
      exclusionCount: 0,
    },
    onClearSort: vi.fn(),
    onClearContract: vi.fn(),
    onClearGc: vi.fn(),
    onClearDevelopment: vi.fn(),
    onClearAccountMan: vi.fn(),
    onOpenHideGroups: vi.fn(),
    toolsMenu: <button type="button">menu-slot</button>,
    ...overrides,
  }
}

describe('JobsStagesCommandBar', () => {
  it('renders the buttons, the search box, the session-notes chip and the menu slot for an office user', () => {
    const p = props({ followupQueueCount: 4 })
    render(<JobsStagesCommandBar {...p} />)
    fireEvent.click(screen.getByLabelText('New job'))
    expect(p.onNewJob).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByLabelText('Open job follow-ups — 4 outstanding'))
    expect(p.onOpenFollowups).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByLabelText('Payment forecast'))
    expect(p.onOpenForecast).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByLabelText('Session notes'))
    expect(p.onOpenSessionNotes).toHaveBeenCalledTimes(1)
    expect(screen.getByText('menu-slot')).toBeTruthy()
    expect(screen.getByText('New Job')).toBeTruthy()
  })

  it('hides Forecast and Session notes when not allowed, and shortens New Job on request', () => {
    render(<JobsStagesCommandBar {...props({ canSeeForecast: false, onOpenSessionNotes: null, shortNewJobButtonLabel: true })} />)
    expect(screen.queryByLabelText('Payment forecast')).toBeNull()
    expect(screen.queryByLabelText('Session notes')).toBeNull()
    expect(screen.getByText('New')).toBeTruthy()
  })

  it('wires the search box: placeholder follows the schedule toggle, typing reports, busy hints show', () => {
    const p = props({ scheduleSessionSearchBusy: true, serverSearchBusy: true })
    const { unmount } = render(<JobsStagesCommandBar {...p} />)
    const input = screen.getByPlaceholderText('Search HCP, name, address, schedule notes, or clock notes') as HTMLInputElement
    fireEvent.change(input, { target: { value: '878' } })
    expect(p.onQueryChange).toHaveBeenCalledWith('878')
    expect(input.getAttribute('aria-describedby')).toBe('stages-search-supplemental-desc')
    expect(screen.getByText('searching all jobs…')).toBeTruthy()
    expect(screen.getByText(/schedule & clock…/)).toBeTruthy()
    unmount()
    render(<JobsStagesCommandBar {...props({ includeScheduleTimeInSearch: false })} />)
    const plain = screen.getByPlaceholderText('Search HCP, name, address')
    expect(plain.getAttribute('aria-describedby')).toBeNull()
  })

  it('renders only the applied filter chips, each clearing on tap; hidden groups opens the manage modal', () => {
    const p = props({
      filters: {
        sortMode: 'progress',
        contract: 'missing',
        gc: 'gc-1',
        gcOptions: [{ id: 'gc-1', name: 'Knight Homes' }],
        development: '',
        developmentOptions: [],
        accountMan: '',
        accountManOptions: [],
        exclusionCount: 2,
      },
    })
    render(<JobsStagesCommandBar {...p} />)
    fireEvent.click(screen.getByLabelText(/^Sorted by .* — tap to restore job-number order$/))
    expect(p.onClearSort).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByLabelText(/^Clear contract filter/))
    expect(p.onClearContract).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByLabelText('Clear GC filter: Knight Homes'))
    expect(p.onClearGc).toHaveBeenCalledTimes(1)
    expect(screen.queryByLabelText(/^Clear development filter/)).toBeNull()
    expect(screen.queryByLabelText(/^Clear Account Man filter/)).toBeNull()
    fireEvent.click(screen.getByLabelText('2 groups hidden from the board — review'))
    expect(p.onOpenHideGroups).toHaveBeenCalledTimes(1)
  })

  it('renders no chips at all on the default filters', () => {
    render(<JobsStagesCommandBar {...props()} />)
    expect(screen.queryByLabelText(/tap to (clear|restore)|hidden from the board/)).toBeNull()
  })
})
