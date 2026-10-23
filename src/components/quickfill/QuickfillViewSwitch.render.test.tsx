// @vitest-environment jsdom
/** Render smoke for the Quickfill view switch (punch list #147, v2.5778). */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QuickfillViewSwitch } from './QuickfillViewSwitch'

describe('QuickfillViewSwitch', () => {
  it('shows every view, presses the chosen one and reports a press', () => {
    const onChange = vi.fn()
    render(<QuickfillViewSwitch view="focus" onChange={onChange} />)
    const page = screen.getByRole('button', { name: 'Page' })
    const focus = screen.getByRole('button', { name: 'Focus' })
    expect(focus.getAttribute('aria-pressed')).toBe('true')
    expect(page.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(page)
    expect(onChange).toHaveBeenCalledWith('page')
  })
})
