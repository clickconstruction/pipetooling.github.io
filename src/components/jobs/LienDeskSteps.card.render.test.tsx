// @vitest-environment jsdom
/**
 * A To do row's step card opens where it can be read (v2.7425; found on the walk of 2026-11-15 that Taunya asked
 * for): under its row when it fits there, over the row when the row is low on the screen. The rule is
 * `lienStepCardPlace.test.ts`; this is the wiring.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { LienStepCardView } from './LienDeskSteps'
import type { LienStepCard } from '../../lib/jobs/lienNextUpSteps'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const CARD = { ladder: 'notice', kindWords: 'Notice', title: 'ZZ Test Job', deadline: 'In the mail by Nov 16', tone: 'red', items: [], blocked: null, foot: 'Step 1 of 4' } as unknown as LienStepCard

/** jsdom lays nothing out: the card stands this tall. */
function tall(px: number) {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.getAttribute('data-testid') === 'lien-step-card' ? px : 0
  })
}

describe('LienStepCardView · the card beside a row (v2.7425)', () => {
  it('a row with room under it opens its card under, where it always was', () => {
    tall(387)
    render(<LienStepCardView card={CARD} place={{ top: 206, left: 40, mark: { top: 180, under: 500, over: 60 } }} onClose={() => {}} />)
    const card = screen.getByTestId('lien-step-card')
    expect(card.getAttribute('data-side')).toBe('under')
    expect(card.style.top).toBe('206px')
    expect(card.style.visibility).toBe('visible')
  })

  it('a row at the foot of the screen opens its card over the row: its foot a gap over the mark', () => {
    tall(387)
    render(<LienStepCardView card={CARD} place={{ top: 2718, left: 40, mark: { top: 2692, under: 2, over: 560 } }} onClose={() => {}} />)
    const card = screen.getByTestId('lien-step-card')
    expect(card.getAttribute('data-side')).toBe('over')
    // 2692 − 6 − 387: the card ends 6 px over the mark's top.
    expect(card.style.top).toBe('2299px')
  })

  it('a place with no mark measured stays under, and a phone’s sheet is not placed at all', () => {
    tall(387)
    const view = render(<LienStepCardView card={CARD} place={{ top: 206, left: 40 }} onClose={() => {}} />)
    expect(screen.getByTestId('lien-step-card').getAttribute('data-side')).toBe('under')
    view.unmount()
    render(<LienStepCardView card={CARD} place="sheet" onClose={() => {}} />)
    const sheet = screen.getByTestId('lien-step-card')
    expect(sheet.getAttribute('data-place')).toBe('sheet')
    expect(sheet.getAttribute('data-side')).toBeNull()
  })
})
