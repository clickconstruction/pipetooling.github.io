// @vitest-environment jsdom
/**
 * Render smoke for the pipe wordmark (v2.3583): the SVG is an image named by the word, the pipe
 * is currentColor, the three handwheels wear the accent, and a word with a missing glyph falls
 * back to plain text.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { PipeWordmark } from './PipeWordmark'
import AuthPublicLandingLayout from './AuthPublicLandingLayout'

describe('PipeWordmark (v2.3583)', () => {
  it('draws the sign-in title as an image named by the word, with three red wheels', () => {
    render(<PipeWordmark word="ClickPlumbing.com" />)
    const svg = screen.getByRole('img', { name: 'ClickPlumbing.com' })
    expect(svg.tagName.toLowerCase()).toBe('svg')
    expect(svg.querySelector('path')?.getAttribute('stroke')).toBe('currentColor')
    expect(svg.querySelectorAll('[data-testid="pipe-wheel"]')).toHaveLength(3)
    expect(svg.querySelector('[data-testid="pipe-wheel"] circle')?.getAttribute('stroke')).toBe('#d21f1f')
  })

  it('falls back to text when a character has no glyph', () => {
    render(<PipeWordmark word="Zed" />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('Zed')).toBeTruthy()
  })

  it('the landing layout wraps it in the title link and keeps the word for screen readers', () => {
    render(
      <AuthPublicLandingLayout titleLinkText="ClickPlumbing.com" titleLinkAriaLabel="ClickPlumbing.com — visit Click Plumbing (opens in new tab)">
        <div>body</div>
      </AuthPublicLandingLayout>,
    )
    const link = screen.getByRole('link', { name: 'ClickPlumbing.com — visit Click Plumbing (opens in new tab)' })
    expect(link.getAttribute('href')).toBe('https://clickplumbing.com')
    expect(link.querySelector('svg[data-testid="pipe-wordmark"]')).toBeTruthy()
    expect(link.querySelector('.auth-public-landing__title-text')?.textContent).toBe('ClickPlumbing.com')
  })
})
