// @vitest-environment jsdom
/**
 * Render-smoke test for the v2.991 sticky-header wiring. jsdom doesn't lay out
 * `position: sticky`, so this asserts the two structural facts the pinning
 * depends on — the × sits in a bar that is sticky at `top: 0`, and the panel
 * that scrolls carries no top padding of its own (a padded scroller leaves a
 * strip where content shows through above the pinned bar).
 *
 * ReportViewModal stands in for the whole family: same helper, same shape.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

import ReportViewModal, { type ReportForView } from './ReportViewModal'
import { renderWithProviders } from '../test/renderSmokeMocks'

// The modal's scroll lock restores the page offset on unmount; jsdom's
// window.scrollTo is a "not implemented" stub that shouts into the console.
beforeAll(() => {
  vi.stubGlobal('scrollTo', vi.fn())
})

const report: ReportForView = {
  id: 'r-1',
  template_name: 'Daily Report',
  job_display_name: 'HCP-12 Kitchen rough-in',
  created_at: '2026-07-24T15:00:00Z',
  created_by_name: 'Tech One',
  field_values: { notes: 'Set the closet flange.' },
}

function renderModal() {
  renderWithProviders(
    <ReportViewModal open report={report} onClose={vi.fn()} viewerRole="master_technician" />,
  )
  const closeButton = screen.getByRole('button', { name: 'Close' })
  const titleBar = closeButton.parentElement as HTMLElement
  const panel = titleBar.parentElement as HTMLElement
  return { closeButton, titleBar, panel }
}

describe('ReportViewModal sticky header', () => {
  it('keeps the × in a bar pinned to the top of the scrolling panel', () => {
    const { titleBar, panel } = renderModal()
    expect(titleBar.style.position).toBe('sticky')
    expect(titleBar.style.top).toBe('0px')
    // Opaque, or rows scrolling underneath show through the bar.
    expect(titleBar.style.background).toBe('var(--surface)')
    expect(panel.style.overflow).toBe('auto')
  })

  it('leaves the panel no top padding — the inset lives on the bar', () => {
    const { titleBar, panel } = renderModal()
    expect(panel.style.paddingTop).toBe('0px')
    expect(titleBar.style.paddingTop).toBe('1.5rem')
  })

  it('never floors the panel wider than a 375px phone', () => {
    const { panel } = renderModal()
    expect(panel.style.minWidth).toBe('')
    expect(panel.style.width).toBe('min(560px, 100%)')
    expect(panel.style.boxSizing).toBe('border-box')
  })

  it('gives the × a 44px tap target', () => {
    const { closeButton } = renderModal()
    expect(closeButton.style.minWidth).toBe('44px')
    expect(closeButton.style.minHeight).toBe('44px')
  })
})
