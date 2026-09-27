// @vitest-environment jsdom
/**
 * Render smokes for the phone fold (v2.3882): bare children when not folding,
 * one line with the headline when folding, the body kept mounted while
 * closed, and the open state remembered per device.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PhoneFold } from './PhoneFold'

afterEach(cleanup)
beforeEach(() => localStorage.clear())

const body = <p data-testid="body">the section</p>

describe('PhoneFold', () => {
  it('renders the children bare when it is not folding', () => {
    const { container } = render(
      <PhoneFold fold={false} section="my-inbox" userId="u1" title="My Inbox" headline={{ words: 'due today 2', tone: 'amber' }}>
        {body}
      </PhoneFold>,
    )
    expect(container.querySelector('[data-phone-fold]')).toBeNull()
    expect(screen.getByTestId('body')).toBeTruthy()
  })

  it('folds to one line with the headline, keeps the body mounted, and opens in place', () => {
    const { container } = render(
      <PhoneFold fold section="my-inbox" userId="u1" title="My Inbox" headline={{ words: 'due today 2 · overdue 1', tone: 'red' }}>
        {body}
      </PhoneFold>,
    )
    const btn = screen.getByRole('button', { name: /My Inbox · due today 2 · overdue 1/ })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(btn.textContent).toContain('Open ▾')
    const host = container.querySelector('#phone-fold-my-inbox') as HTMLElement
    expect(host.hidden).toBe(true)
    expect(host.querySelector('[data-testid="body"]')).toBeTruthy() // mounted while folded
    fireEvent.click(btn)
    expect(host.hidden).toBe(false)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect(localStorage.getItem('pipetooling_phone_fold_my-inbox_u1')).toBe('open')
  })

  it('opens as the device left it, and says only the name while the count loads', () => {
    localStorage.setItem('pipetooling_phone_fold_teams-inbox_u1', 'open')
    const { container } = render(
      <PhoneFold fold section="teams-inbox" userId="u1" title="Team inboxes" headline={null}>
        {body}
      </PhoneFold>,
    )
    expect((container.querySelector('#phone-fold-teams-inbox') as HTMLElement).hidden).toBe(false)
    const btn = screen.getByRole('button')
    expect(btn.textContent).toBe('Team inboxesClose ▴')
    fireEvent.click(btn)
    expect(localStorage.getItem('pipetooling_phone_fold_teams-inbox_u1')).toBeNull()
  })
})
