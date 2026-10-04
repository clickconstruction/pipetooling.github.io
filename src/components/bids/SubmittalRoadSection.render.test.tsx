// @vitest-environment jsdom
/**
 * Render smoke for one step of the Submittals road, moved out of `BidsSubmittalsTab.tsx`
 * (2026-10-04): the dot, the title that jumps, the caret that folds, the summary, the sentence
 * with its ?, and the body that draws only when open and not empty.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RoadSection } from './SubmittalRoadSection'

describe('RoadSection', () => {
  it('a done step folded: the tick, its summary and sentence, no body; the title jumps, the caret folds, the ? helps', () => {
    const onToggle = vi.fn()
    const onJump = vi.fn()
    const onHelp = vi.fn()
    render(
      <RoadSection n={4} title="Package" status="done" open={false} onToggle={onToggle} onJump={onJump} anchor="submittals-package-section" summary="built" about="One PDF for the GC." onHelp={onHelp}>
        <button type="button">Build package</button>
      </RoadSection>,
    )
    const section = screen.getByTestId('road-4')
    expect(section.getAttribute('data-status')).toBe('done')
    expect(section.getAttribute('data-open')).toBe('false')
    expect(section.getAttribute('data-tour')).toBe('submittals-package-section')
    expect(screen.queryByTestId('road-4-body')).toBeNull()
    expect(screen.getByTestId('road-4-about').textContent).toContain('One PDF for the GC.')
    expect(section.textContent).toContain('built')
    fireEvent.click(screen.getByTestId('road-4-title'))
    expect(onJump).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Unfold step 4' }))
    expect(onToggle).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Walk me through step 4' }))
    expect(onHelp).toHaveBeenCalledTimes(1)
  })

  it('open, the body draws; an open step with nothing in it draws no box', () => {
    const props = { n: 5, title: 'Share', status: 'current' as const, open: true, onToggle: () => {}, onJump: () => {}, anchor: 'submittals-share-section', summary: 'not shared yet' }
    const { rerender } = render(<RoadSection {...props}><button type="button">Share</button></RoadSection>)
    expect(screen.getByTestId('road-5-body').textContent).toBe('Share')
    expect(screen.getByRole('button', { name: 'Fold step 5' })).toBeTruthy()
    rerender(<RoadSection {...props}>{null}</RoadSection>)
    expect(screen.queryByTestId('road-5-body')).toBeNull()
  })
})
