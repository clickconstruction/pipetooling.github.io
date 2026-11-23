// @vitest-environment jsdom
/**
 * Render smoke for the top of the screen a look at another person's Task Mode draws (punch list #425):
 * the mode row with Task Mode filled for a role that has the row, the green strip for the estimator,
 * and neither until the person's role is read. Nothing in it can be pressed to change a mode.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TaskModeLookWindow } from './TaskModeLookWindow'

const realMatchMedia = window.matchMedia
beforeEach(() => {
  // A desk: jsdom has no `matchMedia`, and the window asks it for the screen's width.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  // The window holds the page still while it is open, and gives the scroll back as it closes.
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
})
afterEach(() => {
  cleanup()
  window.matchMedia = realMatchMedia
})

function look(top?: 'row' | 'strip') {
  return render(
    <TaskModeLookWindow personName="Dana Sample" readAt={new Date('2026-11-23T09:00:00')} onReadAgain={vi.fn()} onClose={vi.fn()} top={top}>
      <p>The day</p>
    </TaskModeLookWindow>,
  )
}

const thirds = () => screen.queryAllByRole('button').filter((b) => b.hasAttribute('data-mode-third'))

describe('the top of a look at a person’s Task Mode', () => {
  it('is the mode row with Task Mode filled for a role that has the row, and no strip', () => {
    look('row')
    expect(thirds().map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Task Mode', 'true'],
      ['Dashboard', 'false'],
      ['Job Mode', 'false'],
    ])
    expect(screen.queryByRole('status', { name: 'Task Mode is on' })).toBeNull()
    // A press on a third changes nothing: the look stops it, and the row has no press of its own here.
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
    expect(thirds().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
  })

  it('is the green strip for the estimator, who has no row', () => {
    look('strip')
    expect(screen.getByRole('status', { name: 'Task Mode is on' })).toBeTruthy()
    expect(thirds().length).toBe(0)
  })

  it('is neither until the person’s role is read', () => {
    look()
    expect(screen.queryByRole('status', { name: 'Task Mode is on' })).toBeNull()
    expect(thirds().length).toBe(0)
    expect(screen.getByText('The day')).toBeTruthy()
  })
})
