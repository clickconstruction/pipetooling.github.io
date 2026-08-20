// @vitest-environment jsdom
/**
 * v2.1922: the customer document's heading follows doc kind. A change order
 * whose stored title still carries the estimate default ("Estimate for X")
 * renders "Change Order for X"; a standard estimate keeps its title verbatim;
 * hand-written CO titles pass through untouched.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import EstimateCustomerDocument from './EstimateCustomerDocument'
import { EMPTY_ESTIMATE_CHANGE_ORDER_FIELDS } from '../../lib/estimateChangeOrder'

const baseProps = {
  forLine: '415 Springtown Way, San Marcos, TX 78666',
  validUntil: null,
  lineItemsSnapshot: [
    { line_item: 'Deep cleaning of AC units', description: '', quantity: 1, unit_price_cents: 198000, amount_cents: 198000 },
  ],
  termsSnapshot: '',
  totalCents: 198000,
}

afterEach(() => {
  cleanup()
})

describe('EstimateCustomerDocument heading vs doc kind', () => {
  it('rewrites the estimate-default title on a change order', () => {
    render(
      <EstimateCustomerDocument
        {...baseProps}
        title="Estimate for Knight Contracting"
        changeOrder={EMPTY_ESTIMATE_CHANGE_ORDER_FIELDS}
      />,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Change Order for Knight Contracting')
  })

  it('keeps the title verbatim on a standard estimate', () => {
    render(<EstimateCustomerDocument {...baseProps} title="Estimate for Knight Contracting" />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Estimate for Knight Contracting')
  })

  it('keeps a hand-written change-order title', () => {
    render(
      <EstimateCustomerDocument
        {...baseProps}
        title="CO #2 — AC coil cleaning"
        changeOrder={EMPTY_ESTIMATE_CHANGE_ORDER_FIELDS}
      />,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('CO #2 — AC coil cleaning')
  })
})
