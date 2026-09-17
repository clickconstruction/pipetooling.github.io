// @vitest-environment jsdom
/**
 * Render smoke for the Pipeline jump strip (Stages tab decomposition PR 4): four sections
 * always, Collections only while it has rows, the aria-label nouns, the arrows between
 * neighbours, and the click → section key.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { JobsStagesJumpStrip } from './JobsStagesJumpStrip'

const counts = { waiting: '21', working: '33', readyToBill: '0', billed: '66', collections: '0' }

describe('JobsStagesJumpStrip', () => {
  it('renders the four fixed sections with counts and the right nouns, and hides an empty Collections', () => {
    const onFocusSection = vi.fn()
    const { container } = render(<JobsStagesJumpStrip counts={counts} onFocusSection={onFocusSection} />)
    expect(screen.getByLabelText('Jump to Waiting, 21 jobs')).toBeTruthy()
    expect(screen.getByLabelText('Jump to Working, 33 jobs')).toBeTruthy()
    expect(screen.getByLabelText('Jump to Ready to Bill, 0 rows')).toBeTruthy()
    expect(screen.getByLabelText('Jump to Billed Awaiting Payment, 66 rows')).toBeTruthy()
    expect(screen.queryByLabelText(/Jump to Collections/)).toBeNull()
    expect(container.textContent).toContain('(66)')
    expect([...container.querySelectorAll('span[aria-hidden]')].filter((s) => s.textContent?.trim() === '→').length).toBe(3)
    fireEvent.click(screen.getByLabelText('Jump to Billed Awaiting Payment, 66 rows'))
    expect(onFocusSection).toHaveBeenCalledWith('billed')
  })

  it('shows Collections in red with its own arrow once it has rows, and reports "…" counts as given', () => {
    const onFocusSection = vi.fn()
    const { container } = render(<JobsStagesJumpStrip counts={{ ...counts, billed: '…', collections: '8' }} onFocusSection={onFocusSection} />)
    const collections = screen.getByLabelText('Jump to Collections, 8 rows')
    expect(collections.style.color).toBe('var(--text-red-700)')
    expect(screen.getByLabelText('Jump to Billed Awaiting Payment, … rows')).toBeTruthy()
    expect([...container.querySelectorAll('span[aria-hidden]')].filter((s) => s.textContent?.trim() === '→').length).toBe(4)
    fireEvent.click(collections)
    expect(onFocusSection).toHaveBeenCalledWith('collections')
  })
})
