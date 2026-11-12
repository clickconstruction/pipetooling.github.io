// @vitest-environment jsdom
/**
 * Punch list #217, outside-1 (a prototype): the office's invoice preview draws the contract line beside each scaled
 * share on `?shape=1`, today's table over it on the side-by-side, and today's table alone with no flag.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PhysicalInvoicePreview } from './PhysicalInvoicePreview'
import { sampleProgressBillDocument } from '../../lib/journeys/paperSamples'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()
afterEach(cleanup)

describe('PhysicalInvoicePreview · a progress bill’s share', () => {
  const doc = sampleProgressBillDocument('2026-10-30')

  it('draws today’s scaled lines with no flag', () => {
    const { container } = render(<PhysicalInvoicePreview document={doc} />)
    expect(screen.queryByTestId('physical-invoice-share')).toBeNull()
    expect(container.textContent).toContain('Water closet, wall-hung')
    expect(container.textContent).not.toContain('In the contract')
  })

  it('draws the shape on ?shape=1: the headline once, the contract line with its count, and the two sums', () => {
    render(<PhysicalInvoicePreview document={doc} shape={{ shape: true, sideBySide: false }} />)
    const share = screen.getByTestId('physical-invoice-share')
    expect(share.textContent).toContain('This bill: $20,266, 32% of the $63,332 contract.')
    expect(share.textContent).toContain('24 × $1,180 = $28,320')
    expect(share.textContent).toContain('This bill · 32%')
    expect(share.textContent).toContain('Contract · this bill$63,332.00$20,266.00')
  })

  it('draws today over the shape on the side-by-side', () => {
    render(<PhysicalInvoicePreview document={doc} shape={{ shape: false, sideBySide: true }} />)
    const sbs = screen.getByTestId('prototype-side-by-side')
    expect(sbs.querySelector('[data-side="today"]')?.textContent).toContain('Qty')
    expect(sbs.querySelector('[data-side="shape"]')?.textContent).toContain('In the contract')
  })
})
