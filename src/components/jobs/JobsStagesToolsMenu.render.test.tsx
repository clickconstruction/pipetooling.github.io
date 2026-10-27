// @vitest-environment jsdom
/**
 * Render smoke for the Pipeline ⋯ tools menu (Stages tab decomposition PR 2): which items
 * each gate admits, that door items close the menu before opening their modal, that sort
 * and filter picks keep it open, and that the GC-notice item needs a real GC filter.
 */
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { JobsStagesToolsMenu, type JobsStagesToolsMenuProps } from './JobsStagesToolsMenu'

/** The Legal desk's row is a link to its page (v2.5990), so the menu draws inside a router. */
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: MemoryRouter })

function props(overrides: Partial<JobsStagesToolsMenuProps> = {}): JobsStagesToolsMenuProps {
  return {
    open: true,
    onOpenChange: vi.fn(),
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
    onSortModeChange: vi.fn(),
    onContractFilterChange: vi.fn(),
    onGcFilterChange: vi.fn(),
    onDevelopmentFilterChange: vi.fn(),
    onAccountManFilterChange: vi.fn(),
    gates: { lienDesk: true, legalDesk: true, jobContracts: true, officeTools: true, powerToggles: true },
    lienDeskCount: 3,
    legalDeskCount: 4,
    legalDeskTo: '/legal-desk',
    contractSweepCount: 2,
    onOpenLienDesk: vi.fn(),
    onPutGcOnNotice: vi.fn(),
    onOpenContractSweep: vi.fn(),
    onOpenHideGroups: vi.fn(),
    onOpenJobBook: vi.fn(),
    onOpenTotalByName: vi.fn(),
    onOpenCombineSeparate: vi.fn(),
    toggles: { includeScheduleTimeInSearch: true, followMoves: false, hamMode: false, editMode: false, mobileCards: false },
    onToggleIncludeScheduleTimeInSearch: vi.fn(),
    onToggleFollowMoves: vi.fn(),
    onToggleHamMode: vi.fn(),
    onToggleEditMode: vi.fn(),
    onToggleMobileCards: vi.fn(),
    ...overrides,
  }
}

describe('JobsStagesToolsMenu', () => {
  it('renders every item for a fully gated office user, with the counts', () => {
    render(<JobsStagesToolsMenu {...props()} />)
    for (const label of ['Lien desk', 'Legal desk', 'Contract sweep…', 'Hide groups…', 'Job Book…', 'Total by Name…', 'Combine / Separate…', 'Schedule & time in search', 'Follow cards I move', 'Ham mode', 'Edit mode', 'Mobile cards']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(screen.getByText('2 without')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    // v2.4532: the Lien desk row wears the gavel the stage bar and the ☰ menu wear.
    const lienRow = screen.getByText('Lien desk').closest('button')!
    expect(lienRow.querySelector<HTMLElement>('[data-tools-glyph]')?.dataset.toolsGlyph).toBe('gavel')
    expect(lienRow.textContent).not.toContain('⏱')
    expect(screen.getByLabelText('Pipeline tools').getAttribute('aria-expanded')).toBe('true')
  })

  it('hides the gated items when the gates are off, and renders nothing but the trigger when closed', () => {
    const { unmount } = render(
      <JobsStagesToolsMenu {...props({ gates: { lienDesk: false, legalDesk: false, jobContracts: false, officeTools: false, powerToggles: false } })} />,
    )
    for (const label of ['Lien desk', 'Legal desk', 'Contract sweep…', 'Job Book…', 'Combine / Separate…', 'Ham mode', 'Edit mode']) {
      expect(screen.queryByText(label)).toBeNull()
    }
    expect(screen.getByText('Total by Name…')).toBeTruthy()
    expect(screen.getByText('Mobile cards')).toBeTruthy()
    unmount()
    render(<JobsStagesToolsMenu {...props({ open: false })} />)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByLabelText('Pipeline tools').getAttribute('aria-expanded')).toBe('false')
  })

  it('the trigger asks to open; a door item closes the menu and opens its modal', () => {
    const p = props({ open: false })
    const { unmount } = render(<JobsStagesToolsMenu {...p} />)
    fireEvent.click(screen.getByLabelText('Pipeline tools'))
    expect(p.onOpenChange).toHaveBeenCalledWith(true)
    unmount()
    const q = props()
    render(<JobsStagesToolsMenu {...q} />)
    fireEvent.click(screen.getByText('Job Book…'))
    expect(q.onOpenChange).toHaveBeenCalledWith(false)
    expect(q.onOpenJobBook).toHaveBeenCalledTimes(1)
  })

  it('the Legal desk is a link to its page right under the Lien desk, with the firm’s count; a press closes the menu (v2.5990)', () => {
    const p = props()
    render(<JobsStagesToolsMenu {...p} />)
    const items = screen.getAllByRole('menuitem')
    const legal = items[items.findIndex((i) => i.textContent?.startsWith('Lien desk')) + 1]
    expect(legal.tagName).toBe('A')
    expect(legal.getAttribute('href')).toBe('/legal-desk')
    expect(legal.textContent).toBe('Legal desk4')
    expect(legal.querySelector<HTMLElement>('[data-tools-glyph]')?.dataset.toolsGlyph).toBe('scales')
    fireEvent.click(legal)
    expect(p.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('sort and filter picks report the choice and leave the menu open', () => {
    const p = props()
    render(<JobsStagesToolsMenu {...p} />)
    fireEvent.click(screen.getByRole('menuitemradio', { name: /progress|added/i }))
    expect(p.onSortModeChange).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByLabelText('Filter the Pipeline board by GC/Builder'), { target: { value: 'gc-1' } })
    expect(p.onGcFilterChange).toHaveBeenCalledWith('gc-1')
    fireEvent.change(screen.getByLabelText('Filter the Pipeline board by contract state'), { target: { value: 'missing' } })
    expect(p.onContractFilterChange).toHaveBeenCalledWith('missing')
    expect(p.onOpenChange).not.toHaveBeenCalled()
  })

  it('offers "Put <GC> on notice…" only while a real GC filter is applied', () => {
    const { unmount } = render(<JobsStagesToolsMenu {...props()} />)
    expect(screen.queryByText(/on notice…/)).toBeNull()
    unmount()
    const p = props({ filters: { ...props().filters, gc: 'gc-1' } })
    render(<JobsStagesToolsMenu {...p} />)
    fireEvent.click(screen.getByText('Put Knight Homes on notice…'))
    expect(p.onPutGcOnNotice).toHaveBeenCalledWith('gc-1')
    expect(p.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('toggles call their handlers and show On / Off', () => {
    const p = props()
    render(<JobsStagesToolsMenu {...p} />)
    fireEvent.click(screen.getByText('Follow cards I move'))
    expect(p.onToggleFollowMoves).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Mobile cards'))
    expect(p.onToggleMobileCards).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText('On').length).toBe(1)
    expect(screen.getAllByText('Off').length).toBe(4)
  })
})
