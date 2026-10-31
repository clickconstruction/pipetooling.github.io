// @vitest-environment jsdom
/**
 * Render smoke for the Legal desk's shared money (v2.6192): the headline balance draws its cents smaller
 * than the dollars, and a copy still yields the whole figure.
 */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { LegalMoneySmallCents } from './legalDeskShared'

describe('LegalMoneySmallCents', () => {
  it('draws the whole figure with the cents in a smaller span', () => {
    const { container } = render(<LegalMoneySmallCents value={2976.34} />)
    expect(container.textContent).toBe('$2,976.34')
    const small = container.querySelector('[data-legal-cents]') as HTMLElement | null
    expect(small?.textContent).toBe('.34')
    expect(small?.style.fontSize).toBe('0.7em')
  })

  it('keeps the true minus sign before the dollar on a negative figure', () => {
    const { container } = render(<LegalMoneySmallCents value={-1234.5} />)
    expect(container.textContent).toBe('−$1,234.50')
    expect(container.querySelector('[data-legal-cents]')?.textContent).toBe('.50')
  })
})
