// @vitest-environment jsdom
/**
 * Render smoke for one step of the Submittals road, moved out of `BidsSubmittalsTab.tsx`
 * (2026-10-04): the dot, the title that jumps, the caret that folds, the summary, the sentence
 * with its ?, and the body that draws only when open and not empty. A folded step is one line
 * (2026-10-05); an open one can drop a summary its contents already say.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RoadSection } from './SubmittalRoadSection'

describe('RoadSection', () => {
  it('a done step folded is one line: the tick and its summary, no sentence, no ?, no body; the title jumps and the caret unfolds', () => {
    const onToggle = vi.fn()
    const onJump = vi.fn()
    render(
      <RoadSection n={4} title="Package" status="done" open={false} onToggle={onToggle} onJump={onJump} anchor="submittals-package-section" summary="built" about="One PDF for the GC." onHelp={() => {}}>
        <button type="button">Build package</button>
      </RoadSection>,
    )
    const section = screen.getByTestId('road-4')
    expect(section.getAttribute('data-status')).toBe('done')
    expect(section.getAttribute('data-open')).toBe('false')
    expect(section.getAttribute('data-tour')).toBe('submittals-package-section')
    expect(screen.queryByTestId('road-4-body')).toBeNull()
    expect(screen.queryByTestId('road-4-about')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Walk me through step 4' })).toBeNull()
    expect(section.textContent).toBe('4 · Package▾built')
    fireEvent.click(screen.getByTestId('road-4-title'))
    expect(onJump).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Unfold step 4' }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('open, a step shows its sentence and its own ?, which starts the walkthrough there', () => {
    const onHelp = vi.fn()
    render(
      <RoadSection n={4} title="Package" status="current" open onToggle={() => {}} onJump={() => {}} anchor="submittals-package-section" summary="not built yet" about="One PDF for the GC." onHelp={onHelp}>
        <button type="button">Build package</button>
      </RoadSection>,
    )
    expect(screen.getByTestId('road-4-about').textContent).toContain('One PDF for the GC.')
    // The summary stays unless the step says its contents already carry it.
    expect(screen.getByTestId('road-4').textContent).toContain('not built yet')
    fireEvent.click(screen.getByRole('button', { name: 'Walk me through step 4' }))
    expect(onHelp).toHaveBeenCalledTimes(1)
  })

  it('a step whose contents say what its summary says shows the summary only while folded', () => {
    const props = { n: 1, title: 'Where the rows come from', status: 'done' as const, onToggle: () => {}, onJump: () => {}, anchor: 'submittals-schedule', summary: '26 on the takeoff · no schedule yet', summaryWhenOpen: false }
    const { rerender } = render(<RoadSection {...props} open={false}><span>The takeoff · 26 fixtures</span></RoadSection>)
    expect(screen.getByTestId('road-1').textContent).toContain('26 on the takeoff · no schedule yet')
    rerender(<RoadSection {...props} open><span>The takeoff · 26 fixtures</span></RoadSection>)
    expect(screen.getByTestId('road-1').textContent).not.toContain('26 on the takeoff')
    expect(screen.getByTestId('road-1-body').textContent).toBe('The takeoff · 26 fixtures')
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
