// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CardChargeCostAmount } from './CardChargeCostAmount'

describe('CardChargeCostAmount', () => {
  it('a purchase (negative at the bank) reads as plain cost with no mark', () => {
    const { container } = render(<CardChargeCostAmount amount={-37.99} />)
    expect(container.textContent).toBe('37.99')
    expect(screen.queryByTestId('card-refund-mark')).toBeNull()
  })

  it('a refund (positive at the bank) reads negative and carries the refund mark (v2.3519)', () => {
    const { container } = render(<CardChargeCostAmount amount={40} dollarSign />)
    expect(container.textContent).toBe('−$40.00refund')
    expect(screen.getByTestId('card-refund-mark').textContent).toBe('refund')
  })

  it('a string amount from PostgREST and a null both render without throwing', () => {
    expect(render(<CardChargeCostAmount amount="-12.5" />).container.textContent).toBe('12.50')
    expect(render(<CardChargeCostAmount amount={null} />).container.textContent).toBe('0.00')
  })
})
