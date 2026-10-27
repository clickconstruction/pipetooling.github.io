// @vitest-environment jsdom
/**
 * The foot of a waiver's on-screen page (v2.5987): a drawn signature shows its ink, a typed or code signature writes the
 * name in the cursive face on the line (the live walk found the page bare while the print carried it), and an unsigned
 * foot keeps the empty line.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LienWaiverFootPreview } from './LienWaiverFootPreview'

const foot = { name: 'Malachi Whites', company: 'Click Plumbing and Electrical', title: null, signed: 'Signed October 27, 2026' }

describe('LienWaiverFootPreview', () => {
  it('writes a typed or code signature in the cursive face above the rule', () => {
    render(<LienWaiverFootPreview foot={foot} typedName="Malachi Whites" />)
    const typed = screen.getByTestId('lien-waiver-foot-typed')
    expect(typed.textContent).toBe('Malachi Whites')
    expect(typed.style.fontFamily).toContain('Great Vibes')
    expect(screen.queryByTestId('lien-waiver-foot-ink')).toBeNull()
  })

  it('shows a drawn signature as its ink, ahead of any typed name', () => {
    render(<LienWaiverFootPreview foot={foot} inkUrl="data:image/png;base64,INK" typedName="Malachi Whites" />)
    expect(screen.getByTestId('lien-waiver-foot-ink').getAttribute('src')).toBe('data:image/png;base64,INK')
    expect(screen.queryByTestId('lien-waiver-foot-typed')).toBeNull()
  })

  it('keeps the empty line on an unsigned foot', () => {
    render(<LienWaiverFootPreview foot={{ ...foot, signed: null }} />)
    expect(screen.queryByTestId('lien-waiver-foot-typed')).toBeNull()
    expect(screen.queryByTestId('lien-waiver-foot-ink')).toBeNull()
    expect(screen.getByTestId('lien-waiver-foot').textContent).toContain('Signed ______________________')
  })
})
