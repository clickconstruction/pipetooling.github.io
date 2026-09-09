// @vitest-environment jsdom
/**
 * Render smokes for AmountSmallCents / SignedAmountSmallCents (v2.3180).
 */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { AmountSmallCents, SignedAmountSmallCents } from './AmountSmallCents'

describe('AmountSmallCents', () => {
  it('renders the whole amount with the cents in a smaller span', () => {
    const { container } = render(<AmountSmallCents value={48700} />)
    expect(container.textContent).toBe('$48,700.00')
    const small = container.querySelector('span')
    expect(small?.textContent).toBe('.00')
    expect(small?.style.fontSize).toBe('0.7em')
  })
})

describe('SignedAmountSmallCents', () => {
  it('puts a true minus sign before the $ on a loss and keeps the small cents', () => {
    const { container } = render(<SignedAmountSmallCents value={-1234.5} />)
    expect(container.textContent).toBe('−$1,234.50')
    expect(container.querySelector('span')?.textContent).toBe('.50')
  })
  it('renders an em dash for a missing figure and no sign for zero', () => {
    expect(render(<SignedAmountSmallCents value={null} />).container.textContent).toBe('—')
    expect(render(<SignedAmountSmallCents value={undefined} />).container.textContent).toBe('—')
    expect(render(<SignedAmountSmallCents value={0} />).container.textContent).toBe('$0.00')
  })
})
