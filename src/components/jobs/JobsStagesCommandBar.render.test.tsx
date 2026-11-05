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
    onShowMap: null,
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
    onClearKind: vi.fn(),
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

  it('draws the Map button only while the map is hidden, right of the search box and its tools (v2.4518, moved v2.4522)', () => {
    const view = render(<JobsStagesCommandBar {...props()} />)
    expect(screen.queryByLabelText('Show the map')).toBeNull()
    const onShowMap = vi.fn()
    view.rerender(<JobsStagesCommandBar {...props({ onShowMap })} />)
    const map = screen.getByLabelText('Show the map')
    expect(map.textContent).toBe('Map')
    expect(screen.getByPlaceholderText(/^Search /).compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('menu-slot').compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(map.parentElement?.lastElementChild).toBe(map)
    fireEvent.click(map)
    expect(onShowMap).toHaveBeenCalledTimes(1)
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

  it('the job-kind filter reads as a chip that clears on tap (punch list #238)', () => {
    const p = props()
    p.filters = { ...p.filters, kind: 'unset' }
    render(<JobsStagesCommandBar {...p} />)
    fireEvent.click(screen.getByLabelText('Clear kind filter: Kind not set'))
    expect(p.onClearKind).toHaveBeenCalledTimes(1)
  })

  it('renders no chips at all on the default filters', () => {
    render(<JobsStagesCommandBar {...props()} />)
    expect(screen.queryByLabelText(/tap to (clear|restore)|hidden from the board/)).toBeNull()
    expect(screen.queryByTestId('stages-zz-test-jobs-chip')).toBeNull()
  })

  it('v2.6551 · the Checklist left chip counts the jobs with a question left, narrows on a tap and clears on the next (punch list #246, PR 2)', () => {
    const off = props({ filters: { ...props().filters, checklistLeft: { count: 4, on: false } }, onToggleChecklistLeft: vi.fn() })
    const { unmount } = render(<JobsStagesCommandBar {...off} />)
    const chip = screen.getByTestId('stages-checklist-left-chip')
    expect(chip.textContent).toBe('Checklist left · 4')
    expect(chip.getAttribute('aria-pressed')).toBe('false')
    expect(chip.getAttribute('aria-label')).toBe('Show only the 4 jobs with a question left on a stage checklist')
    fireEvent.click(chip)
    expect(off.onToggleChecklistLeft).toHaveBeenCalledTimes(1)
    unmount()
    const on = props({ filters: { ...props().filters, checklistLeft: { count: 4, on: true } }, onToggleChecklistLeft: vi.fn() })
    render(<JobsStagesCommandBar {...on} />)
    const pressed = screen.getByTestId('stages-checklist-left-chip')
    expect(pressed.getAttribute('aria-pressed')).toBe('true')
    expect(pressed.textContent).toBe('Checklist left · 4×')
    fireEvent.click(pressed)
    expect(on.onToggleChecklistLeft).toHaveBeenCalledTimes(1)
  })

  it('v2.6551 · no Checklist left chip while the board holds no job with a question left, or without the press', () => {
    const { unmount } = render(<JobsStagesCommandBar {...props({ filters: { ...props().filters, checklistLeft: null }, onToggleChecklistLeft: vi.fn() })} />)
    expect(screen.queryByTestId('stages-checklist-left-chip')).toBeNull()
    unmount()
    render(<JobsStagesCommandBar {...props({ filters: { ...props().filters, checklistLeft: { count: 2, on: false } } })} />)
    expect(screen.queryByTestId('stages-checklist-left-chip')).toBeNull()
  })

  it('a dev’s ZZ test jobs chip: quiet with the count while hidden, amber while shown; either opens Hide groups (punch list #61)', () => {
    const base = props().filters
    const hidden = props({ filters: { ...base, zzTestJobs: { count: 3, shown: false } } })
    const { unmount } = render(<JobsStagesCommandBar {...hidden} />)
    const chip = screen.getByTestId('stages-zz-test-jobs-chip')
    expect(chip.textContent).toBe('3 ZZ test jobs hidden')
    expect(chip.style.background).toBe('var(--surface)')
    fireEvent.click(chip)
    expect(hidden.onOpenHideGroups).toHaveBeenCalledTimes(1)
    unmount()
    render(<JobsStagesCommandBar {...props({ filters: { ...base, zzTestJobs: { count: 1, shown: true } } })} />)
    const shown = screen.getByTestId('stages-zz-test-jobs-chip')
    expect(shown.textContent).toBe('ZZ test jobs shown')
    expect(shown.style.background).toBe('var(--bg-amber-100)')
  })
})
