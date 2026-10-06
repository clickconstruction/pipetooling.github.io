// @vitest-environment jsdom
/**
 * § Rules as a window (v2.4634): the door opens the rules guide over the desk at the rule for
 * what is on screen, the find box marks and narrows, Enter walks the matches, Esc closes it alone.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders as render } from '../../test/renderSmokeMocks'
import { LienRulesDoor } from './LienRulesDoor'

afterEach(cleanup)

describe('LienRulesDoor', () => {
  it('opens the rules in a window at the rule for the surface, not a new page', async () => {
    render(<LienRulesDoor where="desk_notice" />)
    const door = screen.getByTestId('lien-rules-door')
    expect(door.tagName).toBe('BUTTON')
    expect(screen.queryByTestId('lien-rules-modal')).toBeNull()
    fireEvent.click(door)
    expect(screen.getByTestId('lien-rules-modal')).toBeTruthy()
    expect(screen.getByTestId('lien-rules-modal-at').textContent).toBe('The § 53.056 notice')
    const body = screen.getByTestId('lien-rules-body')
    expect(body.textContent).toContain('Every lien deadline and every line in a demand letter comes from a rule in Texas law.')
    expect(body.querySelector('[data-rule-opened="yes"]')?.textContent).toBe('The § 53.056 notice')
    expect((screen.getByTestId('lien-rules-open-page') as HTMLAnchorElement).getAttribute('target')).toBe('_blank')
  })
  it('the find box marks and narrows, Show all brings the guide back, and Esc closes the window alone', async () => {
    vi.useFakeTimers()
    try {
      render(<LienRulesDoor where="desk_affidavit" />)
      fireEvent.click(screen.getByTestId('lien-rules-door'))
      expect(screen.getByTestId('lien-rules-modal-at').textContent).toBe('The affidavit')
      const body = screen.getByTestId('lien-rules-body')
      const all = body.children.length
      fireEvent.change(screen.getByTestId('lien-rules-find'), { target: { value: 'homestead' } })
      await act(async () => {
        vi.advanceTimersByTime(200)
      })
      const marks = body.querySelectorAll('mark[data-find]')
      expect(marks.length).toBeGreaterThan(0)
      expect(screen.getByTestId('lien-rules-found').textContent).toMatch(/^\d+ matches in \d+ sections$/)
      const hidden = Array.from(body.children).filter((el) => (el as HTMLElement).hidden).length
      expect(hidden).toBeGreaterThan(0)
      expect(hidden).toBeLessThan(all)
      fireEvent.keyDown(screen.getByTestId('lien-rules-find'), { key: 'Enter' })
      expect(body.querySelectorAll('mark[data-find-at="yes"]')).toHaveLength(1)
      fireEvent.click(screen.getByRole('button', { name: 'Show all' }))
      await act(async () => {
        vi.advanceTimersByTime(200)
      })
      expect(body.querySelectorAll('mark[data-find]')).toHaveLength(0)
      expect(Array.from(body.children).filter((el) => (el as HTMLElement).hidden)).toHaveLength(0)
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(screen.queryByTestId('lien-rules-modal')).toBeNull()
      expect(screen.getByTestId('lien-rules-door')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})
