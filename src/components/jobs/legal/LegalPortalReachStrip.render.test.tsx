// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import LegalPortalReachStrip from './LegalPortalReachStrip'
import { emptyOfficeContacts } from '../../../lib/legal/legalOfficeContacts'

describe('LegalPortalReachStrip', () => {
  it('names the office line with who to ask for, the controller with their number, and what each is for', () => {
    render(<LegalPortalReachStrip contacts={{ phone: '(512) 360-0599', assistants: ['Robin Ortega', 'Casey Lindell'], controllers: [{ name: 'Robert Douglas', phone: '+1 617 939 6295' }] }} />)
    const strip = document.querySelector('[data-legal-reach-strip]')!
    expect(strip.textContent).toContain('Reach the office')
    expect(screen.getByRole('link', { name: '(512) 360-0599' }).getAttribute('href')).toBe('tel:+15123600599')
    expect(strip.textContent).toContain('ask for Robin or Casey')
    expect(strip.textContent).toContain('Controller · settlements and payments')
    expect(strip.textContent).toContain('Robert Douglas')
    expect(screen.getByRole('link', { name: '(617) 939-6295' }).getAttribute('href')).toBe('tel:+16179396295')
    expect(strip.textContent).toContain('The office in business hours. Robert when the office does not answer.')
  })

  it('an older payload shows the office number alone; no number at all draws nothing', () => {
    const { unmount } = render(<LegalPortalReachStrip contacts={emptyOfficeContacts('(512) 360-0599')} />)
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(document.querySelector('[data-legal-reach-strip]')!.textContent).not.toContain('ask for')
    unmount()
    render(<LegalPortalReachStrip contacts={emptyOfficeContacts()} />)
    expect(document.querySelector('[data-legal-reach-strip]')).toBeNull()
  })
})
