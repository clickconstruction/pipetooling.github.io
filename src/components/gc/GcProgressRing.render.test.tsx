// @vitest-environment jsdom
/**
 * Render smoke for the ring at the head of a Project Board row (the Board's B2b-vi-c, the design spike's `GcProgressRing`):
 * the count in the middle, its headline as its name, the card a press pins open with each type's done of total and what is
 * left, Escape letting it go, and the hollow check over a full ring's count.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GcProgressRing } from './GcProgressRing'
import { RING_COLORS, stageProgress } from '../../lib/gc/progress'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()
afterEach(cleanup)

const ringFor = (id: string) => {
  const state = initialGcState()
  const p = state.projects.find((x) => x.id === id)!
  return { progress: stageProgress(state, p), color: RING_COLORS[p.stage] }
}

describe('GcProgressRing', () => {
  it('shows the count, and a press pins the card with what is done and what is left', () => {
    const { progress, color } = ringFor('boerne')
    const { container } = render(<GcProgressRing progress={progress} color={color} stageLabel="Bidding to the customer" />)
    expect(screen.getByText('14/25')).toBeTruthy()
    const ring = screen.getByRole('button', { name: '14 of 25 steps done before our bid can go in. Show what is done and what is left.' })
    expect(ring.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(ring)
    const card = screen.getByRole('dialog', { name: 'What is done and what is left' })
    expect(within(card).getByText('Get 2 quotes for each trade')).toBeTruthy()
    expect(within(card).getByText('4 of 7')).toBeTruthy()
    expect(within(card).getAllByText('Structural steel')).toHaveLength(2)
    expect(within(card).getByText('3 companies need a call. See Follow up.')).toBeTruthy()
    fireEvent.keyDown(ring, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(container.querySelector('path')).toBeNull()
  })

  it('draws a hollow check over a full ring’s count', () => {
    const { progress, color } = ringFor('stoneoak')
    const { container } = render(<GcProgressRing progress={progress} color={color} stageLabel="Building" />)
    expect(progress.share).toBe(1)
    expect(screen.getByText('%')).toBeTruthy()
    expect(container.querySelector('path')).not.toBeNull()
  })
})
